# steipete Soul.md Agent

Soul.md profile for **Peter Steinberger** (@steipete) — the ClawFather, creator of OpenClaw. Pure prompt-layer identity distillation. Any LLM can load it to write as him.

Built for the [soul-md.xyz](https://soul-md.xyz) format.

## Structure

```
soul/
  SOUL.md          — Identity, beliefs, opinions, biography
  STYLE.md         — Voice, vocabulary, sentence patterns
  SKILL.md         — Operating modes (tweet, blog, talk, etc.)
  examples/
    good-output.md     — 10 on-voice examples
    bad-output.md      — 10 off-voice examples with explanations
    calibration.md     — Real quotes + prediction test prompts
src/
  index.ts         — Lucid agent serving soul profile via x402
  soul.ts          — Core logic for loading/validating soul files
  soul.test.ts     — Tests
```

## Run locally

```bash
bun install
bun run src/index.ts
```

## Test

```bash
bun test
```

## Entrypoints

| Key | Price | Description |
|-----|-------|-------------|
| `get-soul` | $0.001 | Full soul profile |
| `system-prompt` | $0.001 | Ready-to-use system prompt for a mode |
| `validate` | $0.001 | Profile validation + stats |
