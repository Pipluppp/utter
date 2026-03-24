# Deploy

Read this when you are shipping the current Cloudflare stack.

## Deploy Units

1. API Worker in `workers/api`
2. Frontend assets from `frontend/dist`
3. Frontend Worker in `workers/frontend`
4. Cloudflare queue and R2 bindings
5. Supabase migrations if schema changed (use `supabase db diff` against declarative schemas)

## Key Files

- `package.json`
- `workers/api/wrangler.toml`
- `workers/frontend/wrangler.toml`
- `frontend/.env.staging`

## Staging Flow

1. Build frontend assets:

```bash
npm run cf:frontend:build:staging
```

2. Deploy API Worker:

```bash
npm run cf:deploy:api:staging
```

3. Deploy frontend Worker:

```bash
npm run cf:deploy:frontend:staging
```

Domain cutover note:

- the staging frontend Worker is the live app Worker (`utter`)
- `workers/frontend/wrangler.toml` attaches `uttervoice.com` to that Worker as the custom domain target
- the `/api/*` proxy path stays on the frontend Worker; no separate public API domain is introduced in this step
- keep `https://utter.duncanb013.workers.dev` available as a temporary fallback until the branded domain is confirmed live
- `https://www.uttervoice.com/*` should redirect to `https://uttervoice.com/$1` via a Cloudflare redirect rule
- Supabase Auth URL config should use `site_url = https://uttervoice.com` and allow
  `https://uttervoice.com/**` plus the temporary `https://utter.duncanb013.workers.dev/**` fallback.

Optional one-shot:

```bash
npm run cf:deploy:staging
```

Current script order in `package.json` is:

1. deploy API Worker
2. build frontend assets
3. deploy frontend Worker

Use the manual sequence above when you want to guarantee the frontend build completes before any deploy step. Use the one-shot script when you want repo-default behavior.

## Staging Smoke Checks

- `https://uttervoice.com` serves the SPA after the custom domain attachment is active
- `https://uttervoice.com/api/health` returns 200 through the frontend Worker proxy
- `GET /api/health` returns 200
- protected routes reject unauthenticated requests
- `GET /api/languages` reflects qwen runtime config
- clone upload + finalize works
- generate creates a task and completes through the queue consumer
- `GET /api/tasks/:id` stays read-only

## Production Status

- Production frontend/API origins are partly wired.
- Production R2 and queue bindings are still commented out in `workers/api/wrangler.toml`.
- Treat production deploy as incomplete until those bindings and secrets are set explicitly.

## Release Checks

```bash
npm --prefix frontend run ci
npm --prefix workers/api run typecheck
npm --prefix workers/api run check
supabase test db
npm run test:worker:local
```

## Rollback

- API rollback: deploy the previous Worker version
- frontend rollback: deploy the previous frontend Worker
- queue incident mode: stop submits or drain/replay the queue and DLQ operationally

## Invariants

- Build frontend assets before deploying the frontend Worker.
- Keep Cloudflare env bindings explicit per environment.
- Do not assume production is ready just because staging is healthy.

## Read Next

- [stack.md](./stack.md)
- [architecture.md](./architecture.md)
