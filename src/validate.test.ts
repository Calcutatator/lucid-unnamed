import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  validateListeningHeart,
  ValidateInputSchema,
  NoteSchema,
  type Note,
} from "./validate";

// Mock fetch for testing
const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response) {
  globalThis.fetch = mock((url: string) => Promise.resolve(handler(url))) as any;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

const sampleNote: Note = {
  id: "note-1",
  taskId: "0xabc123",
  content: "This is a test note",
  type: "general",
  walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  createdAt: "2026-03-10T00:00:00Z",
};

describe("ValidateInputSchema", () => {
  it("accepts valid input with taskId", () => {
    const result = ValidateInputSchema.safeParse({ taskId: "0xabc123" });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with taskId and walletAddress", () => {
    const result = ValidateInputSchema.safeParse({
      taskId: "0xabc123",
      walletAddress: "0x1234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty taskId", () => {
    const result = ValidateInputSchema.safeParse({ taskId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing taskId", () => {
    const result = ValidateInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("validateListeningHeart", () => {
  beforeEach(() => {
    restoreFetch();
  });

  it("returns valid=true when notes exist for a task", async () => {
    mockFetch((url: string) => {
      if (url.includes("/stats")) {
        return new Response(
          JSON.stringify({ noteCount: 1, uniqueContributors: 1 })
        );
      }
      return new Response(JSON.stringify([sampleNote]));
    });

    const result = await validateListeningHeart({ taskId: "0xabc123" });
    expect(result.valid).toBe(true);
    expect(result.noteCount).toBe(1);
    expect(result.uniqueContributors).toBe(1);
    expect(result.notes).toHaveLength(1);

    restoreFetch();
  });

  it("returns valid=false when no notes exist", async () => {
    mockFetch((url: string) => {
      if (url.includes("/stats")) {
        return new Response(
          JSON.stringify({ noteCount: 0, uniqueContributors: 0 })
        );
      }
      return new Response(JSON.stringify([]));
    });

    const result = await validateListeningHeart({ taskId: "0xabc123" });
    expect(result.valid).toBe(false);
    expect(result.noteCount).toBe(0);
    expect(result.error).toBeDefined();

    restoreFetch();
  });

  it("filters notes by wallet address when provided", async () => {
    const otherNote: Note = {
      ...sampleNote,
      id: "note-2",
      walletAddress: "0xother",
    };

    mockFetch((url: string) => {
      if (url.includes("/stats")) {
        return new Response(
          JSON.stringify({ noteCount: 2, uniqueContributors: 2 })
        );
      }
      return new Response(JSON.stringify([sampleNote, otherNote]));
    });

    const result = await validateListeningHeart({
      taskId: "0xabc123",
      walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
    });
    expect(result.valid).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes![0].walletAddress).toBe(sampleNote.walletAddress);

    restoreFetch();
  });

  it("returns valid=false when wallet filter yields no matches", async () => {
    mockFetch((url: string) => {
      if (url.includes("/stats")) {
        return new Response(
          JSON.stringify({ noteCount: 1, uniqueContributors: 1 })
        );
      }
      return new Response(JSON.stringify([sampleNote]));
    });

    const result = await validateListeningHeart({
      taskId: "0xabc123",
      walletAddress: "0xnonexistent",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("No notes found for wallet");

    restoreFetch();
  });

  it("handles fetch errors gracefully", async () => {
    mockFetch(() => {
      return new Response("Not Found", { status: 404, statusText: "Not Found" });
    });

    const result = await validateListeningHeart({ taskId: "0xbadtask" });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.noteCount).toBe(0);

    restoreFetch();
  });

  it("handles network errors gracefully", async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("Network error"))
    ) as any;

    const result = await validateListeningHeart({ taskId: "0xabc123" });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Network error");

    restoreFetch();
  });
});
