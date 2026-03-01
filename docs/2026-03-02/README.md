# 2026-03-02 Cloudflare Migration Continuation Plans

This folder is the continuation plan set after implementation work captured in `../2026-03-01/`.

Context:
- Cloudflare frontend worker and API worker are deployed for staging.
- Supabase remains system-of-record for Postgres/Auth/RLS/credits/billing.
- R2 and Queue Q1 are partially enabled in staging.
- This continuation phase is verification, hardening, and documentation realignment.

Important scope note:
- "prod" in this phase means production-like deployed staging surfaces unless explicitly stated otherwise.

## Inputs and predecessor artifacts

1. `../2026-03-01/README.md` and linked implementation docs
2. `../security/audits/2026-03-02/cloudflare-hybrid-phase-01.md`
3. `../security/audits/2026-03-02/cloudflare-hybrid-phase-02.md`
4. `../security/audits/2026-03-02/cloudflare-hybrid-phase-03.md`
5. `../security/audits/2026-03-02/cloudflare-hybrid-phase-04.md`
6. `../2026-02-23/security-supabase/README.md` and `S*` penetration/security planning docs

## Continuation plan documents

1. [01-feature-parity-verification-plan.md](./01-feature-parity-verification-plan.md)
   - full parity matrix and evidence requirements
2. [02-dev-and-staging-runtime-evaluation-plan.md](./02-dev-and-staging-runtime-evaluation-plan.md)
   - local/Miniflare/remote/deployed-staging behavior evaluation
3. [03-cloudflare-wrangler-implementation-audit-plan.md](./03-cloudflare-wrangler-implementation-audit-plan.md)
   - implementation audit against Cloudflare + Wrangler best-practice expectations
4. [04-security-evaluation-and-pentest-plan.md](./04-security-evaluation-and-pentest-plan.md)
   - stack-wide security review and pentest expansion beyond Supabase DB focus
5. [05-deployed-frontend-scan-and-performance-plan.md](./05-deployed-frontend-scan-and-performance-plan.md)
   - scanner coverage and performance benchmarks on deployed frontend
6. [06-current-stack-and-equivalence-explainer.md](./06-current-stack-and-equivalence-explainer.md)
   - current architecture explainer and old-vs-new equivalence map
7. [07-base-docs-realignment-plan.md](./07-base-docs-realignment-plan.md)
   - task plan to remove outdated old-stack references from base docs
8. [08-architecture-and-setup-docs-simplification-plan.md](./08-architecture-and-setup-docs-simplification-plan.md)
   - docs simplification and architecture/setup consolidation plan

## Recommended execution order

1. Parity verification and stack equivalence baseline (`01`, `06`)
2. Runtime environment and Cloudflare/Wrangler setup evaluation (`02`, `03`)
3. Security and deployed frontend scanning (`04`, `05`)
4. Docs realignment and simplification (`07`, `08`)
