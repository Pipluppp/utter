# Design Direction

> Visual identity and aesthetic guidelines for Utter's React + Tailwind v4 frontend.

---

## Aesthetic

**Monospace-forward, minimal, typographic.** The UI leans on type hierarchy and spacing rather than color or decoration. Both light and dark modes are supported, with dark as the default personality.

Inspiration:
- **ElevenLabs** — focused, functional, content-first layout
- **Linear** — monospace type, clean surfaces, sharp visual rhythm
- **Carbon Design (IBM)** — uppercase labels, systematic spacing, flat surfaces

## Typography

The entire UI is monospaced. Two font stacks are defined:

| Token | Fonts | Use |
|-------|-------|-----|
| `--font-mono` | IBM Plex Mono, system monospace | Body text, headings, labels |
| `--font-mono-ui` | Geist Mono, IBM Plex Mono, system monospace | UI chrome (nav, buttons, badges) |

Base font size: **14px**, line-height **1.5**, tabular numerals enabled. Type hierarchy comes from weight and size, not font family changes.

## Color System

Semantic color tokens defined in Tailwind v4's `@theme` block. The palette is intentionally neutral — no brand color beyond the focus ring.

### Light mode

| Token | Value | Role |
|-------|-------|------|
| `--color-background` | `#ffffff` | Page background |
| `--color-subtle` | `#fafafa` | Card/panel backgrounds |
| `--color-muted` | `#f0f0f0` | Input backgrounds, hover states |
| `--color-foreground` | `#111111` | Primary text |
| `--color-muted-foreground` | `#555555` | Secondary text, labels |
| `--color-faint` | `#888888` | Hints, disabled text |
| `--color-border` | `#cccccc` | Default borders |
| `--color-border-strong` | `#999999` | Emphasized borders |
| `--color-ring` | `#111111` | Focus ring |

### Dark mode

| Token | Value | Role |
|-------|-------|------|
| `--color-background` | `#0d0d0d` | Page background |
| `--color-subtle` | `#121212` | Card/panel backgrounds |
| `--color-muted` | `#1a1a1a` | Input backgrounds, hover states |
| `--color-foreground` | `#f5f5f5` | Primary text |
| `--color-muted-foreground` | `#b3b3b3` | Secondary text, labels |
| `--color-faint` | `#8a8a8a` | Hints, disabled text |
| `--color-border` | `#2a2a2a` | Default borders |
| `--color-border-strong` | `#3a3a3a` | Emphasized borders |
| `--color-ring` | `#00d1ff` | Focus ring (cyan accent) |

## Surfaces and Elevation

Surfaces use subtle elevation shadows rather than flat card borders:

```
--shadow-elevated (light): soft 8px blur, minimal offset
--shadow-elevated (dark):  1px inset border glow + deep 24px shadow
```

This gives panels a slight lift without breaking the flat aesthetic.

## Layout Principles

- **Single-column, centered content** — most pages max out at 640-720px
- **Generous vertical spacing** — sections breathe; no cramming
- **Content-first** — minimal chrome, navigation is compact
- **Mobile-friendly** — responsive by default via Tailwind utilities

## Interaction Patterns

- **Focus rings** — 2px ring in `--color-ring` on all interactive elements
- **Touch targets** — `touch-action: manipulation` on buttons and links, no tap highlight
- **Keyboard-first** — visible focus indicators, kbd-styled shortcut hints
- **No decorative animation** — transitions are functional (hover, focus), not ornamental

## What This Is Not

- Not a component library doc (components live in code, not documentation)
- Not a CSS reference (the source of truth is `frontend/src/styles/index.css`)
- Not prescriptive about specific components — this captures the *vibe*, not implementation details

---

*Updated: 2026-02-06*
*Frontend stack: React 19 + Vite + Tailwind CSS v4*
