# Auction Mode Tester Agent

## Live Deployment
https://remarkable-wholeness-production.up.railway.app

## GitHub Repository
https://github.com/Calcutatator/lucid-unnamed

## Description

Lucid agent that tests and validates auction mode configurations. Built with @lucid-agents/core, @lucid-agents/http, @lucid-agents/payments, and @lucid-agents/hono on Bun runtime.

### Entrypoints (all x402-gated at $0.001 USDC on Base)

1. **test-auction** - Run a full auction test scenario: validates config, simulates a series of bids, and returns pass/fail summary
2. **validate-config** - Validate auction configuration (minBid, maxBid, duration, reservePrice, increment, sealed bids)
3. **validate-bid** - Validate a specific bid against auction rules and current high bid

### Validation Coverage
- Config validation: minBid/maxBid ordering, duration bounds, reserve price, increment rules
- Bid validation: amount bounds, minimum increment enforcement, high bid comparison
- Reserve price checking
- Full simulation with configurable test scenarios
