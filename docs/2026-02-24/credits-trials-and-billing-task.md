# Task 2C: Credits + Trials + Prepaid Billing Implementation Plan

## Purpose

This is the executable implementation plan for the next credits phase.

It supersedes prior draft assumptions that used monthly-plan semantics or outdated pricing values.

## Final Decisions (must stay consistent)

- generation: `text.length` credits
- design preview: first `2` attempts free, then `5000` credits
- clone finalize: first `2` attempts free, then `1000` credits
- prepaid packs:
  - `pack_150k` = `$10` -> `150000` credits
  - `pack_500k` = `$25` -> `500000` credits
- starter credits: `100`
- no subscriptions, no monthly resets, no expiry in this phase

## Current Codebase Baseline

Already present:

- `public.credit_ledger`
- `public.credit_apply_event(...)`
- credit debits/refunds in:
  - `supabase/functions/api/routes/generate.ts`
  - `supabase/functions/api/routes/design.ts`
  - `supabase/functions/api/routes/clone.ts`
  - `supabase/functions/api/routes/tasks.ts`
- usage endpoint:
  - `supabase/functions/api/routes/credits.ts`

## Phase 1: Database Migration

Create migration:

- `supabase/migrations/<timestamp>_credits_trials_and_prepaid_billing.sql`

### 1.1 Profiles trial counters

Add columns:

- `design_trials_remaining integer not null default 2`
- `clone_trials_remaining integer not null default 2`

### 1.2 Trial idempotency table

Create `public.trial_consumption` with:

- `id bigserial primary key`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `operation text not null check (operation in ('design_preview','clone'))`
- `reference_type text not null check (reference_type in ('task','voice'))`
- `reference_id uuid`
- `idempotency_key text not null check (char_length(idempotency_key) between 1 and 128)`
- `status text not null check (status in ('consumed','restored'))`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `restored_at timestamptz`
- `unique (user_id, idempotency_key)`

Indexes:

- `(user_id, created_at desc, id desc)`
- `(operation, reference_id)` where `reference_id is not null`

Security:

- enable RLS
- authenticated read not required in this phase
- revoke all from `public`, `anon`, `authenticated`
- grant service_role-only privileges

### 1.3 Expand ledger constraints

Update `credit_ledger` checks and `credit_apply_event` validation lists:

- operation add: `paid_purchase`, `paid_reversal`
- reference_type add: `billing`

### 1.4 Trial RPCs

Add `public.trial_or_debit(...)`:

Inputs:

- `p_user_id`
- `p_operation` (`design_preview|clone`)
- `p_debit_amount` (`5000|1000`)
- `p_reference_type` (`task|voice`)
- `p_reference_id`
- `p_idempotency_key`
- `p_metadata`

Behavior:

1. lock profile row `FOR UPDATE`
2. check `trial_consumption` by `(user_id, idempotency_key)`
3. if existing trial record, return existing result (idempotent)
4. if trial remaining > 0:
   - decrement trial counter
   - insert `trial_consumption(status='consumed')`
   - return `used_trial=true`
5. else call `credit_apply_event(... debit ...)` and return `used_trial=false`

Add `public.trial_restore(...)`:

Inputs:

- `p_user_id`
- `p_operation`
- `p_idempotency_key` (same consume key)
- optional restore metadata

Behavior:

1. lock matching `trial_consumption` row
2. if row missing or already restored -> no-op (idempotent)
3. increment matching profile trial counter (cap at 2)
4. mark row `status='restored'`, set `restored_at`

Privileges:

- revoke execute from anon/authenticated
- grant execute to service_role only

### 1.5 Billing events

Create `public.billing_events`:

- minimal schema from `paid-credit-addition.md`
- unique `provider_event_id`
- states `received|processed|ignored|failed`
- `ledger_id` FK to `credit_ledger`

Security:

- enable RLS
- no authenticated policies
- explicit revoke/grant service_role-only

## Phase 2: Shared Backend Helpers

File:

- `supabase/functions/_shared/credits.ts`

Changes:

- `CreditOperation` add `paid_purchase|paid_reversal`
- `referenceType` add `billing`
- `creditsForDesignPreview()` -> `5000`
- `creditsForCloneTranscript()` -> `1000`
- add constants:
  - `DESIGN_TRIAL_LIMIT = 2`
  - `CLONE_TRIAL_LIMIT = 2`
- add prepaid pack config:
  - `pack_150k`, `pack_500k`
- add helper wrappers:
  - `trialOrDebit(...)`
  - `trialRestore(...)`
- update rate card copy to trialed flat-rate wording

## Phase 3: Route Changes (credit/trial paths)

### 3.1 `design.ts`

Replace debit block with `trialOrDebit(...)`.

Persist in task metadata:

- `used_trial`
- `trial_idempotency_key` (when applicable)
- `credits_debited` (`0` for trial path, `5000` for credit path)

On task insert failure:

- if `used_trial`, call `trialRestore(...)`
- else run credit refund path

### 3.2 `clone.ts`

Replace debit block with `trialOrDebit(...)`.

Use local `used_trial` + idempotency key in inline failure path:

- if voice insert fails and `used_trial`, call `trialRestore(...)`
- else refund `1000` credits

Do not assume a `voices.metadata` column (none exists).

### 3.3 `tasks.ts`

Update refund logic for design preview:

- inspect `metadata.used_trial`
- if `true`: `trialRestore(...)`
- if `false`: refund credits with existing idempotent key

Keep generate flow unchanged.

## Phase 4: Billing Routes

Add file:

- `supabase/functions/api/routes/billing.ts`

### 4.1 Checkout

`POST /api/billing/checkout`:

- require auth
- validate `pack_id` allowlist
- create Stripe Checkout session (`mode=payment`)
- include metadata (`user_id`, `pack_id`)
- return `{ url }`

### 4.2 Webhook

`POST /api/webhooks/stripe`:

- verify Stripe signature
- dedupe via `billing_events.provider_event_id`
- for `checkout.session.completed`:
  - fetch line items
  - resolve `price_id`
  - map `price_id -> credits` from server config
  - apply grant event via `credit_apply_event`:
    - `event_kind='grant'`
    - `operation='paid_purchase'`
    - `reference_type='billing'`
    - idempotency key `stripe:event:<event_id>:grant`
  - mark event processed with ledger linkage
- ignore unsupported events safely

Register route in:

- `supabase/functions/api/index.ts`

## Phase 5: Usage API Contract Update

File:

- `supabase/functions/api/routes/credits.ts`

Changes:

- include profile trial columns in select
- add `trials` response object:
  - `design_remaining`
  - `clone_remaining`
- remove `monthly_credits` from `plan` payload in prepaid mode

## Phase 6: Rate Limiting + Env

### 6.1 Rate limits

File:

- `supabase/functions/_shared/rate_limit.ts`

Add explicit rule:

- `POST /api/billing/checkout` -> `tier1`

Webhook can remain default `tier3`.

### 6.2 Environment

Files:

- `supabase/.env.local`
- `supabase/.env.test`

Add:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PACK_150K`
- `STRIPE_PRICE_PACK_500K`

## Phase 7: Frontend Changes

### 7.1 Pricing content

Files:

- `frontend/src/content/plans.ts`
- `frontend/src/components/marketing/PricingGrid.tsx`
- `frontend/src/components/marketing/PricingContent.tsx`
- `frontend/src/pages/landing/PricingSection.tsx`

Replace monthly-plan objects/UI with prepaid pack UI and updated rate copy.

### 7.2 Billing page

File:

- `frontend/src/pages/account/Billing.tsx`

Implement:

- current balance panel
- pack purchase CTAs
- redirect to Stripe checkout URL
- purchased-credit history from ledger events (`operation='paid_purchase'`)

### 7.3 Types

File:

- `frontend/src/lib/types.ts`

Update `CreditsUsageResponse` to include `trials`; remove dependency on `monthly_credits`.

## Stale Semantics Cleanup List

Remove or replace all monthly/subscription framing in:

- `MONTHLY_CREDITS_BY_TIER` usage paths
- `monthly_credits` usage API fields
- frontend `/month` pricing copy
- account billing “current plan / monthly credits / compare plans” copy

## Test Plan

### Database (pgTAP)

Add tests for:

- `trial_or_debit`: first 2 consume trial, third debits credits
- idempotent retry on trial path does not consume extra trial
- `trial_restore`: one-time restore only
- operation/reference constraints support paid billing values
- `billing_events` grants/RLS hardening

### Edge tests

Add `supabase/functions/tests/billing.test.ts`:

- checkout requires auth
- invalid pack rejected
- invalid webhook signature rejected
- duplicate webhook does not double grant
- `/credits/usage` includes `trials`

### Regression tests

Update existing clone/design tests for new debit/trial behavior.

## Acceptance Criteria

- generation remains character-billed
- design/clone apply trial-first then flat-credit policy exactly
- retries do not double consume trials
- trial restores are idempotent
- successful payment grants credits exactly once
- forged/replayed webhooks cannot mint credits
- usage endpoint and UI reflect trial state and prepaid model

## Release Gate

Before production rollout, complete:

- `docs/2026-02-23/security-supabase/S9-post-credits-security-gate.md`

Store evidence in:

- `docs/security/audits/YYYY-MM-DD/paid-credits-gate.md`
