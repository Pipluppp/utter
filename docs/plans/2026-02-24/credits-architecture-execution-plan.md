# Credits Architecture Execution Plan (v4, Final)

## Objective

Implement a robust, auditable credit system that is simple for users and safe under retries/failures.

## Final Product Rules

- generation: `1 credit = 1 character`
- design preview: first `2` attempts free, then `5000` credits flat
- clone finalize: first `2` attempts free, then `1000` credits flat
- prepaid packs only:
  - `pack_150k`: `$10` -> `150000` credits
  - `pack_500k`: `$25` -> `500000` credits
- no monthly reset, no subscription in this phase

## Current Codebase Reality (cross-check)

Already implemented:

- immutable ledger + idempotent debit/refund RPC
- debit/refund enforcement for generate/design/clone
- usage API + account usage UI

Not implemented yet:

- trial counters and trial idempotency path
- paid purchase operations and billing tables/routes
- prepaid-oriented frontend purchase flow
- usage API trial fields

## Target Architecture

### 1. Credit and Trial Accounting

Keep two explicit accounting tracks:

- credits: `credit_ledger` + `credit_apply_event`
- trials: `profiles` counters + `trial_consumption` table + trial RPCs

This avoids forcing zero-value trial events into `credit_ledger` and keeps idempotency explicit.

### 2. Trial Data Model

Add to `profiles`:

- `design_trials_remaining integer not null default 2`
- `clone_trials_remaining integer not null default 2`

Add `public.trial_consumption`:

- immutable-ish record of trial consumption/restoration
- unique `(user_id, idempotency_key)`
- operation (`design_preview|clone`)
- status (`consumed|restored`)
- reference fields + metadata + timestamps

### 3. Trial RPCs

- `trial_or_debit(...)`:
  - checks trial idempotency key first
  - consumes trial exactly once if available
  - otherwise debits credits via `credit_apply_event`
- `trial_restore(...)`:
  - restores previously consumed trial exactly once
  - no-op on duplicate restore attempts

### 4. Ledger Expansion

Extend allowed `credit_ledger.operation` values:

- `paid_purchase`
- `paid_reversal`

Extend allowed `reference_type` with:

- `billing`

### 5. Billing Pipeline

Add:

- `POST /api/billing/checkout` (auth)
- `POST /api/webhooks/stripe` (signature verified)
- `public.billing_events` replay-safe audit table

Webhook grant flow:

1. verify signature
2. dedupe event ID
3. resolve user and `price_id`
4. resolve credit amount from trusted server mapping
5. grant via `credit_apply_event` with deterministic idempotency key
6. persist processed/failed result in `billing_events`

### 6. Refund/Failure Guarantees

- generate: refund credits on failure/cancel (existing)
- design/clone credit path: refund credits on failure (existing + updates)
- design/clone trial path: restore trial on failure/cancel
- reconciliation worker: optional hardening phase for stale in-flight tasks

### 7. Usage API Contract (prepaid mode)

`GET /api/credits/usage` target fields:

- `credit_unit`, `balance`, `usage`, `rate_card`, `events`
- `trials`: `design_remaining`, `clone_remaining`

Remove monthly-plan semantics (`monthly_credits`) from response.

### 8. Frontend Contract

- pricing surface uses one-time pack cards (not monthly plans)
- billing page supports purchase flow + purchase history
- rate card copy matches `generate + trialed flat rates`
- no monthly reset copy anywhere

## Key Risk Controls

- server-only grant authority
- no direct client credit/trial mutation paths
- idempotency required on debit, trial consume, trial restore, paid grant
- strict grants/RLS on new billing/trial tables

## Execution Source of Truth

Implementation steps and file-level changes are specified in:

- `docs/2026-02-24/credits-trials-and-billing-task.md`
