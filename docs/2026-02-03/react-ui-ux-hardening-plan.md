# React UI/UX Hardening Plan (Pre-Milestone 5)

> **Date**: 2026-02-03  
> **Goal**: Improve UX quality and accessibility of the new React frontend *before* deployment work (Milestone 5).  
> **Non-goals**: No backend changes; keep API contracts stable; no Supabase migration yet.

## Scope

The React app is now functional for parity, but needs a deliberate “polish + correctness” pass:
- keyboard accessibility
- loading/empty/error states
- modal/task UX
- mobile/responsive cleanup
- audio playback ergonomics

## Priority 0 — Blocking UX bugs

1) **Clone success modal focus trap**
   - Current: focuses first action + Escape to close, but does not trap focus.
   - Do: trap tab focus while modal is open, restore focus on close.
   - Acceptance: keyboard-only users can’t tab to page behind the modal.

2) **Global error boundary**
   - Add an App-level error boundary so runtime errors don’t render a blank screen.
   - Acceptance: render a friendly “Something went wrong” with a reload button and a short debug hint.

## Priority 1 — Accessibility + semantics pass

1) **Web Interface Guidelines audit**
   - Run against `frontend/src/**` and address violations (buttons/links, focus order, contrast, aria usage).

2) **Form semantics**
   - Ensure all inputs have labels (`htmlFor`/`id`) and forms submit via Enter.
   - Add `type="search"` where appropriate (Voices/History).

3) **Focus visibility**
   - Keep consistent `focus-visible` styling across links, buttons, and form controls.

## Priority 2 — UX polish (parity-preserving)

1) **Loading states**
   - Replace “Loading…” text with consistent skeletons or compact inline indicators.
   - Prevent layout shift for lists (Voices/History).

2) **Empty states**
   - Make “No voices / No generations found” states informative and actionable.

3) **Toast-style notifications**
   - For non-blocking operations (delete success, copy link, etc.) consider a lightweight toast component.
   - Avoid heavy libraries.

4) **Task UI**
   - Ensure the dock communicates:
     - task type
     - elapsed time
     - current status text (“Waiting for GPU…”, “Generating…”, etc.)
   - Confirm cancel button only appears for generate tasks.

## Priority 3 — Mobile + layout tightening

1) **Header/nav behavior**
   - Ensure nav remains usable on small widths (wrap, spacing, tap targets).

2) **Card layouts**
   - Voices/History card action areas should not overflow or wrap awkwardly on narrow devices.

## Notes / constraints

- Keep the monochrome/IBM Plex Mono aesthetic; avoid introducing a component framework.
- Keep stack minimal; avoid adding state/query libraries unless they clearly reduce complexity.
- When in doubt: parity-first, then incremental UX improvements.

