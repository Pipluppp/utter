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
- declarative schemas: `supabase/schemas/` (DDL authoring source of truth)
- migrations: `supabase/migrations/` (deployment source of truth)
- seed: `supabase/seed.sql`
- tests: `supabase/tests/database`

## What Lives Here

- core tables for profiles, voices, generations, tasks
- credit ledger and trial tables
- billing event log
- RLS and grants
- storage bucket policies
- SQL functions used by the API Worker

## Schema Change Workflow

This project uses declarative schemas. To make a DDL change:

1. Edit the appropriate file in `supabase/schemas/`
2. Run `supabase db diff -f <descriptive_name>`
3. Review the generated migration
4. Commit both the schema edit and the migration

DML changes (data backfills, seed data) go in imperative migrations only. See `supabase/schemas/README.md` for full details.

## Constraints

- Schema files are the DDL authoring source of truth. Migrations are the deployment source of truth.
- Do not hand-edit staging schema in the dashboard and call it done.
- Do not write DDL migrations by hand — use `supabase db diff` against the schema files.
- Service-role flows must stay explicit and narrow.
- If API runtime behavior depends on schema or RPC changes, update [docs/database.md](../docs/database.md).

## Read Next

- [docs/database.md](../docs/database.md)
- [docs/backend.md](../docs/backend.md)
