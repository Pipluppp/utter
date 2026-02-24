# Task 2: Credits Management Foundation (Shipped) + Next-Phase Contract

## Status

The foundation is already implemented in the codebase:

- immutable credit ledger (`public.credit_ledger`)
- atomic idempotent credit RPC (`public.credit_apply_event`)
- debit/refund paths in generate/design/clone flows
- usage API (`GET /api/credits/usage`) + account usage UI

This document now serves as the bridge from shipped foundation to the next implementation task.

## Canonical Credit Rule

- `1 credit = 1 character` for generation.

## Finalized Product Rules (next phase)

- `POST /api/generate`: debit `text.length` credits.
- `POST /api/voices/design/preview`: first `2` attempts free per account, then `5000` credits flat.
- `POST /api/clone/finalize`: first `2` attempts free per account, then `1000` credits flat.
- prepaid packs only (no monthly reset, no expiry):
  - `pack_150k`: `$10` -> `150000` credits
  - `pack_500k`: `$25` -> `500000` credits
- starter balance remains `100` credits by default.

## Trial Rules

- trial scope: all accounts get `2` design trials and `2` clone trials.
- trial counters do not reset on pack purchase.
- failed attempts restore a consumed trial.
- trial consume/restore must be idempotent and race-safe.

## Data Model Additions Required

- `profiles.design_trials_remaining integer not null default 2`
- `profiles.clone_trials_remaining integer not null default 2`
- `public.trial_consumption` (immutable-ish event table for idempotent trial accounting)
  - unique `(user_id, idempotency_key)`
  - operation (`design_preview|clone`)
  - status (`consumed|restored`)
  - reference fields + metadata + timestamps

## RPC Additions Required

- `public.trial_or_debit(...)`
  - consumes trial when available (exactly once per idempotency key)
  - otherwise delegates to `credit_apply_event` for debit
  - returns whether trial or credit path was used
- `public.trial_restore(...)`
  - restores a previously consumed trial exactly once
  - no-op on duplicate restore attempts

## Ledger Operation Expansion Required

- add operations: `paid_purchase`, `paid_reversal`
- keep existing: `generate`, `design_preview`, `clone`, `monthly_allocation`, `manual_adjustment`

## Usage API Contract (target)

`GET /api/credits/usage` should return:

- `credit_unit`
- `balance`
- `usage` totals
- `rate_card`
- `events`
- `trials`:
  - `design_remaining`
  - `clone_remaining`

`monthly_credits` should be removed from the response for prepaid mode.

## Security Requirements (non-negotiable)

- only `service_role` can mutate credits/trials/billing events.
- clients cannot call credit/trial mutation RPCs directly.
- paid grants only happen from verified webhook events.
- grant amounts must be derived from trusted server mapping (`price_id -> pack -> credits`).

## Source of Truth for Implementation

Use `credits-trials-and-billing-task.md` as the executable implementation plan.
