# Utter Frontend Inventory (Ground Truth for React Migration)

> **Date**: 2026-02-03  
> **Scope**: Current FastAPI + Jinja templates + vanilla JS/CSS frontend  
> **Purpose**: Provide a reliable map of *pages, behaviors, state, and API calls* that must be preserved (or intentionally changed) during the React + Tailwind rewrite.
>
> **Codex skills (available)**: `frontend-design`, `tailwind-design-system`, `web-design-guidelines`, `skill-creator`, `skill-installer`.  
> Use `web-design-guidelines` for periodic UI audits, and keep this inventory in sync as behaviors evolve.

---

## 0) High-level architecture

- **Server-rendered pages (Jinja)**: FastAPI serves full HTML pages for:
  - `/`, `/clone`, `/generate`, `/design`, `/voices`, `/history`, `/about`
- **Static assets**:
  - CSS: `backend/static/css/style.css`
  - JS: `backend/static/js/task-manager.js`, `backend/static/js/waveform-manager.js`, `backend/static/js/app.js`
  - Examples: `backend/static/examples/audio.wav`, `backend/static/examples/audio_text.txt`
- **Uploads served as static**:
  - `/uploads/**` is mounted from `backend/uploads` (history playback uses `/uploads/generated/<filename>`)
- **Third-party**:
  - WaveSurfer: loaded globally via CDN in `backend/templates/base.html` (`https://unpkg.com/wavesurfer.js@7`)
  - Font: IBM Plex Mono via Google Fonts in `backend/templates/base.html`

---

## 1) Global layout & shared UI (`backend/templates/base.html`)

**Header / Nav**
- Logo link to `/`
- Nav links: `/clone`, `/generate`, `/design`, `/voices`, `/history`, `/about`
- Active link styling is server-driven via `request.url.path`.
- **Task badge**: `#task-badge` lives on the History link. It shows the count of active tasks (see Task Manager).

**Global task modal**
- Element: `#global-task-modal` with `#task-modal-content`
- Style: bottom-right “persistent notification” (not a fullscreen modal)
- Populated by `TaskManager` when there are active tasks from *other pages*.

**Scripts loaded on every page**
1. WaveSurfer v7 (global `WaveSurfer`)
2. `backend/static/js/task-manager.js` (global `window.taskManager`)
3. `backend/static/js/waveform-manager.js` (global `window.waveformManager`)
4. `backend/static/js/app.js` (initializes Clone + Generate if their forms exist)

---

## 2) Shared behavior: Task system (`backend/static/js/task-manager.js`)

### What it does
- Persists task state in **localStorage** so long-running tasks survive navigation/reloads.
- Polls backend task status (`GET /api/tasks/{task_id}`) on a 1s interval.
- Shows a bottom-right modal when you navigate away during active tasks.
- Dispatches browser events so page scripts can update UI on progress/completion.
- Syncs across tabs via the `storage` event.

### Task types & storage keys
- Supported types: `generate`, `design`, `clone`
- Storage keys:
  - `utter_task_generate`
  - `utter_task_design`
  - `utter_task_clone`
  - Legacy key migrated: `utter_active_task`

### Task object shape (stored in localStorage)
Typical fields used by the frontend:
- `taskId` (backend id)
- `type` (`generate` | `design` | `clone`)
- `originPage` (e.g. `/generate`, `/design`)
- `description` (short human text shown in modal)
- `formState` (page-specific state used to restore form UI)
- `startedAt` (ms timestamp)
- `status` (`pending` | `processing` | `completed` | `failed` | `cancelled`)
- `dismissed` (boolean; if true, hidden from modal)
- `result`, `error`, `completedAt` (when terminal)

### Events fired (consumed by page scripts)
- `taskProgress`: emitted while task is non-terminal
  - includes `statusText` derived from backend `modal_status` + `status` (“Waiting for GPU…”, “Generating…”, etc.)
- `taskComplete`: emitted on terminal status **only when user is on the origin page**
- `taskCancelled`: emitted when user cancels from the modal (generate-only currently)

### Task modal behavior
- Shows tasks that are:
  - not dismissed
  - **not** from the current page (`task.originPage !== window.location.pathname`)
- Clicking a task navigates to `task.originPage`.
- Buttons:
  - **Dismiss**: hides the task from the modal, but keeps it in storage.
  - **Cancel**: only shown for `generate` tasks; calls `POST /api/tasks/{task_id}/cancel`.

### Cleanup / expiry
- Tasks older than ~30 minutes are auto-cleared.
- `clearTask(type)` removes localStorage and calls `DELETE /api/tasks/{task_id}` best-effort.

---

## 3) Shared behavior: Waveform list playback (`backend/static/js/waveform-manager.js`)

Used by **Voices** and **History** pages.

- Maintains a *single* WaveSurfer instance (`currentWavesurfer`) that moves between list items.
- `play(containerId, audioUrl, playBtn)`:
  - Stops/destroys any previous waveform/player
  - Shows the target container, creates a new WaveSurfer instance, loads `audioUrl`
  - Auto-plays once ready; toggles the button to “Stop”
  - Clicking the same button toggles play/pause and updates the label
- `stopAll()`:
  - Destroys wavesurfer, hides/clears container, resets button label to `Preview` (voices) or `Play` (history)

---

## 4) Page-by-page inventory

### 4.1 Landing (`/`) — `backend/templates/index.html`

**Purpose**
- Marketing/entry page: hero + three feature cards linking to Clone/Design/Generate.

**JS**
- No page-specific JS (global scripts still load).

---

### 4.2 Clone (`/clone`) — `backend/templates/clone.html` + `backend/static/js/app.js`

**UI elements (IDs)**
- `#clone-form`, `#dropzone`, `#audio-input`, `#file-info`
- `#voice-name`, `#transcript`, `#transcript-counter`, `#language-select`
- `#try-example-btn`, `#submit-btn`
- Progress: `#clone-progress`, `#clone-elapsed`

**Key behaviors**
- Dropzone:
  - Click opens file picker (`#audio-input`)
  - Drag-over styling + file drop selection
  - Client validation: type/extension (`.wav/.mp3/.m4a`) and max size 50MB
- Transcript character counter updates on input.
- “Try Example Voice”:
  - Fetches `/static/examples/audio_text.txt` + `/static/examples/audio.wav`
  - Fills the form and sets the selected file
- Submit:
  - POSTs `FormData` to `POST /api/clone` (`name`, `audio`, `transcript`, `language`)
  - Shows a timer on the button and `#clone-progress` while request runs
    - Progress panel is timer-focused (no redundant spinner; the submit button carries loading state)
  - On success: shows a **Clone Success Modal** (overlay built in JS) with:
    - Link to `/generate?voice=<newVoiceId>`
    - “Clone Another Voice” resets the form

**Task system**
- Clone is currently **not** tracked via `TaskManager` (synchronous request).

**Backend constraints (current)**
- Reference audio duration: **min 3s, max 5 minutes** (validated server-side)
- Transcript is required in the UI; backend stores it as `reference_transcript`

---

### 4.3 Generate (`/generate`) — `backend/templates/generate.html` + `backend/static/js/app.js` + `TaskManager`

**UI elements (IDs)**
- Form: `#generate-form`, `#voice-select`, `#language-select`, `#text-input`, `#char-counter`, `#generate-btn`
- Progress: `#generation-progress`, `#progress-elapsed`, `#progress-status`
- Result: `#result-section`, `#download-btn`, `#audio-element`
- Player: `#play-btn`, `#play-icon`, `#pause-icon`, `#waveform`, `#time-display`

**Key behaviors**
- Voices dropdown:
  - Fetches `GET /api/voices` and populates `#voice-select`
  - Supports URL param: `/generate?voice=<id>` (preselects voice only)
- Submit starts an async generation task:
  - POST `POST /api/generate` JSON `{ voice_id, text, language, model: "0.6B" }`
  - Calls `taskManager.startTask(task_id, "generate", "/generate", description, formState)`
  - Shows progress UI + elapsed timer
    - Progress panel is timer/status focused (no redundant spinner; the button carries loading state)
- Task progress:
  - Listens for `taskProgress` to update `#progress-status` (GPU queue/progress copy)
  - Listens for `taskCancelled` (from modal cancel) to reset UI
- Task completion:
  - Listens for `taskComplete` to:
    - hide progress
    - show the result audio player
    - set `#download-btn.href = result.audio_url`
    - initialize WaveSurfer for the player waveform

**WaveSurfer usage (Generate page)**
- Generate page has its own WaveSurfer instance (separate from `WaveformManager`).
- `app.js` exposes `window.initWaveSurferForUtter(url)` as a temporary bridge.

**Known behavior gap**
- History “Regenerate” redirect URL includes `text` + `language` query params, but the Generate page currently only reads `voice`.

**Backend constraints (current)**
- Text validation is server-side (`validate_text`): **max 10,000 chars**.
- `/api/generate` returns `{ task_id, status, is_long_running, estimated_duration_minutes, generation_id }`.

**Job-based orchestration note (important for Supabase deployment)**
- Speech generation uses Modal’s **job-based spawn/poll pattern for all generations** (not just “long text”).
  - The backend stores a Modal `job_id` on the task (so it can be polled/cancelled).
  - This avoids HTTP timeout edge cases and makes cancellation consistent.
- Today, task state is tracked by an **in-memory** backend `TaskStore` (polling via `GET /api/tasks/{task_id}`).
- When migrating to Supabase Edge Functions, task state must be **persisted** (e.g. `tasks` table in Postgres) because Edge Functions are stateless.
  - See: `modal_app/qwen3_tts/LONG_RUNNING_TASKS.md`
  - See (new): `docs/2026-02-05/job-based-edge-orchestration.md`

---

### 4.4 Design (`/design`) — `backend/templates/design.html` inline script + `TaskManager`

**UI elements (IDs)**
- Form: `#design-form`, `#voice-name`, `#voice-description`, `#preview-text`, `#language-select`
- Buttons: `#generate-preview-btn`, `#save-voice-btn`
- Messages: `#error-container`, `#success-container`
- Counters: `#description-counter`, `#preview-counter`
- Preview: `#preview-section`, `#preview-play-btn`, `#preview-waveform`, `#preview-time`
- Progress: `#design-progress`, `#design-elapsed`

**Key behaviors**
- Character counters for description + preview text (500 max) and example cards that fill the description.
- “Generate Preview”:
  - POST `POST /api/voices/design/preview` JSON `{ text, language, instruct }`
  - Tracks async work via `taskManager.startTask(task_id, "design", "/design", "...", formState)`
  - Shows progress UI + elapsed timer
    - Progress panel is timer-focused (no redundant spinner; the button carries loading state)
- Preview completion:
  - On `taskComplete` for type `design`, expects `result.audio_base64`
  - Converts base64 → `Blob(audio/wav)` and renders WaveSurfer preview
  - Enables “Save Voice”
- “Save Voice”:
  - POSTs `FormData` to `POST /api/voices/design` including the preview audio blob (`preview.wav`)
  - On success: shows success message and redirects to `/voices`

**Notes**
- Design preview is **not cancellable** from the global task modal (cancel button only exists for generate).
- Preview playback uses a stable play button binding (avoids DOM replacement bugs) and revokes old preview object URLs between runs.
- `design.html` includes page-specific inline `<style>` (subtitle + example cards + button group layout).

---

### 4.5 Voices (`/voices`) — `backend/templates/voices.html` inline script + `WaveformManager`

**UI elements (IDs)**
- Controls: `#voices-search` (debounced), `#voices-source-filter`
- Container: `#voices-container`, `#empty-state`, `#error-container`
- Pagination: `#pagination`, `#prev-page`, `#next-page`, `#page-info`

**Key behaviors**
- Fetch `GET /api/voices?page=&per_page=&search=&source=` (perPage defaults to 20).
- Search:
  - Matches voice name (and backend also matches transcript + description).
  - Results highlight matching substrings in:
    - voice name
    - reference transcript snippet
    - description snippet
- Filter:
  - Source filter: All / Clone (`uploaded`) / Designed (`designed`)
- Pagination:
  - Prev/Next + “Page X of Y” (shown when there are results, matching History UX)
- Card rendering:
  - Shows voice type tag: `CLONE` vs `DESIGNED`
  - Shows reference transcript snippet (or “No transcript”)
  - Shows designed voice description snippet (when present)
  - Preview button uses `/api/voices/{voice_id}/preview` + `WaveformManager`
  - Generate link: `/generate?voice=<id>`
  - Delete:
    - confirm dialog
    - `DELETE /api/voices/{voice_id}`
    - reloads list (keeps pagination/search state consistent)

---

### 4.6 History (`/history`) — `backend/templates/history.html` inline script + `WaveformManager`

**UI elements (IDs)**
- Controls: `#history-search` (debounced), `#history-filter`
- Container: `#history-container`, `#empty-state`, `#error-container`
- Pagination: `#pagination`, `#prev-page`, `#next-page`, `#page-info`

**Key behaviors**
- Fetch `GET /api/generations?page=&per_page=&search=&status=` (perPage defaults to 20).
- Search:
  - Matches generation text **and** voice name
  - Highlights matching substrings in:
    - voice name
    - text preview
- Renders cards with:
  - Status label (pending/processing/completed/failed/cancelled)
  - Text preview + error message preview (if failed/cancelled)
  - Duration and generation time (if present)
  - Completed-only actions:
    - Play (WaveSurfer list player via `WaveformManager`)
    - Download link to `/uploads/generated/<filename>`
  - Processing/pending indicator: “Generating…”
  - Regenerate:
    - `POST /api/generations/{generation_id}/regenerate`
    - redirects browser to returned `redirect_url`
  - Delete:
    - confirm dialog
    - `DELETE /api/generations/{generation_id}`
    - reloads history list
- Auto-refresh:
  - If the current page of results contains any `pending` or `processing` generations, refreshes every 5s.

---

### 4.7 About (`/about`) — `backend/templates/about.html`

**Purpose**
- Static info page.

---

## 5) Known inconsistencies / decisions to make during migration

1. **Generate text limit**: UI copy mentions 5,000 in places, but frontend + backend currently allow **10,000**.
2. **Clone duration copy**: one tip block mentions max 60s, but backend allows **5 minutes** (`MAX_DURATION = 300`).
3. **History regenerate UX**: backend returns `text` + `language` in `redirect_url`, but Generate page currently only reads `voice`.
4. **Clone task tracking**: TaskManager supports `clone`, but Clone is currently synchronous (no polling / no persistence).
5. **Design preview payload**: task result includes `audio_base64` (could be moved to a binary URL endpoint later for efficiency).
6. **WaveSurfer delivery**: currently from CDN; decide whether to bundle via Vite (recommended for React).

---

## 6) Migration implication checklist (feature parity)

- Preserve routes (`/`, `/clone`, `/generate`, `/design`, `/voices`, `/history`, `/about`).
- Preserve Task Manager behavior:
  - localStorage persistence + formState restoration
  - global bottom-right task modal + badge
  - polling cadence + progress/status copy
  - generate cancellation flow
- Preserve WaveSurfer behaviors:
  - Generate page player
  - Single-instance list player on Voices + History
- Preserve data flows:
  - `/api/clone` (FormData upload)
  - `/api/generate` (task start) + `/api/tasks/{id}` polling
  - `/api/voices/design/preview` (task start) + `audio_base64` completion
  - `/api/voices/design` (FormData with preview audio blob)
  - `/api/voices` list/delete + preview streaming
  - `/api/generations` list/search/filter/paginate + delete + regenerate
