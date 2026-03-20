# S9: Post-Credits Anti-Cheat Security Gate

Backlinks: `README.md`, `../../2026-02-24/credits-management.md`, `S1-access-control-grants-rls.md`, `S3-policy-testing-supashield.md`

When to run: only after Task 2 (`../../2026-02-24/credits-management.md`) is implemented and deployed to staging.

Goal: prove credits system cannot be cheated via tamper, race, replay, or failure edge cases.

## What this gate checks

1. Atomic debit.
- debit + business action linked atomically.
- no partial state where usage succeeds without debit.

2. Idempotency / replay safety.
- retries or duplicate submits cannot double-charge or bypass charge.
- same idempotency key cannot create multiple billable events.

3. Concurrency/race safety.
- parallel requests cannot overspend balance.
- no negative or impossible balance state.

4. Tamper resistance.
- direct PostgREST/API attempts to edit credits/tier denied.
- server-owned fields still non-client-writable.

5. Refund/reversal correctness.
- failed/cancelled jobs follow defined reversal rule.
- no free-success, no charge-on-total-failure (per policy).

6. Ledger integrity.
- every debit/credit has reason, reference, timestamp.
- displayed balance reconciles with ledger.

7. Cross-user boundary.
- user A cannot affect user B balance/ledger rows.

## Step-by-step execution

1. Build scenario matrix.
- success path charge
- insufficient balance deny
- duplicate submit
- concurrent submit race
- upstream fail before completion
- cancellation path
- manual tamper attempts

2. Automated tests.
- DB tests for grants/policies and invariants.
- edge integration tests for debit/refund/idempotency behavior.
- add stress/concurrency test harness for double-spend checks.

3. Manual tamper probes.
- direct REST PATCH/UPDATE against credits/tier fields.
- expected deny (`401/403/42501` depending path).

4. Reconciliation test.
- run sample billable operations.
- compute expected ledger sum.
- confirm API/UI balance match.

5. Cross-user tests.
- A/B accounts, ensure no write/read crossover on credit data.

6. Artifact + signoff.
- store report under `docs/security/audits/YYYY-MM-DD/credits-gate.md`.
- mark blocking issues.

## Required evidence

- test logs for concurrency and idempotency cases.
- tamper probe outputs.
- reconciliation worksheet (expected vs actual).
- list of unresolved issues with severity.

## Exit criteria

- no known double-spend path.
- no client tamper path for server-owned credit fields.
- ledger and balance reconcile for test scenarios.
- unresolved high/critical issues = release blocked.

Done after this: return to `README.md` workstream DoD checks.
