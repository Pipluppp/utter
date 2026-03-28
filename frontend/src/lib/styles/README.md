# Styles — Tailwind Variants

This directory contains shared `tv()` style definitions that are not owned by a specific component. For component-owned styles, see the `.styles.ts` files co-located with each component.

## How it works

[Tailwind Variants](https://www.tailwind-variants.org/) (`tv()`) is a variant-driven styling utility for Tailwind CSS. It provides two shapes:

- **`base` shape** — for single-element components. Returns a function that produces a class string. See [variants](https://www.tailwind-variants.org/docs/variants).
- **`slots` shape** — for multi-element components. Returns an object of slot functions, each producing a class string. See [slots](https://www.tailwind-variants.org/docs/slots).

## Directory structure

```
lib/styles/
├── input.ts              # Form input styling (used across Auth, Design, Generate, etc.)
├── toggle-button.ts      # Toggle button styling (used in Clone, Credits, DemoClipCard)
├── status-badge.ts       # Status badge styling (used in History)
├── pagination-button.ts  # Extends buttonStyles with pagination defaults (used in Voices)
├── AGENTS.md             # Prescriptive rules for working with TV styles
└── README.md             # This file
```

Component-owned styles live next to their component:

```
components/atoms/Button.styles.ts       # buttonStyles, buttonStyle helper
components/atoms/Message.styles.ts      # messageStyles
components/atoms/ProgressBar.styles.ts  # progressBarStyles
components/molecules/Select.styles.ts   # selectStyles
components/molecules/Toast.styles.ts    # toastStyles
features/account/accountNotice.styles.ts # accountNoticeStyles
```

## When to add a file here vs next to a component

- If the style definition belongs to a React component → put it in `ComponentName.styles.ts` next to the component.
- If the style definition is consumed by raw HTML/RAC elements across multiple features with no wrapping component → put it here in `lib/styles/`.

## Naming convention

| Export                                       | Pattern          | Example                                                                      |
| -------------------------------------------- | ---------------- | ---------------------------------------------------------------------------- |
| `tv()` definition                            | `{name}Styles`   | `inputStyles`, `buttonStyles`                                                |
| Style-only helper (flattens slots to string) | `{name}Style`    | `buttonStyle`                                                                |
| Variant prop types                           | `{Name}Variants` | `ButtonVariants` ([docs](https://www.tailwind-variants.org/docs/typescript)) |

## The [`cn`](https://www.tailwind-variants.org/docs/api-reference#cn) utility

For simple conditional class merging (no variants needed), use `cn` from `lib/cn.ts`:

```ts
import { cn } from "../../lib/cn";

<div className={cn("border border-border", isActive && "bg-subtle", className)} />
```

`cn` uses `tailwind-merge` under the hood for automatic conflict resolution. Custom class groups (like `text-caption`) are registered in `lib/cn.ts`.

## Quick reference

```ts
// Single-element (base shape)
import { tv } from "tailwind-variants";

export const inputStyles = tv({
  base: "w-full border border-border bg-background ...",
  variants: {
    multiline: { true: "min-h-36 resize-y" },
  },
});

// Usage: inputStyles()  or  inputStyles({ multiline: true, className: "pr-9" })
```

```ts
// Multi-element (slots shape — https://www.tailwind-variants.org/docs/slots)
export const buttonStyles = tv({
  slots: {
    base: "inline-flex items-center ...",
    spinner: "animate-spin ...",
  },
  variants: { ... },
  compoundVariants: [ ... ],  // https://www.tailwind-variants.org/docs/variants#compound-variants
  defaultVariants: { variant: "primary", size: "md" },
});

// Usage:
const { base, spinner } = buttonStyles({ variant, size });
<button className={base({ className })}>...</button>
```

```ts
// Composition via extend — https://www.tailwind-variants.org/docs/composing-components
export const paginationButtonStyles = tv({
  extend: buttonStyles,
  slots: { base: "data-[disabled]:opacity-50" },
  defaultVariants: { variant: "secondary", size: "sm" },
});
```

## Interaction states (hover, press, disabled, selected)

This project uses `react-aria-components` for interactive elements. React Aria sets **data attributes** (`data-hovered`, `data-pressed`, `data-selected`, `data-disabled`) instead of relying on CSS pseudo-classes (`:hover`, `:active`). We target these with Tailwind's `data-[*]:` modifier.

### Why not `:hover` / `:active` / plugin shorthands?

| Approach | Problem |
|----------|---------|
| `hover:` (`:hover`) | Gets stuck on mobile — a touch triggers `:hover` and it never clears until the user taps elsewhere. React Aria's `useHover` ignores touch-emulated hover entirely. |
| `active:` (`:active`) | Fires inconsistently on touch — clears too early, gets stuck, conflicts with React Aria's deterministic press tracking. |
| `hovered:` / `pressed:` (plugin) | The `tailwindcss-react-aria-components` plugin generates class-level selectors with the **same specificity** as base utilities in Tailwind v4. Source order wins, so `bg-background` beats `hovered:bg-surface-hover`. |
| `data-[hovered]:` | Generates an `[data-hovered]` attribute selector — **higher specificity** than a plain class. Always wins over base styles. |

### Visual feedback model

Interactive elements have two feedback layers:

1. **Color change** — applied on both `data-[hovered]:` and `data-[pressed]:` with the **same** color value.
   - Desktop: hover shows the color; press is already hovered so the color is a no-op, and the scale animation provides the additional press feedback.
   - Mobile: no hover on touch; `data-[pressed]:` is the only color trigger — without it, tapping a button shows no color change.

2. **Scale animation** — applied via `press-scale` / `press-scale-sm` / `press-scale-sm-y` utility classes defined in `styles/index.css`. These use raw `[data-pressed]` CSS selectors internally and animate on press only.

### Example

```ts
export const buttonStyles = tv({
  slots: {
    base: "... press-scale data-[disabled]:cursor-not-allowed data-[disabled]:bg-muted",
  },
  variants: {
    variant: {
      primary: {
        // Hover and press use the same color — see explanation above
        base: "bg-foreground data-[hovered]:bg-foreground/80 data-[pressed]:bg-foreground/80",
      },
      secondary: {
        base: "bg-background data-[hovered]:bg-surface-hover data-[pressed]:bg-surface-hover",
      },
    },
  },
});
```

### `press-scale` utilities

Defined in `styles/index.css`. Each transitions `scale`, `background-color`, `color`, and `box-shadow`. They use `[data-pressed]:not([data-disabled])` selectors — no `:active`.

| Utility | Scale | Duration | Use for |
|---------|-------|----------|---------|
| `press-scale` | 0.95 | 200ms | Default buttons |
| `press-scale-sm` | 0.98 | 150ms | Small controls, pills |
| `press-scale-sm-y` | 0.995 × 0.95 | 150ms | List items, rows |

See `AGENTS.md` for the full prescriptive rules.
