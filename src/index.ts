import { createAgent } from "@lucid-agents/core";
import { http } from "@lucid-agents/http";
import { payments, paymentsFromEnv, createX402Fetch, accountFromPrivateKey } from "@lucid-agents/payments";
import { createAgentApp } from "@lucid-agents/hono";
import {
  EvaluateInputSchema,
  EvaluateOutputSchema,
  configFromEnv,
  DailyBudgetTracker,
  EvaluatedTracker,
  runEvaluation,
  type EvalConfig,
} from "./validate";

// --- Config ---
const config: EvalConfig = configFromEnv();
const budgetTracker = new DailyBudgetTracker(config.dailyBudgetCents);
const evaluatedTracker = new EvaluatedTracker();

// --- x402 Paid Fetch (for making outgoing paid requests) ---
let paidFetch: typeof fetch = fetch;
if (config.privateKey) {
  try {
    const account = accountFromPrivateKey(config.privateKey as `0x${string}`);
    paidFetch = createX402Fetch({ account });
  } catch (e) {
    console.warn("Failed to create x402 fetch, using regular fetch:", e);
  }
}

// --- Monitored tasks ---
const MONITORED_TASKS = (process.env.MONITORED_TASKS || "").split(",").filter(Boolean);
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// --- Agent setup ---
const runtime = await createAgent({
  name: "submission-evaluator",
  version: "1.0.0",
  description:
    "TaskMarket Submission Evaluator Agent. Auto-evaluates bounty submissions: checks GET 200, POST 402 x402 gate, paid call, and posts structured eval notes to listening-heart.",
})
  .use(http())
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const { app, addEntrypoint } = await createAgentApp(runtime);

// --- Gated POST /evaluate entrypoint (0.01 USDC) ---
addEntrypoint({
  key: "evaluate",
  description:
    "Evaluate a TaskMarket submission. Checks GET 200, POST 402 with x402v2, paid call, and posts eval note to listening-heart.",
  input: EvaluateInputSchema,
  output: EvaluateOutputSchema,
  price: "0.01",
  async handler(ctx) {
    const result = await runEvaluation(
      ctx.input,
      0, // external callers don't trigger auto-pay
      config,
      budgetTracker,
      paidFetch
    );
    return {
      output: {
        eval: result.eval,
        result: result.result,
        fail_reason: result.fail_reason,
        auto_paid: false,
      },
    };
  },
});

// --- Polling for submissions from monitored tasks ---

async function fetchSubmissions(taskId: string): Promise<any[]> {
  try {
    // Use the taskmarket CLI to list submissions for a task
    const proc = Bun.spawn(
      ["npx", "@lucid-agents/taskmarket@0.6.3", "task", "submissions", taskId, "--json"],
      { stdout: "pipe", stderr: "pipe" }
    );
    const text = await new Response(proc.stdout).text();
    await proc.exited;

    try {
      const parsed = JSON.parse(text);
      if (parsed.ok && Array.isArray(parsed.data?.submissions)) {
        return parsed.data.submissions;
      }
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // If JSON parse fails, try line-by-line
    }
    return [];
  } catch (e) {
    console.error(`Failed to fetch submissions for ${taskId}:`, e);
    return [];
  }
}

async function pollAndEvaluate(): Promise<void> {
  if (MONITORED_TASKS.length === 0) {
    console.log("No MONITORED_TASKS configured, skipping poll");
    return;
  }

  console.log(`Polling ${MONITORED_TASKS.length} monitored tasks...`);

  for (const taskId of MONITORED_TASKS) {
    try {
      const submissions = await fetchSubmissions(taskId);
      console.log(`Task ${taskId}: ${submissions.length} submissions found`);

      for (const sub of submissions) {
        const subId = sub.id || sub.submissionId || `${taskId}-${sub.workerAddress}`;
        if (evaluatedTracker.has(subId)) {
          continue;
        }
        evaluatedTracker.add(subId);

        const submissionUrl = sub.url || sub.submissionUrl || "";
        const workerAddress = sub.workerAddress || sub.worker || "";
        const reward = sub.reward || 0;

        if (!submissionUrl) {
          console.log(`Skipping submission ${subId}: no URL`);
          continue;
        }

        console.log(`Evaluating submission ${subId}: ${submissionUrl}`);
        try {
          const result = await runEvaluation(
            { taskId, submissionUrl, workerAddress },
            reward,
            config,
            budgetTracker,
            paidFetch
          );
          console.log(`Evaluation result for ${subId}: ${result.result}`);
        } catch (e) {
          console.error(`Evaluation failed for ${subId}:`, e);
        }
      }
    } catch (e) {
      console.error(`Error processing task ${taskId}:`, e);
    }
  }
}

// --- Start server ---
const port = parseInt(process.env.PORT || "3000");
Bun.serve({ port, fetch: app.fetch });
console.log(`Submission Evaluator agent running on port ${port}`);

// --- Immediate poll on startup + recurring ---
pollAndEvaluate().catch(e => console.error("Initial poll failed:", e));
setInterval(() => {
  pollAndEvaluate().catch(e => console.error("Poll failed:", e));
}, POLL_INTERVAL_MS);
