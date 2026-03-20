# Plan: Cloudflare and Wrangler Implementation Audit

## Goal

Assess the current implementation against Cloudflare platform and Wrangler CLI best-practice expectations, then produce a remediation backlog.

## Audit focus areas

1. Wrangler config quality
   - config format consistency (`wrangler.toml` vs preferred JSON config strategy)
   - environment separation (`staging`, `production`)
   - compatibility date freshness and explicit flags
2. Binding correctness
   - R2, Queue, service bindings, vars, secrets
   - remote/local binding strategy and documented intent
3. Deployment hygiene
   - `wrangler check`
   - deploy dry-run flow
   - typed env generation and validation strategy
4. Operational readiness
   - rollback and feature flags
   - observability/logging/tail workflow
   - secret rotation process

## Inputs

- `workers/api/wrangler.toml`
- `workers/frontend/wrangler.toml`
- `workers/api/README.md`
- `workers/frontend/README.md`
- Cloudflare migration docs in `../2026-03-01/`

## Tasks

1. Run a config and runtime contract audit checklist.
2. Produce a "meets / partially meets / missing" scorecard per area.
3. Identify concrete remediations with owner, risk, and effort.
4. Separate "must fix before production" from "post-cutover improvement".

## Deliverables

1. `cloudflare-wrangler-audit-report.md`
2. `cloudflare-wrangler-remediation-backlog.md`

## Exit criteria

1. Every critical Cloudflare runtime concern is mapped to a control
2. No unresolved high-risk configuration ambiguity
3. Production cutover preconditions are explicit and testable
