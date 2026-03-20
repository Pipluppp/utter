# Plan: Dev and Staging Runtime Evaluation

## Goal

Evaluate how the stack behaves across local development and deployed staging runtime modes, with explicit Cloudflare runtime mode guidance.

## Runtime modes to evaluate

1. Local-only simulation (`wrangler dev` with local bindings)
2. Miniflare-backed local execution (where used by Wrangler local mode)
3. Hybrid local + remote bindings (`remote = true` where needed)
4. Edge-remote dev (`wrangler dev --remote` when required)
5. Deployed staging workers (`workers.dev` endpoints)

## Targets

- Frontend worker: `workers/frontend`
- API worker: `workers/api`
- Supabase local stack (when validating DB/auth integration behavior)

## Evaluation tasks

1. Create environment matrix for each mode:
   - startup command
   - required secrets and bindings
   - expected request paths
   - known unsupported behavior
2. Validate local fidelity for:
   - Queue consumers/producers
   - R2 read/write/signing
   - service binding frontend -> API
3. Validate staging fidelity against local expectations.
4. Document mode-specific debugging workflow (`wrangler tail`, local logs, request IDs).
5. Classify each test as:
   - local sufficient
   - requires staging
   - requires remote binding

## Deliverables

1. `runtime-mode-matrix.md`
2. `dev-workflow-recommendation.md`
3. `staging-vs-local-delta-report.md`

## Exit criteria

1. Every critical feature has a documented "where to test" mode
2. No unresolved unknowns around queue/R2 behavior across modes
3. Local onboarding path is clear and reproducible in under 30 minutes
