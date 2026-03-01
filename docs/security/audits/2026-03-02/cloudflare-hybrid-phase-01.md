# Cloudflare Hybrid Migration - Phase 01 Audit

Date: 2026-03-02  
Scope: Frontend hosting migration to Cloudflare Workers (staging)

## 1) Deployed environment URLs

1. Frontend Worker (staging): `https://utter.duncanb013.workers.dev`
2. API Worker (staging): `https://utter-api-staging.duncanb013.workers.dev`

Deployment command used:

```bash
cd workers/frontend
npx wrangler deploy --env staging
```

Deployment result:

- Worker name: `utter`
- Version ID: `9766d4c3-d82a-48ce-bb73-903ef6ac48cf`
- Service binding: `env.API -> utter-api-staging`
- Legacy worker `utter-frontend-staging-staging` deleted (verified absent via Wrangler API)

## 2) Runtime routing model

1. Static asset and SPA route handling is hosted by `workers/frontend/src/index.ts`.
2. SPA deep-link handling serves `/` for extensionless GET/HEAD routes.
3. `/api/*` is proxied from frontend Worker to API Worker using Cloudflare service binding.
4. API proxy responses are forced `Cache-Control: no-store`.
5. API proxy preserves upstream redirects (`redirect: manual`) so protected media flows return browser-followable signed URLs.
6. Frontend Worker injects forwarded host/proto headers for service-binding requests to avoid `api.internal` leakage in signed URLs.

## 3) Smoke transcript (staging)

Direct route loads via frontend Worker:

1. `GET /` -> `200 text/html`
2. `GET /generate` -> `200 text/html`
3. `GET /voices` -> `200 text/html`
4. `GET /history` -> `200 text/html`
5. `GET /account` -> `200 text/html`
6. `GET /account/profile` -> `200 text/html`
7. `GET /account/billing` -> `200 text/html`
8. `GET /nonexistent/deep/link` -> `200 text/html` (SPA fallback)

API proxy via frontend Worker:

1. `GET /api/health` -> `200` + `{ "ok": true }`
2. `GET /api/languages` -> `200` + languages payload
3. `GET /api/me` (no auth) -> `200` + `{ "signed_in": false, "user": null, "profile": null }`
4. `OPTIONS /api/generate` with `Authorization,content-type` preflight -> `204` with expected CORS headers

## 4) Auth configuration + flow evidence

Resolved issue:

1. `/auth` previously showed `Supabase Auth isn't configured` due missing `VITE_SUPABASE_*` at build time.
2. Rebuilt frontend with staging envs and redeployed `utter`.
3. Built bundle now contains staging Supabase project ref and anon key material (`frontend/dist/assets/index-*.js` string checks).

Auth API smoke (staging project, temporary user):

1. Admin create confirmed user -> `200`
2. Password sign-in (`/auth/v1/token?grant_type=password`) -> `200`, access token present
3. Logout (`/auth/v1/logout`) -> `204`
4. Magic-link generation with `redirect_to=https://utter.duncanb013.workers.dev/clone` (`/auth/v1/admin/generate_link`) -> `200`
5. Temporary user cleanup -> `200`

Interpretation:

1. Frontend Worker auth config is now correctly baked into the deployed assets.
2. Supabase auth login/logout and redirect URL acceptance are valid for the Worker domain context.
3. Final interactive browser clickthrough remains a manual UX sanity pass.

## 5) Rollback verification note

Rollback path remains straightforward:

1. Repoint frontend DNS/custom domain to Vercel deployment.
2. Re-verify direct route loads and `/api/*` calls.
3. Re-run login/logout redirect check on Vercel domain.

## 6) Summary

Phase 01 staging cutover for frontend hosting is operational on Cloudflare Workers with stable SPA route loads, `/api/*` proxy parity, and Supabase auth configuration/flow evidence on the `utter` Worker domain.
