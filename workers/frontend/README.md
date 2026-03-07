# Frontend Worker

Cloudflare Worker that serves the built SPA from `frontend/dist` and proxies `/api/*`
requests to the API Worker.

## Deploy

```bash
npm run cf:deploy:frontend:staging
```

## Required build step

`frontend/dist` must exist before deploy, and Supabase public env vars must be baked at build time:

```bash
npm run cf:frontend:build:staging
```

Staging mode reads `frontend/.env.staging`, which avoids accidentally baking local `.env.local` values.
If vars are missing at build time, `/auth` will show the unconfigured Supabase warning.
