import { z } from "zod";

// --- Schemas ---

export const EvalNoteSchema = z.object({
  eval: z.object({
    endpoint_live: z.boolean(),
    x402_gate: z.boolean(),
    x402_v2_valid: z.boolean(),
    paid_call_success: z.boolean(),
  }),
  result: z.enum(["PASS", "FAIL", "PASS_NEEDS_REVIEW"]),
  fail_reason: z.string().nullable(),
  worker: z.string(),
  taskId: z.string(),
  auto_paid: z.boolean(),
});

export type EvalNote = z.infer<typeof EvalNoteSchema>;

export const EvaluateInputSchema = z.object({
  taskId: z.string().min(1),
  submissionUrl: z.string().url(),
  workerAddress: z.string().min(1),
});

export const EvaluateOutputSchema = z.object({
  eval: EvalNoteSchema.shape.eval,
  result: z.enum(["PASS", "FAIL", "PASS_NEEDS_REVIEW"]),
  fail_reason: z.string().nullable(),
  auto_paid: z.boolean(),
});

export type EvaluateInput = z.infer<typeof EvaluateInputSchema>;
export type EvaluateOutput = z.infer<typeof EvaluateOutputSchema>;

// --- Config ---

export interface EvalConfig {
  autopayCeilingCents: number; // reward ceiling in USDC atomic (e.g. 2_000_000 = $2)
  dailyBudgetCents: number;   // daily budget in USDC atomic
  listeningHeartUrl: string;
  evaluatorWallet: string;
  privateKey: string;
}

export function configFromEnv(): EvalConfig {
  return {
    autopayCeilingCents: parseInt(process.env.AUTOPAY_CEILING || "2000000"),
    dailyBudgetCents: parseInt(process.env.DAILY_BUDGET || "15000000"),
    listeningHeartUrl: process.env.LISTENING_HEART_URL || "https://listening-heart.onrender.com",
    evaluatorWallet: process.env.EVALUATOR_WALLET_ADDRESS || "",
    privateKey: process.env.TASKMARKET_PRIVATE_KEY || "",
  };
}

// --- Budget tracking ---

export class DailyBudgetTracker {
  private spent = 0;
  private lastReset: string = new Date().toISOString().slice(0, 10);

  constructor(private dailyLimit: number) {}

  canSpend(amount: number): boolean {
    this.resetIfNewDay();
    return this.spent + amount <= this.dailyLimit;
  }

  record(amount: number): void {
    this.resetIfNewDay();
    this.spent += amount;
  }

  getSpent(): number {
    this.resetIfNewDay();
    return this.spent;
  }

  private resetIfNewDay(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.lastReset) {
      this.spent = 0;
      this.lastReset = today;
    }
  }
}

// --- Evaluated ID tracker ---

export class EvaluatedTracker {
  private seen = new Set<string>();

  has(id: string): boolean {
    return this.seen.has(id);
  }

  add(id: string): void {
    this.seen.add(id);
  }

  size(): number {
    return this.seen.size;
  }
}

// --- Core evaluation logic ---

export interface CheckResults {
  endpoint_live: boolean;
  x402_gate: boolean;
  x402_v2_valid: boolean;
  paid_call_success: boolean;
}

/**
 * Check 1: GET endpoint returns 200
 */
export async function checkEndpointLive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Check 2: POST without payment returns 402 with correct x402 headers
 */
export async function checkX402Gate(url: string): Promise<{
  gate: boolean;
  v2Valid: boolean;
}> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });

    if (res.status !== 402) {
      return { gate: false, v2Valid: false };
    }

    // Parse PAYMENT-REQUIRED header
    const paymentHeader = res.headers.get("payment-required");
    if (!paymentHeader) {
      return { gate: true, v2Valid: false };
    }

    const decoded = parsePaymentRequired(paymentHeader);
    if (!decoded) {
      return { gate: true, v2Valid: false };
    }

    const v2Valid = decoded.x402Version === 2 &&
      Array.isArray(decoded.accepts) &&
      decoded.accepts.some((a: any) => a.network === "eip155:84532");

    return { gate: true, v2Valid };
  } catch {
    return { gate: false, v2Valid: false };
  }
}

/**
 * Parse base64-encoded PAYMENT-REQUIRED header
 */
export function parsePaymentRequired(headerValue: string): any | null {
  try {
    const json = Buffer.from(headerValue, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Check 3: Make a real x402 paid call and verify 200 + valid JSON
 */
export async function checkPaidCall(
  url: string,
  paidFetch: typeof fetch
): Promise<boolean> {
  try {
    const res = await paidFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });

    if (res.status !== 200) return false;

    const body = await res.json();
    return body !== null && typeof body === "object";
  } catch {
    return false;
  }
}

/**
 * Post evaluation note to listening-heart
 */
export async function postEvalNote(
  listeningHeartUrl: string,
  taskId: string,
  note: EvalNote,
  walletAddress: string,
  paidFetch: typeof fetch
): Promise<boolean> {
  try {
    const url = `${listeningHeartUrl}/tasks/${taskId}/notes`;
    const res = await paidFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-address": walletAddress,
      },
      body: JSON.stringify({
        content: JSON.stringify(note),
        type: "general",
      }),
    });
    return res.status === 200 || res.status === 201;
  } catch (e) {
    console.error("Failed to post eval note:", e);
    return false;
  }
}

/**
 * Determine result based on checks and reward
 */
export function determineResult(
  checks: CheckResults,
  rewardAtomic: number,
  autopayCeiling: number,
  budgetTracker: DailyBudgetTracker
): { result: "PASS" | "FAIL" | "PASS_NEEDS_REVIEW"; auto_paid: boolean; fail_reason: string | null } {
  const allPass = checks.endpoint_live && checks.x402_gate && checks.x402_v2_valid && checks.paid_call_success;

  if (!allPass) {
    const reasons: string[] = [];
    if (!checks.endpoint_live) reasons.push("GET endpoint not live (expected 200)");
    if (!checks.x402_gate) reasons.push("POST without payment did not return 402");
    if (!checks.x402_v2_valid) reasons.push("x402 header missing x402Version=2 or network=eip155:84532");
    if (!checks.paid_call_success) reasons.push("Paid call did not return 200 with valid JSON");
    return { result: "FAIL", auto_paid: false, fail_reason: reasons.join("; ") };
  }

  // All checks pass - determine auto-pay eligibility
  if (rewardAtomic > autopayCeiling) {
    return { result: "PASS_NEEDS_REVIEW", auto_paid: false, fail_reason: null };
  }

  if (!budgetTracker.canSpend(rewardAtomic)) {
    return { result: "PASS_NEEDS_REVIEW", auto_paid: false, fail_reason: null };
  }

  return { result: "PASS", auto_paid: true, fail_reason: null };
}

/**
 * Run full evaluation for a single submission
 */
export async function runEvaluation(
  input: EvaluateInput,
  rewardAtomic: number,
  config: EvalConfig,
  budgetTracker: DailyBudgetTracker,
  paidFetch: typeof fetch
): Promise<EvalNote> {
  // Check 1: GET endpoint live
  const endpoint_live = await checkEndpointLive(input.submissionUrl);

  // Check 2: POST without payment → 402 + validate headers
  const { gate: x402_gate, v2Valid: x402_v2_valid } = await checkX402Gate(input.submissionUrl);

  // Check 3: Paid call
  const paid_call_success = await checkPaidCall(input.submissionUrl, paidFetch);

  const checks: CheckResults = { endpoint_live, x402_gate, x402_v2_valid, paid_call_success };
  const { result, auto_paid, fail_reason } = determineResult(
    checks, rewardAtomic, config.autopayCeilingCents, budgetTracker
  );

  const evalNote: EvalNote = {
    eval: checks,
    result,
    fail_reason,
    worker: input.workerAddress,
    taskId: input.taskId,
    auto_paid,
  };

  // Check 4: Post eval note to listening-heart
  await postEvalNote(
    config.listeningHeartUrl,
    input.taskId,
    evalNote,
    config.evaluatorWallet,
    paidFetch
  );

  // If auto-pay approved, record spend
  if (auto_paid) {
    budgetTracker.record(rewardAtomic);
  }

  return evalNote;
}
