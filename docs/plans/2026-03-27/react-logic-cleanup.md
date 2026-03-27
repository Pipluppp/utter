# React Logic Cleanup & Modularization

Signposting document for the frontend React logic refactoring workstream.
This covers hooks, shared patterns, duplicated logic, and state management — everything that isn't the atomic design / component structure restructuring.

## Context

84 source files in `frontend/src/`. React 19 + React Router 7 + React Aria Components + Tailwind v4.
No external state management libraries (Context API only). 11 custom hooks scattered across 4 locations.
Several patterns are duplicated verbatim across page components.

---

## 1. Paginated list data-fetching hook

`Voices.tsx` and `History.tsx` share ~60 lines of identical boilerplate:
- `loadAbortRef` + `AbortController` management
- `setLoading` / `setError` / `setData` state triple
- URL search param sync (`useSearchParams`)
- Debounced search with `useDebouncedValue`
- Pagination reset on filter change
- Cleanup on unmount

Extract a `usePaginatedList<T>` hook (or similar) that encapsulates this pattern.
Both pages would reduce to: configure filters → render data.

**Files:** `pages/Voices.tsx`, `pages/History.tsx`

---

## 2. Duplicated Highlight component and tokenize utility

`Highlight` (text search highlighting with range merging) and `tokenize(query)` are copy-pasted identically in both `Voices.tsx` and `History.tsx`.

Extract to a shared location — either `components/ui/Highlight.tsx` + `lib/text.ts`, or wherever makes sense post-atomic-restructuring.

**Files:** `pages/Voices.tsx` (lines 17–65), `pages/History.tsx` (lines 18–76)

---

## 3. Audio recording logic extraction

Clone.tsx embeds ~200 lines of WebAudio API code inline:
- `navigator.mediaDevices.getUserMedia`
- `AudioContext` + `AudioWorkletNode` with `ScriptProcessorNode` fallback
- PCM chunk accumulation, resampling, WAV encoding
- Mic level metering, recording timer, cleanup

This is a self-contained domain. Extract to a `useAudioRecorder` hook that exposes `{ start, stop, clear, recording, micLevel, recordSeconds, file, error }`.

The pure audio utilities (`resampleFloat32Linear`, `concatFloat32Chunks`, `float32ToPcm16leBytes`, `createWavHeaderPcm16Mono`, `rmsLevel`) already live in `lib/audio.ts` — the hook would orchestrate them.

**Files:** `pages/Clone.tsx` (startRecording, stopRecording, cleanupRecording functions + associated refs/state)

---

## 4. Input/textarea styling consolidation

The same ~180-character Tailwind class string for text inputs is copy-pasted across 11+ locations:

```
w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated
placeholder:text-faint transition-colors hover:border-border-strong focus:border-border-strong
focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring
focus-visible:ring-offset-2 focus-visible:ring-offset-background
```

Options:
- A. Create a shared `inputStyles()` function (like `buttonStyles()` already exists)
- B. Create thin `<TextInput>` / `<TextAreaInput>` wrapper components around React Aria primitives
- C. A Tailwind `@utility` or `@apply` rule

Same applies to textarea styling (identical string + `min-h-36 resize-y`).

**Files:** Clone, Design, Generate, Auth, ForgotPassword, UpdatePassword, ChangePasswordSection (and landing mocks)

---

## 5. Async effect cleanup pattern unification

Two different patterns are used for the same problem (preventing state updates after unmount):

**Pattern A — manual active flag:**
```ts
let active = true;
void (async () => { ... if (!active) return; ... })();
return () => { active = false; };
```
Used in: `Tasks.tsx`, `Generate.tsx`

**Pattern B — AbortController:**
```ts
loadAbortRef.current?.abort();
const controller = new AbortController();
loadAbortRef.current = controller;
```
Used in: `Voices.tsx`, `History.tsx`

Pick one and standardize. AbortController is more idiomatic (also cancels in-flight fetches), but either works if consistent.

---

## 6. Polling pattern consolidation

Two different polling implementations exist:

**TaskProvider.tsx** — `setInterval`-based, per-task polling at 3s intervals, with in-flight guards.

**Tasks.tsx** — `setTimeout`-based recursive polling at 5s, with `visibilitychange` listener to pause/resume when tab is hidden, and error backoff (10s).

The Tasks.tsx approach is arguably better (visibility-aware, no overlapping requests). Consider:
- Extracting a `usePolling(fn, intervalMs, options)` hook
- Adding visibility-awareness to TaskProvider's polling
- Or at minimum documenting why they differ

**Files:** `components/tasks/TaskProvider.tsx`, `pages/Tasks.tsx`

---

## 7. WaveSurfer theme color resolution

Both `WaveformPlayer.tsx` and `useWaveformListPlayer.ts` independently:
1. Call `getComputedStyle(document.documentElement)`
2. Read `--color-foreground`, `--color-muted-foreground`, `--color-faint`
3. Apply fallback values based on `resolvedTheme`
4. Derive `waveColor` and `progressColor`

Extract to a shared `getWaveformColors(resolvedTheme)` utility or a `useWaveformTheme()` hook.

**Files:** `components/audio/WaveformPlayer.tsx`, `components/audio/useWaveformListPlayer.ts`

---

## 8. Task status display helpers

`getStatusText()` lives in TaskProvider, but the surrounding display logic is repeated with variations:

- Elapsed time: `formatElapsed(task.startedAt, nowMs)` vs `formatTaskElapsed(task)` — different APIs for the same thing
- Terminal status checks: `task.status === "completed" || task.status === "failed" || task.status === "cancelled"` repeated inline in TaskDock, Design, Generate, Tasks
- Status badge rendering: History.tsx has its own status-to-color mapping inline

Consider:
- An `isTerminal(status)` helper (already exists inside TaskProvider but not exported)
- A `TaskStatusBadge` component for the status pill rendering
- Consolidating elapsed display into one pattern

**Files:** `components/tasks/TaskProvider.tsx`, `components/tasks/TaskDock.tsx`, `pages/Design.tsx`, `pages/Generate.tsx`, `pages/Tasks.tsx`, `pages/History.tsx`

---

## 9. Form validation patterns

`lib/validation.ts` only covers `validateEmail` and `validatePassword`.

Page components have their own inline validation:
- Clone.tsx: `if (!name.trim())`, `if (!file)`, `if (transcript.trim().length < 10)`
- Design.tsx: `if (!name.trim())`, `if (text.length > 500)`, `if (instruct.length > 500)`
- Generate.tsx: compound `canSubmit` boolean from multiple conditions

Not necessarily wrong — these are feature-specific rules. But the pattern of "check → setError → return" is repeated. Consider whether a lightweight form validation helper or pattern would reduce boilerplate without over-abstracting.

Lower priority than the other items.

---

## 10. Hook organization

Current state:
- `hooks/useElapsedTick.ts` — the only file in the hooks directory
- `pages/hooks.ts` — `useLanguages`, `useDebouncedValue`, `useCreditsUsage`
- `pages/account/accountData.ts` — `useAccountData`, `useAccountPageData`
- `app/auth/AuthStateProvider.tsx` — `useAuthState`
- `app/theme/ThemeProvider.tsx` — `useTheme`
- `app/useGlobalShortcuts.ts` — `useGlobalShortcuts`
- `components/tasks/TaskProvider.tsx` — `useTasks`
- `components/audio/useWaveformListPlayer.ts` — co-located with WaveformPlayer

After the atomic design restructuring (Workstream A), hooks should land in predictable locations:
- Shared/generic hooks → `hooks/`
- Feature-specific hooks → co-located with their feature directory
- Provider hooks → stay with their provider (useAuthState, useTheme, useTasks)

This is mostly a follow-up to Workstream A rather than independent work.

---

## 11. State management migration (Jotai)

Covered in detail in the companion document: `state-management-audit.md`.

The three Context providers (ThemeProvider, AuthStateProvider, TaskProvider), the module-level languages cache, and the paginated list patterns are all candidates for Jotai atoms. Page-local form state (Clone, Generate, Design, Auth) should stay as `useState`.

TaskProvider is the highest-value migration target — 539 lines of reducer + polling + persistence that would decompose into focused atoms with granular subscriptions (no more re-rendering everything on every 3-second poll).

This should happen after items #1–#8 above, since the extractions (paginated list hook, polling consolidation, etc.) will simplify the migration surface.

---

## Suggested sequence

1. **Input/textarea styling** (#4) — quick win, touches many files but low risk
2. **Highlight + tokenize extraction** (#2) — quick win, pure extraction
3. **Audio recording hook** (#3) — high impact on Clone.tsx readability
4. **Paginated list hook** (#1) — high impact on Voices/History readability
5. **Async cleanup unification** (#5) — standardize across codebase
6. **WaveSurfer theme colors** (#7) — small but clean
7. **Task status helpers** (#8) — moderate impact, touches several files
8. **Polling consolidation** (#6) — moderate complexity, TaskProvider is sensitive
9. **Hook organization** (#10) — do after Workstream A
10. **State management migration** (#11) — Jotai integration, do after extractions stabilize
11. **Form validation** (#9) — evaluate after other items, may not be worth abstracting
