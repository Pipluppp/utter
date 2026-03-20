# S1: Access Control, Grants, RLS

Backlinks: `README.md`, `S0-scope-ground-truth.md`

Goal: least privilege enforced by DB and code. Regressions caught in tests.

## Why this task

- Access bugs are highest blast radius (A01 OWASP).
- RLS alone not enough if grants/function execute are loose.

## Implementation steps

1. Add privilege inventory SQL script.
- File: `scripts/security/sql/grants_snapshot.sql`
- Include:
  - table grants by role
  - routine execute grants by role
  - RLS enabled/forced status

2. Expand pgTAP tests in `supabase/tests/database/08_grants.test.sql`.
- For each privileged RPC: assert `anon` + `authenticated` no execute.
- Assert `service_role` execute only where required.
- Keep existing `increment_task_modal_poll_count` assertions.

3. Add/expand pgTAP tests for direct table write denials.
- `profiles` update denied for authenticated direct SQL role.
- `voices` insert/update denied for authenticated direct SQL role.
- `generations` insert/update denied.
- `tasks` insert/update/delete denied.

4. Expand Deno edge tests for auth and cross-user.
- Files: `supabase/functions/tests/*.test.ts`
- Ensure each route family has:
  - unauth request -> 401 where expected
  - cross-user operation -> 403/404 deny behavior

5. Add checklist gate in PR template or release checklist.
- Any new table/RPC must ship with grants + tests in same PR.

## Verification

Local:

```bash
npm run test:db
npm run test:edge
npm run test:all
```

Manual SQL verify (local/staging): run queries from `S0`.

Production verify:
- anon/publishable call to privileged RPC returns deny (not 200).
- direct PostgREST tamper on server-owned fields denied.

## Deliverables

- `scripts/security/sql/grants_snapshot.sql`
- expanded pgTAP + Deno tests
- updated checklist docs

## Exit criteria

- tests fail if grants drift open.
- no privileged RPC callable by anon/authenticated unless explicitly intended.

Next: `S2-external-probing-supa-sniffer.md`.
