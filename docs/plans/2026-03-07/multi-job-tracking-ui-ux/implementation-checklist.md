# Implementation Checklist: Multi-Job Tracking + Job Center

## Phase A: Requirements and design

- [ ] Plan 01 completed
- [ ] Concurrency cap policy agreed (default + tier behavior)
- [ ] Job Center UX scope approved

## Phase B: Backend and API

- [ ] Plan 02 completed
- [ ] Active generate unique constraint replaced with cap-based logic
- [ ] Queue/terminal safety revalidated under concurrency
- [ ] Plan 03 completed
- [ ] `GET /api/tasks` list route added and tested

## Phase C: Frontend state and UX

- [ ] Plan 04 completed
- [ ] TaskProvider refactored to multi-job model
- [ ] Legacy task storage migration implemented
- [ ] Plan 05 completed
- [ ] Job Dock supports multiple tasks per type
- [ ] Job Center route/panel implemented

## Phase D: Validation and rollout

- [ ] Plan 06 completed
- [ ] Worker + frontend + integration tests green
- [ ] Staging multi-job smoke passed
- [ ] Observability metrics/logs/alerts added
- [ ] Rollback controls documented and tested
