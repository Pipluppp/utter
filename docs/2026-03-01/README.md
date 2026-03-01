# 2026-03-01 Cloudflare Migration Planning

This folder captures near-term planning for a hybrid Cloudflare + Supabase architecture:

- Frontend on Cloudflare Workers
- API on Cloudflare Workers (no direct frontend app-data queries)
- Object storage on Cloudflare R2
- Supabase retained for Postgres, RLS, Auth, and existing credits/billing RPC logic

## Documents

1. [cloudflare-migration-plan.md](./cloudflare-migration-plan.md)
   - phased execution plan with acceptance criteria and rollback
2. [migration-benefits-tradeoffs.md](./migration-benefits-tradeoffs.md)
   - concise benefits, costs, and constraints on free plans
3. [scaffold-strategy.md](./scaffold-strategy.md)
   - how to preserve current repo and route contracts while migrating runtime
4. [feature-migration-mapping.md](./feature-migration-mapping.md)
   - feature-by-feature migration mapping from current implementation
5. [db-auth-impact.md](./db-auth-impact.md)
   - what changes and what stays unchanged in Supabase DB/Auth/RLS
6. [cloudflare-supabase-integration-verified.md](./cloudflare-supabase-integration-verified.md)
   - verified Cloudflare↔Supabase integration guidance and migration guardrails
7. [implementation-orchestration.md](./implementation-orchestration.md)
   - developer orchestration runbook and execution order
8. [implementation-phase-01-frontend-hosting.md](./implementation-phase-01-frontend-hosting.md)
   - concrete frontend hosting migration steps
9. [implementation-phase-02-workers-api-port.md](./implementation-phase-02-workers-api-port.md)
   - concrete API runtime porting checklist
10. [implementation-phase-03-r2-storage-cutover.md](./implementation-phase-03-r2-storage-cutover.md)
   - concrete storage adapter and R2 cutover steps
11. [implementation-phase-04-queues-hardening.md](./implementation-phase-04-queues-hardening.md)
   - queue adoption and hardening phase
12. [implementation-db-and-schema-notes.md](./implementation-db-and-schema-notes.md)
   - DB/RLS/ledger constraints and optional schema notes
13. [cloudflare-queues-evaluation.md](./cloudflare-queues-evaluation.md)
   - evaluated queue opportunities, constraints, and phased adoption guidance
14. [cloudflare-queues-migration-plan.md](./cloudflare-queues-migration-plan.md)
   - standalone queue migration design and execution plan
15. [cloudflare-queues-implementation-context.md](./cloudflare-queues-implementation-context.md)
   - feature-by-feature context on current behavior vs queue replacement
16. [cloudflare-queues-qwen-compatibility.md](./cloudflare-queues-qwen-compatibility.md)
   - verified compatibility and guardrails for Qwen model flows on Queues
17. [implementation-phase-01-02-scaffold-progress.md](./implementation-phase-01-02-scaffold-progress.md)
   - current scaffold status for Phase 01 frontend hosting + Phase 02 worker runtime
18. [implementation-bootstrap-checklist.md](./implementation-bootstrap-checklist.md)
   - worktree/auth/tooling bootstrap before phase execution
19. [cloudflare-hybrid-phase-01.md](../security/audits/2026-03-02/cloudflare-hybrid-phase-01.md)
   - phase 01 frontend worker hosting deployment/smoke evidence artifact
20. [cloudflare-hybrid-phase-02.md](../security/audits/2026-03-02/cloudflare-hybrid-phase-02.md)
   - phase 02 deployment/smoke/parity evidence artifact
21. [cloudflare-hybrid-phase-03.md](../security/audits/2026-03-02/cloudflare-hybrid-phase-03.md)
   - phase 03 storage adapter implementation + validation status artifact
22. [cloudflare-hybrid-phase-04.md](../security/audits/2026-03-02/cloudflare-hybrid-phase-04.md)
   - phase 04 queue Q1 wiring + staging evidence artifact

## Scope guardrails

- Do not migrate Postgres schema or Auth provider in this phase.
- Do not rewrite credits ledger or billing invariants.
- Keep `/api/*` as stable frontend contract.
- Keep user session handling in Supabase Auth SDK.

## Current Staging State (2026-03-02)

1. Frontend is served from Cloudflare Worker `utter` at `https://utter.duncanb013.workers.dev`.
2. API is served from Cloudflare Worker `utter-api-staging` at `https://utter-api-staging.duncanb013.workers.dev/api`.
3. Supabase remains system-of-record for Postgres/Auth/RLS/credits/billing RPC flows.
4. Queue Q1 is active in staging for qwen generate and qwen design-preview paths.
5. Storage mode in staging is `hybrid` for parity:
   - new writes go to R2
   - reads fall back to Supabase Storage for legacy objects not yet in R2.

## Remaining Migration Work

1. Production environment sync:
   - finalize production Worker secrets/vars
   - wire production R2 bucket bindings
   - wire production queue bindings/flags.
2. Production hardening evidence:
   - repeat smoke/parity suite on production-like config
   - verify rollback drills for `/api/*` routing and storage mode toggles.
3. Cleanup/de-scope:
   - keep modal queue paths out of active rollout unless explicitly re-enabled.
