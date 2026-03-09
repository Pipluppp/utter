# 2026-03-09 Triage And Branching

## Summary

The unfinished March 7 work that still matters for the current product pass is:

1. multi-job execution and tracking UX
2. frontend loading skeletons
3. copy alignment on landing and product surfaces

The security bundle under `docs/2026-03-07/security-sweep-plan-bundle/` exists but is intentionally out of scope for this pass.

## What was checked

### Existing March 7 docs

- `docs/2026-03-07/frontend-loading-skeleton-plan.md`
- `docs/2026-03-07/multi-job-tracking-ui-ux/README.md`
- `docs/2026-03-07/multi-job-tracking-ui-ux/implementation-checklist.md`

### Current implementation state

- `frontend/src/app/Layout.tsx`
- `frontend/src/app/RequireAuth.tsx`
- `frontend/src/app/TopBar.tsx`
- `frontend/src/pages/About.tsx`
- `frontend/src/pages/account/Overview.tsx`
- `frontend/src/pages/account/Credits.tsx`
- `frontend/src/pages/account/Profile.tsx`
- `frontend/src/components/tasks/TaskProvider.tsx`
- `frontend/src/components/tasks/TaskDock.tsx`
- `frontend/src/pages/Generate.tsx`
- `workers/api/src/routes/generate.ts`
- `workers/api/src/routes/design.ts`
- `workers/api/src/routes/clone.ts`
- `workers/api/src/routes/tasks.ts`

## Triage findings

### Loading skeleton work is not done

The March 7 loading skeleton plan is still largely unimplemented.

Confirmed raw loading placeholders still in the app:

- `frontend/src/app/Layout.tsx`: generic `Loading...` Suspense fallback
- `frontend/src/app/RequireAuth.tsx`: `Checking session...`
- `frontend/src/app/TopBar.tsx`: `Checking session...`
- `frontend/src/pages/About.tsx`: inline languages `Loading...`
- `frontend/src/pages/account/Profile.tsx`: `Loading...` email text
- `frontend/src/pages/account/Overview.tsx`: `...` balance and pre-load empty-state behavior
- `frontend/src/pages/account/Credits.tsx`: `...` balance and pre-load zero trial counts
- `frontend/src/pages/Generate.tsx`: voices still load as a form wait, not a dedicated skeleton

Already good and should remain reference implementations:

- `frontend/src/pages/Voices.tsx`
- `frontend/src/pages/History.tsx`

### Multi-job execution is not done

The March 7 multi-job docs are still planning artifacts, not shipped behavior.

Confirmed blockers:

- `workers/api/src/routes/generate.ts` rejects a second active generation with a `409` if one `generate` task is already `pending` or `processing`
- `frontend/src/components/tasks/TaskProvider.tsx` stores tasks as `Partial<Record<TaskType, StoredTask>>`, so only one task can exist per type
- `frontend/src/components/tasks/TaskDock.tsx` renders at most one row per type and keys rows by `task.type`
- `workers/api/src/routes/tasks.ts` exposes `GET /tasks/:id`, `POST /tasks/:id/cancel`, and `DELETE /tasks/:id`, but there is no `GET /tasks` feed for a multi-job list or job center

Current task behavior by feature:

- `generate`: queue-backed, cancellable, single-active per user
- `design preview`: queue-backed, cancellable, but frontend still only tracks one design task at a time
- `clone finalize`: synchronous request-response flow, not a queue-backed task today

### Copy alignment is needed

Landing and product copy no longer matches the actual runtime:

- `frontend/src/pages/landing/LandingHero.tsx` says `{languages.length} languages supported`
- `workers/api/src/routes/languages.ts` returns `Auto` plus 14 named languages
- current official Qwen TTS docs only advertise 10 supported languages for these models, so the app copy and `/api/languages` payload need review together

### Privacy, terms, and pricing are outdated

- `frontend/src/pages/Privacy.tsx` still contains placeholder retention language
- `frontend/src/pages/Terms.tsx` still mentions subscriptions renewing monthly, but the app is using prepaid packs
- `frontend/src/content/plans.ts` and `workers/api/src/_shared/credits.ts` still use the old `$10` and `$25` packs and the old flat-credit constants

## Current branch state

- current worktree branch: `docs/frontend-loading-skeleton-plan`
- local unstaged change exists in `frontend/index.html`
- current branch is only ahead of `main` by the March 7 skeleton-doc files

## Chosen approach

Use a single implementation working directory for execution:

- repo directory: `utter/`
- base branch: `main`
- one task branch at a time
- merge each completed task back into `main` after local verification

The extra worktree that was used during planning was only to avoid disturbing an existing dirty tree while preparing the docs. It is not the intended workflow for implementing these tasks.

## Why this task first

`multi-job-workflows` is the best next implementation branch because it unlocks the largest product gap:

1. it removes the current single-generation bottleneck
2. it gives users a reliable cross-page source of truth for running work
3. it provides the backend and frontend primitives that later pricing, copy, and loading-state polish can sit on top of

## Recommended execution order after planning

1. Implement multi-job backend and frontend tracking first.
2. Land the loading skeleton pass next.
3. Update landing/product copy and `/api/languages` together.
4. Update privacy, terms, pricing, and credit constants together after product decisions are agreed.

## One-task-per-session workflow

Use one fresh Codex chat per task.

Recommended loop:

1. In the main `utter/` repo, make sure you are on updated `main`.
2. Create a new branch for the next task only.
3. Open this triage doc and the next task doc in the sequence.
4. Start a new chat with the task doc's `Session prompt`.
5. Let Codex implement only that task.
6. Manually test the task locally.
7. If the task is good, merge that branch back into `main`.
8. Start the next task from a brand-new branch and a brand-new chat.

This keeps context focused and avoids packing the whole March 9 scope into one session.

## Branching rule for every task

Use this same branch pattern for all numbered tasks:

1. checkout `main`
2. pull or otherwise confirm `main` is the latest local base you want
3. create a task branch from `main`
4. implement and verify only that task
5. merge back into `main`
6. delete the completed task branch
7. repeat for the next numbered task

## Session queue

### Session 1: multi-job workflows

Doc:

- `docs/2026-03-09/01-multi-job-workflows-plan.md`

Suggested branch:

- `feature/multi-job-workflows`

Exit gate:

- concurrent jobs work
- task tracking no longer overwrites by type

### Session 2: loading skeletons

Doc:

- `docs/2026-03-09/03-loading-skeleton-plan.md`

Suggested branch:

- `feature/loading-skeletons`

Exit gate:

- raw loading placeholders are replaced with skeleton states

### Session 3: copy alignment

Doc:

- `docs/2026-03-09/04-copy-alignment-plan.md`

Suggested branch:

- `chore/copy-alignment`

Exit gate:

- landing/app copy and `/api/languages` agree

### Session 4: privacy and terms

Doc:

- `docs/2026-03-09/05-privacy-and-terms-alignment-plan.md`

Suggested branch:

- `chore/privacy-terms-alignment`

Exit gate:

- legal pages match actual product behavior

### Session 5: pricing and credits

Doc:

- `docs/2026-03-09/06-pricing-and-credit-rebalance-plan.md`

Suggested branch:

- `feature/pricing-credit-rebalance`

Exit gate:

- pricing constants, UI copy, and billing assumptions are aligned
