import { createAgent } from '@lucid-agents/core';
import { createAgentApp } from '@lucid-agents/hono';
import { http } from '@lucid-agents/http';
import { payments, paymentsFromEnv } from '@lucid-agents/payments';
import { z } from 'zod';
import { runAuctionTest, validateAuctionConfig, validateBid } from './auction';

const agent = await createAgent({
  name: 'auction-mode-tester',
  version: '1.0.0',
  description: 'Tests and validates auction mode configurations. Validates auction configs, bids, and runs simulated auction test scenarios.',
})
  .use(http())
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const { app, addEntrypoint } = await createAgentApp(agent);

addEntrypoint({
  key: 'test-auction',
  description: 'Run a full auction mode test scenario. Validates config, tests bids, and returns a summary. Requires 0.001 USDC payment.',
  price: '0.001',
  input: z.object({
    minBid: z.number().optional(),
    maxBid: z.number().optional(),
    duration: z.number().optional(),
    reservePrice: z.number().optional(),
    sealed: z.boolean().optional(),
    increment: z.number().optional(),
  }),
  output: z.object({
    configValidation: z.object({
      valid: z.boolean(),
      errors: z.array(z.string()),
      warnings: z.array(z.string()),
      config: z.any(),
    }),
    bidTests: z.array(z.object({
      bid: z.number(),
      result: z.object({
        valid: z.boolean(),
        reason: z.string(),
      }),
    })),
    summary: z.string(),
  }),
  handler: async (ctx) => {
    const result = runAuctionTest(ctx.input);
    return { output: result };
  },
});

addEntrypoint({
  key: 'validate-config',
  description: 'Validate an auction configuration without running a full test. Requires 0.001 USDC payment.',
  price: '0.001',
  input: z.object({
    minBid: z.number().optional(),
    maxBid: z.number().optional(),
    duration: z.number().optional(),
    reservePrice: z.number().optional(),
    sealed: z.boolean().optional(),
    increment: z.number().optional(),
  }),
  output: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    config: z.any(),
  }),
  handler: async (ctx) => {
    const result = validateAuctionConfig(ctx.input);
    return { output: result };
  },
});

addEntrypoint({
  key: 'validate-bid',
  description: 'Validate a specific bid against an auction configuration. Requires 0.001 USDC payment.',
  price: '0.001',
  input: z.object({
    bidAmount: z.number(),
    config: z.object({
      minBid: z.number().optional(),
      maxBid: z.number().optional(),
      duration: z.number().optional(),
      reservePrice: z.number().optional(),
      sealed: z.boolean().optional(),
      increment: z.number().optional(),
    }),
    currentHighBid: z.number().optional(),
  }),
  output: z.object({
    valid: z.boolean(),
    reason: z.string(),
  }),
  handler: async (ctx) => {
    const result = validateBid(ctx.input.bidAmount, ctx.input.config, ctx.input.currentHighBid);
    return { output: result };
  },
});

const port = Number(process.env.PORT ?? 3000);
const server = Bun.serve({ port, fetch: app.fetch });

console.log(`Auction mode tester agent running at http://${server.hostname}:${server.port}`);
console.log(`  POST /entrypoints/test-auction/invoke - $0.001/call`);
console.log(`  POST /entrypoints/validate-config/invoke - $0.001/call`);
console.log(`  POST /entrypoints/validate-bid/invoke - $0.001/call`);
console.log(`  GET  /health - free`);
