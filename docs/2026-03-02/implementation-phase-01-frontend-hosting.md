# Phase 01: Cloudflare Frontend Hosting

Date: 2026-03-02  
Status: Ready for implementation

## Goal

Move SPA hosting from Vercel to Cloudflare without changing product behavior.

## Scope

- Frontend hosting only
- Backend remains current Supabase Edge Functions for this phase

## Inputs

- `frontend/` Vite app
- Current rewrite behavior in `frontend/vercel.json`

## Tasks

1. Provision Cloudflare Pages project for `frontend/`.
2. Configure build:
   - build command: `npm --prefix frontend run build`
   - output directory: `frontend/dist`
3. Set Pages env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Configure SPA fallback routing (non-asset routes -> `index.html`).
5. Keep API target unchanged in this phase:
   - `/api/*` still points to existing Supabase Edge Function backend endpoint.
6. Configure custom domain for staging frontend.
7. Add explicit CORS/origin cutover configuration for interim split architecture:
   - allow Pages staging/prod origins on the API CORS allowlist
   - verify `Authorization` header is allowed on preflight
   - decide preview-domain policy (allowlist vs block)
8. Update Supabase Auth redirect URL allowlist for new Pages/custom domain origins.
9. Run smoke tests on staging domain.

## Validation checklist

- [ ] `/` renders landing page.
- [ ] `/generate`, `/voices`, `/history`, `/account/*` routes load directly.
- [ ] Login/logout flows work.
- [ ] Calls to `/api/*` succeed for generate/clone/design/history pages.
- [ ] No unexpected CORS errors in browser.
- [ ] Preflight requests pass for authenticated `/api/*` calls.
- [ ] Supabase login/logout redirect flow works on Pages domain.

## Rollback

1. Repoint DNS/custom domain back to Vercel.
2. Verify `/api/*` and auth flows recover.

## Deliverables

1. Cloudflare Pages project config captured.
2. Domain cutover notes.
3. Smoke test evidence.
