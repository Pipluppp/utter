# Landing Metaballs Edge (lucumr-style) Plan (2026-02-05)

## Goal

Bring the lucumr.pocoo.org “moving water/metaballs” WebGL strip into **Utter’s React landing page only**:

1) A decorative animated “border” at the **top of the demos section** (between hero and demos).
2) A decorative animated “border” at the **top of a bottom landing footer**.

Non-goals:
- No site-wide header/footer changes in `frontend/src/app/Layout.tsx`.
- No porting of lucumr’s htmx scripts.

## Placement (Utter)

- Divider: `frontend/src/pages/landing/DemoWall.tsx`
  - Render a full-width, fixed-height strip positioned at the top of the demos section.
  - Keep existing dot/gradient overlays; metaballs sits beneath them.
- Footer: `frontend/src/pages/Landing.tsx`
  - Add a landing-only footer section with the metaballs strip at its top edge.

## Component design

Create `frontend/src/components/visual/MetaballsEdge.tsx`:

- Renders a wrapper + `<canvas>` (WebGL).
- Initializes WebGL program once (compile shaders, fullscreen quad).
- Animation loop:
  - Throttle to ~30fps.
  - Skip work when tab hidden (Visibility API) and when off-screen (IntersectionObserver).
  - Resize-aware via ResizeObserver (or window resize fallback).
  - Hover-aware via pointer enter/leave on wrapper (drives accent blobs).
- Theme integration:
  - Utter uses `.dark` on `<html>` (ThemeProvider), not `data-theme`.
  - Feed `u_isDark` and use colors that match Utter’s palette.
- Reduced motion:
  - If `prefers-reduced-motion: reduce`, render a single static frame and disable the loop.

## Visual spec (initial)

- Height:
  - Divider strip: ~88–104px
  - Footer strip: ~120–140px
- Colors:
  - Base background should match the section (`bg-subtle` for demos; `bg-background` for footer).
  - Water palette stays “blue-ish” (lucumr vibe) but dark-mode background matches Utter’s `#0d0d0d`.
  - Hover accent uses a cyan-ish accent (aligning with Utter’s ring color in dark mode).

## Acceptance criteria

- Landing page shows:
  - Animated strip at top of demos.
  - Animated strip at top of landing footer.
- Animation pauses when off-screen and when tab is hidden.
- Theme toggle updates the effect correctly (light/dark).
- Resizing window / changing DPR doesn’t blur or stretch.
- Reduced-motion users do not get continuous animation.
- No runtime errors if WebGL is unavailable; effect silently disables.

## Implementation steps

1) Add `MetaballsEdge` component (WebGL init + loop + cleanup).
2) Mount it at the top of `DemoWall` section.
3) Add `LandingFooter` section and mount another `MetaballsEdge` at its top.
4) Run `npm --prefix frontend run check` (Biome) and fix issues.

