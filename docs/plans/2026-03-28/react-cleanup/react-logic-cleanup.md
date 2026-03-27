# React Logic Cleanup & Modularization

Date: 2026-03-27

This plan is now post-TanStack Router.

The router migration already cleaned up route/search ownership:

- route/search state belongs in `frontend/src/routes/*`
- feature components now read typed search state from TanStack Router
- auth redirects already live in route `beforeLoad`

That changes the React cleanup priorities. The next pass should reduce component complexity without creating more ad hoc server-state abstractions that TanStack Query would immediately replace.

## Keep In Scope

These are still good cleanup targets because they are mostly pure UI or imperative logic:

1. `frontend/src/features/voices/Voices.tsx` and `frontend/src/features/history/History.tsx`
   Extract shared `Highlight` and `tokenize` helpers.

2. `frontend/src/features/clone/Clone.tsx`
   Extract the recording/orchestration logic into a `useAudioRecorder` hook.

3. Input and textarea recipes
   Keep consolidating shared field styling around `frontend/src/lib/recipes/input.ts`.

4. Waveform theme helpers
   Deduplicate theme color resolution between `frontend/src/components/organisms/WaveformPlayer.tsx` and `frontend/src/hooks/useWaveformListPlayer.ts`.

5. Task status helpers
   Normalize terminal checks, elapsed labels, and shared status rendering between `frontend/src/app/TaskProvider.tsx`, `frontend/src/components/organisms/TaskDock.tsx`, `frontend/src/features/generate/Generate.tsx`, `frontend/src/features/design/Design.tsx`, `frontend/src/features/tasks/Tasks.tsx`, and `frontend/src/features/history/History.tsx`.

6. Account data ownership
   Fix the duplicated `useAccountData()` ownership across `frontend/src/features/account/AccountLayout.tsx`, `frontend/src/features/account/Overview.tsx`, `frontend/src/features/account/Credits.tsx`, and `frontend/src/features/account/Profile.tsx`.

## Deprioritize Or Skip

Do not spend time on these before the TanStack Query pass:

1. A manual `usePaginatedList<T>` abstraction for voices/history
   Those pages are better candidates for query keys plus route-owned search state than another custom `useEffect` wrapper.

2. A broad async-effect standardization pass
   Query will replace much of the current `loading/error/data` and cancellation boilerplate in the main read-heavy screens.

3. A polling abstraction for every fetch loop
   The polling in `History.tsx`, `Tasks.tsx`, and `TaskProvider.tsx` does not have one shared ownership model yet. Make the data-layer decision first.

## Relationship To TanStack Query

This cleanup track should prepare the codebase for Query, not compete with it.

That means:

- extract pure helpers now
- fix duplicated ownership now
- leave read-heavy server-state hooks thin enough to replace cleanly

## Updated Sequence

1. Input/textarea styling consolidation
2. Highlight and tokenize extraction
3. Audio recording hook extraction
4. Waveform and task-status helper cleanup
5. Account data ownership fix
6. TanStack Query rollout for shared server state
7. Revisit any remaining async hook cleanup after Query is in place
8. Reassess Jotai/Bunshi only after the server-state surface is reduced
