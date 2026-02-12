# Running the Supabase Test Suite

## Prerequisites

- **Supabase CLI** (`npx supabase` or globally installed)
- **Deno** v2+ (install: `irm https://deno.land/install.ps1 | iex` or `scoop install deno`)
- Local Supabase running: `npm run sb:start`
- Edge functions served (for Deno tests)

## Quick Reference

```bash
npm run test:db       # pgTAP database tests (144 tests)
npm run test:edge     # Deno edge function tests (90 tests)
npm run test:all      # Both suites
```

## Database Tests (pgTAP)

Tests schema, RLS policies, grants, triggers, storage, and best-practice guards.

```bash
npm run sb:start          # Start local Supabase (if not running)
npm run test:db           # Run all pgTAP tests
```

### What's tested (144 tests across 11 files)

| File | Tests | Coverage |
|------|-------|---------|
| `00_extensions.test.sql` | 3 | pgTAP, pgcrypto, public schema |
| `01_schema_tables.test.sql` | 51 | All 4 tables: columns, types, PKs, NOT NULL, defaults |
| `02_schema_indexes.test.sql` | 10 | Custom indexes + FK index invariant |
| `03_best_practices.test.sql` | 21 | RLS enabled, `(select auth.uid())` pattern, timestamptz, CHECK constraints, FK cascades, SECURITY DEFINER, least-privilege guards |
| `04_rls_profiles.test.sql` | 8 | Read own, UPDATE revoked, cross-user denied, anon blocked |
| `05_rls_voices.test.sql` | 10 | SELECT/DELETE own, INSERT/UPDATE revoked |
| `06_rls_generations.test.sql` | 8 | SELECT/DELETE own, INSERT/UPDATE revoked |
| `07_rls_tasks.test.sql` | 6 | SELECT own only, all writes revoked |
| `08_grants.test.sql` | 14 | Grant revocations for authenticated + anon (includes profiles UPDATE + voices INSERT revoke) |
| `09_triggers_functions.test.sql` | 7 | Auto-profile trigger, updated_at trigger, increment poll count |
| `10_storage.test.sql` | 6 | Buckets exist + private, storage policies |

## Edge Function Tests (Deno)

Tests all API endpoints: auth guards, CRUD operations, validation, cross-user isolation, and Modal integration.

### Standard mode (without Modal mock)

Edge functions connect to real Modal endpoints. Generate/tasks Modal-specific assertions are relaxed.

```bash
npm run sb:start
npm run sb:serve              # Serve with .env.local (real Modal URLs)
npm run test:edge             # Run Deno tests
```

### Full mode (with Modal mock)

Edge functions use `.env.test` which routes Modal calls to a local mock server on port 9999. The mock is started automatically by the test files that need it (`generate.test.ts`, `tasks.test.ts`).

```bash
npm run sb:start
npm run sb:serve:test         # Serve with .env.test (Modal → localhost:9999)
npm run test:edge             # Run Deno tests (mock server auto-starts)
```

### What's tested (90 tests across 10 files)

| File | Tests | Coverage |
|------|-------|---------|
| `health.test.ts` | 2 | Health endpoint liveness |
| `languages.test.ts` | 3 | Language list, defaults, transcription config |
| `auth.test.ts` | 8 | Auth guard on all protected endpoints |
| `me.test.ts` | 12 | GET /me, PATCH /profile (handle/display_name/avatar_url validation), server-owned fields immutable |
| `voices.test.ts` | 10 | GET /voices (pagination, search, source filter), preview key-prefix guard, DELETE, cross-user isolation |
| `generations.test.ts` | 13 | GET /generations (pagination, filters, voice join), audio key-prefix guard, regenerate, DELETE |
| `clone.test.ts` | 10 | Upload URL, finalize validation, full clone flow |
| `generate.test.ts` | 9 | POST /generate validation, Modal submit + failure handling |
| `design.test.ts` | 11 | Design preview validation, POST /voices/design with audio |
| `tasks.test.ts` | 12 | GET/DELETE/cancel tasks, cross-user denial, design preview lifecycle |

## CI

The GitHub Actions workflow (`.github/workflows/test-supabase.yml`) runs both suites automatically on:
- Push to `main` or `refactor/backend-db-supabase`
- PRs targeting `main`
- Only when `supabase/` files change

Two parallel jobs: `database-tests` (pgTAP) and `edge-function-tests` (Deno + Supabase).

## Adding New Tests

- **Database tests**: Add `.test.sql` files to `supabase/tests/database/`. Use `BEGIN/ROLLBACK` for auto-cleanup.
- **Edge function tests**: Add `.test.ts` files to `supabase/functions/tests/`. Use setup/teardown with `createTestUser`/`deleteTestUser` from `_helpers/setup.ts`.
- Tests that use the Supabase JS admin client need `sanitizeResources: false, sanitizeOps: false` due to internal intervals.
- Always consume response bodies (`await res.json()` or `await res.body?.cancel()`) to avoid Deno leak detection failures.
