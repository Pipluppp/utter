# Phase 08b — Automated Test Suite Plan

> **Status**: Implementing
> **Prerequisites**: Phases 01-08 complete, local Supabase stack functional
> **Goal**: Reproducible, CI-ready test suite covering schema validation, RLS policy correctness, edge function behavior, and integration flows with mocked Modal.
> **Replaces**: Ad-hoc bash/curl scripts (`scripts/phase08-test.sh`, `scripts/phase08-modal-e2e.sh`)

---

## Tool Decisions

### pgTAP for all database tests (not supabase-test)
- Our 4 tables use uniform `(select auth.uid()) = user_id` RLS — simple enough for SQL assertions
- Built into Supabase CLI: `supabase test db`, zero extra dependencies
- supabase-test would add Jest + pg + Node.js alongside our Deno stack for minimal gain
- pgTAP can simulate authenticated users via `SET LOCAL role/request.jwt.claims`

### Deno test runner for edge functions (not Jest)
- Edge functions ARE Deno — natural fit, official Supabase recommendation
- Uses `@std/assert` + `fetch()` against running edge functions
- No runtime mismatch (Jest would require Node.js parallel to Deno)

### Mock Modal server for external dependency
- Lightweight Deno HTTP server on fixed port 9999
- Edge functions served with `.env.test` pointing `MODAL_*` URLs to mock
- Mock simulates async polling: job starts "processing", completes after 2 polls
- Controllable failure injection for error-path testing

---

## File Structure

```
supabase/
  .env.test                           # Modal URLs → localhost:9999
  tests/
    database/
      00_extensions.test.sql          # pgTAP + pgcrypto loaded
      01_schema_tables.test.sql       # 4 tables: columns, types, constraints
      02_schema_indexes.test.sql      # All custom indexes + FK index invariant
      03_best_practices.test.sql      # Supabase Postgres best practices regression guards
      04_rls_profiles.test.sql        # Profile read-only isolation
      05_rls_voices.test.sql          # Voice read/delete isolation + no INSERT/UPDATE
      06_rls_generations.test.sql     # Generation read/delete + no INSERT/UPDATE
      07_rls_tasks.test.sql           # Task read-only + all writes blocked
      08_grants.test.sql              # REVOKE hardening (authenticated + anon)
      09_triggers_functions.test.sql  # Triggers + DB functions
      10_storage.test.sql             # Bucket existence + policies + write restrictions
  functions/
    tests/
      deno.json                       # Deno test config + import map
      _helpers/
        setup.ts                      # createTestUser(), apiFetch(), constants
        modal_mock.ts                 # ModalMock class (start/stop/reset)
        fixtures.ts                   # Test payloads, MINIMAL_WAV bytes
      health.test.ts
      languages.test.ts
      auth_guard.test.ts              # 401 enforcement on all protected routes
      me.test.ts
      clone.test.ts                   # 2-step upload flow
      voices.test.ts
      generate.test.ts                # Modal mock: submit + poll
      design.test.ts                  # Modal mock: voice design
      generations.test.ts
      tasks.test.ts                   # Full polling lifecycle
.github/
  workflows/
    test-supabase.yml                 # CI workflow
```

---

## Layer 1: pgTAP Database Tests

Run with: `supabase test db` (single command, ~143 assertions)

### RLS Testing Pattern

Each RLS test file uses this pattern to simulate authenticated users:

```sql
BEGIN;
SELECT plan(N);

-- Insert test users into auth.users (trigger auto-creates profiles)
INSERT INTO auth.users (id, instance_id, role, aud, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change)
VALUES
  ('aaaaaaaa-...', '00000000-...', 'authenticated', 'authenticated',
   'a@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  ('bbbbbbbb-...', '00000000-...', 'authenticated', 'authenticated',
   'b@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', '');

-- Insert test data as superuser (bypasses RLS)
INSERT INTO public.voices (...) VALUES (...);

-- Switch to User A
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-...","role":"authenticated"}';

-- Assert User A sees own data
SELECT results_eq($$SELECT count(*)::int FROM voices$$, ARRAY[1], 'sees own');

-- Switch to User B
RESET role;
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-...","role":"authenticated"}';

-- Assert User B can't see User A's data
SELECT results_eq($$SELECT count(*)::int FROM voices$$, ARRAY[0], 'isolation works');

SELECT * FROM finish();
ROLLBACK;
```

### Test Breakdown

| File | Tests | What |
|------|-------|------|
| `00_extensions` | 3 | pgTAP, pgcrypto, public schema exist |
| `01_schema_tables` | ~45 | has_table, has_column, col_type_is, col_not_null, col_default_is, col_is_pk for all 4 tables |
| `02_schema_indexes` | 9 | All custom indexes + FK index invariant (query for missing FK indexes → 0 rows) |
| `03_best_practices` | 21 | Supabase Postgres + security doc regression guards (see below) |
| `04_rls_profiles` | 8 | SELECT own, can't SELECT other, UPDATE revoked for authenticated, anon blocked |
| `05_rls_voices` | 10 | SELECT/DELETE own, INSERT/UPDATE revoked for authenticated, anon blocked |
| `06_rls_generations` | 8 | SELECT/DELETE own, no INSERT/UPDATE (revoked), cross-user denied |
| `07_rls_tasks` | 6 | SELECT own only, no INSERT/UPDATE/DELETE (all revoked), cross-user denied |
| `08_grants` | 14 | Authenticated: can't UPDATE profiles, can't INSERT/UPDATE voices, can't INSERT/UPDATE generations, can't write tasks. Anon: all writes blocked on all tables |
| `09_triggers_functions` | 9 | handle_updated_at, handle_new_user, increment_task_modal_poll_count + function security audit |
| `10_storage` | 8 | Bucket existence + privacy, policy existence, write restriction tests |

### `03_best_practices.test.sql` — Regression Guards

Derived from Supabase Postgres best practices AND `docs/supabase-security.md`:

| # | Guard | Tests | Source |
|---|-------|-------|--------|
| 1 | RLS enabled on all public tables | 4 | best practices |
| 2 | RLS uses `(select auth.uid())` pattern (not bare) | 4 | security-rls-performance.md, security doc §3 |
| 3 | No RLS policies reference `user_metadata` | 1 | security doc §7 |
| 4 | All timestamps are `timestamptz` | 1 | schema-data-types.md |
| 5 | Check constraints reject invalid values | 4 | best practices |
| 6 | FK cascade behavior works correctly | 3 | schema-foreign-key-indexes.md |
| 7 | Security-sensitive functions use DEFINER + search_path | 2 | security doc §5b |

> **Security Update:** Profile and voice write-surface hardening is now enforced by grants:
> `authenticated` cannot `UPDATE public.profiles` and cannot `INSERT public.voices` directly.
> Corresponding grant checks are covered in `08_grants.test.sql` and least-privilege guards in
> `03_best_practices.test.sql`.

### `10_storage.test.sql` — Storage Security

Beyond bucket existence, tests from `supabase-security.md §6`:
- Buckets are PRIVATE (2 tests)
- Storage policies exist (2 tests)
- Authenticated cannot INSERT into generations bucket (1 test)
- Authenticated cannot DELETE from references bucket (1 test)
- Cross-user read denied (1 test)
- Storage policies use `(select auth.uid())` pattern (1 test)

---

## Layer 2: Deno Edge Function Tests

Run with: `deno test --allow-net --allow-env --allow-read` (~65 tests)

Requires: `supabase start` + `npm run sb:serve:test` (edge functions with `.env.test`)

### Mock Modal Server

`_helpers/modal_mock.ts` — `ModalMock` class:
- Starts on fixed port 9999 in test setup, stops in teardown
- Tracks jobs in-memory: submit creates job, first poll returns "processing", second poll returns "completed"
- `getJobResultBytes` returns minimal valid WAV (44-byte header)
- `designVoicePreviewBytes` returns WAV immediately
- Controllable: `shouldFailSubmit`, `shouldFailDesign` flags for error-path tests
- `reset()` clears state between test files

### Test Helpers

`_helpers/setup.ts`:
- `createTestUser(email, password)` — sign-up via GoTrue API, returns `{ accessToken, userId }`
- `deleteTestUser(userId)` — admin deletion via service_role key
- `apiFetch(path, token, init?)` — fetch wrapper with auth headers
- Constants: `SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `API_URL`

`_helpers/fixtures.ts`:
- `MINIMAL_WAV` — 44-byte valid WAV file for storage uploads
- Payload templates for clone, generate, design

### Test Breakdown

| File | Tests | What |
|------|-------|------|
| `health` | 2 | 200 + `{ ok: true }`, CORS headers present |
| `languages` | 2 | Returns language list, no auth required |
| `auth_guard` | 10 | 401 on every protected endpoint without token, expired/tampered token rejection |
| `me` | 6 | Unauthenticated → `signed_in: false`, authenticated → profile, PATCH display_name, PATCH handle validation, duplicate handle rejection |
| `clone` | 8 | upload-url success, finalize success, upload WAV to signed URL, validation errors (missing name/transcript, name too long), finalize without upload → 400 |
| `voices` | 8 | List paginated, search, source filter, preview → 302, delete own, cross-user preview → 404, cross-user delete → 404 |
| `generate` | 6 | Submit with mock Modal, missing voice_id, text too long, nonexistent voice, voice without transcript, Modal failure → 502 |
| `design` | 6 | Preview creates task, save voice from FormData, validation (text/instruct too long), missing audio |
| `generations` | 7 | List paginated, status filter, audio → 302, delete + storage cleanup, regenerate returns redirect data, cross-user → 404 |
| `tasks` | 10 | Poll pending → processing, poll processing → completed (finalize audio), poll failed job, design_preview inline execution, cancel pending, cancel completed → rejected, delete, cross-user → 404 |

---

## Layer 3: CI Workflow

`.github/workflows/test-supabase.yml` — two parallel jobs:

### Job 1: `database-tests`
1. checkout
2. supabase/setup-cli@v1
3. `supabase start -x realtime,studio,inbucket,imgproxy,edge-runtime,logflare,vector,pgbouncer`
4. `supabase test db`
5. `supabase stop` (always)

Fast (~45s) — only starts Postgres + GoTrue.

### Job 2: `edge-function-tests`
1. checkout
2. supabase/setup-cli@v1 + denoland/setup-deno@v2
3. `supabase start`
4. `supabase functions serve api --env-file ./supabase/.env.test --no-verify-jwt &`
5. Wait for /health (retry loop, up to 60s)
6. `deno test --allow-net --allow-env --allow-read supabase/functions/tests/`
7. `supabase stop` (always)

Mock Modal starts within Deno test process (port 9999).

Triggered on: push to `main`/`refactor/backend-db-supabase`, PRs to `main`, when `supabase/**` changes.

---

## npm Scripts

```json
"test:db": "supabase test db",
"sb:serve:test": "supabase functions serve api --env-file ./supabase/.env.test --no-verify-jwt",
"test:edge": "cd supabase/functions && deno test --allow-net --allow-env --allow-read tests/",
"test": "npm run test:db"
```

---

## Implementation Order

### Phase A — pgTAP Foundation
1. `supabase/.env.test`
2. `00_extensions.test.sql` — verify `supabase test db` works
3. `01_schema_tables.test.sql` + `02_schema_indexes.test.sql`
4. `03_best_practices.test.sql`

### Phase B — Database Security Tests
5. `04_rls_profiles.test.sql` — establishes RLS test pattern
6. `05_rls_voices.test.sql`, `06_rls_generations.test.sql`, `07_rls_tasks.test.sql`
7. `08_grants.test.sql`, `09_triggers_functions.test.sql`, `10_storage.test.sql`

### Phase C — Deno Test Infrastructure
8. `deno.json`, `_helpers/fixtures.ts`, `_helpers/setup.ts`, `_helpers/modal_mock.ts`
9. `health.test.ts` + `languages.test.ts` — verify Deno runner works

### Phase D — Edge Function Tests (simple → complex)
10. `auth_guard.test.ts`, `me.test.ts`
11. `clone.test.ts`, `voices.test.ts`
12. `generate.test.ts`, `design.test.ts` (first tests using mock Modal)
13. `tasks.test.ts`, `generations.test.ts` (full polling lifecycle)

### Phase E — CI + Scripts
14. `.github/workflows/test-supabase.yml`
15. Update `package.json` scripts

---

## Verification

1. **pgTAP**: `supabase start` → `npm run test:db` → all ~143 tests pass
2. **Edge functions**: `supabase start` → `npm run sb:serve:test` (terminal 2) → `npm run test:edge` (terminal 3) → all ~65 tests pass
3. **CI**: Push branch → both GitHub Actions jobs pass green
4. **Regression check**: Compare coverage against `phase08-test.sh` — every scenario should have a corresponding pgTAP or Deno test

---

## Key References

| File | Why |
|------|-----|
| `supabase/migrations/20260207190731_initial_schema.sql` | Source of truth for schema, RLS, grants, triggers, storage |
| `supabase/migrations/20260207195500_task_poll_count.sql` | increment_task_modal_poll_count function |
| `supabase/functions/api/routes/tasks.ts` | Most complex route — Modal polling state machine |
| `supabase/functions/_shared/modal.ts` | All 5 Modal endpoint signatures (mock must replicate) |
| `supabase/functions/_shared/auth.ts` | Auth pattern for requireUser() |
| `docs/supabase-security.md` | Security guide — column escalation (§3b), storage (§6), auth (§7), checklist (§9) |
| `scripts/phase08-test.sh` | Existing test scenarios to port |
| `scripts/phase08-modal-e2e.sh` | Polling + audio retrieval scenarios |
