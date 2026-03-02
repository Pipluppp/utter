# Frontend Worker

Cloudflare Worker that serves the built SPA from `frontend/dist` and proxies `/api/*`
requests to the API Worker.

## Deploy

```bash
cd workers/frontend
npx wrangler deploy --env staging
```

## Required build step

`frontend/dist` must exist before deploy, and Supabase public env vars must be baked at build time:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<publishable-key> \
npm --prefix frontend run build
```

If these vars are missing at build time, `/auth` will show the unconfigured Supabase warning.
