import { z } from "zod";

const LISTENING_HEART_BASE_URL = "https://listening-heart.onrender.com";

export const NoteType = z.enum([
  "general",
  "progress",
  "clarification",
  "suggestion",
  "question",
]);

export const ValidateInputSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  walletAddress: z.string().optional(),
});

export const NoteSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  content: z.string(),
  type: z.string(),
  walletAddress: z.string(),
  createdAt: z.string(),
});

export const StatsSchema = z.object({
  noteCount: z.number(),
  uniqueContributors: z.number(),
});

export const ValidateOutputSchema = z.object({
  valid: z.boolean(),
  taskId: z.string(),
  noteCount: z.number(),
  uniqueContributors: z.number(),
  notes: z.array(NoteSchema).optional(),
  error: z.string().optional(),
});

export type ValidateInput = z.infer<typeof ValidateInputSchema>;
export type ValidateOutput = z.infer<typeof ValidateOutputSchema>;
export type Note = z.infer<typeof NoteSchema>;

export async function fetchTaskNotes(taskId: string): Promise<Note[]> {
  const url = `${LISTENING_HEART_BASE_URL}/tasks/${taskId}/notes`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch notes: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.notes ?? [];
}

export async function fetchTaskStats(
  taskId: string
): Promise<{ noteCount: number; uniqueContributors: number }> {
  const url = `${LISTENING_HEART_BASE_URL}/tasks/${taskId}/notes/stats`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function validateListeningHeart(
  input: ValidateInput
): Promise<ValidateOutput> {
  const { taskId, walletAddress } = input;

  try {
    const [notes, stats] = await Promise.all([
      fetchTaskNotes(taskId),
      fetchTaskStats(taskId),
    ]);

    const filteredNotes = walletAddress
      ? notes.filter(
          (n) => n.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        )
      : notes;

    const hasNotes = filteredNotes.length > 0;

    return {
      valid: hasNotes,
      taskId,
      noteCount: stats.noteCount,
      uniqueContributors: stats.uniqueContributors,
      notes: filteredNotes.length > 0 ? filteredNotes : undefined,
      error: hasNotes
        ? undefined
        : walletAddress
          ? `No notes found for wallet ${walletAddress} on task ${taskId}`
          : `No notes found on task ${taskId}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      taskId,
      noteCount: 0,
      uniqueContributors: 0,
      error: message,
    };
  }
}
