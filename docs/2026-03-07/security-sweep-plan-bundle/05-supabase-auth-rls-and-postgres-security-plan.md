# Plan 05: Supabase Auth, RLS, and Postgres Security Sweep

## Goal

Verify that Supabase remains a strong system of record with correct least-privilege behavior, RLS enforcement, and billing/credit integrity.

## Scope

1. Supabase Auth configuration and key usage model
2. Postgres grants/RLS policies/functions
3. Credits, billing, and idempotency data integrity

## Test tasks

1. Auth/key model review:
- Confirm publishable/anon keys are only used client-side
- Confirm secret/service keys are server-only
- Confirm key rotation and storage practices

2. RLS and grants verification:
- Table-by-table policy review for `profiles`, `voices`, `generations`, `tasks`, billing tables
- Verify anon/authenticated/service_role permissions are explicit
- Verify direct REST/RPC access cannot bypass intended controls

3. SQL function and trigger review:
- SECURITY DEFINER usage and `search_path` hardening
- Function execute privileges and exposure
- Trigger behavior for credits/trials/account lifecycle

4. Data integrity and fraud resistance:
- Credit debit/refund idempotency across retries
- Billing event idempotency and duplicate webhook handling
- Concurrency/race checks on task + credits lifecycle

5. Observability and recovery readiness:
- Audit trail sufficiency for security incidents
- Backup/PITR readiness for data recovery

## Deliverables

1. RLS/grants audit worksheet
2. Auth/key-handling compliance checklist
3. Data-integrity findings report for credits/billing

## Exit criteria

1. RLS and grants enforce tenant isolation for all user-facing tables.
2. Service-role paths are constrained to server-side worker logic.
3. No critical ledger-integrity gaps remain for credits/billing.
