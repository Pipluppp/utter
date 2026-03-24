# Supabase Schema Audit Report

_Generated 2026-03-24 — read-only audit, no changes made._

---

## 1. Dead Tables

No fully dead tables found. All six tables (`profiles`, `voices`, `generations`, `tasks`, `credit_ledger`, `trial_consumption`, `rate_limit_counters`, `billing_events`) are referenced by application code.

---

## 2. Dead Columns

### `tasks.modal_job_id`

| Detail | |
|---|---|
| Defined in | `20260207190731_initial_schema.sql` |
| Indexed | Yes — `idx_tasks_modal_job_id` (partial) |
| Written by app | Never |
| Read by app | Never |
| Verdict | **Safe to drop** (column + index). Legacy Modal provider artifact. |

### `tasks.modal_poll_count`

| Detail | |
|---|---|
| Defined in | `20260207190731_initial_schema.sql` |
| Written by app | Never (the RPC `increment_task_modal_poll_count` exists but is never called) |
| Read by app | Read-only in `GET /tasks/:id` response — returned as `modal_poll_count` but always 0 for new tasks |
| Verdict | **Safe to drop** after removing the read in `routes/tasks.ts`. Dead weight from Modal era. |

### `generations.duration_seconds`

| Detail | |
|---|---|
| Defined in | `20260207190731_initial_schema.sql` |
| Written by app | Never — no code path sets this column |
| Read by app | Selected in `GET /generations` list and returned to frontend, but always `null` |
| Verdict | **Investigate** — may have been intended for actual audio duration (vs `generation_time_seconds` which tracks wall-clock processing time). Currently dead; either populate it from provider response or drop it. |

---

## 3. Dead / Unused Functions

### `increment_task_modal_poll_count(uuid, uuid)`

| Detail | |
|---|---|
| Defined in | `20260207195500_task_poll_count.sql` |
| Hardened in | `20260223024500_rpc_execute_hardening.sql` |
| Called by app | **Never** — zero references in worker code |
| Verdict | **Safe to drop.** Legacy Modal polling helper. |

---

## 4. Dead / Orphaned RLS Policies

All current RLS policies are exercised:

| Policy | Table | Exercised by |
|---|---|---|
| `profiles_select_own` | profiles | `GET /me`, `GET /credits/usage` (via user client) |
| `voices_select_own` | voices | `GET /voices`, `GET /voices/:id/preview`, `POST /generate` (voice lookup) |
| `voices_delete_own` | voices | Soft-delete reads via user client in `DELETE /voices/:id` |
| `generations_select_own` | generations | `GET /generations`, `GET /generations/:id/audio`, `DELETE /generations/:id` |
| `generations_delete_own` | generations | `DELETE /generations/:id` (ownership check via user client) |
| `tasks_select_own` | tasks | `GET /tasks`, `GET /tasks/:id`, `POST /tasks/:id/cancel` |
| `credit_ledger_select_own` | credit_ledger | `GET /credits/usage` (events list) |
| `credit_ledger_service_role_all` | credit_ledger | All credit RPC writes |
| `rate_limit_counters_service_role_all` | rate_limit_counters | Rate-limit middleware |
| `trial_consumption_service_role_all` | trial_consumption | `trial_or_debit` / `trial_restore` RPCs |
| `billing_events_service_role_all` | billing_events | `POST /webhooks/stripe` |

**Dropped policies** (already removed by migrations, confirmed clean):
- `profiles_update_own` — dropped in `20260212120000`
- `voices_insert_own` — dropped in `20260212120000`

No orphaned policies found.

---

## 5. Stripe-Specific Schema

Everything below is tied to Stripe billing. You haven't set up Stripe yet and may switch to Polar.

### `billing_events` table (entire table)

| Detail | |
|---|---|
| Defined in | `20260225100000_credits_trials_and_prepaid_billing.sql` |
| Columns | `id`, `provider` (default `'stripe'`), `provider_event_id`, `event_type`, `user_id`, `status`, `credits_granted`, `ledger_id`, `error_detail`, `payload`, `created_at`, `processed_at` |
| Used by | `routes/billing.ts` — webhook handler + checkout route |
| Verdict | **Keep if Stripe stays; rename/generalize if switching to Polar.** The `provider` column already supports multi-provider, but the default is `'stripe'` and the webhook handler is Stripe-specific. |

### `credit_ledger` operations: `paid_purchase`, `paid_reversal`

| Detail | |
|---|---|
| Defined in | `20260225100000` (constraint update) |
| Used by | `paid_purchase` is used in the Stripe webhook grant flow. `paid_reversal` is defined in the constraint but **never written by any code path**. |
| Verdict | `paid_purchase` — keep if billing stays. `paid_reversal` — dead enum value, safe to remove from constraint if desired. |

### `credit_ledger` reference_type: `billing`

| Detail | |
|---|---|
| Defined in | `20260225100000` (constraint update) |
| Used by | Stripe webhook grant writes `reference_type = 'billing'` |
| Verdict | Keep if billing stays. |

### Worker code: `routes/billing.ts`

| Detail | |
|---|---|
| Stripe-specific | Checkout session creation, webhook signature verification, `checkout.session.completed` event processing |
| Env vars | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PACK_30K`, `STRIPE_PRICE_PACK_120K` |
| Shared code | `_shared/credits.ts` — `PrepaidPack` type, `stripePriceIdForPack()`, `prepaidPackFromStripePriceId()` |
| Verdict | All of `routes/billing.ts` is Stripe-specific. The `credits.ts` pack definitions are billing-provider-agnostic in structure but reference Stripe price env vars. |

### Summary of Stripe surface

| Artifact | Type | Action if switching to Polar |
|---|---|---|
| `billing_events` table | Table | Rename `provider` default or keep as-is (already multi-provider capable) |
| `routes/billing.ts` | Worker route | Replace webhook + checkout logic |
| `credits.ts` pack definitions | Shared code | Replace `stripePriceEnv` references |
| `STRIPE_*` env vars (4) | Config | Replace with Polar equivalents |
| `paid_reversal` operation | Constraint enum | Dead — remove regardless |

---

## 6. Queue-Related / Redundant Job State in Supabase

The app uses Cloudflare Queues for async TTS processing. The `tasks` table in Supabase tracks job state alongside the queue. This is **intentional and active** — the tasks table serves as the durable state store that the frontend polls, while the queue handles delivery.

No Postgres-based job queue tables exist (no `pgboss`, `graphile_worker`, or custom job tables). The architecture is clean: queue for delivery, Supabase for state.

However, several `tasks` columns are vestiges of the old Modal provider polling model:

| Column | Status | Notes |
|---|---|---|
| `tasks.modal_job_id` | **Dead** | Was for Modal job tracking. Never written. Has a partial index. |
| `tasks.modal_poll_count` | **Dead** | Was for Modal polling. Only read (never written) in task detail endpoint. |
| `tasks.provider_poll_count` | **Written never, read once** | Selected in `GET /tasks/:id` but never incremented by any code. Qwen flow doesn't poll. |

All three are safe to drop once the read in `routes/tasks.ts` is cleaned up.

---

## 7. Modal Provider Residue (Bonus)

Beyond the columns above, the `modal` value persists in several check constraints as a valid enum:

| Constraint | Table | Values |
|---|---|---|
| `voices_tts_provider_check` | voices | `('modal', 'qwen')` |
| `tasks_provider_check` | tasks | `('modal', 'qwen')` |
| `generations_tts_provider_check` | generations | `('modal', 'qwen')` |

No code ever writes `provider = 'modal'` anymore. All new rows use `'qwen'`. These constraints are harmless but could be tightened to `('qwen')` only if no legacy `modal` rows exist in production.

The `tasks.type` constraint still includes `'clone'` — but clone tasks are no longer created through the queue-backed task flow (clone is synchronous in `routes/clone.ts`). The type value is still valid for the `tasks` table schema but no clone-type tasks are created by current code.

---

## Summary

| Category | Count | Safe to drop now | Needs investigation |
|---|---|---|---|
| Dead tables | 0 | — | — |
| Dead columns | 3 | `modal_job_id`, `modal_poll_count` | `duration_seconds` (decide: populate or drop) |
| Dead functions | 1 | `increment_task_modal_poll_count` | — |
| Dead RLS policies | 0 | — | — |
| Stripe-specific artifacts | 5+ | `paid_reversal` enum value | Rest depends on billing provider decision |
| Unused task columns | 1 | `provider_poll_count` | — |
| Modal enum residue | 3 constraints | Tighten after verifying no `modal` rows in prod | — |
