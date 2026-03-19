# Execution Prompt

Implement the API Worker privatization plan in this directory.

Objective:

- Remove the public `workers.dev` bypass for the API Worker.
- Keep hosted browser API traffic on `uttervoice.com/api/*` through the frontend Worker service binding.
- Make hosted frontend proxying fail closed if the API service binding is missing.

Required reading before changes:

1. `docs/2026-03-19/01-api-worker-privatization/README.md`
2. `docs/2026-03-19/01-api-worker-privatization/api-worker-privatization-plan.md`
3. `docs/2026-03-19/01-api-worker-privatization/api-worker-privatization-research-verification.md`
4. `docs/2026-03-18/cloudflare-security/implementation-audit-2026-03-19.md`

Implementation requirements:

1. Update `workers/api/wrangler.toml` to disable the public `workers.dev` route durably.
2. Review `workers/frontend/src/index.ts` and remove or narrow hosted fallback behavior so hosted `/api/*` requests require the `API` service binding.
3. Preserve local development behavior where reasonable.
4. Do not introduce a new API custom domain in this task.
5. Do not change auth, credits, queue logic, or provider behavior unless strictly necessary for privatization.

Verification requirements:

1. Confirm the repo config reflects private API Worker intent.
2. Confirm hosted traffic still targets the internal service binding path.
3. List the exact dashboard action still required, if any, to disable `workers.dev` on the live Worker.
4. Provide a concrete post-deploy verification checklist:
   - `uttervoice.com/api/health` should work
   - `utter-api-staging.duncanb013.workers.dev/api/health` should no longer expose the API

Constraints:

- Follow repo guidance in `AGENTS.md`.
- Keep error handling explicit; do not add broad silent fallbacks.
- If you find an unexpected dependency on the public API hostname, document it clearly before changing behavior.

Deliverables:

1. Code/config changes
2. Short implementation summary
3. Verification notes
4. Any remaining manual Cloudflare dashboard step
