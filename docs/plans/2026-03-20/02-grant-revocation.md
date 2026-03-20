# 02 — Database Grant Revocation

Priority: LOW
Status: Planned
Scope: Revoke excess `anon` and `authenticated` grants for defense-in-depth

## Problem

The `anon` role has SELECT grants on 4 tables with no corresponding RLS policies. `authenticated` has INSERT/DELETE on `profiles` with no policies. RLS blocks access today, but if RLS were ever accidentally disabled, these tables would be fully exposed via the Data API.

The Worker uses `service_role` for all server-side operations, so revoking these grants has no functional impact.

## Findings (2026-03-20)

### anon — excess SELECT

| Table | anon SELECT | RLS policy for anon? |
|---|---|---|
| `profiles` | YES | No |
| `voices` | YES | No |
| `generations` | YES | No |
| `tasks` | YES | No |

### authenticated — excess grants

| Table | Excess grant | RLS policy? |
|---|---|---|
| `profiles` | INSERT, DELETE | No INSERT or DELETE policy |

### Already correct (no action needed)

- `billing_events` — service_role only
- `rate_limit_counters` — service_role only
- `credit_ledger` — authenticated SELECT own only
- `trial_consumption` — service_role only
- `rate_limit_check_and_increment` — no anon/authenticated grants

## Migration

```sql
-- Revoke excess anon grants
REVOKE SELECT, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM anon;
REVOKE SELECT, TRUNCATE, REFERENCES, TRIGGER ON public.voices FROM anon;
REVOKE SELECT, TRUNCATE, REFERENCES, TRIGGER ON public.generations FROM anon;
REVOKE SELECT, TRUNCATE, REFERENCES, TRIGGER ON public.tasks FROM anon;

-- Revoke excess authenticated grants on profiles
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;
```

## Verification

- `anon` cannot SELECT from any public table (test via Data API with anon key)
- `authenticated` cannot INSERT or DELETE profiles via Data API
- All Worker-mediated flows still work (Worker uses `service_role`)

## Rollback

```sql
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.voices TO anon;
GRANT SELECT ON public.generations TO anon;
GRANT SELECT ON public.tasks TO anon;
GRANT INSERT, DELETE ON public.profiles TO authenticated;
```

## Note: db_pre_request

Not needed. The Data API is unused by clients now that everything goes through the Worker. The grant revocations are sufficient.
