# Plan 04: Integrated Validation and Cutover

## Goal

Validate the simplified architecture end-to-end in staging before production.

## Test matrix

1. Auth/session
- login/logout/session refresh
- unauthorized path checks

2. Clone flow
- upload-url -> upload -> finalize -> preview

3. Generate flow
- submit -> task progression -> audio playback -> delete

4. Design flow
- preview submit -> completion -> save voice -> generate with saved voice

5. Credits/billing invariants
- debit/refund correctness
- Stripe webhook signature + duplicate event behavior

6. Queue behavior
- normal processing
- retry on transient provider error
- DLQ on repeated failure

## Required commands/checks

1. Build/typecheck
- `npm --prefix workers/api run typecheck`
- `npm --prefix workers/api run check`

2. API parity (worker target)
- `npm run test:worker:local`

3. Cloudflare resource/binding verification
- `npx wrangler queues info <queue-name>`
- `npx wrangler r2 bucket list`
- verify worker deploy output includes expected queue/r2 bindings for target env

4. Local-dev mode verification
- validate the chosen local mode (local bindings or `wrangler dev --env staging` local simulation) can run clone/generate/design submit paths without missing binding errors

5. Manual smoke against staging Worker URLs
- `/api/health`
- protected route 401 behavior
- full clone/design/generate/task lifecycle

## Exit criteria

1. No Sev-1/Sev-2 regressions in active user flows.
2. No modal/hybrid code paths remain reachable.
3. Task orchestration is queue-only and stable.
4. R2-only storage path validated for all object lifecycle operations.

## Cutover checklist

1. Set simplified env vars and remove deprecated ones.
2. Deploy API worker, then frontend worker.
3. Run staging smoke and review logs.
4. Promote only after evidence artifact is recorded.
