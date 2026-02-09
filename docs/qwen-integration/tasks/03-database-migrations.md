# 03 - Database Migrations

## Goal

Add provider-aware schema support for dual-provider operation using additive migrations only.

## In Scope

- Additive columns for `voices`, `tasks`, `generations`.
- Backfill defaults to `modal` for legacy rows.
- New indexes and constraints for provider queries.

## Out of Scope

- Dropping old modal columns.
- Large historical cleanup or table rewrites.

## Interfaces Impacted

- Supabase Postgres schema (`public.voices`, `public.tasks`, `public.generations`).
- Edge route query/update payloads.
- Frontend type expectations for additive fields.

## Files/Modules Expected to Change

- New migration in `supabase/migrations/`.
- Optional DB tests in `supabase/tests/database/`.

## Step-by-Step Implementation Notes

1. Add provider fields to `public.voices`.

Recommended columns:
- `tts_provider text not null default 'modal' check (tts_provider in ('modal','qwen'))`
- `provider_voice_id text null`
- `provider_target_model text null`
- `provider_voice_kind text null check (provider_voice_kind in ('vc','vd'))`
- `provider_region text null`
- `provider_request_id text null`
- `provider_metadata jsonb not null default '{}'::jsonb`
- `deleted_at timestamptz null` (soft delete marker)

2. Add provider fields to `public.tasks`.

Recommended columns:
- `provider text not null default 'modal' check (provider in ('modal','qwen'))`
- `provider_job_id text null`
- `provider_status text null`
- `provider_poll_count int not null default 0`
- optional for cancellation quality: `cancellation_requested boolean not null default false`

3. Add provider fields to `public.generations`.

Recommended columns:
- `tts_provider text not null default 'modal' check (tts_provider in ('modal','qwen'))`
- `provider_model text null`
- `output_format text null`
- `provider_metadata jsonb not null default '{}'::jsonb`

4. Backfill legacy rows.

```sql
update public.voices set tts_provider = 'modal' where tts_provider is null;
update public.tasks set provider = 'modal' where provider is null;
update public.generations set tts_provider = 'modal' where tts_provider is null;
```

5. Add indexes.

Recommended:
- `idx_voices_user_provider_created` on `(user_id, tts_provider, created_at desc)`
- `idx_voices_user_active_provider_created` partial on `(user_id, tts_provider, created_at desc)` where `deleted_at is null`
- `idx_tasks_provider_job_id` partial where `provider_job_id is not null`
- `idx_generations_user_provider_created` on `(user_id, tts_provider, created_at desc)`

6. Query policy for soft deleted voices.
- Read/list endpoints must filter `deleted_at is null`.
- Delete endpoint should set `deleted_at` and avoid provider delete calls.

7. Keep existing modal columns untouched during migration window.
- `tasks.modal_job_id`
- `tasks.modal_poll_count`

## Data and Failure Modes

Failure modes:
1. Non-additive migration breaks rollback.
- Mitigation: additive only in this phase.
2. Missing defaults create null behavior drift.
- Mitigation: explicit defaults + backfill.
3. Constraint mismatch with older data.
- Mitigation: run data checks before adding strict `check` constraints.

## Validation Checks

### Preconditions

- Supabase local stack available.
- Migration naming/versioning follows existing project convention.

### Command list

```bash
npx supabase migration new qwen_provider_additive_schema
npm run sb:reset
npm run test:db
```

Optional schema spot checks (SQL editor or psql):

```sql
select column_name from information_schema.columns where table_name='voices' and column_name like 'provider%';
select column_name from information_schema.columns where table_name='tasks' and column_name in ('provider','provider_job_id','provider_status','provider_poll_count');
select column_name from information_schema.columns where table_name='generations' and column_name in ('tts_provider','provider_model','output_format');
```

### Expected success output/state

- Migration applies cleanly on reset.
- Existing DB tests remain green.
- New columns exist with defaults and constraints.
- Legacy rows remain valid and readable.

### Failure signatures

- Reset fails due to non-null additions without defaults.
- Existing edge queries fail from renamed/dropped fields.
- DB tests fail due to RLS/grant regressions.

## Exit Criteria

- Additive schema fully supports dual-provider metadata.
- Legacy Modal data remains operational.
- Migration is reversible through code rollback without DB rollback.

## Rollback Note

Use env switch first, then code rollback if needed. Additive schema allows safe backward code compatibility. See `docs/qwen-integration/restoration.md`.
