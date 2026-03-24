# API Worker Tests

## Layout

```
tests/
├── unit/                          # No network, no Supabase, no Worker
│   ├── credits.test.ts            # Credit calculations, pack lookup, constants
│   └── transcription_provider.test.ts  # Qwen ASR payload + error handling (mocked fetch)
├── integration/                   # Requires running Supabase + API Worker
│   ├── _helpers/
│   │   ├── setup.ts               # createTestUser, apiFetch, apiPublicFetch
│   │   ├── fixtures.ts            # Shared constants (test users, payloads, minimal WAV)
│   │   └── factories.ts           # createUserWithBalance, cleanupUserArtifacts
│   ├── auth.test.ts               # Auth guards on all protected endpoints
│   ├── billing_stripe.test.ts     # Stripe-specific: webhook sig, idempotency, checkout
│   ├── billing_credits.test.ts    # Provider-agnostic: pack validation, trials payload
│   ├── clone.test.ts              # Clone flow: upload-url → upload → finalize, trials, credits
│   ├── credits.test.ts            # /credits/usage endpoint
│   ├── generations.test.ts        # Generation CRUD, user isolation, path traversal
│   ├── health.test.ts             # /health endpoint
│   ├── languages.test.ts          # /languages endpoint
│   ├── me.test.ts                 # /me + /profile: auth, updates, validation
│   ├── rate_limits.test.ts        # Per-IP rate limiting
│   ├── tasks.test.ts              # Task CRUD, cancellation, trial restore, feed
│   ├── voices.test.ts             # Voice CRUD, user isolation, path traversal
│   ├── design.test.ts             # ⛔ Disabled — requires Qwen API key
│   ├── generate.test.ts           # ⛔ Disabled — requires Qwen API key
│   └── transcriptions.test.ts     # ⛔ Disabled — requires Qwen API key
```

## Running tests

```bash
# Unit tests only (< 1s, no dependencies)
npm --prefix workers/api run test:unit

# Integration tests only (needs Supabase + API Worker running)
npm --prefix workers/api run test:integration

# Both
npm --prefix workers/api test
```

Integration tests require:
1. `supabase start`
2. `npm --prefix workers/api run dev` (API Worker on port 8787)
3. `API_URL` env var set (defaults to `http://127.0.0.1:8787/api`)

## Adding tests

**Unit test**: Add to `tests/unit/`. Import source directly, no network calls. Use `vi.restoreAllMocks()` in `afterEach`.

**Integration test**: Add to `tests/integration/`. Use helpers from `_helpers/`:
- `createUserWithBalance()` for user setup with specific credits/trials
- `apiFetch()` / `apiPublicFetch()` for API calls
- Wrap top-level `describe` with `describe.skipIf(!process.env.API_URL)`
- Add `afterEach(() => { vi.restoreAllMocks(); })`

**Test naming**: Use business-rule language, not endpoint names. Group with `describe` blocks by domain concept.

## Disabled tests

Files marked ⛔ make real Qwen API calls. They're excluded in `vitest.config.ts` and guarded with `describe.skipIf(!process.env.DASHSCOPE_API_KEY)`. To re-enable, remove the exclude entry and set the env var.

## Billing test split

`billing_stripe.test.ts` contains Stripe-specific tests (webhook, checkout). When migrating to Polar.sh, only this file and the billing adapter need changes. `billing_credits.test.ts` is provider-agnostic.
