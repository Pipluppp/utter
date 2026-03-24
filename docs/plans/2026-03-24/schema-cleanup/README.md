# Schema Cleanup — 2026-03-24

Removed Modal-era database artifacts and unused profile vanity columns from the Supabase schema. Tightened provider constraints to Qwen-only across all three provider columns.

## What changed

**Migration** (`20260324120000_schema_cleanup_modal_vanity.sql`):
- Migrated any remaining `'modal'` provider values → `'qwen'`
- Dropped `tasks.modal_job_id`, `tasks.modal_poll_count`
- Dropped `profiles.handle`, `profiles.display_name`, `profiles.avatar_url`
- Dropped `idx_tasks_modal_job_id` index
- Dropped `increment_task_modal_poll_count(uuid, uuid)` function
- Replaced provider CHECK constraints on `voices`, `tasks`, `generations` to accept only `'qwen'`
- Updated column defaults from `'modal'` → `'qwen'`

**API Worker**:
- Removed `PATCH /api/profile` endpoint and all helper functions
- Stripped `modal_poll_count` and related fields from `GET /api/tasks/:id`

**Frontend**:
- Narrowed `ProfileRecord`, `BackendTask`, and provider union types
- Removed `saveProfile`, `AccountFormValues`, and the profile PATCH call
- Simplified Profile page to read-only (email + user ID + initials avatar)
- Cleaned up `modal_status` reference in `TaskProvider.tsx`

**pgTAP tests** (6 files updated):
- Replaced `has_column` → `hasnt_column` for all dropped columns
- Added constraint rejection test (`tts_provider = 'modal'` must fail)
- Removed `increment_task_modal_poll_count` RPC and grant assertions
- Fixed `display_name` references in grant and RLS tests
- All 263 tests pass across 12 test files

## Files in this directory

- `schema-audit-report.md` — pre-cleanup audit that identified the dead artifacts
- This README — summary of the cleanup work
