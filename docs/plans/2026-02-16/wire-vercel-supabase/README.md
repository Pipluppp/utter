# Task 2 - Wire Vercel Frontend to Staging Supabase

Status: `Done` (2026-02-17)  
Owner: `Frontend/Deployment`  
Priority: `P0` (after Task 1)

---

## Objective

Connect the already auto-deployed Vercel frontend to the live staging Supabase backend using `/api/*` rewrites + Vite env vars, then validate end-to-end behavior in the deployed app.

---

## Scope

In:
- add API rewrite in `frontend/vercel.json`
- set Vercel env vars for Supabase client
- redeploy and verify backend connectivity
- validate auth + core feature smoke path on deployed URL

Out:
- production Supabase cutover
- Qwen official API integration/cutover
- broad architecture or schema changes

---

## Source docs

- Primary extracted from: `docs/supabase-migration/phases/10-vercel.md`
- Supporting:
  - `docs/vercel-frontend.md`
  - `docs/supabase-security.md`
  - `docs/supabase-migration/phases/09-staging-deploy.md`

---

## Preconditions (Go / No-Go)

- [ ] Task 1 completed (`../deploy-supabase/README.md`)
- [ ] staging `api` edge function deployed and healthy
- [ ] staging CORS + Auth redirect configuration completed

No-Go if Task 1 acceptance criteria are incomplete.

---

## Current repo state note

`frontend/vercel.json` is currently SPA fallback only.  
No `/api/*` rewrite exists yet.

---

## Implementation plan (strict order)

### 1) Add rewrite in `frontend/vercel.json`

Insert rewrite **before** catch-all:

```json
{
  "source": "/api/:path*",
  "destination": "https://<staging-ref>.supabase.co/functions/v1/api/:path*"
}
```

Also keep `Cache-Control: no-store` for `/api/*` responses.

### 2) Configure Vercel env vars

Set in Vercel project settings:

- `VITE_SUPABASE_URL=https://<staging-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<staging-anon-key>`

Apply to the deployment environments used for staging validation (Preview and/or Production, per your workflow).

### 3) Redeploy

- [ ] push config changes
- [ ] confirm deployment success in Vercel

### 4) Connectivity verification

- [ ] verify deployed API path returns backend JSON:
  - `https://<vercel-domain>/api/languages`
- [ ] ensure response is backend payload, not `index.html`

### 5) Deployed smoke test

- [ ] auth flow works (sign in, session present)
- [ ] profile load/update works
- [ ] clone flow works
- [ ] generate + polling works
- [ ] playback works (no CORS/range issues)
- [ ] delete flows work

---

## Rollback

If staging backend wiring fails:

1. revert `frontend/vercel.json` to SPA-only fallback (remove `/api/*` rewrite)
2. redeploy
3. keep env vars as-is but treat deployment as frontend-only until backend issues resolved

---

## Deliverables / evidence to capture

- [ ] final `frontend/vercel.json` rewrite snippet in commit
- [ ] Vercel env vars set (names + target envs)
- [ ] successful `/api/languages` check on deployed URL
- [ ] smoke test notes with pass/fail

---

## Exit criteria

- [ ] deployed Vercel app is backed by staging Supabase API
- [ ] core flows are functional over the public deployment
- [ ] no critical CORS/auth/regression blockers remain

---

## Risk hotspots

- rewrite order wrong (`/(.*)` capturing `/api/*`)
- missing build-time env vars
- storage CORS missing `range`
- auth redirect URL mismatch

---

## Next task gate

Only after Task 1 + Task 2 are complete do we start the official Qwen API wiring/cutover work, using:

- `docs/qwen-integration/README.md`
- `docs/qwen-integration/tasks/11-rollout-cutover.md`
