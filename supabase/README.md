# Supabase

Schema, RLS, RPC, seed, and pgTAP tests for Utter.

## Read This When

- you are changing schema
- you are touching credits, trials, or billing persistence
- you are debugging RLS or grants

## Commands

```bash
supabase start
supabase db reset
supabase test db
```

## Key Files

- config: `supabase/config.toml`
- seed: `supabase/seed.sql`
- migrations: `supabase/migrations`
- tests: `supabase/tests/database`

## What Lives Here

- core tables for profiles, voices, generations, tasks
- credit ledger and trial tables
- billing event log
- RLS and grants
- storage bucket policies
- SQL functions used by the API Worker

## Constraints

- Migrations are the source of truth.
- Do not hand-edit staging schema in the dashboard and call it done.
- Service-role flows must stay explicit and narrow.
- If API runtime behavior depends on schema or RPC changes, update [docs/database.md](../docs/database.md).

## Read Next

- [docs/database.md](../docs/database.md)
- [docs/backend.md](../docs/backend.md)
