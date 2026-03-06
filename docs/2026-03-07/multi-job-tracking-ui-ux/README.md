# Multi-Job Execution + Job Tracking UX Plan Pack

Date: 2026-03-03

## Goal

Implement true multi-job execution and a robust job-tracking UX that is visible across the app (not only inside History).

## Problem statement

Current system limitations:

1. Backend restricts active `generate` jobs to one per user.
2. Frontend task state is keyed by task type (`generate|design|clone`), so only one task per type can be tracked.
3. Task dock/status is useful but not a complete "job center" for active/recent jobs.

## Desired outcome

1. Users can run multiple queued/processing jobs safely.
2. Users can monitor, filter, cancel, and resume context for jobs from anywhere.
3. Queue-first and terminal-state safety guarantees remain intact.

## Plan set

1. `01-current-state-and-requirements-plan.md`
2. `02-backend-concurrency-and-job-model-plan.md`
3. `03-api-contract-and-job-feed-plan.md`
4. `04-frontend-task-state-and-polling-refactor-plan.md`
5. `05-job-center-ui-ux-plan.md`
6. `06-rollout-validation-and-observability-plan.md`

Execution tracking: `implementation-checklist.md`

## Non-goals

1. Replacing queue-first orchestration.
2. Changing the core `/api/*` contract in breaking ways.
3. Rebuilding History page from scratch.
