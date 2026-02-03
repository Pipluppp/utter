# Dark Mode & Keyboard Navigation - Final Implementation Plan (React + Tailwind v4)
**Date:** 2026-02-03  
**Reference:** https://npmx.dev aesthetic (dark, developer-centric)

## 0. Ground truth from this repo (so the plan matches reality)

**Frontend stack**
- React 19 + React Router 7 + Vite
- Tailwind CSS v4 (CSS-first): design tokens live in `frontend/src/styles/index.css` using `@theme`
- The UI already uses semantic classes everywhere (`bg-background`, `text-foreground`, `border-border`, etc.)

**Where to integrate**
- Navbar/layout: `frontend/src/app/Layout.tsx` (NavLink items for Clone/Generate/Design already exist)
- App root: `frontend/src/app/App.tsx` (currently wraps only `TaskProvider`)
- HTML shell: `frontend/index.html` (best place to prevent theme flash before React mounts)

This means dark mode is primarily a **token override + theme toggle** problem, not a redesign.

## Skill-informed decisions (what we adopt vs skip)

**Adopt (genuinely high leverage for this repo)**
- Tailwind v4 design-token approach: keep semantic tokens and override them in `.dark` (no component rewrite).
- A semantic focus ring token (`--color-ring`) so dark mode can use npmx-style cyan focus without changing layout.
- Web Interface Guidelines essentials: visible focus for custom controls, `color-scheme` toggling, and `theme-color` meta.

**Skip (not worth the cost / would change the product too much)**
- New font system (e.g. Geist). Keep IBM Plex Mono to preserve the current Utter identity.
- Large visual restyle (new spacing system, new component library, new typography scale).
- Shortcut-trigger toasts by default (only add if we also add accessible `aria-live` output).

## 1. Design intent (Dark Mode) - npmx-inspired, Utter-compatible

We are adopting a **matte-black, high-contrast, minimal** dark mode inspired by **npmx.dev**, but we will **not** rewrite Utter's existing monochrome/IBM Plex Mono UI. Instead, we'll:
- keep the existing semantic token names and Tailwind usage
- change only token values for dark mode
- introduce a **semantic focus ring token** so dark mode can use an npmx-like cyan ring without changing layouts or components

### Color palette (semantic tokens)

The design uses a deep matte black background with high-contrast off-white text and a restrained cyan accent.

| Token / Role | Suggested Dark Value (Hex) | Used via | Notes |
| :--- | :--- | :--- | :--- |
| `--color-background` (Background) | `#0d0d0d` | `bg-background` | Main page background. |
| `--color-subtle` (Subtle surface) | `#121212` | `bg-subtle` | Panels / hover surfaces. |
| `--color-muted` (Muted surface) | `#1a1a1a` | `bg-muted` | Chips, navbar active/hover, controls. |
| `--color-foreground` (Primary text) | `#f5f5f5` | `text-foreground` | Headings + primary text. |
| `--color-muted-foreground` (Secondary text) | `#b3b3b3` | `text-muted-foreground` | Metadata / labels. |
| `--color-faint` (Faint text) | `#8a8a8a` | `text-faint` | Hints, helper text. |
| `--color-border` (Borders) | `#2a2a2a` | `border-border` | Default borders/dividers. |
| `--color-border-strong` (Strong border) | `#3a3a3a` | `border-border-strong` | Emphasis borders. |
| `--color-ring` (Focus ring) | `#00d1ff` | `ring-ring` | Focus rings (primary npmx "accent"). |

### Typography

Keep IBM Plex Mono (already loaded in `frontend/index.html` and applied in `frontend/src/styles/index.css`).

### Visual style notes (to echo npmx without redesign)

- Borders: subtle (contrast between `background/subtle/muted` + thin borders)
- Shadows: minimal (prefer surface separation over drop shadows)
- Optional: add a faint edge glow / vignette in dark mode to echo npmx atmosphere (done via a CSS background layer, not component rewrites)

## 2. Theme system design (Tailwind v4 + class toggle)

We will use **class-based dark mode** by toggling `.dark` on the `<html>` element.

### Tailwind v4 specifics (important)

This repo uses Tailwind v4 CSS-first config, so we will **not** edit `tailwind.config.js` (there isn't one in `frontend/`).

Implementation outline:
- Add dark variant: `@custom-variant dark (&:where(.dark, .dark *));` in `frontend/src/styles/index.css`
- Add a `.dark { ... }` block that overrides existing `--color-*` tokens (plus `--color-ring`)
- Add `color-scheme` switching so native UI (scrollbars, form controls) matches:
  - `:root { color-scheme: light; }`
  - `.dark { color-scheme: dark; }`

### Theme persistence + no flash

Add a tiny inline script in `frontend/index.html` that:
- reads `localStorage['utter_theme']` (`light` | `dark` | `system`)
- resolves `system` via `prefers-color-scheme`
- sets/removes `document.documentElement.classList.toggle('dark', ...)` before React mounts
- updates `<meta name="theme-color">` to match the background for the chosen theme (improves mobile browser chrome)

Then implement a small React `ThemeProvider` so the UI can toggle theme at runtime without reloading.

## 3. Keyboard navigation requirements (global hotkeys + navbar hints)

Global hotkeys to speed up power-user workflows:

| Key | Action | Behavior |
| :--- | :--- | :--- |
| <kbd>d</kbd> | Design | Navigate to `/design` |
| <kbd>c</kbd> | Clone | Navigate to `/clone` |
| <kbd>g</kbd> | Generate | Navigate to `/generate` |

### Implementation details

**Global listener**
- Add a `useGlobalShortcuts()` hook that registers a `window` `keydown` handler.
- Mount it once in `frontend/src/app/Layout.tsx` (layout is always present).

**Safety rules**
- Do not trigger if the user is typing:
  - `event.target` is `input`, `textarea`, or `select`
  - or `event.target.isContentEditable === true`
- Do not trigger if any modifiers are held (`metaKey`, `ctrlKey`, `altKey`)
- Do not trigger on key repeats (`event.repeat`)

**Navbar UX**
- Add `<kbd>` hints next to the three relevant navbar items (Clone/Generate/Design).
- Implement a tiny `Kbd` component (or an inline element) so styling stays consistent across themes.

## 4. Reference imagery (npmx.dev)

Screenshots in this folder are the target vibe:
- `home_page_1770113719067.png`
- `docs_page_1770113991761.png`
- `compare_page_1770113905517.png`

## 5. Implementation checklist (files + steps)

- [ ] **Dark-mode variant + tokens** (`frontend/src/styles/index.css`)
  - Add `@custom-variant dark (&:where(.dark, .dark *));`
  - Add `.dark { ... }` overrides for all existing semantic tokens
  - Add `--color-ring`:
    - light theme: set to foreground (keeps current focus look)
    - dark theme: set to cyan (`#00d1ff`) for the npmx vibe
  - Add `color-scheme` switching: `:root { color-scheme: light; }` and `.dark { color-scheme: dark; }`
  - Optional: add dark-only ambience (subtle edge glow / vignette) using a `body::before` layer

- [ ] **No-flash theme boot** (`frontend/index.html`)
  - Inline script to read `utter_theme` and set `.dark` on `<html>` before React mounts
  - Add `<meta name="theme-color">` and update it in the boot script

- [ ] **Theme provider + toggle** (new + existing files)
  - Add `frontend/src/app/theme/ThemeProvider.tsx` (context: `theme`, `resolvedTheme`, `setTheme`)
  - Wrap `RouterProvider` with `ThemeProvider` in `frontend/src/app/App.tsx`
  - Add a theme toggle control in `frontend/src/app/Layout.tsx`
  - When theme changes, update `<meta name="theme-color">` so browser UI stays in sync

- [ ] **Move focus rings to a semantic token** (small, targeted class changes)
  - Switch `focus-visible:ring-foreground` -> `focus-visible:ring-ring` so light stays the same and dark gets the cyan ring via token override.
  - Primary touch points today:
    - `frontend/src/app/Layout.tsx`
    - `frontend/src/components/ui/Button.tsx`
    - `frontend/src/components/ui/Input.tsx`
    - `frontend/src/components/ui/Select.tsx`
    - `frontend/src/components/ui/Textarea.tsx`
    - `frontend/src/components/tasks/TaskDock.tsx`
    - `frontend/src/components/audio/WaveformPlayer.tsx`
    - (Optional cleanup) inline button classes in `frontend/src/pages/*`

- [ ] **Global keyboard shortcuts** (new + existing files)
  - Add `frontend/src/app/useGlobalShortcuts.ts` (uses `useNavigate()` from react-router)
  - Mount in `frontend/src/app/Layout.tsx`
  - Keys: `c` -> `/clone`, `g` -> `/generate`, `d` -> `/design`
  - Ignore typing targets, modifiers, and key repeats

- [ ] **Navbar shortcut hints** (`frontend/src/app/Layout.tsx`)
  - Display a small `<kbd>` chip next to Clone / Generate / Design (and keep it accessible: don't rely on color alone)

- [ ] **Dark-mode contrast fixes** (keep it minimal, but don't ship unreadable errors)
  - Replace hard-coded light-theme error colors like `text-red-700` with a dark-friendly variant (`dark:text-red-400`) or a semantic token if introduced.
  - Known occurrences today:
    - `frontend/src/pages/Clone.tsx` (`text-red-700`)
    - `frontend/src/pages/Generate.tsx` (`text-red-700`)
    - `frontend/src/pages/History.tsx` (`text-red-700`)
  - Spot-check overlays (dark mode can make “black on black” overlays effectively invisible):
    - `frontend/src/pages/Clone.tsx` uses `bg-black/60` for the modal overlay; consider adding `backdrop-blur-sm` and/or a dark-specific alpha.

- [ ] **Web Interface Guidelines sanity checks** (high-leverage, not a full rewrite)
  - Ensure any custom clickable surfaces have a visible keyboard focus state.
    - Known issue: the Clone upload dropzone is `role="button"` + `tabIndex={0}` but has no `focus-visible` styling (`frontend/src/pages/Clone.tsx`).
  - If we add shortcut-trigger feedback (toast), make it `aria-live="polite"` (otherwise skip the toast for now).

## 6. Acceptance criteria (definition of done)

**Dark mode**
- Toggle works and persists across reloads (`localStorage['utter_theme']`)
- "System" mode matches OS preference and updates when OS theme changes
- No visible theme flash on page load (HTML boot script sets theme before React)

**Visual alignment (npmx-inspired)**
- Dark theme: matte background + subtle surfaces, legible secondary text, borders visible but understated
- Focus rings use the accent token (cyan) rather than pure white

**Keyboard shortcuts**
- `c/g/d` navigate from anywhere except when typing in an input/textarea/select/contenteditable
- No interference with existing per-page keyboard handling (e.g. Clone modal Escape handler)

**Accessibility**
- Theme toggle is keyboard reachable, has an accessible name, and does not remove focus indicators
- `<kbd>` hints are not the only cue (labels remain clear without them)
