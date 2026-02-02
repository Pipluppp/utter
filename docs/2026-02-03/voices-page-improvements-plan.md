# Voices page improvements (tags, reference text, search + pagination) (Plan)

## Summary

Improve `/voices` so it:
1) visually distinguishes **cloned** vs **designed** voices,  
2) shows the **reference transcript** used for each voice, and  
3) supports **search + pagination** similar to `/history`.

---

## Current behavior (ground truth)

**Frontend**
- Page: `backend/templates/voices.html` (inline `<script>`)
- On load: fetches `GET /api/voices` and renders *all* voices into `#voices-container`
- Provides actions:
  - Preview (WaveSurfer list player via `backend/static/js/waveform-manager.js`)
  - Generate link (`/generate?voice=<id>`)
  - Delete (`DELETE /api/voices/{voice_id}`)
- No search, no pagination, no voice “type” indicators, no transcript display.

**Backend**
- Endpoint: `GET /api/voices` in `backend/main.py`
- Returns `{ voices: [...] }` (all rows, ordered by `created_at desc`)
- `Voice.to_dict()` already includes:
  - `source` (`uploaded` | `designed`)
  - `reference_transcript`
  - `description` (for designed voices)
  - `language`

---

## Desired behavior

### A) Tag voice type
- Each voice card shows a clear tag:
  - `CLONE` for `source="uploaded"`
  - `DESIGNED` for `source="designed"`

### B) Show reference transcript
- Show a short, readable snippet of `reference_transcript` on the card.
- If missing, show a subtle “No transcript” indicator (important because Qwen generation requires it).

### C) Search + pagination
- Add controls similar to `/history`:
  - search input (debounced)
  - pagination with prev/next and page count
- The search should at minimum match voice **name**.
  - Nice-to-have: also match `reference_transcript` and `description`.

---

## Plan (Backend)

### 1) Add pagination/search parameters to `GET /api/voices`

In `backend/main.py`, extend the endpoint signature to accept:
- `page: int = 1`
- `per_page: int = 20` (cap at 100 like generations)
- `search: Optional[str] = None`
- (optional) `source: Optional[str] = None` (for future filter UI)

Query strategy:
- Start with `select(Voice)`
- If `search` is present:
  - token-split by whitespace
  - apply an `AND` across tokens, with each token matching one of:
    - `Voice.name ilike %token%`
    - `Voice.reference_transcript ilike %token%` (optional)
    - `Voice.description ilike %token%` (optional)
- Order by `Voice.created_at.desc()`
- Apply `offset/limit` like `/api/generations`
- Return:
  - `voices: [voice.to_dict() ...]`
  - `pagination: { page, per_page, total, pages }`

### 2) Keep existing clients working

The current voices page expects `data.voices`.
Returning `pagination` in addition is backward compatible.

### 3) Add a basic test (optional but recommended)

If API tests exist, add one verifying:
- search by `name` returns expected results
- pagination boundaries behave (page > pages clamps or returns empty consistently)

---

## Plan (Frontend: `backend/templates/voices.html`)

### 1) Add search + pagination UI

Add markup similar to history:
- a controls row above the grid:
  - search input
  - (optional) filter dropdown: All / Clone / Designed (if backend supports `source`)
- pagination controls below the grid:
  - previous/next buttons
  - “Page X of Y” label

### 2) Update data loading to use params

Refactor the existing “load on DOMContentLoaded” flow into:
- `loadVoices()` that calls `/api/voices?page=&per_page=&search=`
- debounced search input handler that resets to page 1
- pagination click handlers

### 3) Update card rendering to show tags + transcript

When rendering each voice card, include:
- a tag pill derived from `voice.source`
- a transcript preview:
  - `reference_transcript` truncated to ~120–200 chars
  - escape HTML
  - optionally a “Show more” toggle later if needed

Also consider showing:
- `language` (small muted label)
- designed voice `description` (optional) if it helps UX

### 4) Keep WaveformManager integration intact

Waveform containers rely on stable IDs (`waveform-${voice.id}`).
Ensure the new renderer preserves those IDs so:
- `window.waveformManager.play(...)` continues to work

### 5) Improve empty state semantics

Differentiate:
- “No voices yet” (no data at all)
- “No results” (search filter excludes all voices)

---

## Plan (CSS)

Update `backend/static/css/style.css` with minimal additions:
- a “tag” pill style (bordered, uppercase, mono)
  - variants for clone vs designed
- a transcript block style:
  - small label (“Reference”)
  - muted text, monospaced, multi-line clamp if desired
- controls/pagination styles for Voices page
  - can reuse the history styles if desired, but prefer generic class names if sharing

---

## Acceptance criteria

- Voices page shows an obvious `CLONE` vs `DESIGNED` tag on every card.
- Each card shows the reference transcript snippet (or “No transcript”).
- Voices page supports search + pagination (same UX feel as history).
- Preview, Generate, and Delete actions still work.

---

## Codex skills (relevant)

- `frontend-design`: design the CLONE/DESIGNED tags and transcript snippets so they’re readable and not visually noisy.
- `web-design-guidelines`: audit the list controls (search/pagination) and card actions (preview/generate/delete) for accessibility/UX issues.
- `tailwind-design-system`: when implementing the React version, build tag variants + card layouts using Tailwind v4 design tokens and component patterns.
- `skill-creator`: codify a “voices list UI” checklist (tagging, transcript display, pagination/search patterns) to keep the Jinja and React implementations consistent.

---

## Notes for the React rewrite

- Treat these as UX requirements to encode in the React pages/components.
- The `/api/voices` pagination/search shape will be directly reusable in React with minimal changes.
