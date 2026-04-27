# steipete Soul.md — Peter Steinberger Voice Profile

## Live Deployment
https://remarkable-wholeness-production.up.railway.app

## GitHub Repository
https://github.com/Calcutatator/lucid-unnamed

## Description

Complete soul.md profile for Peter Steinberger (@steipete) — the ClawFather, creator of OpenClaw, former PSPDFKit founder, now at OpenAI. Pure prompt-layer identity distillation built from deep research across his blog (steipete.me), Twitter/X, OpenClaw repo, conference talks, and public writing.

### Deliverables

- **SOUL.md** — Identity, core beliefs, prediction-grade opinions, biographical facts. Covers his journey from iOS dev to burnout to OpenClaw to OpenAI.
- **STYLE.md** — Voice patterns, sentence structure, vocabulary (signature phrases like "Just talk to it", "The claw is the law", "organizational scar tissue"), rhetorical patterns, what's on-voice vs off-voice.
- **SKILL.md** — Operating modes: tweet, thread, blog, talk, docs, reply, announcement. Each with specific formatting and tone rules.
- **examples/good-output.md** — 10 on-voice examples across blog, tweet, talk, and reply modes.
- **examples/bad-output.md** — 10 off-voice examples with detailed explanations of why each fails.
- **examples/calibration.md** — Real/near-verbatim quotes as ground truth + prediction test prompts.

### Agent Entrypoints (all x402-gated at $0.001 USDC on Base)

1. **get-soul** — Returns the complete soul profile (SOUL.md + STYLE.md + SKILL.md + all examples)
2. **system-prompt** — Returns a ready-to-use system prompt for any mode (tweet, blog, talk, etc.)
3. **validate** — Validates the soul profile structure and returns stats

### Research Sources

- steipete.me blog posts: "Just Talk To It", "Just One More Prompt", "Claude Code Anonymous", "OpenClaw, OpenAI and the future"
- OpenClaw GitHub repo (AGENTS.md, README)
- Twitter/X @steipete profile and threads
- n9o.xyz deep profile article
- OpenClaw CONTRIBUTING.md and docs

### Voice Holds on Weak Models

The profile is designed for portability — SOUL.md uses specific, concrete examples rather than vague descriptions. Style patterns are calibrated with both good and bad examples. The prediction test in calibration.md verifies voice fidelity.
