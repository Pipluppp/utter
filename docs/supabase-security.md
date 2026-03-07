# Supabase Security Guide

Last updated: **2026-03-06**

This is the current Supabase-layer security reference for Utter's active runtime:

- Frontend: Cloudflare Frontend Worker serving the React + Vite SPA
- API/runtime: Cloudflare API Worker on `/api/*`
- Async/storage: Cloudflare Queues + R2
- Data/auth: Supabase Postgres + Auth + RLS + credits/billing state
- Active TTS provider: qwen-only

Related docs:

- `docs/architecture.md`
- `docs/backend.md`
- `docs/database.md`

This guide is intentionally narrower than `architecture.md`: it documents what Supabase still protects, what moved out of Supabase after the Cloudflare migration, and which database-side controls are actually enforced by the current migrations and Worker code.

---

## 1) Core boundaries

Assume attackers can:

- see the Supabase project URL
- use the browser anon key
- call PostgREST / Data API endpoints directly
- call the API Worker directly
- replay any browser request outside the SPA

Implications:

- The Frontend Worker proxy is routing convenience, not an auth boundary.
- PostgREST is still a real attack surface for exposed schemas, even if the UI only uses `/api/*`.
- Supabase Auth is still the identity source.
- Active media storage security is no longer enforced by Supabase Storage policies. The live object boundary is Worker-signed R2 access.

The current security model is:

- Supabase RLS + grants protect database rows and direct Data API access.
- Cloudflare API Worker performs request validation, JWT verification, webhook verification, and all privileged writes.
- R2 access is gated by short-lived HMAC-signed Worker tokens.

---

## 2) Keys and clients

Safe in the browser:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STORAGE_SIGNING_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- provider secrets such as `DASHSCOPE_API_KEY` and `MISTRAL_API_KEY`

Current code paths:

- `frontend/src/lib/supabase.ts` uses the anon key for Auth/session lifecycle in the browser.
- `workers/api/src/_shared/supabase.ts` creates:
  - a user-scoped client with anon key + forwarded `Authorization` header
  - an admin client with the service-role key

Rule: the service-role key must stay inside the API Worker / queue consumer only.

---

## 3) Current Supabase data surface

The current public tables that matter for security are:

| Table | Authenticated direct access | Server-owned fields / behavior |
| --- | --- | --- |
| `profiles` | `SELECT` only | `subscription_tier`, `credits_remaining`, `design_trials_remaining`, `clone_trials_remaining` are server-owned |
| `voices` | `SELECT`, `DELETE` own rows | create/update happen through Worker; rows also contain provider metadata and object keys |
| `generations` | `SELECT`, `DELETE` own rows | create/finalize happen through Worker/queue |
| `tasks` | `SELECT` own rows only | all writes are server-owned |
| `credit_ledger` | `SELECT` own rows | immutable write path via service-role RPC |
| `rate_limit_counters` | no direct client access | service-role only |
| `trial_consumption` | no direct client access | service-role only |
| `billing_events` | no direct client access | service-role only |

Important nuance:

- `voices` and `generations` still allow direct authenticated `DELETE` through PostgREST today.
- That matches the current SQL tests, but it is weaker than the Worker-only delete behavior the app UI expects.
- See section 7 for why this is still a gap.

Legacy schema note:

- `modal_*` columns and `increment_task_modal_poll_count(...)` still exist in the schema for compatibility, but the active runtime is qwen-first and queue-first.
- They are hardened, but they are not part of the live happy path anymore.

---

## 4) Database controls enforced today

### 4a) RLS

RLS is enabled on all current public application tables:

- `profiles`
- `voices`
- `generations`
- `tasks`
- `rate_limit_counters`
- `credit_ledger`
- `trial_consumption`
- `billing_events`

Current repo tests also enforce that:

- policies use `(select auth.uid())` rather than bare `auth.uid()`
- no policy references `user_metadata`
- foreign keys used for ownership relations are indexed
- timestamps are `timestamptz`, not `timestamp without time zone`

Why this still matters:

- the `public` schema remains exposed through PostgREST
- a browser or attacker can bypass the SPA and hit the Data API directly
- RLS is therefore still mandatory even though privileged writes moved into the Worker

### 4b) Grants and least privilege

The important revocations in the current migrations are:

- `profiles`: `UPDATE` revoked from `authenticated`
- `voices`: `INSERT` and `UPDATE` revoked from `authenticated`
- `generations`: `INSERT` and `UPDATE` revoked from `authenticated`
- `tasks`: `INSERT`, `UPDATE`, `DELETE` revoked from `authenticated`
- `rate_limit_counters`, `credit_ledger`, `trial_consumption`, `billing_events`: client writes revoked; service-role only
- callable RPC execution is revoked from `anon` and `authenticated`

Current service-role-only RPCs include:

- `increment_task_modal_poll_count(...)`
- `rate_limit_check_and_increment(...)`
- `credit_apply_event(...)`
- `credit_usage_window_totals(...)`
- `trial_or_debit(...)`
- `trial_restore(...)`

These are explicitly re-granted only to `service_role`.

### 4c) Security definer usage

Current `security definer` functions in the migration path are small, database-local helpers such as:

- `handle_new_user()`
- `increment_task_modal_poll_count(...)`
- `rate_limit_check_and_increment(...)`
- `credit_apply_event(...)`
- `credit_usage_window_totals(...)`
- `trial_or_debit(...)`
- `trial_restore(...)`

The repo already follows the critical hardening rule here:

- `set search_path = ''`

Keep it that way. If a new `security definer` function is added, it must stay minimal, fully qualify objects, and have explicit execute grants.

---

## 5) What moved out of Supabase

The old Supabase-first security model no longer matches production reality.

### 5a) Storage boundary moved to R2

Active runtime facts:

- media lives in Cloudflare R2, not Supabase Storage
- the Worker signs upload/download tokens using `STORAGE_SIGNING_SECRET`
- `/api/storage/upload` and `/api/storage/download` are the live object gateway

What still exists in Supabase:

- `storage.buckets` entries and `storage.objects` policies for `references` and `generations`
- local `supabase/config.toml` bucket settings
- pgTAP storage tests that validate those policies

How to interpret that:

- Supabase Storage policy correctness is still useful for local parity and migration history
- it is not the primary protection for live production media access anymore
- do not assume `storage.objects` policies protect R2 objects

### 5b) Long-running orchestration moved to queue-first Worker flows

Active flows:

- `POST /api/generate` creates `generations` + `tasks`, debits credits, then enqueues work
- `POST /api/voices/design/preview` creates a `tasks` row, charges trial/credits, then enqueues work
- queue consumer finalizes provider work and updates Supabase rows with service-role credentials
- `GET /api/tasks/:id` is read-only and does not finalize jobs

Security implication:

- `tasks`, `generations`, credits, billing, and provider metadata are all server-owned state
- client writes must stay revoked unless there is a deliberate new RPC/Worker write path

---

## 6) Worker-side auth, billing, and abuse controls

### 6a) JWT verification

Protected Worker routes use `requireUser()` in `workers/api/src/_shared/auth.ts`, which:

- requires the `Authorization` header
- creates a user-scoped Supabase client
- calls `supabase.auth.getUser()`

This is the right pattern. The Worker is not trusting `getSession()` for authorization.

### 6b) Credits and billing are server-owned

Credits, trials, and billing state are enforced through service-role-only database paths:

- immutable `credit_ledger`
- `credit_apply_event(...)`
- `trial_or_debit(...)`
- `trial_restore(...)`
- `billing_events`

This is the correct design for Utter because:

- balance changes are atomic and idempotent
- retries do not double-charge
- client-controlled profile updates cannot mutate credits or plan state

### 6c) Rate limiting exists, but the identity is currently IP-based

The API Worker rate-limits requests through `rate_limit_check_and_increment(...)`.

Current implementation detail:

- `workers/api/src/_shared/rate_limit.ts` intentionally does not trust unverified JWT payload claims
- `resolveRateLimitIdentity()` currently returns `userId = null`
- effective rate limiting therefore falls back to hashed client IP only

That is still useful, but it means:

- authenticated per-user throttling is not currently enforced at the middleware layer
- shared IPs can interfere with each other
- per-user abuse containment still mostly relies on auth, credits, and task-level invariants

### 6d) Webhooks are signature-authenticated

`POST /api/webhooks/stripe` does not use user JWTs.

Instead it:

- requires `stripe-signature`
- verifies the HMAC against `STRIPE_WEBHOOK_SECRET`
- persists the event in `billing_events`
- uses idempotent credit grants keyed by Stripe event id

This is the correct trust boundary for webhook traffic.

---

## 7) Current gaps and sharp edges

These are the most important current-state caveats.

### 7a) Direct authenticated DELETE is still allowed on `voices` and `generations`

This is the main remaining least-privilege gap.

Today:

- the UI deletes through Worker routes
- Worker delete routes perform extra behavior such as:
  - soft-deleting voices via `deleted_at`
  - removing generation audio from R2
- but authenticated users can still delete their own `voices` and `generations` rows directly through PostgREST because DELETE grants + RLS policies remain in place

Why this matters:

- direct `DELETE public.voices` bypasses soft-delete semantics
- direct `DELETE public.generations` can orphan R2 generation audio
- direct `DELETE public.voices` can orphan reference objects or bypass future cleanup logic

Recommended fix:

- revoke direct `DELETE` on `voices` and `generations` from `authenticated`
- route deletions through Worker endpoints or explicit RPCs only

### 7b) R2 upload validation is still minimal

Current protections for clone uploads are:

- auth-gated upload URL creation
- server-chosen object key under `{user_id}/{voice_id}/reference.wav`
- short-lived signed upload token
- object existence and max-size check during finalize

Not currently enforced at the R2 boundary:

- MIME allowlisting
- audio content validation
- transcript/audio consistency

If upload abuse becomes a problem, validation needs to happen before or during finalize, not in the browser.

### 7c) Supabase Storage policies are no longer enough for media security

The repo still contains `storage.objects` policies and tests, but live media access no longer depends on them.

Rule: if the object is in R2, the real security boundary is the Worker token signer and the Worker routes, not Supabase Storage RLS.

---

## 8) Evaluation of `$supabase-postgres-best-practices`

The skill is a good baseline for the Postgres/Supabase part of this repo, but it is not a complete security guide for the current architecture.

### Guidance from the skill that the repo already follows well

- **RLS basics**: all multi-tenant public tables have RLS
- **RLS performance**: policies consistently use `(select auth.uid())`
- **Least privilege**: most direct client writes are revoked and privileged RPCs are service-role-only
- **Foreign key indexes**: ownership and relation FKs are indexed and tested
- **Data types**: timestamps are `timestamptz`; constraints are explicit

### Where the skill is directionally right, but this repo needs extra project-specific rules

- **Generic RLS guidance is not enough**:
  - the real problem here is not just row leakage
  - it is also server-owned state, idempotent billing, signed storage, and queue finalization
- **Least privilege must include side-effect safety**:
  - direct `DELETE` on `voices` / `generations` is still too permissive because it bypasses Worker cleanup
- **Storage guidance needs reinterpretation**:
  - the skill is Postgres-focused and does not cover R2 signed-token flows
- **Business invariants belong in trusted write paths**:
  - this repo correctly uses service-role RPCs and Worker routes for credits, trials, billing, and provider-owned fields

### Important things the skill does not cover well enough for this codebase

- Cloudflare Worker trust boundaries
- R2 signed upload/download token design
- webhook signature verification
- queue retry/idempotency behavior
- soft-delete vs hard-delete implications for external object storage
- direct Data API deletes that bypass server-side cleanup

### Bottom line

Use the skill as the baseline for:

- schema design
- RLS policy design
- grants
- indexes
- function hardening

Do not use it as the complete security model for Utter without adding:

- Worker auth rules
- R2 object access rules
- webhook rules
- credits/billing invariants
- cleanup-sensitive least-privilege rules

---

## 9) Current checklist

- [x] RLS enabled on all public multi-tenant tables in active use
- [x] `(select auth.uid())` pattern used in RLS policies
- [x] `profiles` updates are server-only
- [x] `voices` insert/update are server-only
- [x] `generations` insert/update are server-only
- [x] `tasks` writes are server-only
- [x] credit/trial/rate-limit/billing RPC execution is service-role-only
- [x] Worker auth uses `getUser()`, not `getSession()`
- [x] Stripe webhook uses signature verification, not JWT auth
- [x] media access is signed and short-lived
- [ ] direct authenticated `DELETE` on `voices` still bypasses Worker soft-delete/cleanup
- [ ] direct authenticated `DELETE` on `generations` still bypasses Worker-managed R2 cleanup
- [ ] rate limiting is still IP-based rather than verified-user-based
- [ ] R2 upload validation is still size/presence-oriented, not content-oriented
