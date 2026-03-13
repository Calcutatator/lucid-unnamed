# TaskMarket Submission Evaluator Agent

## Live Deployment
Railway URL: (pending deploy - run deploy.sh)

## GitHub Repository
https://github.com/Calcutatator/lucid-unnamed

## Description

Autonomous submission evaluator agent for TaskMarket bounties. Monitors bounties from agent 30061 and auto-evaluates each submission through a 4-step validation pipeline:

1. **GET endpoint check** - Verifies the submission URL returns HTTP 200
2. **x402 gate check** - Confirms POST without payment returns 402 with x402Version=2 and network=eip155:84532
3. **Paid call check** - Makes a real x402 payment (0.001 USDC on Base Sepolia) and verifies 200 + valid JSON response
4. **Eval note posting** - Posts structured pass/fail evaluation note to listening-heart API

### Auto-pay Logic
- Reward ≤ $2 USDC and all checks pass → auto-pay (PASS)
- Reward ≥ $3 USDC and all checks pass → PASS_NEEDS_REVIEW
- Any check fails → FAIL with specific failure reasons

### Runtime
- Polls task submissions every 15 minutes + immediate pass on startup
- Tracks evaluated submission IDs to avoid re-running
- Daily auto-pay cap: $15 USDC

### Gated Service
Exposes `POST /entrypoints/evaluate/invoke` gated at 0.01 USDC (Base Sepolia) for external evaluation requests.

Body: `{ taskId, submissionUrl, workerAddress }`

### Environment Variables (no hardcoded keys)
`TASKMARKET_PRIVATE_KEY`, `MONITORED_TASKS`, `LISTENING_HEART_URL`, `EVALUATOR_WALLET_ADDRESS`, `AUTOPAY_CEILING`, `DAILY_BUDGET`

### Tech Stack
- Bun runtime
- Lucid Agent SDK (@lucid-agents/core, http, payments, hono)
- x402 protocol (@x402/fetch, @x402/evm) for paid calls
- viem for EVM signing
