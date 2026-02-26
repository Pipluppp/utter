# Qwen + Credits Security Gate Evaluation (S9 Context)

Date: 2026-02-26
Scope: Qwen provider integration + credits anti-cheat controls (`clone`, `design`, `generate`, `tasks/cancel`, ledger/refund paths)

## Summary

- Gate result: **Pass with follow-up items**
- Unresolved High/Critical: **0**
- Unresolved Medium: **2**

This run found two exploitable anti-cheat issues and patched them in this branch before signoff. Edge regression suite passed after patching (`128 passed, 0 failed`).

## Evidence Collected

1. Full edge integration tests:
- `npm run sb:serve:test`
- `npm run test:edge`
- Result: `ok | 128 passed | 0 failed`

2. Replay anti-cheat probe (`/clone/finalize` duplicate submit):
- First finalize: `200`, trial count `2 -> 1`
- Second finalize with same `voice_id`: `200` (idempotent existing voice), trial count stayed `1`
- Confirms replay no longer restores trial or causes double side-effects.

3. Static route and provider review against S8/S9 criteria:
- Auth boundaries (`requireUser`) on billable routes.
- RLS/grants for profiles/voices/generations/tasks/trial tables.
- Idempotency keys and refund paths for clone/design/generate.
- Task cancellation and terminal-state race behavior.

## Findings (ordered by severity)

### 1. High (Fixed): Clone finalize replay allowed trial abuse + repeated provider side-effects

- Location (pre-fix): `supabase/functions/api/routes/clone.ts` around finalize flow.
- Issue:
  - Duplicate finalize submissions with same `voice_id` were not handled as idempotent at route level.
  - Flow still proceeded into provider work and insert/refund branches, enabling replay abuse patterns.
- Security impact:
  - Trial/billing policy bypass opportunities via replay edge cases.
  - Repeated provider-side side-effects on duplicate finalize submits.
- Fix applied:
  - Added explicit duplicate charge handling before provider calls.
  - Duplicate now returns existing voice if present; otherwise `409` requiring new upload.

### 2. High (Fixed): Cancel/refund race could refund tasks no longer cancellable

- Location (pre-fix): `supabase/functions/api/routes/tasks.ts` in `POST /tasks/:id/cancel` and modal completion finalization path.
- Issue:
  - Cancellation updates/refunds did not verify task state transition succeeded at write time.
  - Final completion writes could overwrite a newly-cancelled task in certain race windows.
- Security impact:
  - Free-success risk (refund on effectively completed work) under timing races.
  - Status integrity drift under concurrent finalize/cancel activity.
- Fix applied:
  - Cancel now requires successful conditional update (`status in pending/processing`) and returns `409` if no longer cancellable.
  - Modal completion writes now use status guards and avoid overwriting terminal states.

### 3. Medium (Open): Qwen design save race can create duplicate voice rows

- Location: `supabase/functions/api/routes/design.ts` (`POST /voices/design`, qwen path).
- Issue:
  - `saved_voice_id` check is non-atomic relative to voice insert.
  - Concurrent save requests for the same completed preview task can race and both insert.
- Impact:
  - Duplicate voice records from one preview task (cost/control integrity concern).
- Recommended remediation:
  - Add DB uniqueness guard for qwen provider voice identity (e.g. unique `(user_id, tts_provider, provider_voice_id)` where active), and handle conflict by returning existing row.

### 4. Medium (Open): Provider audio URL fetch lacks origin allowlist

- Location: `supabase/functions/_shared/tts/providers/qwen_audio.ts`.
- Issue:
  - Downloader fetches provider-returned `url` directly without host allowlist validation.
- Impact:
  - SSRF-style risk if upstream response is compromised or unexpectedly manipulated.
- Recommended remediation:
  - Enforce allowlist on host/scheme before fetch (DashScope/expected domains only), reject private-network targets.

## S9 Gate Matrix

1. Atomic debit: **Pass**
- Debit/trial + reversal paths are idempotent and service-role RPC-backed.

2. Idempotency/replay safety: **Pass (after fix)**
- Clone finalize duplicate flow now short-circuits safely.

3. Concurrency/race safety: **Pass with follow-up**
- Cancel/finalize race hardening applied.
- Remaining medium: design save concurrency guard.

4. Tamper resistance: **Pass**
- Client writes to tasks/generations/protected credit paths remain revoked/RLS constrained.

5. Refund/reversal correctness: **Pass (after fix)**
- Refund now tied to successful cancellable transition.

6. Ledger integrity: **Pass**
- Credit events remain idempotent with consistent reference keys.

7. Cross-user boundary: **Pass**
- Existing tests and route checks preserve user scoping.

## Deployment Recommendation

- Approved to continue rollout in current branch after applied fixes.
- Track medium items before final hardening closeout.

## Files changed by this gate run

- `supabase/functions/api/routes/clone.ts`
- `supabase/functions/api/routes/tasks.ts`
- `supabase/functions/tests/clone.test.ts`
