# Supabase Security (Initial Notes)

Last updated: **2026-02-07**

This doc is an initial security checklist for Utter’s target deployment:

- Frontend: **Vercel** hosting a **React + Vite SPA**
- Backend: **Supabase** (Postgres + Auth + Storage + Edge Functions)
- Compute: **Modal** for long-running GPU work (TTS)

Related:

- `docs/architecture.md` - overall backend architecture and data model
- `docs/vercel-frontend.md` - frontend deployment and `/api/*` rewrite strategy

It’s intentionally lightweight for now: “what we must not get wrong”, plus links to official docs we’ll expand into concrete policies/migrations later.

---

## 1) Core principle: Supabase is public by design

Assume attackers can:

- see your Supabase project URL
- call PostgREST/Data API endpoints
- call Edge Functions endpoints

**Hiding endpoints behind a Vercel rewrite is not a security boundary.** A rewrite is routing convenience (same-origin `/api/*`), not access control.

Security must be enforced by:

- **RLS policies** (database and Storage policies)
- **Edge Function auth checks** (JWT verification patterns, webhook signature verification)
- **least-privilege grants** / **hardening the Data API surface**

---

## 2) Keys: what is safe in the browser (and what is not)

Safe to expose in the browser (expected):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` / publishable key

Never expose publicly:

- `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- database URLs/passwords
- JWT secrets / signing secrets

Official docs:

- API keys overview: https://supabase.com/docs/guides/api/api-keys

---

## 3) RLS is non-optional (database)

Rules for Utter:

- Enable **RLS on every table** that is reachable from the Data API.
- Write policies so that the “default” is **deny**.
- Put tenant boundaries on `user_id` everywhere (`voices`, `generations`, `tasks`, etc.).
- Write RLS policies with performance in mind:
  - wrap `auth.uid()` as `(select auth.uid())` to avoid per-row function calls on large scans
  - ensure columns referenced by policies (typically `user_id`) are indexed
- Prefer doing complex invariants via:
  - Postgres functions (RPC) executed under RLS, or
  - Edge Functions that validate, then write as the server where appropriate.

Official docs:

- RLS guide: https://supabase.com/docs/guides/database/postgres/row-level-security
- Securing your API: https://supabase.com/docs/guides/api/securing-your-api

---

## 3b) Indexing and query performance (security-adjacent)

Poor performance becomes a security problem when it:

- forces you to add dangerous caches, or
- makes RLS checks so slow that you start bypassing them.

Minimum expectations for Utter:

- Index every `user_id` column used in RLS policies.
- Index foreign key columns (Postgres does not create FK indexes automatically).
- Use composite indexes that match real query patterns (e.g. `(user_id, created_at desc)` for history pages).

References:

- Indexes on WHERE/JOIN columns: https://supabase.com/docs/guides/database/query-optimization
- RLS performance notes: https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations

---

## 4) Harden the Data API surface (defense-in-depth)

Even if the frontend only ever calls our `/api/*` Edge router, the Data API still exists.

Hardening options include:

- restrict which schemas are exposed (don’t expose everything in `public`)
- move non-client tables into a `private` schema
- optionally disable the Data API (if we truly don’t want any direct table access)

Official docs:

- Hardening the Data API: https://supabase.com/docs/guides/database/hardening-data-api

---

## 5) Edge Functions security: auth, secrets, and webhooks

Edge Functions are where we put:

- Modal orchestration (submit/poll/finalize)
- Stripe checkout + webhooks
- Storage signed upload URLs
- server-owned writes (tasks, generation finalization, credit deduction)

Rules:

- Treat Edge Functions as the trusted “backend code”.
- Store secrets using Supabase secrets (not in the frontend build).
- Only disable auth/JWT checks for endpoints like **webhooks**, and then verify the webhook signature instead.
- Keep database transactions short: don’t hold DB locks while calling Modal/Stripe. Do external calls outside transactions; only lock rows for the final update.

Official docs:

- Edge Functions overview: https://supabase.com/docs/guides/functions
- Securing Edge Functions: https://supabase.com/docs/guides/functions/auth
- Function secrets / env vars: https://supabase.com/docs/guides/functions/secrets

---

## 6) Storage security (audio files)

Rules:

- Buckets should be **private** by default.
- Enforce access via Storage policies (`storage.objects`) aligned to our object-key conventions (user prefixing).
- For uploads:
  - do not proxy large files through Edge Functions
  - prefer signed upload URLs or resumable uploads

Official docs:

- Storage access control: https://supabase.com/docs/guides/storage/security/access-control

---

## 7) Auth settings to remember (Vercel domains)

We will have:

- Production domain(s)
- Vercel Preview Deployment domains

Supabase Auth must allow the relevant redirect URLs/origins, otherwise login flows will fail.

If we use the Vercel ↔ Supabase Marketplace integration, it can automate some redirect URL setup for preview branches (still validate the exact behavior for our flow).

Official docs:

- JWTs (how tokens work / verification): https://supabase.com/docs/guides/auth/jwts
- Vercel Marketplace integration (Supabase docs): https://supabase.com/docs/guides/integrations/vercel-marketplace
- Supabase on Vercel marketplace: https://vercel.com/marketplace/supabase/

---

## 8) “Backend exposed” incident pattern (what usually went wrong)

If a prior Netlify/Vercel + Supabase project felt “exposed”, the typical causes are:

- a table in an exposed schema without RLS enabled
- overly permissive RLS policies
- using the service role key in the frontend (or otherwise leaking it)

Fix is almost always:

- enable/correct RLS
- harden exposed schemas / privileges
- move privileged logic into Edge Functions

---

## 9) Pre-launch checklist (minimum)

- [ ] No `service_role` or DB secrets in frontend build env (`VITE_*`)
- [ ] RLS enabled + policies written for all exposed tables
- [ ] Storage buckets private + policies validated
- [ ] Data API hardened (exposed schemas intentional)
- [ ] Edge Functions: auth enforced; webhooks signature-verified
- [ ] Auth redirect URLs configured for prod + preview domains
- [ ] Supabase “Security Advisor” clean (or findings triaged)

---

## Appendix: Vercel previews should not use production data

Vercel Preview Deployments are great for UI iteration, but they should not accidentally point at the production Supabase project.

Because Utter uses static `vercel.json` rewrites for `/api/*`, the simplest safe approach is:

- a staging Vercel project (rewrites → staging Supabase)
- a production Vercel project (rewrites → production Supabase)

See `docs/vercel-frontend.md`.
