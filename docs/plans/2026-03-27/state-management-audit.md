# State Management Audit

A walkthrough of every state management pattern in the frontend, why it exists, how it behaves, and what a Jotai/Bunshi migration would look like for each.

## Current stack

- React 19 Context API (3 providers)
- `useState` / `useReducer` for component-local state
- `useRef` for mutable values that shouldn't trigger re-renders
- `localStorage` for persistence (theme, task store)
- Module-level variables for request deduplication (languages cache)
- No external state management libraries

---

## Provider-level state (Context API)

These are the three global state containers that wrap the entire app in `App.tsx`:

```tsx
<ThemeProvider>        // outermost
  <AuthStateProvider>  // middle
    <TaskProvider>     // innermost
      <RouterProvider router={router} />
    </TaskProvider>
  </AuthStateProvider>
</ThemeProvider>
```

### 1. ThemeProvider

**File:** `app/theme/ThemeProvider.tsx` (75 lines)

**What it holds:**
- `theme: "light" | "dark"` — the user's chosen theme

**How it works:**
- Reads initial value from `localStorage` key `utter_theme`
- `useLayoutEffect` applies `.dark` class to `<html>` and updates `color-scheme` + `<meta theme-color>`
- Listens for `storage` events so theme syncs across tabs
- Exposes `setTheme(theme)` and `toggleTheme()` via context

**Who consumes it:**
- `Layout.tsx` — renders the toggle button, passes `theme` to TopBar
- `WaveformPlayer.tsx` — reads `resolvedTheme` to pick waveform colors
- `useWaveformListPlayer.ts` — same

**Behaviour notes:**
- Simple, synchronous, no async. The lightest provider.
- `resolvedTheme` is currently just `theme` (no "system" option anymore), so the `useMemo` wrapping it is a no-op.

**Jotai fit:** Very clean candidate. A single `atom` with `atomWithStorage` would replace the entire provider, context, and localStorage sync. Theme consumers would just `useAtomValue(themeAtom)`.

---

### 2. AuthStateProvider

**File:** `app/auth/AuthStateProvider.tsx` (95 lines)

**What it holds:**
```ts
{
  status: "loading" | "signed_out" | "signed_in",
  user: { email, id } | null,
  error: Error | null,
  refresh: () => Promise<void>
}
```

**How it works:**
- On mount, calls `getAuthSession()` (fetches `/api/auth/session`)
- Uses a `requestIdRef` counter to discard stale responses (race condition guard)
- `refresh()` re-fetches the session — called after sign-in, sign-up, sign-out, and password changes
- No polling, no localStorage — auth state is always server-derived

**Who consumes it:**
- `RequireAuth.tsx` — redirects to `/auth` if not signed in
- `Layout.tsx` — determines nav variant (marketing vs app)
- `Auth.tsx` — redirects away if already signed in, calls `refresh()` after auth actions
- `AccountLayout.tsx` (indirectly via `useAccountData` which calls `signOut` → `authState.refresh()`)

**Behaviour notes:**
- The `refresh` function is recreated on every render (not wrapped in `useCallback`). This is fine because it's only called imperatively, never as a dependency.
- The provider re-renders all children on any auth state change. In practice this is rare (sign-in/out events).

**Jotai fit:** Good candidate. An async atom that fetches `/api/auth/session` on read, with a `refresh` action. The `requestIdRef` race guard could be replaced by Jotai's built-in async atom cancellation. Bunshi could scope it if needed, but auth is inherently global.

---

### 3. TaskProvider

**File:** `components/tasks/TaskProvider.tsx` (539 lines)

This is the most complex state container in the app. It manages the lifecycle of async backend tasks (generate, design_preview, clone).

**What it holds:**
```ts
{
  tasks: StoredTask[],           // ordered list of all tracked tasks
  tasksById: Record<string, StoredTask>,
  activeCount: number,           // non-terminal tasks
  startTask(id, type, ...),      // create a new task
  dismissTask(id),               // remove from UI + delete on backend
  cancelTask(id),                // POST /api/tasks/:id/cancel
  clearTask(id),                 // remove + DELETE on backend
  getLatestTask(type),           // most recent task of a type
  getTasksByType(type),          // all tasks of a type
  getStatusText(status, ...),    // human-readable status label
  formatTaskElapsed(task),       // elapsed time string
}
```

**How it works — state:**
- Uses `useReducer` with three actions: `hydrate`, `upsert`, `remove`
- Task store shape: `{ byId: Record<string, StoredTask>, orderedIds: string[] }`
- Tasks are sorted by completion/start timestamp, pruned after 30 minutes if terminal

**How it works — persistence:**
- Reads/writes to `localStorage` key `utter_tasks_store` via `readJson`/`writeJson`
- On mount, runs `migrateLegacyTasks()` which reads old per-type keys (`utter_task_generate`, etc.) and merges them into the unified store
- Listens for `storage` events to sync across tabs
- Every 15 seconds, re-writes the store (triggers pruning of expired tasks)

**How it works — polling:**
- For each non-terminal task, starts a `setInterval` at 3 seconds
- Each poll fetches `GET /api/tasks/:id` and upserts the response
- Uses `pollInFlightRef` to prevent overlapping requests
- Stops polling when task reaches terminal status or 404s
- Cleanup on unmount clears all intervals

**Who consumes it:**
- `Clone.tsx` — doesn't use it directly (clone is synchronous, not task-based)
- `Generate.tsx` — `startTask()` after submitting, reads `getTasksByType("generate")` to show tracked jobs, watches `selectedTask` status to load audio when completed
- `Design.tsx` — same pattern but for `"design_preview"` tasks, plus saves the preview blob as a voice
- `Tasks.tsx` — uses `cancelTask` and `dismissTask`, but fetches its own task list from `/api/tasks` (doesn't use the provider's task list)
- `TaskDock.tsx` — renders the floating task dock, uses `tasks`, `dismissTask`, `cancelTask`, `formatTaskElapsed`

**Behaviour notes:**
- The provider re-renders on every poll update (every 3 seconds per active task). All consumers re-render too.
- `stateRef` is maintained alongside the reducer state to avoid stale closures in polling callbacks.
- `Tasks.tsx` fetches its own task list from the API independently — it doesn't use the provider's `tasks` array. This means there are two sources of truth for the task list on the `/tasks` page.
- The 15-second periodic write is a side effect that triggers pruning. It re-renders even if nothing changed.

**Jotai fit:** This is the most interesting migration target. The reducer + polling + persistence could be decomposed into:
- `taskStoreAtom` — the core `{ byId, orderedIds }` with `atomWithStorage` for localStorage
- `taskPollingAtom` — an effect atom that manages per-task polling intervals
- `activeTaskCountAtom` — derived atom from `taskStoreAtom`
- `tasksByTypeAtom(type)` — atom family for filtered views
- Individual task actions as write-only atoms or standalone functions

Bunshi would be useful here if you wanted to scope task state per-route or per-feature, but tasks are inherently global (the dock shows them everywhere).

---

## Page-level state (useState)

Each page manages its own local state. Here's what each feature page holds and why.

### Clone.tsx — 18 useState + 8 useRef

The heaviest page by state count.

**Form state (5):** `name`, `transcript`, `language`, `file`, `audioMode`
These are the form fields the user fills in. They reset on successful clone.

**Recording state (5):** `recording`, `recordingError`, `micLevel`, `recordSeconds`, `recordedPreviewUrl`
Drive the microphone recording UI — level meter, timer, preview player. Only relevant when `audioMode === "record"`.

**Recording refs (8):** `streamRef`, `audioCtxRef`, `processorRef`, `workletRef`, `pcmChunksRef`, `pcmSamplesRef`, `captureSampleRateRef`, `recordTimerRef`
Mutable handles to WebAudio objects. Must be refs (not state) because they're manipulated in callbacks without triggering re-renders.

**Submission state (4):** `submitting`, `startedAt`, `elapsedLabel`, `sweepNonce`
Track the clone API call progress. `sweepNonce` triggers the GridArt animation.

**Transcription state (1):** `transcribing`
Whether the transcription API call is in flight.

**Result state (2):** `error`, `created`
The clone response or error message. `created` triggers the success modal.

**File validation (1):** `fileError`
Separate from `error` because file errors show inline on the drop zone.

**Why it's all local:** Clone is a single-page form submission. No other page needs this state. The form resets after success. There's no cross-page data flow.

**Jotai consideration:** The recording state cluster (5 useState + 8 useRef) should become a `useAudioRecorder` hook first (see react-logic-cleanup.md #3). After that, the remaining form state is simple enough that Jotai atoms wouldn't add value — unless you want form state to survive route changes (currently it doesn't).

---

### Generate.tsx — 11 useState + 4 useRef

**Form state (3):** `voiceId`, `language`, `text`
The generation form fields.

**Voice list (2):** `voices`, `loadingVoices`
Fetched on mount from `/api/voices`. Used to populate the voice selector.

**Task tracking (1):** `selectedTaskId`
Which tracked generation job is currently selected in the "Tracked Jobs" list.

**Submission state (2):** `isSubmitting`, `sweepNonce`

**Result state (3):** `error`, `audioUrl`, `downloadUrl`
When the selected task completes, the audio URL is resolved and set here.

**Refs (4):** `restoredRef` (one-time form restore from latest task), `handledTaskKeyRef` (prevent re-processing terminal tasks), `loadedDemoRef` (prevent re-loading demo), `submitInFlightRef` (prevent double submit)

**Cross-component data flow:**
- Reads from `useTasks()` — `getTasksByType("generate")`, `getLatestTask("generate")`, `startTask()`, `getStatusText()`
- Reads from `useLanguages()` — shared language list
- Reads URL params — `?voice=`, `?text=`, `?language=`, `?demo=`

**Jotai consideration:** The voice list fetch (`voices`, `loadingVoices`) is a classic async data atom candidate. If multiple pages needed the voice list (currently only Generate and the voice selector in the account section), a shared `voicesAtom` would deduplicate. The form state and task tracking are page-local and don't benefit much from atoms.

---

### Design.tsx — 12 useState + 3 useRef

**Form state (4):** `name`, `language`, `text`, `instruct`
The voice design form fields.

**Task tracking (1):** `selectedTaskId`
Which design preview task is selected.

**Submission state (2):** `isSubmittingPreview`, `sweepNonce`

**Save state (3):** `isSavingVoice`, `savedVoiceId`, `savedVoiceName`
After a preview completes, the user can save it as a voice. These track that flow.

**Result state (3):** `error`, `success`, `previewUrl`

**Refs (3):** `previewBlobRef` (holds the audio blob for saving), `objectUrlRef` (for cleanup), `restoredRef`, `handledTaskKeyRef`

**Cross-component data flow:**
- Same as Generate — reads from `useTasks()` and `useLanguages()`

**Jotai consideration:** Same analysis as Generate. The form + task tracking is page-local. The preview blob ref is inherently imperative.

---

### Voices.tsx — 7 useState + 2 useRef

**List state (5):** `query`, `source`, `page`, `data`, `loading`, `error`
Standard paginated list with search and filter.

**Playback state (2):** `busyDelete`, `playState`

**Cross-component data flow:**
- Reads from `useWaveformListPlayer()` — shared audio playback singleton
- Reads/writes URL search params

**Jotai consideration:** The paginated list state is a good candidate for a derived atom pattern — `voiceListAtom` that reacts to filter atoms (`voiceSearchAtom`, `voiceSourceAtom`, `voicePageAtom`). This would also solve the URL sync problem more cleanly.

---

### History.tsx — 6 useState + 3 useRef

Nearly identical to Voices.tsx but for generations instead of voices.

**List state (5):** `query`, `status`, `page`, `data`, `loading`, `error`

**Playback state (1):** `playState`

**Polling:** Has its own `refreshTimerRef` that polls every 5 seconds when active generations exist.

**Jotai consideration:** Same as Voices — paginated list atom pattern.

---

### Tasks.tsx — 6 useState

**List state (6):** `statusFilter`, `typeFilter`, `tasks`, `loading`, `loadingMore`, `error`, `nextBefore`

**Polling:** Has its own `setTimeout`-based polling with visibility change handling.

**Notable:** This page fetches its own task list from `/api/tasks` independently of `TaskProvider`. The provider tracks tasks the user started in the current session; this page shows the full server-side task history. Two different views of overlapping data.

**Jotai consideration:** The dual data source (TaskProvider vs API fetch) is a real problem. With Jotai, you could have a single `serverTaskListAtom` that the Tasks page reads, and the `taskStoreAtom` (from TaskProvider migration) could be a client-side overlay. Or unify them.

---

### Auth.tsx — 5 useState + 1 useRef

**Form state (3):** `intent`, `email`, `password`

**Auth flow state (2):** `status` (discriminated union: idle/loading/error/ok), `captchaToken`

**Server validation (1):** `serverErrors` — maps field names to server error messages for React Aria validation

**Jotai consideration:** None. Auth form state is ephemeral and page-local. No benefit from atoms.

---

### Account section

**AccountLayout.tsx** calls `useAccountData()` which fetches `/api/me` + `/api/credits/usage` + auth session info in parallel. The result is passed to child routes via React Router's `<Outlet context={account}>`.

Child pages (`Overview.tsx`, `Credits.tsx`, `Profile.tsx`) call `useAccountPageData()` which is just `useOutletContext<AccountData>()`.

**Credits.tsx** adds its own local state: `activePackId`, `checkoutError`, `activityFilter`, `checkoutStatus`.

**Jotai consideration:** The `useAccountData` → outlet context pattern is a React Router-specific way to share data between a layout and its children. With Jotai, this would be an `accountDataAtom` that any account page can read directly, without the outlet context indirection. Cleaner, but the current approach works fine.

---

## Module-level state

### Languages cache

**File:** `pages/hooks.ts`

```ts
let languagesCache: LanguagesResponse | null = null;
let languagesInFlight: Promise<LanguagesResponse> | null = null;
```

`useLanguages()` uses these module-level variables to deduplicate the `/api/languages` fetch. First caller triggers the fetch, subsequent callers get the cached result or join the in-flight promise.

**Who uses it:** Clone, Generate, Design (all need the language list).

**Jotai consideration:** Perfect atom candidate. `atomWithDefault(async () => fetch('/api/languages'))` or similar. The module-level cache + in-flight dedup is exactly what Jotai's async atoms do automatically.

---

## localStorage usage

| Key | Owner | What |
|---|---|---|
| `utter_theme` | ThemeProvider | `"light"` or `"dark"` |
| `utter_tasks_store` | TaskProvider | JSON task store `{ byId, orderedIds }` |
| `utter_task` (legacy) | TaskProvider migration | Old single-task key, migrated on load |
| `utter_task_generate` (legacy) | TaskProvider migration | Old per-type key, migrated on load |
| `utter_task_design_preview` (legacy) | TaskProvider migration | Old per-type key, migrated on load |

**Jotai consideration:** `atomWithStorage` handles localStorage persistence + cross-tab sync out of the box. Both theme and task store would benefit.

---

## Summary: what Jotai/Bunshi would replace

| Current pattern | Jotai replacement | Complexity reduction |
|---|---|---|
| ThemeProvider (Context + localStorage) | `atomWithStorage("utter_theme", "light")` | Eliminates provider, context, manual storage sync |
| AuthStateProvider (Context + fetch) | Async atom with refresh action | Eliminates provider, context, requestIdRef race guard |
| TaskProvider (Context + useReducer + polling + localStorage) | Atom family: store atom + polling effect + derived atoms | Biggest win — eliminates 539-line provider, enables granular subscriptions (no more re-rendering everything on every poll) |
| Languages cache (module-level) | Async atom with caching | Eliminates manual cache + in-flight dedup |
| Account data (outlet context) | Shared atom | Eliminates outlet context indirection |
| Paginated list state (Voices, History) | Filter atoms → derived list atom | Cleaner URL sync, reusable pattern |
| Page form state (Clone, Generate, Design) | Keep as useState | No benefit from atoms — ephemeral, page-local |

### Where Bunshi adds value

Bunshi provides dependency injection and scoping for Jotai atoms. In this app:
- Task state is global (dock shows everywhere) — no scoping needed
- Auth state is global — no scoping needed
- Theme is global — no scoping needed
- Account data could be scoped to the account route tree, but it's simple enough that scoping isn't necessary

Bunshi would become valuable if you later add features like multi-workspace support, per-route state isolation, or if you want to inject different atom implementations for testing. For now, plain Jotai covers everything.
