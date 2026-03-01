# Phase 01: Cloudflare Frontend Hosting

Date: 2026-03-02  
Status: Implemented on staging via Cloudflare Workers frontend service

## Goal

Move SPA hosting from Vercel to Cloudflare without changing product behavior.

## Scope

- Frontend hosting only
- Backend remains current Cloudflare Worker API for this phase

## Inputs

- `frontend/` Vite app
- Existing `/api/*` contract handled by API worker

## Tasks

1. Provision frontend Worker service for static assets + SPA fallback.
2. Configure build:
   - build command: `npm --prefix frontend run build`
   - output directory: `frontend/dist`
3. Set frontend env vars as needed for client runtime:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Configure SPA fallback routing in Worker (non-asset routes -> `/`).
5. Keep API contract unchanged in this phase:
   - `/api/*` proxy remains stable and forwards to API worker.
6. Configure worker-to-worker service binding for API proxy (`utter-api-staging`).
7. Add explicit CORS/origin checks for split frontend/API domains:
   - verify `Authorization` header is allowed on preflight.
8. Update Supabase Auth redirect URL allowlist for new frontend Worker/custom domain origins.
9. Run smoke tests on staging domain.

## Validation checklist

- [x] `/` renders landing page.
- [x] `/generate`, `/voices`, `/history`, `/account/*` routes load directly.
- [x] Supabase auth config is present on Worker deploy (no unconfigured auth gate).
- [x] Login/logout API flow validated against Supabase from Worker-domain context.
- [x] Final interactive browser login/logout clickthrough on Worker domain.
- [x] Calls to `/api/*` succeed for health/languages/me routes through frontend Worker.
- [x] No unexpected CORS errors on API preflight.
- [x] Preflight requests pass for authenticated `/api/*` calls.
- [x] Supabase auth redirect URL acceptance validated for Worker domain (`/auth/v1/admin/generate_link`).

## Rollback

1. Repoint frontend DNS/custom domain back to Vercel deployment.
2. Verify `/api/*` and auth flows recover.

## Deliverables

1. Frontend Worker config captured (`workers/frontend/*`).
2. Domain cutover notes.
3. Smoke test evidence in `docs/security/audits/2026-03-02/cloudflare-hybrid-phase-01.md`.
