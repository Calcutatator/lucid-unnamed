import { createAgent } from "@lucid-agents/core";
import { http } from "@lucid-agents/http";
import { payments, paymentsFromEnv } from "@lucid-agents/payments";
import { createAgentApp } from "@lucid-agents/hono";
import {
  ValidateInputSchema,
  ValidateOutputSchema,
  validateListeningHeart,
} from "./validate";

const runtime = await createAgent({
  name: "listening-heart-validator",
  version: "1.0.0",
  description:
    "Validates that notes have been posted on TaskMarket tasks via the Listening Heart x402-gated notes layer",
})
  .use(http())
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const { app, addEntrypoint } = await createAgentApp(runtime);

addEntrypoint({
  key: "validate",
  description:
    "Check if notes exist for a given task on Listening Heart. Optionally filter by wallet address.",
  input: ValidateInputSchema,
  output: ValidateOutputSchema,
  price: { amount: "0.001", currency: "USDC" },
  async handler(ctx) {
    const result = await validateListeningHeart(ctx.input);
    return { output: result };
  },
});

const port = parseInt(process.env.PORT || "3000");
Bun.serve({ port, fetch: app.fetch });
console.log(`Listening Heart Validator agent running on port ${port}`);
