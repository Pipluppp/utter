# Frontend Worker

Cloudflare Worker that serves `frontend/dist` and proxies `/api/*` to the API Worker.

## Read This When

- you are changing frontend delivery or proxy behavior
- you are debugging asset serving or `/api/*` forwarding

## Commands

```bash
npm run cf:frontend:build:staging
npm run cf:deploy:frontend:staging
```

## Key Files

- worker entry: `workers/frontend/src/index.ts`
- config: `workers/frontend/wrangler.toml`
- built assets: `frontend/dist`

## Behavior

- serves SPA assets from `frontend/dist`
- falls back to `/` for SPA routes
- proxies `/api/*` to the API Worker
- preserves redirect behavior for signed media URLs

## Constraints

- `frontend/dist` must exist before deploy.
- Build-time frontend env values come from the frontend build, not from this worker alone.
- Keep proxy headers intact when changing forwarding logic.

## Read Next

- [docs/architecture.md](../../docs/architecture.md)
- [docs/deploy.md](../../docs/deploy.md)
