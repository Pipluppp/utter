# React Frontend Guidelines (Utter)

> **Date**: 2026-02-03  
> **Goal**: Migrate the frontend to React + Tailwind with *better structure* than vanilla HTML/JS, without introducing unnecessary complexity.
>
> **Codex skills (available)**: `frontend-design`, `tailwind-design-system`, `web-design-guidelines`, `skill-creator`, `skill-installer`.  
> Use them to keep UI quality high (design), Tailwind patterns consistent (design system), and accessibility/UX audited (guidelines).

---

## 1) Principles (non-negotiables)

1. **Feature parity first**: match current behavior described in `frontend-inventory.md`.
2. **Keep the stack small**: prefer React + TypeScript + Vite + Tailwind only.
3. **Avoid “framework creep”**: add libraries only when they clearly reduce complexity for this app.
4. **Co-locate**: keep components close to where they’re used; avoid deep abstractions.
5. **Make state obvious**: local state for local UI; a small app-wide provider only where needed (tasks).

---

## 2) Architecture choice (SPA vs multi-page)

Both work. Pick one early and commit to it.

### Option A: SPA (recommended)
- React Router handles `/`, `/clone`, `/generate`, `/design`, `/voices`, `/history`, `/about`.
- Pros: single layout, easiest global task UI, clean navigation.
- Cons: need backend “serve index.html for routes” setup in prod.

### Option B: Vite multi-page (acceptable)
- Each route serves a tiny HTML shell with a route-specific entrypoint.
- Pros: no SPA route fallback concerns.
- Cons: more build wiring, repeated layout bootstrapping, task UI still global but navigation is reload-based unless you re-create routing.

The existing `react-refactor-plan.md` assumes **Option A**.

---

## 3) Suggested project structure (minimal, scalable enough)

Create a `frontend/` directory (keep backend unchanged):

```
frontend/
  index.html
  vite.config.ts
  src/
    main.tsx
    app/
      App.tsx
      router.tsx
      Layout.tsx
    pages/
      Landing.tsx
      Clone.tsx
      Generate.tsx
      Design.tsx
      Voices.tsx
      History.tsx
      About.tsx
    components/
      ui/        (Button, Input, Select, etc.)
      audio/     (WaveformPlayer, WaveformListPlayer)
      tasks/     (TaskDock, TaskBadge)
    lib/
      api.ts     (fetch wrapper + typed endpoints)
      storage.ts (localStorage helpers)
      time.ts    (format helpers)
    styles/
      index.css  (tailwind import + base styles)
```

Rule of thumb: if a component is only used on one page, keep it under `pages/<PageName>/...` instead of `components/`.

---

## 4) React patterns to use (and avoid)

### Use
- Function components + hooks only.
- Small “feature hooks” where it removes duplicated logic:
  - `useTaskPolling(taskId)`
  - `useWaveSurfer(containerRef, url)`
  - `useVoices()` / `useGenerations(params)` (either custom or via a query lib)
- “Dumb” UI components in `components/ui` (Button/Input/etc).

### Avoid (unless the project grows)
- Complex global state (Redux/Zustand/etc).
- Over-abstracted “service layers” with indirection.
- Heavy form libraries unless forms become hard to maintain.

---

## 5) Data fetching & API client

### Keep it simple
- Use one small wrapper around `fetch`:
  - JSON requests/responses
  - FormData uploads
  - consistent error shape (e.g. `{ message, status }`)

### When to consider TanStack Query (optional)
Only add it if it clearly helps:
- caching voices/history across route changes
- polling tasks + retry behavior
- avoiding manual loading/error state duplication

If you don’t adopt it, keep a small set of hooks that centralize fetch + state.

---

## 6) Task system (must preserve behavior)

Rebuild the current `TaskManager` (see `frontend-inventory.md`) as React primitives:

- `TaskProvider` (Context + reducer)
  - persists to localStorage under the same keys (`utter_task_generate`, `utter_task_design`, `utter_task_clone`)
  - polls `GET /api/tasks/{task_id}` every ~1s for active tasks
  - exposes actions:
    - `startTask(...)`
    - `dismissTask(type)`
    - `cancelTask(type)` → `POST /api/tasks/{task_id}/cancel`
    - `clearTask(type)` → `DELETE /api/tasks/{task_id}` best-effort
- `TaskDock` UI (bottom-right)
  - shown only when there are non-dismissed tasks not on the current route
  - clicking task navigates to its origin route
- `TaskBadge` UI (nav count)

### Restoration pattern
Generate + Design pages currently restore `formState` from stored tasks. Keep that:
- `Generate` reads task `formState` on mount and hydrates inputs
- `Design` reads task `formState` on mount and hydrates inputs

---

## 7) WaveSurfer integration (avoid leaks)

Two distinct use-cases exist today:

1. **Generate page player**
   - A single waveform for the current generated audio.
   - Implement as `WaveformPlayer` with explicit cleanup on URL change/unmount.

2. **Voices/History list player**
   - A single shared WaveSurfer instance that moves between cards.
   - Implement as `WaveformListPlayer` that:
     - tracks the active item id
     - creates/destroys one WaveSurfer instance
     - manages button label/state (“Preview”/“Play” ↔ “Stop”)

Bundle WaveSurfer via npm instead of CDN once on Vite.

---

## 8) Tailwind usage (match current design, stay maintainable)

### Keep the “design token” feel
Current CSS uses variables like `--bg`, `--text`, `--border`, spacing tokens, and IBM Plex Mono.

Suggested approach:
- Put base styles in `styles/index.css` with Tailwind’s `@layer base`.
- Use Tailwind for layout/spacing/typography.
- Use a **small** `@layer components` for repeated patterns (`.btn`, `.input`, `.card`, etc.) to avoid massive className strings everywhere.

Avoid adding a full component framework unless you truly need it.

---

## 9) Routing & FastAPI integration (dev/prod)

### Dev
- Run Vite dev server for React.
- Proxy from Vite to FastAPI for:
  - `/api/**`
  - `/uploads/**`

### Prod
- Build React and serve static assets from FastAPI.
- Ensure non-API routes return the React `index.html` so deep links work (Option A).

---

## 10) Migration sequence (low risk)

1. Create Vite + React + Tailwind scaffold in `frontend/`.
2. Implement shared shell: Layout + Nav + “TaskBadge”.
3. Implement `TaskProvider` + `TaskDock` early (it touches multiple pages).
4. Implement API client + types (voices, generations, tasks).
5. Migrate pages in increasing complexity:
   - Landing, About (static)
   - Voices, History (lists + WaveformListPlayer)
   - Clone (FormData upload + progress + clone success modal)
   - Generate (tasks + polling + waveform player)
   - Design (tasks + base64 preview + save voice)

---

## 11) “Parity vs improve” decisions to explicitly make

These are current behavior gaps/inconsistencies worth deciding on during migration:
- Generate max text: copy says 5k in some places; backend validates 10k.
- Clone max duration: some copy mentions 60s; backend allows 5 minutes.
- History “Regenerate” should actually prefill text + language on Generate page.
