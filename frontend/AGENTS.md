# Frontend Agent Notes

Read first:

1. [frontend/README.md](./README.md)
2. [frontend/src/routes/README.md](./src/routes/README.md)
3. [docs/features.md](../docs/features.md)
4. [docs/backend.md](../docs/backend.md) if the change touches API assumptions

## Stack

- React 19
- Vite
- TypeScript
- Tailwind v4
- Oxfmt + Oxlint

## Commands

- Dev: `npm --prefix frontend run dev`
- Build: `npm --prefix frontend run build`
- Staging build: `npm --prefix frontend run build:staging`
- Typecheck: `npm --prefix frontend run typecheck`
- Verify: `npm --prefix frontend run ci`
- Fix formatting/lint: `npm --prefix frontend run check:write`

## Key Files

- `frontend/src/router.ts`
- `frontend/src/routerContext.ts`
- `frontend/src/routes`
- `frontend/src/routeTree.gen.ts`
- `frontend/src/app/auth/AuthStateProvider.tsx`
- `frontend/src/app/TaskProvider.tsx`
- `frontend/src/lib/api.ts`

## Rules

- Keep frontend route docs aligned with the router.
- Do not invent backend behavior in UI docs. Verify against `workers/api`.
- Oxc is the formatter/linter source of truth. Do not add ESLint/Prettier unless asked.
- Do not edit `frontend/src/routeTree.gen.ts`.
- For router work, read `frontend/src/routes/AGENTS.md` before editing route files.
- For Tailwind Variants (`tv()`) authoring, read `frontend/src/lib/styles/AGENTS.md` before editing style files.

## Interaction States on React Aria Components

This project uses [`react-aria-components`](https://react-spectrum.adobe.com/react-aria/components.html) (`<Button>`, `<Link>`, `<ToggleButton>`, `<Tab>`, `<ListBoxItem>`, etc.) which set **data attributes** — not CSS pseudo-classes — for interaction states. The `tailwindcss-react-aria-components` plugin is installed but its shorthand modifiers (`hovered:`, `pressed:`, `selected:`, `disabled:`) MUST NOT be used — they generate selectors with the same specificity as base utility classes, causing base styles to win via source order.

### Correct modifiers (MUST use)

| State         | Tailwind modifier              | Generated selector    |
|---------------|--------------------------------|-----------------------|
| Hover         | `data-[hovered]:`              | `[data-hovered]`      |
| Press/active  | `data-[pressed]:`              | `[data-pressed]`      |
| Selected      | `data-[selected]:`             | `[data-selected]`     |
| Disabled      | `data-[disabled]:`             | `[data-disabled]`     |
| Focused       | `data-[focused]:`              | `[data-focused]`      |
| Focus-visible | `focus-visible:`               | `:focus-visible` (native Tailwind — OK as-is) |
| Group hover   | `group-data-[hovered]:`        | `.group[data-hovered]` |
| Negation      | `not-data-[selected]:`         | `:not([data-selected])` |
| Compound      | `data-[disabled]:data-[hovered]:` | `[data-disabled][data-hovered]` |

### Forbidden modifiers (MUST NOT use on React Aria components)

- `hovered:`, `pressed:`, `selected:`, `disabled:`, `focused:` — plugin shorthands, lose to base styles in Tailwind v4 due to equal specificity.
- `hover:`, `:hover` — native CSS pseudo-class; gets stuck on mobile touch devices. React Aria's `useHover` ignores touch-emulated hover, which is the correct behavior.
- `active:`, `:active` — native CSS pseudo-class; fires inconsistently on touch (gets stuck, clears too early). React Aria's `usePress` normalizes this across mouse, touch, and keyboard via `[data-pressed]`.

> `hover:` and `active:` are fine on plain HTML elements (`<div>`, `<a>`, `<input>`) that are NOT React Aria components. Only avoid them on RAC elements.

### Visual affordance model

Every interactive React Aria element MUST have two layers of feedback:

1. **Color change** — on both hover (desktop) and press (mobile + desktop):
   ```
   data-[hovered]:bg-surface-hover data-[pressed]:bg-surface-hover
   ```
2. **Scale animation** — on press only, via a `press-scale` utility class:
   ```
   press-scale          /* scale 0.95, 200ms ease */
   press-scale-sm       /* scale 0.98, 150ms ease */
   press-scale-sm-y     /* scale 0.995×0.95, 150ms ease — subtle vertical squeeze */
   ```

The `data-[pressed]:` color MUST match the `data-[hovered]:` color. This is not redundant — on desktop, hover fires first (color changes), then press adds scale; the pressed color is already active from hover so it's a no-op. On mobile, there is no hover — `data-[pressed]:` is the only way to get the color change on touch.

### Pattern: button-styled elements

The `buttonStyle()` helper generates button appearance classes including `data-[hovered]:` and `data-[pressed]:` colors. Elements using it MUST be React Aria components (`<Link>`, `<Button>`) so `data-hovered` and `data-pressed` attributes are actually set. If an element is a plain `<a>` or `<div>`, it will never receive these attributes and the hover/press styles will not apply.

### Pattern: inline interactive elements

For one-off interactive elements (buttons, links, list items) with custom classes:

```tsx
/* ✅ Correct — data attributes, paired hover+pressed, press-scale */
<Button className="bg-background text-foreground press-scale data-[hovered]:bg-surface-hover data-[pressed]:bg-surface-hover">

/* ❌ Wrong — plugin shorthand loses to bg-background */
<Button className="bg-background text-foreground press-scale hovered:bg-surface-hover">

/* ❌ Wrong — native :hover gets stuck on mobile touch */
<Button className="bg-background text-foreground press-scale hover:bg-surface-hover">

/* ❌ Wrong — missing data-[pressed]:, no color feedback on mobile */
<Button className="bg-background text-foreground press-scale data-[hovered]:bg-surface-hover">
```

### References

- [React Aria styling with Tailwind](https://react-spectrum.adobe.com/react-aria/styling.html#tailwind-css) — data attribute list
- [Why :hover breaks on touch](https://react-spectrum.adobe.com/react-aria/blog/building-a-button-part-2.html)
- [Why :active breaks on touch](https://react-spectrum.adobe.com/react-aria/blog/building-a-button-part-1.html)
- [usePress hook](https://react-spectrum.adobe.com/react-aria/usePress.html) — deterministic press tracking across input modalities
- [useHover hook](https://react-spectrum.adobe.com/react-aria/useHover.html) — ignores touch-emulated hover events
