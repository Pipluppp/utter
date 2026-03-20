# Plan: Architecture and Setup Docs Simplification

## Goal

Simplify architecture and setup docs so onboarding and operations are aligned, concise, and specific to the current Cloudflare hybrid architecture.

## Outcomes

1. Clear architecture story in one primary doc
2. One setup runbook for local development
3. One deployment runbook for staging/production-like environments
4. Reduced duplication and conflicting guidance

## Proposed doc shape

1. `docs/architecture.md`
   - high-level architecture
   - request/data flow
   - trust boundaries and service responsibilities
2. `docs/setup.md` (new)
   - prerequisites
   - local bootstrap
   - local run commands
   - troubleshooting
3. `docs/deploy.md` (new or refactor from existing deployment docs)
   - staging deploy
   - verification gates
   - rollback controls

## Simplification tasks

1. Collapse repeated setup snippets spread across multiple docs.
2. Move deep implementation notes into date-stamped or component-specific docs.
3. Add "read this next" pointers to keep navigation linear.
4. Define ownership and update cadence for core docs.

## Deliverables

1. `docs-information-architecture-proposal.md`
2. `core-docs-template.md`
3. `docs-cleanup-backlog.md`

## Exit criteria

1. New contributor can run local stack with one setup doc
2. On-call/deployer can run staging deploy from one deploy doc
3. Architecture doc matches actual deployed boundaries and services
