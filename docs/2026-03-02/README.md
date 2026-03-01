# 2026-03-02 Cloudflare Migration Planning

This folder captures near-term planning for a hybrid Cloudflare + Supabase architecture:

- Frontend on Cloudflare Pages/Workers
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

## Scope guardrails

- Do not migrate Postgres schema or Auth provider in this phase.
- Do not rewrite credits ledger or billing invariants.
- Keep `/api/*` as stable frontend contract.
- Keep user session handling in Supabase Auth SDK.
