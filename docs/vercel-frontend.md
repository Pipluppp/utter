# Vercel Frontend (React + Vite SPA)

Last updated: **2026-02-07**

This is the frontend deployment source of truth for Utter.

Stack:

- Frontend: **React + Vite SPA** hosted on **Vercel**
- Backend: **Supabase** (Postgres + Auth + Storage + Edge Functions)
- Compute: **Modal** (Qwen3-TTS GPU jobs), orchestrated by Supabase Edge Functions

Related:

- `docs/architecture.md` - overall target architecture
- `docs/backend.md` - `/api/*` Edge API surface (fat `api` function)
- `docs/edge-orchestration.md` - Modal job orchestration model
- `docs/supabase-security.md` - security checklist (RLS, keys, hardening, Storage policies)

---

## What Vercel does for us

Vercel handles the frontend hosting layer:

- global CDN for static assets, HTTPS/SSL, custom domains
- build + deploy from GitHub, Preview Deployments, rollbacks
- request routing rules (SPA fallback + `/api/*` rewrites)

We are using Vercel as a frontend host, not as a backend runtime.

---

## Non-goals (important)

- We are **not using Next.js**.
- We are **not** planning to run backend logic in Next.js API routes / Server Actions.
- Backend logic lives in **Supabase Edge Functions** (and long-running compute lives in **Modal**).

---

## Chosen connectivity pattern: Pattern A only

The deployed SPA keeps calling these stable relative endpoints:

- `https://<app-domain>/api/*`

In production, Vercel rewrites those calls to Supabase Edge Functions:

- `https://<project-ref>.supabase.co/functions/v1/api/*`

This preserves a stable, same-origin `/api/*` contract for the frontend while keeping the backend on Supabase.

### Why we prefer this

- minimal frontend changes (keep `/api/*`)
- keeps room for future cookie-based auth (optional)
- keeps ergonomics for media endpoints (e.g. `/api/voices/:id/preview` can 302 to Storage)

### Operational constraints to design around

- External rewrite proxy timeout: Vercel external rewrites have a **120s** proxy timeout (errors like `ROUTER_EXTERNAL_TARGET_ERROR` if the backend does not respond in time).
  - For Utter, avoid doing "big finalize work" in a single request routed through Vercel. Keep finalization incremental/idempotent, or move finalization to server-to-server triggers that do not pass through the Vercel proxy.
- WebSockets: do not assume Vercel rewrites can tunnel WebSockets reliably. Treat Vercel rewrites as HTTP-only.
  - For Option A, prefer HTTP polling (or an `/api/*` push mechanism like SSE) rather than direct client WebSockets.
- `vercel.json` is static config (no env-var interpolation). The Supabase project ref in a rewrite destination is not a secret; committing it is acceptable.

### Minimal `vercel.json` (placed under `frontend/`)

If the Vercel project root is `frontend/`, place this at `frontend/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://<project-ref>.supabase.co/functions/v1/api/:path*"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

Notes:

- The SPA fallback rewrite is required because we use React Router (browser history mode).
- Be careful with caching on rewritten API responses; default to `no-store` for user-scoped APIs.

### Staging readiness gate

Before wiring Vercel to staging Supabase, confirm:

- [ ] Staging Supabase project is created and linked (`npx supabase link --project-ref <staging-ref>`).
- [ ] Migrations are pushed to staging.
- [ ] `api` Edge Function is deployed.
- [ ] Storage CORS includes the Vercel staging origin and allows the `range` header.
- [ ] Supabase Auth redirect URLs include the Vercel staging URL.
- [ ] Tests are validated: DB suite passes locally, and edge suite is validated locally or via green CI.

---

## Supabase features we rely on (frontend-facing)

Even with Pattern A, Supabase is still the backend platform. The frontend will rely on:

- Supabase Auth: user login/session; frontend obtains an access token
- RLS: the security boundary for user-owned rows and Storage objects
- Edge Functions: our `/api/*` contract (via Vercel rewrites)
- Storage: private buckets for audio; signed URLs for playback/download and signed upload URLs for large uploads
- Realtime (future; optional): not used by the SPA in Option A. If adopted later, treat as a direct Supabase surface area that must be secured like PostgREST.

---

## How requests work end-to-end

### Auth

- The SPA uses `supabase-js` for Auth only (getting/refreshing the user session).
- Requests to `/api/*` include the Supabase access token (JWT).
- The `api` Edge Function verifies the JWT and enforces authorization via RLS (or uses service-role only for explicitly server-owned operations).

### Clone (large reference uploads)

Do not proxy large files through Edge Functions.

Preferred flow:

1. `POST /api/clone/upload-url` -> returns signed upload URL + object key
2. browser uploads directly to Supabase Storage
3. `POST /api/clone/finalize` -> validate + write DB rows

### Generate (Modal job orchestration)

Recommended "submit fast, poll to finalize" flow:

1. `POST /api/generate` -> inserts `generations` + `tasks`, submits Modal job, returns `{ task_id, generation_id }`
2. `GET /api/tasks/:id` -> polls Modal and finalizes idempotently (Storage upload + DB updates)

If finalization risks exceeding the Vercel proxy timeout, move the finalize step to a server-to-server trigger (or split it across multiple polls).

### Playback

- Return a signed URL in JSON, or
- 302 redirect from `/api/.../preview` to a signed Storage URL

---

## Vercel configuration (repo-specific)

## Setup (Vercel)

### Setup via Dashboard (recommended)

Vercel docs walkthrough:

- Import an existing project: https://vercel.com/docs/getting-started-with-vercel/import

Utter-specific steps:

1. Create a new Vercel project by importing this Git repo.
2. In the “Configure Project” step (or later in Project Settings), set:
   - Root Directory: `frontend/`
   - Framework Preset: Vite
   - Install Command: `npm ci`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Add `frontend/vercel.json` with:
   - rewrite `/api/*` → `https://<project-ref>.supabase.co/functions/v1/api/*`
   - SPA fallback rewrite to `/index.html`
4. Add required environment variables (build-time `VITE_*` vars).
5. Deploy.

### Setup via CLI (optional)

Vercel docs:

- Deploying via CLI: https://vercel.com/docs/deployments
- Import via CLI (monorepo-friendly): https://vercel.com/docs/getting-started-with-vercel/import

From the repo root:

```bash
npm i -g vercel
vercel --cwd frontend
```

Notes:

- This links `frontend/` to a Vercel project and creates a preview deployment by default.
- Use `vercel --cwd frontend --prod` for a production deployment.
- The CLI creates a `.vercel/` directory; keep it ignored (this repo’s `frontend/.gitignore` already includes it).

### Root Directory

Set Vercel "Root Directory" to `frontend/` so it builds and serves `frontend/dist/`.

### Build settings

Recommended (Vercel Project Settings):

- Install Command: `npm ci` (uses `frontend/package-lock.json` for reproducible installs)
- Build Command: `npm run build`
- Output Directory: `dist`

### Environment variables (Vite)

- Any `VITE_*` variables are build-time. Changing them requires a rebuild/deploy.
- Do not put secrets in `VITE_*` variables.

### Environments (dev / preview / production)

Two things are true at the same time:

1. We want **separate Supabase projects** for dev/staging/prod (see `docs/supabase.md`).
2. `vercel.json` rewrites are **static**, so `/api/*` rewrite targets cannot change per Vercel environment without introducing a proxy layer.

Practical recommendation for Utter:

- Use **two Vercel projects**:
  - **Staging Vercel project** (deploys `develop`): rewrites `/api/*` to the **staging** Supabase project.
  - **Production Vercel project** (deploys `main`): rewrites `/api/*` to the **production** Supabase project.

This prevents Vercel Preview Deployments for staging from accidentally pointing at the production database.

### Monitoring (minimum)

- Use Vercel Deployments + Logs to debug build/runtime issues.
- Add application error tracking (e.g. Sentry) early; most production problems show up in the browser and in Edge Function logs.

---

## Vercel <-> Supabase integration (optional)

Vercel has a Supabase Marketplace integration. It can help with provisioning/linking and syncing env vars.

Important notes for Utter:

- Many examples assume Next.js env conventions like `NEXT_PUBLIC_*`. We are a Vite SPA, so browser-exposed variables must be `VITE_*`.
- The integration may also surface a service-role key for server-side use cases. Never expose it to the browser.

Docs:

- Vercel marketplace entry: https://vercel.com/marketplace/supabase/
- Supabase guide: https://supabase.com/docs/guides/integrations/vercel-marketplace

---

## Security reminder

Vercel rewrites are routing convenience, not access control. Treat Supabase as public-by-design and enforce security via RLS + Edge Function auth + Data API hardening.

See `docs/supabase-security.md`.

---

## Official docs (primary sources)

Vercel:

- Getting started: https://vercel.com/docs/getting-started-with-vercel
- Rewrites: https://vercel.com/docs/rewrites
- `ROUTER_EXTERNAL_TARGET_ERROR`: https://vercel.com/docs/errors/ROUTER_EXTERNAL_TARGET_ERROR
- 120s origin timeout changelog: https://vercel.com/changelog/cdn-origin-timeout-increased-to-two-minutes
- Environment variables: https://vercel.com/docs/environment-variables
- Configure a build (build command/output dir): https://vercel.com/docs/deployments/configure-a-build
- Builds overview: https://vercel.com/docs/deployments/builds/
- Add a domain: https://vercel.com/docs/getting-started-with-vercel/use-existing

Supabase:

- Edge Functions: https://supabase.com/docs/guides/functions
- Edge Functions auth: https://supabase.com/docs/guides/functions/auth
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Hardening the Data API: https://supabase.com/docs/guides/database/hardening-data-api
