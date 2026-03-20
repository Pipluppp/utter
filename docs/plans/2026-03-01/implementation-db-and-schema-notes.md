# DB and Schema Implementation Notes

Date: 2026-03-02  
Status: Implementation guidance

## Default rule

No mandatory Postgres schema changes are required for Phases 01-03.

The migration is primarily runtime + storage adapter + hosting.

## Keep unchanged

1. Existing tables and indexes for voices/generations/tasks/profiles.
2. Credits and trials functions:
   - `credit_apply_event`
   - `trial_or_debit`
   - `trial_restore`
3. Billing event model and webhook idempotency behavior.
4. Existing RLS policies and grants.

## Optional schema changes (only if needed)

Use these only if migration operations require stronger traceability:

1. Add object-store marker column (`supabase|r2`) on rows with audio keys.
2. Add migration metadata fields to provider metadata JSON for audit.

These are optional; avoid schema churn unless operationally justified.

## Postgres best-practice guardrails during migration

1. Keep DB transactions short; do not hold locks during provider/storage HTTP calls.
2. Preserve indexes on `user_id` and high-frequency filter columns.
3. Keep RLS performance patterns (for example `(select auth.uid())` style where used).

## Testing requirements

1. Re-run database pgTAP suite after each phase touching write paths.
2. Re-run edge/API integration tests for credits/billing/task cancellation paths.
3. Add targeted staging tests for concurrent debit/refund edge cases after runtime cutover.
