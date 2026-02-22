# Task 2: Credits Management Foundation

## Goal

Implement a reliable credits model that enforces usage limits, supports future pricing tiers, and produces auditable usage history.

## Why this is second

- Monetization and plan enforcement require secure, atomic usage accounting.
- This depends on Task 1 security controls to prevent direct credit tampering.

## Scope (initial)

### A. Credits domain model

- Define credit units per operation (clone, design preview, generation by text length, etc.).
- Define tier defaults and monthly allocations.
- Define insufficient-credit behavior.

### B. Ledger-first accounting

- Add or finalize immutable credit ledger records for every debit/credit event.
- Keep `profiles.credits_remaining` as a derived/runtime convenience, not the only source of truth.
- Ensure each event has reason + reference (task/generation/payment).

### C. Atomic enforcement in generation flows

- Perform credit checks before expensive job submission.
- Deduct credits atomically with idempotency safeguards.
- Add refund/reversal behavior for failed/cancelled operations (rules to be finalized).

### D. Usage visibility

- Populate usage page from real data (no placeholders).
- Expose recent credit events and current balance.
- Ensure totals are consistent with ledger.

## Explicit non-goals (for this task)

- Final pricing copy and marketing content polish.
- Full subscription lifecycle complexity beyond initial tier + credits wiring.

## Deliverables

- Credits rules doc (operations -> cost).
- Ledger-backed schema and server logic.
- Enforced checks/deductions in clone/generate/design flows.
- Usage API/UI showing real balances and history.

## Acceptance criteria (initial)

- [ ] Requests that exceed credits are blocked with clear error responses.
- [ ] Credits are deducted exactly once per successful billable action.
- [ ] Failed/cancelled actions follow defined refund rules.
- [ ] Ledger entries reconcile with displayed balance.
- [ ] Direct client tampering cannot increase credits.

## Open questions for next planning pass

- Exact per-feature cost schedule?
- Refund policy for partial failures/timeouts?
- Do we need monthly rollover or hard reset?

## Mandatory post-implementation security gate

After this task is implemented, run:
- `docs/2026-02-23/security-supabase/S9-post-credits-security-gate.md`

Do not treat credits task as complete until S9 passes.
