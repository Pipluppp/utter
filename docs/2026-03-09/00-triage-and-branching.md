# 2026-03-09 Triage And Branching

## Summary

The unfinished March 7 work that still matters for the current product pass is:

1. multi-job execution and tracking UX
2. frontend loading skeletons
3. copy alignment on landing and product surfaces

An additional March 9 workstream has now been added:

4. visual language integration for landing and app surfaces, based on custom blob/dot graphics and stronger pixel-display typography

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

### Visual language integration is now a defined task

The current landing and app pages already use a dark mono/pixel base, but the visual system is still mostly layout + screenshots. It does not yet have a reusable decorative identity for the three core workflows.

Confirmed gaps:

- no reusable blob/dot graphic component family exists
- `Clone`, `Design`, and `Generate` do not have distinct branded graphics
- `Geist Pixel Circle` is not currently wired into the frontend font tokens
- the landing page is still relatively short and does not fully capitalize on the existing dark atmospheric direction

## Current branch state

- current worktree branch: `docs/frontend-loading-skeleton-plan`
- local unstaged change exists in `frontend/index.html`
- current branch is only ahead of `main` by the March 7 skeleton-doc files

## Chosen approach

Do not disturb the current worktree.

Create a clean worktree from `main` and branch there:

- worktree path: `C:\Users\Duncan\Desktop\utter-2026-03-09-multi-job`
- branch: `feature/multi-job-workflows`

## Why this branch first

`multi-job-workflows` is the best next implementation branch because it unlocks the largest product gap:

1. it removes the current single-generation bottleneck
2. it gives users a reliable cross-page source of truth for running work
3. it provides the backend and frontend primitives that later pricing, copy, and loading-state polish can sit on top of

## Recommended execution order after planning

1. Implement multi-job backend and frontend tracking first.
2. Build the visual language integration pass for landing and core app pages.
3. Land the loading skeleton pass once the visual direction and task-state model are stable.
4. Update landing/product copy and `/api/languages` together.
5. Update privacy, terms, pricing, and credit constants together after product decisions are agreed.

## One-task-per-session workflow

Use one fresh Codex chat per task.

Recommended loop:

1. Open this triage doc and the next task doc in the sequence.
2. Start a new chat with the task doc's `Session prompt`.
3. Let Codex implement only that task.
4. Manually test the task locally.
5. If the task is good, move to the next task in a brand-new chat instead of continuing the old one.

This keeps context focused and avoids packing the whole March 9 scope into one session.

## Session queue

### Session 1: multi-job workflows

Doc:

- `docs/2026-03-09/01-multi-job-workflows-plan.md`

Exit gate:

- concurrent jobs work
- task tracking no longer overwrites by type

### Session 2: visual language integration

Doc:

- `docs/2026-03-09/02-design-language-graphics-plan.md`

Exit gate:

- landing and core workflow pages share the new graphic system

### Session 3: loading skeletons

Doc:

- `docs/2026-03-09/03-loading-skeleton-plan.md`

Exit gate:

- raw loading placeholders are replaced with skeleton states

### Session 4: copy alignment

Doc:

- `docs/2026-03-09/04-copy-alignment-plan.md`

Exit gate:

- landing/app copy and `/api/languages` agree

### Session 5: privacy and terms

Doc:

- `docs/2026-03-09/05-privacy-and-terms-alignment-plan.md`

Exit gate:

- legal pages match actual product behavior

### Session 6: pricing and credits

Doc:

- `docs/2026-03-09/06-pricing-and-credit-rebalance-plan.md`

Exit gate:

- pricing constants, UI copy, and billing assumptions are aligned
