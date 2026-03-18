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
- router: `frontend/src/app/router.tsx`
- auth state: `frontend/src/app/auth/AuthStateProvider.tsx`
- API client: `frontend/src/lib/api.ts`
- Supabase browser client: `frontend/src/lib/supabase.ts`
- task state: `frontend/src/components/tasks/TaskProvider.tsx`
- core pages: `frontend/src/pages`

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
- `pages/account/*`

## Constraints

- Oxc is the formatter/linter source of truth.
- Keep API assumptions aligned with `workers/api`.
- If a route or feature flag changes, update docs that point to it.

## Read Next

- [AGENTS.md](./AGENTS.md)
- [docs/features.md](../docs/features.md)
- [docs/backend.md](../docs/backend.md)
