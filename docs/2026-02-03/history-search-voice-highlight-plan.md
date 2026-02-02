# History search by voice name + highlight matches (Plan)

## Summary

Improve `/history` so the search box:
1) matches **voice name** as well as generation text, and  
2) visually **highlights** the matching substrings in the rendered cards.

This is an incremental improvement to the current Jinja/vanilla frontend, and the behavior should be carried into the React rewrite.

---

## Current behavior (ground truth)

**Frontend**
- File: `backend/templates/history.html`
- Search input sets `search` query param and calls `GET /api/generations?page=&per_page=&search=&status=`.
- Rendering only prints `gen.voice_name` + truncated `gen.text` with plain escaping; **no highlighting**.

**Backend**
- File: `backend/main.py` (`@app.get("/api/generations")`)
- Search filter is currently **text-only**:
  - `Generation.text.ilike("%<search>%")`
- Voice name is not included in the filter.

---

## Desired behavior

1. Typing in the History search box returns generations where either:
   - generation **text** matches, or
   - the associated **voice name** matches.
2. On the results list, highlight matches in:
   - the voice name line, and
   - the generation text preview.

---

## Diagnosis (why it doesn’t work today)

- Backend search doesn’t include `Voice.name`, so voice-name matches never appear.
- Frontend renders escaped strings only; it never inserts “match markup”.
- Highlighting must be implemented carefully to avoid XSS (we currently render HTML strings via template literals).

---

## Plan (Backend)

### 1) Expand `/api/generations` search to include voice name

In `backend/main.py`:
- Import `or_` (and optionally `and_`) from SQLAlchemy.
- When `search` is present:
  - join `Generation.voice` (or `Voice`) so we can filter by `Voice.name`.
  - apply `or_` filter for `Generation.text` **or** `Voice.name`.

Recommended token behavior (more user-friendly than substring-only):
- Split `search` by whitespace into tokens.
- Require **all tokens** to match at least one of the two fields:
  - `AND( OR(text ilike token, voice.name ilike token) for each token )`

This mirrors typical “multi-term” search expectations and makes highlighting clearer (highlight each token).

### 2) Keep response backward compatible

No change needed to response shape; this is just widening the filter.

### 3) Add a small regression test (optional but recommended)

If tests exist for API endpoints, add one that:
- creates two voices with distinct names
- creates generations per voice
- verifies `/api/generations?search=<voice-name-fragment>` returns the correct generations

---

## Plan (Frontend)

### 1) Add safe highlight helper

In `backend/templates/history.html` (inline script), implement a helper that:
- escapes all non-matching text segments
- wraps matching substrings with a tag (e.g. `<mark class="text-highlight">…</mark>`)

Avoid regex-based replacement on already-escaped text (it’s easy to break HTML). Use an index-based splitter:
- operate on the raw string
- find match spans for each token (case-insensitive)
- build HTML as escaped segments + `<mark>` segments

### 2) Highlight in the card renderer

Update `renderHistoryCard(gen)` to:
- highlight `gen.voice_name`
- highlight truncated `gen.text`

Inputs for highlighting:
- the current search query (the same `currentSearch` used for API calls)
- tokens derived from it (same split-by-whitespace as backend)

### 3) Add minimal CSS for highlight

In `backend/static/css/style.css`, add a small style:
- subtle background + strong text color
- preserve mono aesthetic (no neon yellow)

Example intent (not exact CSS):
- background: `var(--bg-muted)`
- border: `1px solid var(--border)`
- padding: `0 2px`

---

## Acceptance criteria

- Searching “Ada” returns generations for voice “Ada Lovelace” even if the generation text doesn’t contain “Ada”.
- Matching substrings are visually highlighted in voice name and text preview.
- No XSS regressions: highlighted output still escapes everything except the intentional `<mark>` wrappers.
- Pagination/search/filter continue to work together.

---

## Codex skills (relevant)

- `frontend-design`: style highlights + search UI so it matches the project’s minimal mono aesthetic.
- `web-design-guidelines`: after implementation, audit `backend/templates/history.html` and `backend/static/css/style.css` changes for interaction/a11y issues.
- `tailwind-design-system`: when porting to React, implement highlight styles and search controls using tokenized Tailwind v4 patterns.
- `skill-creator`: codify a repeatable “search + highlight” checklist/pattern across pages (and later React).

---

## Notes for the React rewrite

This plan translates cleanly:
- Implement highlighting as a pure function that returns React nodes (preferred) instead of HTML strings.
- Keep the backend search semantics identical so parity is maintained between Jinja and React.
