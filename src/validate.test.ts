import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  checkEndpointLive,
  checkX402Gate,
  checkPaidCall,
  parsePaymentRequired,
  determineResult,
  DailyBudgetTracker,
  EvaluatedTracker,
  EvalNoteSchema,
  EvaluateInputSchema,
  type CheckResults,
} from "./validate";

// --- Fetch mocking helpers ---
const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = mock((url: string, init?: RequestInit) =>
    Promise.resolve(handler(url, init))
  ) as any;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// --- Schema tests ---
describe("EvaluateInputSchema", () => {
  it("accepts valid input", () => {
    const result = EvaluateInputSchema.safeParse({
      taskId: "0xabc",
      submissionUrl: "https://example.com/api",
      workerAddress: "0x1234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing taskId", () => {
    const result = EvaluateInputSchema.safeParse({
      submissionUrl: "https://example.com",
      workerAddress: "0x1234",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = EvaluateInputSchema.safeParse({
      taskId: "0xabc",
      submissionUrl: "not-a-url",
      workerAddress: "0x1234",
    });
    expect(result.success).toBe(false);
  });
});

describe("EvalNoteSchema", () => {
  it("validates a PASS note", () => {
    const result = EvalNoteSchema.safeParse({
      eval: {
        endpoint_live: true,
        x402_gate: true,
        x402_v2_valid: true,
        paid_call_success: true,
      },
      result: "PASS",
      fail_reason: null,
      worker: "0x1234",
      taskId: "0xabc",
      auto_paid: true,
    });
    expect(result.success).toBe(true);
  });

  it("validates a FAIL note", () => {
    const result = EvalNoteSchema.safeParse({
      eval: {
        endpoint_live: false,
        x402_gate: false,
        x402_v2_valid: false,
        paid_call_success: false,
      },
      result: "FAIL",
      fail_reason: "GET endpoint not live",
      worker: "0x1234",
      taskId: "0xabc",
      auto_paid: false,
    });
    expect(result.success).toBe(true);
  });
});

// --- checkEndpointLive ---
describe("checkEndpointLive", () => {
  it("returns true for 200 response", async () => {
    mockFetch(() => new Response("OK", { status: 200 }));
    expect(await checkEndpointLive("https://example.com")).toBe(true);
  });

  it("returns false for non-200 response", async () => {
    mockFetch(() => new Response("Not Found", { status: 404 }));
    expect(await checkEndpointLive("https://example.com")).toBe(false);
  });

  it("returns false on network error", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("timeout"))) as any;
    expect(await checkEndpointLive("https://example.com")).toBe(false);
  });
});

// --- checkX402Gate ---
describe("checkX402Gate", () => {
  it("returns gate=true, v2Valid=true for valid 402 with x402v2 header", async () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [{ network: "eip155:84532", amount: "1000", asset: "USDC" }],
    };
    const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");

    mockFetch(() => new Response("Payment Required", {
      status: 402,
      headers: { "payment-required": encoded },
    }));

    const result = await checkX402Gate("https://example.com");
    expect(result.gate).toBe(true);
    expect(result.v2Valid).toBe(true);
  });

  it("returns gate=true, v2Valid=false for 402 without proper header", async () => {
    mockFetch(() => new Response("Payment Required", { status: 402 }));

    const result = await checkX402Gate("https://example.com");
    expect(result.gate).toBe(true);
    expect(result.v2Valid).toBe(false);
  });

  it("returns gate=true, v2Valid=false for 402 with wrong version", async () => {
    const paymentRequired = {
      x402Version: 1,
      accepts: [{ network: "eip155:84532" }],
    };
    const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");

    mockFetch(() => new Response("Payment Required", {
      status: 402,
      headers: { "payment-required": encoded },
    }));

    const result = await checkX402Gate("https://example.com");
    expect(result.gate).toBe(true);
    expect(result.v2Valid).toBe(false);
  });

  it("returns gate=true, v2Valid=false for 402 with wrong network", async () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [{ network: "eip155:1" }],
    };
    const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");

    mockFetch(() => new Response("Payment Required", {
      status: 402,
      headers: { "payment-required": encoded },
    }));

    const result = await checkX402Gate("https://example.com");
    expect(result.gate).toBe(true);
    expect(result.v2Valid).toBe(false);
  });

  it("returns gate=false for non-402 response", async () => {
    mockFetch(() => new Response("OK", { status: 200 }));

    const result = await checkX402Gate("https://example.com");
    expect(result.gate).toBe(false);
    expect(result.v2Valid).toBe(false);
  });
});

// --- parsePaymentRequired ---
describe("parsePaymentRequired", () => {
  it("decodes valid base64 JSON", () => {
    const data = { x402Version: 2, accepts: [] };
    const encoded = Buffer.from(JSON.stringify(data)).toString("base64");
    expect(parsePaymentRequired(encoded)).toEqual(data);
  });

  it("returns null for invalid base64", () => {
    expect(parsePaymentRequired("not-valid-base64!!!")).toBeNull();
  });

  it("returns null for non-JSON base64", () => {
    const encoded = Buffer.from("not json").toString("base64");
    expect(parsePaymentRequired(encoded)).toBeNull();
  });
});

// --- checkPaidCall ---
describe("checkPaidCall", () => {
  it("returns true for 200 with valid JSON body", async () => {
    const fakePaidFetch = mock((url: string, init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ result: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
    ) as any;

    expect(await checkPaidCall("https://example.com", fakePaidFetch)).toBe(true);
  });

  it("returns false for non-200 response", async () => {
    const fakePaidFetch = mock(() =>
      Promise.resolve(new Response("error", { status: 500 }))
    ) as any;

    expect(await checkPaidCall("https://example.com", fakePaidFetch)).toBe(false);
  });

  it("returns false on network error", async () => {
    const fakePaidFetch = mock(() =>
      Promise.reject(new Error("network error"))
    ) as any;

    expect(await checkPaidCall("https://example.com", fakePaidFetch)).toBe(false);
  });
});

// --- determineResult ---
describe("determineResult", () => {
  const allPass: CheckResults = {
    endpoint_live: true,
    x402_gate: true,
    x402_v2_valid: true,
    paid_call_success: true,
  };

  it("returns PASS with auto_paid when all pass and reward under ceiling", () => {
    const tracker = new DailyBudgetTracker(15_000_000);
    const result = determineResult(allPass, 1_000_000, 2_000_000, tracker);
    expect(result.result).toBe("PASS");
    expect(result.auto_paid).toBe(true);
    expect(result.fail_reason).toBeNull();
  });

  it("returns PASS_NEEDS_REVIEW when reward above ceiling", () => {
    const tracker = new DailyBudgetTracker(15_000_000);
    const result = determineResult(allPass, 3_000_000, 2_000_000, tracker);
    expect(result.result).toBe("PASS_NEEDS_REVIEW");
    expect(result.auto_paid).toBe(false);
  });

  it("returns PASS_NEEDS_REVIEW when daily budget exceeded", () => {
    const tracker = new DailyBudgetTracker(1_000_000);
    tracker.record(900_000);
    const result = determineResult(allPass, 500_000, 2_000_000, tracker);
    expect(result.result).toBe("PASS_NEEDS_REVIEW");
    expect(result.auto_paid).toBe(false);
  });

  it("returns FAIL when endpoint is not live", () => {
    const checks = { ...allPass, endpoint_live: false };
    const tracker = new DailyBudgetTracker(15_000_000);
    const result = determineResult(checks, 1_000_000, 2_000_000, tracker);
    expect(result.result).toBe("FAIL");
    expect(result.auto_paid).toBe(false);
    expect(result.fail_reason).toContain("GET endpoint not live");
  });

  it("returns FAIL with multiple reasons when multiple checks fail", () => {
    const checks: CheckResults = {
      endpoint_live: false,
      x402_gate: false,
      x402_v2_valid: false,
      paid_call_success: false,
    };
    const tracker = new DailyBudgetTracker(15_000_000);
    const result = determineResult(checks, 1_000_000, 2_000_000, tracker);
    expect(result.result).toBe("FAIL");
    expect(result.fail_reason).toContain("GET endpoint not live");
    expect(result.fail_reason).toContain("POST without payment did not return 402");
  });
});

// --- DailyBudgetTracker ---
describe("DailyBudgetTracker", () => {
  it("allows spending within budget", () => {
    const tracker = new DailyBudgetTracker(10_000_000);
    expect(tracker.canSpend(5_000_000)).toBe(true);
    tracker.record(5_000_000);
    expect(tracker.canSpend(5_000_000)).toBe(true);
    tracker.record(5_000_000);
    expect(tracker.canSpend(1)).toBe(false);
  });

  it("tracks spent amount", () => {
    const tracker = new DailyBudgetTracker(10_000_000);
    tracker.record(3_000_000);
    expect(tracker.getSpent()).toBe(3_000_000);
  });
});

// --- EvaluatedTracker ---
describe("EvaluatedTracker", () => {
  it("tracks seen IDs", () => {
    const tracker = new EvaluatedTracker();
    expect(tracker.has("abc")).toBe(false);
    tracker.add("abc");
    expect(tracker.has("abc")).toBe(true);
    expect(tracker.size()).toBe(1);
  });

  it("handles multiple IDs", () => {
    const tracker = new EvaluatedTracker();
    tracker.add("a");
    tracker.add("b");
    tracker.add("a"); // duplicate
    expect(tracker.size()).toBe(2);
  });
});
