# S0: Scope + Ground Truth

Backlink: `README.md`

Goal: freeze baseline. Kill assumption drift. Every later task uses this as source.

## A. Runtime ground truth

- Frontend runtime: Vercel SPA.
- Backend runtime: Supabase Edge Function `api` with Hono router.
- Auth gate: `requireUser()` in `supabase/functions/_shared/auth.ts`.
- CORS helper: `supabase/functions/_shared/cors.ts` with `CORS_ALLOWED_ORIGIN`.
- Data clients:
  - user JWT-scoped client: `createUserClient()`
  - service role client: `createAdminClient()`

## B. API route surface (current)

From `supabase/functions/api/routes/*.ts`.

Protected routes (JWT required):
- `/api/clone/upload-url`
- `/api/clone/finalize`
- `/api/voices*`
- `/api/generate`
- `/api/generations*`
- `/api/tasks*`
- `/api/profile` (PATCH)
- `/api/transcriptions`

Public/low-risk routes:
- `/api/languages`
- `/api/health`
- `/api/me` returns `signed_in:false` when no auth header.

## C. DB and storage baseline

Tables:
- `public.profiles`
- `public.voices`
- `public.generations`
- `public.tasks`

Storage buckets:
- `references` private
- `generations` private

RLS:
- enabled on all 4 public tables.
- storage policies exist for user-scoped object access.

Grant hardening already applied:
- `profiles` direct update revoked from `authenticated`.
- `voices` direct insert/update revoked from `authenticated`.
- `generations` insert/update revoked from `authenticated`.
- `tasks` insert/update/delete revoked from `authenticated`.
- anon write revoked on app tables.
- RPC `increment_task_modal_poll_count` execute revoked from `public/anon/authenticated`, granted to `service_role` only.

## D. Known prior finding

- `supa-sniffer` found anonymous callable RPC: `increment_task_modal_poll_count`.
- Fixed by migration `20260223024500_rpc_execute_hardening.sql`.
- regression test added in `supabase/tests/database/08_grants.test.sql`.

## E. Baseline verification commands (run now, store output)

```bash
npm run test:all
```

SQL grant snapshot:

```sql
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee in ('anon','authenticated','service_role')
  and table_schema in ('public','storage')
order by grantee, table_schema, table_name, privilege_type;

select grantee, routine_schema, routine_name, privilege_type
from information_schema.routine_privileges
where routine_schema='public'
order by routine_name, grantee;
```

HTTP smoke:
- anon call to privileged RPC must return deny.
- anon writes to app tables must return deny.

## Exit criteria

- Baseline outputs archived under `docs/security/audits/YYYY-MM-DD/`.
- Team agrees this file matches current code and deployed behavior.

Next: `S1-access-control-grants-rls.md`.
