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
