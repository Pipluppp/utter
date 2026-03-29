# Feature Component & Hook Extraction Guide

Date: 2026-03-29

## Purpose

Atomic refactoring guide for extracting inline logic from monolithic page components into co-located hooks and sub-components. This is the cleanup pass that prepares each feature for TanStack Query integration (the next track).

Each page is tackled independently. The goal is structural — reduce cognitive load, isolate responsibilities, and make the TanStack Query migration a clean swap of data-fetching internals rather than a combined structural + data-layer rewrite.

## Reference implementation: `features/clone/`

Clone.tsx was refactored from a 751-line monolith (18 `useState`, 10 `useRef`, 5 `useEffect`) into:

```
features/clone/
  Clone.tsx              ← 199 lines, orchestration + JSX only
  components/
    CloneForm.tsx        ← form fields (name, transcript, language, submit button)
    CloneSuccessModal.tsx
    RecordPanel.tsx      ← recording UI surface
    UploadPanel.tsx      ← file upload UI surface
    Countdown.tsx
    RecordingGuide.tsx
  hooks/
    useAudioRecorder.ts  ← recording state machine (all refs + state encapsulated)
    useCloneFile.ts      ← file validation + selection state
    useCloneSubmit.ts    ← 3-step clone mutation lifecycle
    useTranscribe.ts     ← transcription mutation
    useDemoLoader.ts     ← one-shot demo/example seeding
```

### Principles demonstrated

1. The page component (`Clone.tsx`) is pure orchestration: it wires hooks together, handles cross-concern coordination, and renders the JSX tree. No fetch logic, no imperative refs, no complex state machines.

2. Hooks encapsulate a single async or stateful concern and expose a typed result object:

   ```ts
   // useCloneSubmit returns:
   {
     (submitting, elapsedLabel, sweepNonce, created, error, submit, reset);
   }
   // useCloneFile returns:
   {
     (file, fileError, fileInfo, validateAndSet, clear, setFile);
   }
   // useTranscribe returns:
   {
     (transcribing, transcribe);
   }
   ```

3. Components receive data and callbacks as props — they don't call hooks that fetch data. The page component owns the data flow.

4. Hooks that manage server interactions (submit, transcribe) keep their `loading`/`error` state internal. The page reads those from the hook result, not from its own `useState`.

5. Pure helpers (formatting, validation constants, content-type resolution) live as module-level functions in the hook file or in `lib/`, not as component state.

## Execution order

| #   | Feature  | File(s)                                     | Lines | Complexity                                                         |
| --- | -------- | ------------------------------------------- | ----- | ------------------------------------------------------------------ |
| 1   | Generate | `features/generate/Generate.tsx`            | 433   | Medium — voice fetch, form, task integration, result playback      |
| 2   | Design   | `features/design/Design.tsx`                | 490   | Medium — similar to Generate with design-specific preview flow     |
| 3   | Voices   | `features/voices/Voices.tsx`                | 560   | High — search/filter/sort, pagination, 3 mutations, playback       |
| 4   | Tasks    | `features/tasks/Tasks.tsx`                  | 265   | Low — filter, polling, load-more, cancel/dismiss                   |
| 5   | History  | `features/history/History.tsx`              | 513   | High — search/filter/sort, pagination, polling, playback, download |
| 6   | Account  | `features/account/*.tsx` + `accountData.ts` | ~600  | Medium — shared data hook, 5 consumer files                        |

## Per-page instructions

### General approach (apply to every page)

1. Read the full page component. Identify every `useState`, `useRef`, `useEffect`, and inline async function.

2. Categorize each piece of state:
   - **Server-state-like**: `data`, `loading`, `error`, abort refs, polling timers → extract to a hook
   - **Mutation lifecycle**: `busyDelete`, `submitting`, `isSubmitting` + try/catch/finally → extract to a hook
   - **Local UI state**: filter selections, form values, modal open/close → stays in the page component
   - **Playback/media state**: waveform refs, play state → extract to a hook or keep if small

3. Extract hooks into `features/<name>/hooks/`. Each hook:
   - Owns one concern (a fetch, a mutation, a state machine)
   - Returns a typed result object (not a tuple)
   - Manages its own `loading`/`error` internally
   - Does not import or depend on other feature hooks

4. Extract presentational sub-components into `features/<name>/components/`. Each component:
   - Receives data and callbacks as props
   - Does not call data-fetching hooks
   - Can import shared atoms/molecules from `components/`

5. The page component becomes orchestration:
   - Calls hooks at the top
   - Wires cross-concern logic (e.g., "after mutation succeeds, reload list")
   - Renders the component tree with props from hook results

6. Do not change behavior. The page should work identically before and after. No new features, no API changes, no loading-state changes.

7. Run `npm --prefix frontend run check` after each page to verify formatting + linting.

### 1. Generate (`features/generate/Generate.tsx`)

Current state audit (from TanStack Query audit):

- Server-state-like: `voices`, `loadingVoices` (mount-time `/api/voices` fetch)
- Mutation: `isSubmitting` + `onGenerate()` posts `/api/generate` then calls `startTask()`
- Form state: `voiceId`, `language`, `text` (seeded from route search + task formState)
- Task result: `selectedTaskId`, `audioUrl`, `downloadUrl` (reads from `TaskProvider`)
- Playback: audio element refs, play/pause state

Target structure:

```
features/generate/
  Generate.tsx           ← orchestration + JSX
  components/
    GenerateForm.tsx     ← voice select, language, text input, submit button
    GenerateResult.tsx   ← completed audio playback + download
  hooks/
    useVoiceOptions.ts   ← fetches /api/voices, returns { voices, loading, error }
    useGenerateSubmit.ts ← posts /api/generate + startTask integration
```

Notes:

- `useVoiceOptions` will later become a one-liner `useQuery(voiceQueries.options())` in the TanStack Query pass. Keep it thin.
- Task result reading from `TaskProvider` stays in the page component — it's cross-feature state, not a fetch.
- Route search seeding (`restoredRef` pattern) stays in the page component.

### 2. Design (`features/design/Design.tsx`)

Similar to Generate. Identify:

- Voice options fetch (same `/api/voices` pattern)
- Design preview mutation
- Form state (prompt, voice, language)
- Task/result integration

Target structure:

```
features/design/
  Design.tsx
  components/
    DesignForm.tsx
    DesignResult.tsx
  hooks/
    useDesignSubmit.ts
```

Notes:

- `useVoiceOptions` from Generate can be promoted to `features/shared/hooks/useVoiceOptions.ts` if both pages need it. Or keep it duplicated and let TanStack Query deduplicate via shared `queryOptions()` later.

### 3. Voices (`features/voices/Voices.tsx`)

Current state audit (from TanStack Query audit):

- Server-state-like: `data`, `loading`, `error`, `loadAbortRef` (paginated list fetch)
- Mutations: delete (`busyDelete`), favorite toggle (`busyFavorite`), rename (`busyRename`) — each with manual `void load()` after success
- UI state: `query`, `source`, `sort`, `sortDir`, `favorites`, `page`, `highlightedVoiceId`
- Playback: `playState`, `waveRefs`

Target structure:

```
features/voices/
  Voices.tsx
  components/
    VoiceCard.tsx          ← single voice card with actions
    VoiceCardSkeleton.tsx  ← skeleton variant (already exists inline)
    VoicesSkeleton.tsx     ← skeleton grid (already exists inline)
    VoiceFilterBar.tsx     ← search + source + sort + favorites controls
  hooks/
    useVoiceList.ts        ← paginated fetch with abort, returns { data, loading, error, reload }
    useVoiceMutations.ts   ← delete, favorite, rename with per-item busy state
```

Notes:

- `Highlight` and `tokenize` are shared with History. Extract to `features/shared/Highlight.tsx` and `features/shared/tokenize.ts` during either the Voices or History pass (whichever comes first), then import from the other.
- `VoiceCard` receives the voice object + action callbacks + play state as props.
- `useVoiceList` wraps the current `load()` + `AbortController` + `useEffect` pattern. It will later become `useQuery(voiceQueries.list(filters))`.
- `useVoiceMutations` returns `{ deleteVoice, toggleFavorite, renameVoice }` each with their own `busy`/`error`. Will later become three `useMutation` calls.

### 4. Tasks (`features/tasks/Tasks.tsx`)

Smallest page. Current state:

- Server-state-like: `tasks`, `loading`, `loadingMore`, `error`, `nextBefore`
- Polling: recursive `setTimeout` + visibility listener
- UI state: `typeFilter`

Target structure:

```
features/tasks/
  Tasks.tsx
  components/
    TaskCard.tsx
    TaskCardSkeleton.tsx   ← already exists inline
    TasksSkeleton.tsx      ← already exists inline
  hooks/
    useTaskList.ts         ← fetch + polling + load-more, returns { tasks, loading, loadingMore, error, loadMore }
```

Notes:

- Cancel/dismiss stay as inline functions in the page since they delegate to `TaskProvider`.
- The polling logic is the main extraction target — it's ~40 lines of `setTimeout` + visibility management.

### 5. History (`features/history/History.tsx`)

Current state audit:

- Server-state-like: `data`, `loading`, `error`, `loadAbortRef`, `refreshTimerRef` (paginated fetch + conditional polling)
- Voice filter options: separate mount-time `/api/voices?per_page=100` fetch → `voiceItems`
- Mutations: delete, regenerate (navigates after success)
- UI state: `query`, `status`, `sort`, `sortDir`, `voiceId`, `page`
- Playback: `playState`, `waveRefs`
- Download: `resolveProtectedMediaUrl` + `triggerDownload`

Target structure:

```
features/history/
  History.tsx
  components/
    HistoryCard.tsx
    HistoryCardSkeleton.tsx
    HistorySkeleton.tsx
    HistoryFilterBar.tsx
  hooks/
    useGenerationList.ts     ← paginated fetch + conditional polling
    useGenerationActions.ts  ← delete, regenerate, download
```

Notes:

- Voice filter options fetch: reuse `useVoiceOptions` from `features/shared/hooks/` (extracted during Generate or Voices pass).
- `Highlight` and `tokenize`: import from `features/shared/` (extracted during Voices pass).
- Polling logic (`refreshTimerRef` + `setInterval` when active generations exist) goes into `useGenerationList`. Will later become `refetchInterval` callback in TanStack Query.

### 6. Account (`features/account/`)

Different pattern — not one monolith but a shared data hook consumed by multiple pages.

Current problem (from TanStack Query audit):

- `useAccountData()` is called independently by `AccountLayout`, `Overview`, `Credits`, `Profile`
- Each call creates a separate fetch lifecycle — 2+ parallel fetches for the same data
- No shared cache or invalidation

This page's refactoring is less about component extraction and more about:

1. Ensuring each account sub-page's inline components are clean
2. Preparing `accountData.ts` so the TanStack Query migration is a clean swap

Target structure:

```
features/account/
  accountData.ts           ← keep, will become queryOptions() wrapper
  AccountLayout.tsx        ← keep
  Overview.tsx             ← extract OverviewSkeleton, ActivityList if large
  Credits.tsx              ← extract PricingCards, ActivityTimeline if large
  Profile.tsx              ← extract IdentityList if large
  ChangePasswordSection.tsx ← already extracted
  components/              ← only if sub-components are extracted
  hooks/                   ← only if needed
```

Notes:

- The main win here comes from the TanStack Query pass (shared cache eliminates duplication), not from component extraction.
- Only extract sub-components if a file is over ~300 lines. Don't force the pattern.

## What NOT to change

- Route files (`routes/_app/*.tsx`) — URL contracts stay untouched
- `lib/api.ts`, `lib/types.ts` — shared utilities stay
- `components/atoms/`, `components/molecules/`, `components/organisms/` — shared component library stays
- `app/TaskProvider.tsx`, `app/auth/AuthStateProvider.tsx` — global providers stay
- Loading/error/skeleton behavior — no UX changes, just structural moves
- Do not introduce TanStack Query, Jotai, or any new dependencies in this pass

## Verification checklist (per page)

- [ ] `npm --prefix frontend run check` passes (oxfmt + oxlint)
- [ ] Page renders identically (manual visual check)
- [ ] All filter/sort/search/pagination still works
- [ ] All mutations (delete, rename, etc.) still work
- [ ] Skeleton loading on first visit still works
- [ ] Stale-while-revalidate on filter change still works (voices/history)
- [ ] No new TypeScript errors introduced
