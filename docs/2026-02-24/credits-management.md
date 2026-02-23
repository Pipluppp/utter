# Task 2: Credits Management Foundation

## Goal

Ship a robust, auditable credits system with strict server-side enforcement and a clear product rule:

- **`1 credit = 1 character`**

## Core decisions

### Credit unit + billable operations

- **Generate (`POST /api/generate`)**
  - debit = `text.length`
- **Design preview (`POST /api/voices/design/preview`)**
  - debit = `text.length + instruct.length`
- **Clone finalize (`POST /api/clone/finalize`)**
  - debit = `transcript.length`

Non-billable in this phase:
- clone upload URL allocation (`POST /api/clone/upload-url`)
- voice save from already-generated preview audio (`POST /api/voices/design`)

### Refund policy (phase 1)

- **Generate**: full refund if task fails/cancels before successful completion.
- **Design preview**: full refund if preview task fails/cancels.
- **Clone finalize**: immediate refund if voice insert fails after debit.

### Idempotency rule

Every debit/refund uses a deterministic idempotency key tied to task/generation/voice IDs to guarantee exactly-once accounting under retries.

## Data model + DB enforcement

### Ledger-first schema

Add immutable ledger table:
- `public.credit_ledger`
  - `event_kind` (`debit|refund|grant|adjustment`)
  - `operation` (`generate|design_preview|clone|monthly_allocation|manual_adjustment`)
  - `amount` (positive absolute units)
  - `signed_amount` (negative for debits, positive for refunds/grants)
  - `balance_after`
  - `reference_type` + `reference_id`
  - `idempotency_key` (unique per user)
  - `metadata` JSONB

### Atomic RPC

Add `public.credit_apply_event(...)`:
- row-locks profile balance
- checks idempotency
- checks insufficient credits (without overdraft)
- updates `profiles.credits_remaining`
- writes immutable ledger row

Add `public.credit_usage_window_totals(...)`:
- server-side aggregate totals (debited/credited/net) for usage UI/API.

### Security / grants / RLS

- `credit_ledger` RLS enabled.
- `authenticated`: read-only own rows.
- writes + RPC execution restricted to `service_role`.

## Edge/API integration

### Enforced debit points

- `generate.ts`: debit before task submission.
- `design.ts` preview route: debit before task creation.
- `clone.ts` finalize route: debit before voice insert.

### Refund points

- `tasks.ts`: refund on generate/design-preview failure and cancel.
- `generate.ts`: refund on submission/setup failure path.
- `clone.ts`: refund on insert failure path.

### Usage endpoint

Add `GET /api/credits/usage` response with:
- current balance
- tier + monthly allocation
- period usage totals
- recent ledger events
- canonical rate card copy

## Frontend updates (landing + account)

- Landing pricing copy updated to **1 credit = 1 character** framing.
- Rate card copy aligned with operation-specific character-based charging.
- Account credits page now reads real usage/balance from `/api/credits/usage`.
- Account billing page now reflects live tier/balance and credit unit.

## Deliverables checklist

- [x] Credits rules finalized (`1 credit = 1 character` across billable operations).
- [x] Ledger-backed schema shipped with idempotent debit/refund RPC.
- [x] Atomic credit enforcement integrated into clone/design/generate flows.
- [x] Refund behavior integrated for failure/cancel paths.
- [x] Usage API + account UI now backed by live ledger/profile data.
- [x] Landing/account credit messaging aligned to the same unit model.

## Acceptance criteria

- [x] Requests that exceed credits are blocked with clear `402` responses.
- [x] Credits are deducted exactly once per billable action.
- [x] Failed/cancelled actions follow defined refund rules.
- [x] Ledger entries reconcile with displayed balance and usage totals.
- [x] Direct client tampering cannot increase credits (server-owned writes + restricted RPC).

## Mandatory post-implementation security gate

After deploying this task, run:
- `docs/2026-02-23/security-supabase/S9-post-credits-security-gate.md`

Do not mark this task complete until S9 passes.
