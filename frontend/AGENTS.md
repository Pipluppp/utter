# Frontend Agent Notes

Read first:

1. [frontend/README.md](./README.md)
2. [docs/features.md](../docs/features.md)
3. [docs/backend.md](../docs/backend.md) if the change touches API assumptions

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

- `frontend/src/app/router.tsx`
- `frontend/src/app/auth/AuthStateProvider.tsx`
- `frontend/src/components/tasks/TaskProvider.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/supabase.ts`

## Rules

- Keep frontend route docs aligned with the router.
- Do not invent backend behavior in UI docs. Verify against `workers/api`.
- Oxc is the formatter/linter source of truth. Do not add ESLint/Prettier unless asked.
