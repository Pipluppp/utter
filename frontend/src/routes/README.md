# Frontend Routes

This directory is the TanStack Router file-based route tree.

Read first:

- https://tanstack.com/router/v1/docs/routing/file-based-routing
- https://tanstack.com/router/latest/docs/routing/routing-concepts
- https://tanstack.com/router/latest/docs/api/file-based-routing
- [frontend/README.md](../../README.md)
- [frontend/AGENTS.md](../../AGENTS.md)

How it works:

- `frontend/vite.config.ts` enables `TanStackRouterVite(...)`.
- The plugin scans `frontend/src/routes`.
- It generates `frontend/src/routeTree.gen.ts`.
- `frontend/src/router.ts` builds the router from the generated tree.
- `frontend/src/app/App.tsx` passes `authState` into `RouterProvider` and invalidates the router when auth settles so `beforeLoad` guards re-run.

Default file-routing config in this repo:

- `routesDirectory`: `./src/routes`
- `generatedRouteTree`: `./src/routeTree.gen.ts`
- `routeToken`: `route`
- `indexToken`: `index`
- ignored files/folders start with `-`

Current route structure:

- `__root.tsx`: root shell and typed router context
- `_marketing/route.tsx`: public marketing shell
- `_auth/route.tsx`: public auth shell
- `_app/route.tsx`: protected app shell
- `_app/account/route.tsx`: account subsection layout

Why the tree is shaped this way:

- The old React Router setup had one central route definition and one large shell.
- TanStack Router works better when shell boundaries are expressed as routes instead of inferred from route metadata.
- `_marketing`, `_auth`, and `_app` are not just folders. They are the main UX shells of the app.
- Account is nested because it is a real subsection with shared layout and child routes.
- The current layout uses directories because deeply nested flat filenames were readable enough for the migration, but not for long-term maintenance.

Conventions used here:

- Use `route.tsx` for a directory layout route.
- Use `index.tsx` for the exact parent path.
- Use a leading `_` for a pathless layout route or pathless layout directory.
- Use `foo_.bar.tsx` only when the URL should stay under `foo`, but the route must not render inside `foo`'s component tree.
- Use `-components`, `-pending.tsx`, or other `-` prefixed files for route-local helpers that should not become routes.
- Do not edit `routeTree.gen.ts`.

What belongs in route files:

- `beforeLoad`
- redirects
- `validateSearch`
- route loaders if added later
- pending, error, not-found, and head config
- thin wiring to a feature page

What does not belong in route files:

- large page UI
- long business logic
- API orchestration that is not route-specific
- duplicated feature layouts

Use `frontend/src/features` for page implementation. Keep `frontend/src/routes` focused on URL contract and shell composition.

Current repo-specific notes:

- This app uses TanStack Router, not TanStack Query.
- Component-owned data fetching still exists in `features/*`. That is acceptable for now.
- Search-param ownership has moved into route files with `validateSearch`.
- Protected app routes are guarded in `_app/route.tsx` with `beforeLoad`, not in page components.
- If a feature only needs typed route hooks, prefer `getRouteApi(...)` over importing a route module into the feature.
- The route tree should explain shell composition at a glance. If a route shape makes the tree harder to read, prefer the clearer route shape.
- Do not treat file-based routing as a requirement to keep everything under `routes/*`. TanStack only needs the route contract there.

Change checklist:

- Preserve the `_marketing`, `_auth`, and `_app` shell split unless the UX truly changes.
- Keep URLs stable unless the change is intentional and documented.
- If you add or remove a route, verify generated output by running `npm --prefix frontend run build` or `npm --prefix frontend run typecheck`.
- If you change route behavior, update this file when the guidance changes.
