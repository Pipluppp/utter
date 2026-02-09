# Phase 08 — Testing

> **Status**: Complete (automated suite), In Progress (manual browser QA)
>
> 227 automated tests passing: 140 pgTAP (database) + 87 Deno (edge functions)

---

## What's in this directory

| File | Purpose |
|------|---------|
| [running-tests.md](./running-tests.md) | How to run the test suite (quick reference + detailed instructions) |
| [test-suite-plan.md](./test-suite-plan.md) | Architecture decisions, file structure, test breakdowns |
| [qa-security.md](./qa-security.md) | Manual QA checklist (core flows, RLS isolation, security) |
| [testing-guide.md](./testing-guide.md) | CLI testing guide for running manual QA via curl |

---

## What we built

The automated test suite replaces the ad-hoc bash/curl scripts (`scripts/phase08-test.sh`, `scripts/phase08-modal-e2e.sh`) with two proper test layers that run in CI.

### Layer 1: pgTAP database tests (140 tests, 11 files)

SQL-based tests that run inside Postgres via `supabase test db`. They validate the schema is correct and the security model holds. Each test file runs inside a `BEGIN/ROLLBACK` transaction so nothing persists.

**What they cover:**
- Schema correctness: all 4 tables have the right columns, types, PKs, NOT NULL, defaults
- Indexes: custom indexes exist, all foreign keys have backing indexes
- Best-practice guards: RLS enabled on all tables, `(select auth.uid())` pattern used (not bare `auth.uid()`), `timestamptz` used everywhere, CHECK constraints on enums, FK cascades, SECURITY DEFINER on sensitive functions
- RLS policies: each table tested with two simulated users (User A and User B) to verify read/write isolation and that blocked operations (e.g. UPDATE on voices, all writes on tasks) are actually denied
- Grant revocations: authenticated and anon roles can't bypass edge functions via direct PostgREST
- Triggers: `handle_new_user` auto-creates profiles, `updated_at` auto-updates, `increment_task_modal_poll_count` works
- Storage: buckets exist and are private, storage policies exist

**How RLS simulation works:**
```sql
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
-- Now queries run as that user, RLS applies
SELECT * FROM voices;  -- only sees own rows
```

### Layer 2: Deno edge function tests (87 tests, 10 files)

HTTP-level integration tests that call the running edge functions via `fetch()`. They test the actual API contract: request validation, auth guards, CRUD operations, cross-user isolation, and Modal integration.

**How they work:**
1. Each test file has a `setup` test that creates test users via the Supabase Auth API
2. Tests call the edge functions through the same HTTP interface the frontend uses
3. A `teardown` test deletes the test users (which cascades to clean up all their data)
4. For tests involving Modal (generate, tasks, design preview), a mock HTTP server on port 9999 simulates Modal's 5 endpoints

**The Modal mock** (`supabase/functions/tests/_helpers/modal_mock.ts`):
- Simulates the async job lifecycle: submit returns a job ID, first status poll returns "processing", second returns "completed", result returns a minimal WAV file
- Controllable failure injection: `shouldFailSubmit`, `shouldFailDesign`, `shouldFailResult`
- Edge functions connect to it when served with `.env.test` (which sets `MODAL_*` URLs to `http://localhost:9999`)
- Tests are written to pass in both modes: with `.env.test` (mock) and `.env.local` (real Modal)

**Key test helpers** (`supabase/functions/tests/_helpers/`):
- `setup.ts`: `createTestUser()`, `deleteTestUser()`, `apiFetch()` with auth headers
- `fixtures.ts`: test user credentials, payload templates, `MINIMAL_WAV` (44-byte valid WAV header)

**Deno-specific gotchas we solved:**
- Deno's leak detector flags unconsumed `fetch()` response bodies. Every test that only checks `res.status` without calling `res.json()` needs `await res.body?.cancel()`.
- The `@supabase/supabase-js` client creates internal realtime WebSocket intervals that trigger Deno's leak detector. Tests using the admin client need `sanitizeResources: false, sanitizeOps: false`.

### CI workflow

`.github/workflows/test-supabase.yml` runs two parallel jobs on push/PR when `supabase/` files change:

| Job | What it does | Speed |
|-----|-------------|-------|
| `database-tests` | Starts minimal Supabase (Postgres + GoTrue only), runs `supabase test db` | ~45s |
| `edge-function-tests` | Starts full Supabase, serves edge functions with `.env.test`, waits for health check, runs Deno tests (mock Modal auto-starts inside test process) | ~2min |

---

## Quick start

```bash
npm run sb:start          # Start local Supabase
npm run test:db           # Run 140 pgTAP tests
npm run sb:serve:test     # Serve edge functions with mock Modal (separate terminal)
npm run test:edge         # Run 87 Deno tests
npm run test:all          # Both suites sequentially
```

See [running-tests.md](./running-tests.md) for full details.

---

## Current state

**Automated (complete):**
- All schema, RLS, grants, triggers, and storage properties are regression-tested
- All edge function endpoints are tested: auth guards, input validation, CRUD, cross-user isolation
- Full integration flows: clone (upload-url -> WAV upload -> finalize), generate (Modal submit -> poll -> complete), design preview lifecycle
- CI runs on every push/PR affecting `supabase/`

**Manual (remaining browser-only checks from [qa-security.md](./qa-security.md)):**
- Design voice flow (requires audio recording in browser)
- WaveSurfer waveform rendering (visual)
- Double-poll finalization idempotency (two browser tabs)
- Console error sweep across all SPA pages
- Audio playback verification
