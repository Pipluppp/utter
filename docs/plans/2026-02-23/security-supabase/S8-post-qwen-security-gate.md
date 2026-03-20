# S8: Post-Qwen Security Gate

Backlinks: `README.md`, `../../2026-02-24/qwen-integration.md`, `S2-external-probing-supa-sniffer.md`, `S6-rate-limits-observability.md`

When to run: only after Task 3 (`../../2026-02-24/qwen-integration.md`) is implemented and deployed to staging.

Goal: prove Qwen path cannot be abused for cost, data leak, or credential leak.

## What this gate checks

1. Provider credential custody.
- Qwen API key exists only in server secrets.
- no key in frontend bundle, repo, logs, error payloads.

2. Access control on Qwen-triggering routes.
- protected routes still require JWT.
- no anonymous trigger path for generation/design/clone provider calls.

3. Abuse resistance.
- rate limits enforced on Qwen-cost routes.
- payload limits enforced (text length, file size, request frequency).
- repeated burst returns 429, not endless 200.

4. Failure safety.
- provider timeout/5xx does not leak internals.
- retries bounded.
- fallback/kill-switch works fast.

5. Data boundary.
- user A cannot trigger/read artifacts of user B through Qwen flows.

6. Observability.
- logs include request_id, user_id, endpoint, provider, cost-significant events.
- alertable signals exist (5xx spike, 429 spike, provider error spike).

## Step-by-step execution

1. Secrets + build check.
- verify secret set in Supabase/Vercel server env only.
- scan frontend build output for key pattern.
- run secret scanner (`gitleaks`) against repo.

2. AuthN/AuthZ checks.
- replay route tests with no auth / invalid token / cross-user token.
- expected deny status on protected routes.

3. Abuse burst checks.
- run controlled burst on Qwen-cost endpoints.
- verify limit threshold and 429 contract.

4. Input-boundary checks.
- max text, oversized audio, malformed payload.
- expected 4xx with safe message.

5. Provider-failure checks.
- simulate upstream timeout/error.
- verify bounded retries and safe error response.
- verify no stack traces or secret leak in response/logs.

6. Cross-user isolation checks.
- account A/B test for generation, tasks, voices, audio retrieval.
- expected deny/not-found for cross-user access.

7. Artifact + signoff.
- store report under `docs/security/audits/YYYY-MM-DD/qwen-gate.md`.
- mark blockers if any high/critical issue.

## Required evidence

- curl/probe output for auth and burst tests.
- logs excerpt proving 429 and provider-failure handling.
- secret-scan output.
- pass/fail matrix with owner and fix ETA for failures.

## Exit criteria

- no credential exposure.
- no unauthorized Qwen trigger path.
- abuse controls active and verified.
- no cross-user leak through Qwen flows.
- unresolved high/critical issues = release blocked.

Next: if credits task done, run `S9-post-credits-security-gate.md`.
