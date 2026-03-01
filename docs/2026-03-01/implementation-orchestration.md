# Implementation Orchestration Runbook

Date: 2026-03-02  
Audience: Developer implementing Cloudflare hybrid migration

## Objective

Execute migration with minimal product risk:

1. Cloudflare frontend hosting
2. Cloudflare Worker API runtime (BFF pattern, no direct frontend app-data DB access)
3. Cloudflare R2 object storage
4. Supabase Postgres/Auth/RLS/RPC retained

## Constraints

- Keep `/api/*` contract stable for frontend.
- Keep credits and billing correctness unchanged.
- Do not migrate to D1/Better Auth in this execution.

## Locked decisions (2026-03-01)

1. Phase 02 production cutover on Cloudflare Free must not ship with Qwen `waitUntil` long-running paths still active. Queue Q1 (`generate.qwen.start`, `design_preview.qwen.start`) is required in the same rollout train as API cutover (or immediately after, before production traffic).
2. Frontend host cutover must include explicit CORS/origin and Supabase Auth redirect allowlist updates for Worker/custom domains.
3. Storage migration currently uses `hybrid` in staging for legacy parity:
   - writes -> R2
   - reads -> R2 first, then Supabase Storage fallback
   - production cutover must explicitly choose `r2` or `hybrid` based on launch risk tolerance.

## Branching and rollout model

1. Create an integration branch: `codex/cloudflare-hybrid-migration`.
2. Deliver phase-by-phase PRs.
3. Deploy each phase to staging first.
4. Promote to production only after acceptance checklist passes.

## Phase sequence

1. [implementation-phase-01-frontend-hosting.md](./implementation-phase-01-frontend-hosting.md)
2. [implementation-phase-02-workers-api-port.md](./implementation-phase-02-workers-api-port.md)
3. [implementation-phase-03-r2-storage-cutover.md](./implementation-phase-03-r2-storage-cutover.md)
4. [cloudflare-queues-migration-plan.md](./cloudflare-queues-migration-plan.md)
5. [cloudflare-queues-implementation-context.md](./cloudflare-queues-implementation-context.md)
6. [cloudflare-queues-qwen-compatibility.md](./cloudflare-queues-qwen-compatibility.md)
7. [implementation-phase-04-queues-hardening.md](./implementation-phase-04-queues-hardening.md)
8. [implementation-db-and-schema-notes.md](./implementation-db-and-schema-notes.md)

## Required evidence artifacts

For each phase, attach:

1. Deployed environment URL(s)
2. Smoke test transcript (request/response summary)
3. Error-rate/latency comparison vs baseline
4. Rollback verification note

Store evidence in:

- `docs/security/audits/YYYY-MM-DD/cloudflare-hybrid-phase-<n>.md`

## Definition of done

1. Frontend served from Cloudflare.
2. `/api/*` served by Cloudflare Worker.
3. `references` + `generations` storage flows served via R2.
4. Supabase auth/session flow unchanged for end users.
5. Credits/billing regression suite passes.

## Current Execution Status (2026-03-02)

1. Phase 01: complete on staging (`utter` frontend Worker).
2. Phase 02: complete on staging (`utter-api-staging` Worker API).
3. Phase 03: complete on staging with `STORAGE_PROVIDER=hybrid` compatibility mode.
4. Phase 04 (Q1): queue wiring complete for qwen generate + qwen design preview in staging.
5. Remaining pre-production items:
   - production env/binding rollout
   - final production smoke/parity evidence
   - explicit modal-path de-scope in rollout runbooks.
