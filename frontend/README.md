# Frontend

React 19 + Vite SPA for marketing, auth, clone, generate, history, tasks, and account flows.

## Read This When

- you are changing UI routes
- you are debugging frontend auth or task state
- you need frontend commands and key files

## Commands

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run build:staging
npm --prefix frontend run typecheck
npm --prefix frontend run ci
npm --prefix frontend run check:write
```

## Key Files

- entry: `frontend/src/main.tsx`
- app shell: `frontend/src/app/App.tsx`
- router config: `frontend/src/router.ts`
- router context: `frontend/src/routerContext.ts`
- route tree: `frontend/src/routes`
- auth state: `frontend/src/app/auth/AuthStateProvider.tsx`
- API client: `frontend/src/lib/api.ts`
- task state: `frontend/src/app/TaskProvider.tsx`
- generated route tree: `frontend/src/routeTree.gen.ts`

## Runtime Notes

- The frontend talks to `/api/*`.
- Supabase auth session refresh happens in the browser.
- Long-running generation and design preview work is modeled through task polling.
- Protected media is resolved through signed backend URLs, not public asset URLs.

## Important Pages

- `Landing.tsx`
- `Clone.tsx`
- `Generate.tsx`
- `Design.tsx`
- `Voices.tsx`
- `History.tsx`
- `Tasks.tsx`
- `features/account/*`

## Constraints

- Oxc is the formatter/linter source of truth.
- Keep API assumptions aligned with `workers/api`.
- If a route or feature flag changes, update docs that point to it.

## Interaction states (hover, press, disabled, selected)

This project uses `react-aria-components` for interactive elements. React Aria sets **data attributes** (`data-hovered`, `data-pressed`, `data-selected`, `data-disabled`) instead of relying on CSS pseudo-classes (`:hover`, `:active`). We target these with Tailwind's `data-[*]:` modifier.

### Why not `:hover` / `:active` / plugin shorthands?

| Approach                         | Problem                                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hover:` (`:hover`)              | Gets stuck on mobile — a touch triggers `:hover` and it never clears until the user taps elsewhere. React Aria's `useHover` ignores touch-emulated hover entirely.                                                     |
| `active:` (`:active`)            | Fires inconsistently on touch — clears too early, gets stuck, conflicts with React Aria's deterministic press tracking.                                                                                                |
| `hovered:` / `pressed:` (plugin) | The `tailwindcss-react-aria-components` plugin generates class-level selectors with the **same specificity** as base utilities in Tailwind v4. Source order wins, so `bg-background` beats `hovered:bg-surface-hover`. |
| `data-[hovered]:`                | Generates an `[data-hovered]` attribute selector — **higher specificity** than a plain class. Always wins over base styles.                                                                                            |

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

| Utility            | Scale        | Duration | Use for               |
| ------------------ | ------------ | -------- | --------------------- |
| `press-scale`      | 0.95         | 200ms    | Default buttons       |
| `press-scale-sm`   | 0.98         | 150ms    | Small controls, pills |
| `press-scale-sm-y` | 0.995 × 0.95 | 150ms    | List items, rows      |

## Read Next

- [AGENTS.md](./AGENTS.md)
- [src/routes/README.md](./src/routes/README.md)
- [src/routes/AGENTS.md](./src/routes/AGENTS.md)
- [docs/features.md](../docs/features.md)
- [docs/backend.md](../docs/backend.md)
