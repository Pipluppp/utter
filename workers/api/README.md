# API Worker

Cloudflare Worker that serves the `/api/*` contract for Utter.

## Read This When

- you are changing backend routes
- you are touching queue-backed job flow
- you need local commands or key files for the API Worker

## Commands

```bash
npm --prefix workers/api install
npm --prefix workers/api run dev
npm --prefix workers/api run typecheck
npm --prefix workers/api run check
```

## Key Files

- entry: `workers/api/src/index.ts`
- env typing: `workers/api/src/env.ts`
- route handlers: `workers/api/src/routes`
- queue code: `workers/api/src/queues`
- config and bindings: `workers/api/wrangler.toml`
- local secrets template: `workers/api/.dev.vars.example`

## What Lives Here

- the `/api/*` contract, including protected user routes plus a small public/token-signed surface
- signed upload/download flow for R2
- queue producer and consumer for qwen jobs
- credits, trials, and billing orchestration
- provider integration for qwen TTS and transcription

## Constraints

- Queue-backed long-running flows should fail clearly if bindings are missing.
- Route handlers should not silently fall back to stale runtime paths.
- Polling endpoints stay read-only.
- Keep docs aligned with [docs/backend.md](../../docs/backend.md).

## Read Next

- [docs/backend.md](../../docs/backend.md)
- [docs/architecture.md](../../docs/architecture.md)
- [docs/database.md](../../docs/database.md)
