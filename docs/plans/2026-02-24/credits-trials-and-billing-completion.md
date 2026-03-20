# Credits + Trials + Prepaid Billing Completion (2026-02-25)

## Goal

Ship the next credits phase for Utter with:

- generation billing unchanged (`1 credit = 1 character`)
- trial-first flat pricing
  - design preview: first `2` attempts free, then `5000` credits
  - clone finalize: first `2` attempts free, then `1000` credits
- prepaid packs (no subscriptions, no monthly reset)
  - `pack_150k`: `$10` -> `150000` credits
  - `pack_500k`: `$25` -> `500000` credits
- idempotent accounting across retries/failures/cancellations

## What Was Implemented

Implemented in phased order from `credits-trials-and-billing-task.md`:

1. Database migration
   - Added profile trial counters.
   - Added `trial_consumption` table + RLS/service-role hardening.
   - Added `billing_events` table + dedupe/state tracking.
   - Extended credit ledger operation/reference constraints for billing.
   - Added `trial_or_debit(...)` and `trial_restore(...)` RPCs.

2. Shared helpers and backend routes
   - Updated shared credit types/constants and added prepaid pack config.
   - Added trial/debit wrappers and restore helpers.
   - Updated design/clone/task flows for trial-first behavior and idempotent restore/refund handling.
   - Added billing routes:
     - `POST /api/billing/checkout`
     - `POST /api/webhooks/stripe`
   - Updated usage payload contract to include `trials`.

3. Frontend updates
   - Replaced monthly/subscription framing with prepaid-pack pricing content.
   - Updated billing page for prepaid checkout + purchased credit history.
   - Updated frontend types and pricing surfaces for new API contract.

4. Tests
   - Added pgTAP coverage for trial/debit/restore and billing constraints.
   - Added edge-function billing tests (webhook signature + idempotency + usage trials).
   - Updated design/clone/tasks/credits tests for new semantics.

## Validation Results

Executed locally on 2026-02-25:

- `npx supabase test db` -> PASS (`12 files`, `236 tests`)
- `deno test --allow-net --allow-env --allow-read supabase/functions/tests` -> PASS (`127 passed`, `0 failed`)
- `npm --prefix frontend run ci` -> PASS
- `npm --prefix frontend run typecheck` -> PASS
- `npm --prefix frontend run build` -> PASS

## Deployment Results

Executed on 2026-02-25:

- `npx supabase db push --linked` -> migration `20260225100000_credits_trials_and_prepaid_billing.sql` applied
- `npx supabase functions deploy api --project-ref jgmivviwockcwjkvpqra` -> deployed
- `npx vercel --prod --yes` -> production alias updated to `https://utter-wheat.vercel.app`

## Outcome

Task goals were achieved: trial-first pricing, prepaid packs, and idempotent accounting behavior are implemented, validated locally, and deployed to production.
