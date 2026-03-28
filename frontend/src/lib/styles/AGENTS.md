# Tailwind Variants — Style Authoring Rules

This project uses [`tailwind-variants`](https://www.tailwind-variants.org/docs/introduction) v3 (`tv()`) for component styling. These rules govern how styles are defined, located, named, and consumed. See also: [API reference](https://www.tailwind-variants.org/docs/api-reference), [examples](https://www.tailwind-variants.org/docs/examples).

## File Location

- Every component with a `tv()` definition MUST have a sibling `.styles.ts` file (e.g. `Button.tsx` → `Button.styles.ts`).
- The `.tsx` component file MUST NOT contain `tv()` calls. Import from the `.styles.ts` sibling instead.
- Shared styles that have no owning component (e.g. `inputStyles`, `toggleButtonStyles`) MUST live in `lib/styles/`.
- Feature-scoped styles that belong to a specific feature component MUST live next to that component (e.g. `accountNotice.styles.ts` next to `accountUi.tsx`).

## Naming

- Every `tv()` export MUST be named `{name}Styles` (e.g. `buttonStyles`, `selectStyles`, `toastStyles`).
- Style-only helper functions that flatten a slots recipe into a single class string MUST be named `{name}Style` (singular, e.g. `buttonStyle`).
- Type exports SHOULD use `{Name}Variant` or `{Name}Size` for union types, and `{Name}Variants` for `VariantProps<typeof xStyles>`.
- MUST NOT use the word "recipe" anywhere — use "styles" consistently.

## Choosing `base` vs [`slots`](https://www.tailwind-variants.org/docs/slots)

- Use `base` (no slots) when the component is a single DOM node with [variants](https://www.tailwind-variants.org/docs/variants).
- Use `slots` when the component has 2+ styled DOM nodes that need coordinated variant changes.
- The primary slot in a slots-based definition MUST be named `base`.
- SHOULD NOT use `slots` for a single-element component — use `base` instead.

## [Variants](https://www.tailwind-variants.org/docs/variants)

- [Boolean variants](https://www.tailwind-variants.org/docs/variants#boolean-variants) MUST use `true` as the key: `disabled: { true: "..." }`.
- [`defaultVariants`](https://www.tailwind-variants.org/docs/variants#default-variants) SHOULD be declared when a variant has a sensible default.
- [`compoundVariants`](https://www.tailwind-variants.org/docs/variants#compound-variants) MUST use `class` (not `className`) as the key — this is the TV convention.
- For slots-based `compoundVariants`, the `class` value MUST be an object keyed by slot name: `class: { spinner: "..." }`.
- MUST NOT add variants that are only used in one place — use `className` override instead.

## [Composition](https://www.tailwind-variants.org/docs/composing-components)

- Use [`extend`](https://www.tailwind-variants.org/docs/composing-components#using-the-extend-prop) to inherit from another `tv()` definition when building a specialized variant of an existing component (e.g. `paginationButtonStyles` extends `buttonStyles`).
- `extend` merges slots, variants, compoundVariants, and defaultVariants automatically.
- MUST NOT duplicate classes from a parent definition — use `extend` and override only what changes.

## Consuming Styles

- Components MUST destructure slot functions from the `tv()` call result:
  ```ts
  const { base, spinner } = buttonStyles({ variant, size });
  ```
- Slot functions MUST be called to produce the class string: `base()`, `spinner()`.
- Ad-hoc class overrides MUST be passed via the [`className` parameter](https://www.tailwind-variants.org/docs/overriding-styles): `base({ className })` or `inputStyles({ className: "pr-9" })`.
- For non-component elements that need a component's appearance (e.g. `<Link>` styled as a button), use the `buttonStyle()` helper — MUST NOT call `.base()` directly on the slots result from consumer code.

## [`cn` Utility](https://www.tailwind-variants.org/docs/api-reference#cn)

- `cn` (re-exported from `tailwind-variants` via `lib/cn.ts`) is for ad-hoc conditional class merging where a full `tv()` definition is not warranted.
- MUST import `cn` from `lib/cn` — not directly from `tailwind-variants`.
- MUST NOT use array `.filter(Boolean).join(" ")` for class merging — use `cn()` instead, which handles tailwind-merge conflict resolution.
- Custom class groups (e.g. `text-caption` as a font-size class) are registered in `lib/cn.ts` via `defaultConfig.twMergeConfig`.

## Imports

- Components MUST import styles from their `.styles.ts` sibling: `import { buttonStyles } from "./Button.styles"`.
- Components that re-export styles for external use MUST do so explicitly: `export { buttonStyle, buttonStyles } from "./Button.styles"`.
- Feature files SHOULD import shared styles from `lib/styles/`: `import { inputStyles } from "../../lib/styles/input"`.
- Feature files that need a component's style utility SHOULD import from the `.styles.ts` file directly: `import { buttonStyle } from "../../components/atoms/Button.styles"`.

## [TypeScript](https://www.tailwind-variants.org/docs/typescript)

- Shared styles SHOULD export variant prop types using [`VariantProps<typeof xStyles>`](https://www.tailwind-variants.org/docs/typescript#extract-variants-from-a-component).
- Component prop interfaces SHOULD reference the exported variant types rather than redeclaring union types.
