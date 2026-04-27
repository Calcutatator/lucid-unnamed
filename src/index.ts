import { createAgent } from "@lucid-agents/core";
import { createAgentApp } from "@lucid-agents/hono";
import { http } from "@lucid-agents/http";
import { payments, paymentsFromEnv } from "@lucid-agents/payments";
import { z } from "zod";
import { getSoulProfile, buildSystemPrompt, validateSoulProfile } from "./soul";

const agent = await createAgent({
  name: "steipete-soul",
  version: "1.0.0",
  description:
    "Soul.md profile for Peter Steinberger (@steipete) — the ClawFather, creator of OpenClaw. Pure prompt-layer identity distillation. Any LLM can load it to write as him.",
})
  .use(http())
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const { app, addEntrypoint } = await createAgentApp(agent);

addEntrypoint({
  key: "get-soul",
  price: "$0.001",
  input: z.object({}),
  output: z.object({
    soul: z.string(),
    style: z.string(),
    skill: z.string(),
    examples: z.object({
      good: z.string(),
      bad: z.string(),
      calibration: z.string(),
    }),
  }),
  handler: async () => {
    return getSoulProfile();
  },
});

addEntrypoint({
  key: "system-prompt",
  price: "$0.001",
  input: z.object({
    mode: z
      .enum([
        "tweet",
        "thread",
        "blog",
        "talk",
        "docs",
        "reply",
        "announcement",
      ])
      .default("blog"),
  }),
  output: z.object({
    systemPrompt: z.string(),
    mode: z.string(),
  }),
  handler: async ({ input }) => {
    return {
      systemPrompt: buildSystemPrompt(input.mode),
      mode: input.mode,
    };
  },
});

addEntrypoint({
  key: "validate",
  price: "$0.001",
  input: z.object({}),
  output: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    stats: z.object({
      soulLines: z.number(),
      styleLines: z.number(),
      skillLines: z.number(),
      goodExamples: z.number(),
      badExamples: z.number(),
      calibrationQuotes: z.number(),
    }),
  }),
  handler: async () => {
    return validateSoulProfile();
  },
});

const port = Number(process.env.PORT ?? 3000);
const server = Bun.serve({ port, fetch: app.fetch });

console.log(
  `steipete-soul agent running at http://${server.hostname}:${server.port}`
);
console.log(`  POST /entrypoints/get-soul/invoke - $0.001/call`);
console.log(`  POST /entrypoints/system-prompt/invoke - $0.001/call`);
console.log(`  POST /entrypoints/validate/invoke - $0.001/call`);
console.log(`  GET  /health - free`);
