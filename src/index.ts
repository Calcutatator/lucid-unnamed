import { createAgent } from '@lucid-agents/core';
import { createAgentApp } from '@lucid-agents/hono';
import { http } from '@lucid-agents/http';
import { payments, paymentsFromEnv } from '@lucid-agents/payments';
import { z } from 'zod';
import { createEchoResponse } from './echo';

const agent = await createAgent({
  name: 'echo-x402',
  version: '1.0.0',
  description: 'x402-gated echo endpoint. POST with payment to echo back your request body.',
})
  .use(http())
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const { app, addEntrypoint } = await createAgentApp(agent);

addEntrypoint({
  key: 'echo',
  description: 'Echo back the request body as JSON with a timestamp. Requires 0.001 USDC payment.',
  price: '0.001',
  input: z.object({}).passthrough(),
  output: z.object({
    echo: z.any(),
    timestamp: z.string(),
  }),
  handler: async (ctx) => {
    const result = createEchoResponse(ctx.input);
    return { output: result };
  },
});

const port = Number(process.env.PORT ?? 3000);
const server = Bun.serve({ port, fetch: app.fetch });

console.log(`Echo x402 agent running at http://${server.hostname}:${server.port}`);
console.log(`  POST /entrypoints/echo/invoke - $0.001/call (x402 gated)`);
console.log(`  GET  /health - free`);
