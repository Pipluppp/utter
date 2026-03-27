# Route Agent Notes

The key words "MUST", "MUST NOT", "SHOULD", and "SHOULD NOT" in this document are to be interpreted as requirement levels.

Read first:

1. [README.md](./README.md)
2. [frontend/AGENTS.md](../../AGENTS.md)
3. [TanStack file-based routing docs](https://tanstack.com/router/v1/docs/routing/file-based-routing)
4. [TanStack routing concepts](https://tanstack.com/router/latest/docs/routing/routing-concepts)

Context:

- This repo uses TanStack Router file-based routing with the Vite plugin.
- `frontend/src/routes` is scanned and turned into `frontend/src/routeTree.gen.ts`.
- `frontend/src/router.ts` builds the router from that generated tree.
- The route tree is a composition layer. It owns URL structure, route guards, search validation, and shell/layout boundaries.
- `frontend/src/features` is the page layer. It owns UI and feature logic.
- This repo does not use TanStack Query yet. Route loaders are optional here, not mandatory.

Current repo decisions:

- Use pathless layout boundaries for the three main surfaces: `_marketing`, `_auth`, `_app`.
- Keep the signed-in shell guard in `_app/route.tsx` with `beforeLoad`.
- Keep account as a real nested branch under `_app/account`.
- Prefer directory routes for real branches. Use flat route filenames only when the branch stays shallow.
- Prefer `getRouteApi(...)` in feature code when only typed route hooks are needed.
- Keep route files thin and reuse feature layouts where possible.

Important TanStack conventions used here:

- `__root.tsx` is the root route.
- `route.tsx` is the layout token inside a route directory.
- `index.tsx` is the exact parent-path route.
- Leading `_` means pathless layout.
- `foo_.bar.tsx` means a non-nested route: the URL stays under `foo`, but rendering does not happen inside `foo`'s component tree.
- Leading `-` means ignored by route generation. Use that for route-local helpers.

Rules:

- Treat `frontend/src/routes` as the URL contract, not the page implementation layer.
- Route files MUST stay thin.
- Page UI and product logic MUST live in `frontend/src/features`.
- You MUST NOT edit `frontend/src/routeTree.gen.ts`.
- You SHOULD prefer directory routes for real nested branches.
- You SHOULD use flat files only when the branch is shallow and stays readable.
- You MUST use `beforeLoad` for auth and redirects.
- Keep `validateSearch` next to the route that owns that URL state.
- You SHOULD prefer `getRouteApi(...)` in feature modules when only typed route hooks are needed.
- You SHOULD reuse existing feature layouts instead of duplicating them in route files.
- Use `-` prefixed files or folders for route-local helpers that should not become routes.
- You MUST NOT move large business logic into route modules just because TanStack allows route-owned APIs.
- You MUST NOT create route-to-feature-to-route import cycles.
- You SHOULD NOT collapse `_marketing`, `_auth`, and `_app` into one shell unless the UI contract actually changes.

Current structure is intentional:

- `__root.tsx` owns the root shell and router context.
- `_marketing` owns public marketing surfaces.
- `_auth` owns auth surfaces.
- `_app` owns signed-in product surfaces.
- `_app/account` owns the account subsection layout.

Imperative notes:

- If you add a route, you SHOULD choose the route family first, then the file shape.
- If the route needs the same shell and nested rendering as its parent, add it under that directory.
- If the URL should share a prefix but should not render inside the parent page, use the non-nested `foo_.bar.tsx` pattern.
- If the route owns URL search state, define `validateSearch` in the route file.
- If auth or redirect behavior is required, you MUST use `beforeLoad`, not page-level redirects.
- If route-local pending or helper UI is needed, colocate it with `-pending.tsx` or `-components`.
- After route changes, you MUST verify generation by running `npm --prefix frontend run build` or `npm --prefix frontend run typecheck`.

Common mistakes in this repo:

- Treating `routeTree.gen.ts` as hand-written code.
- Encoding deep nesting into one flat filename when a directory route is clearer.
- Putting route-only concerns into `features/*`.
- Putting page implementation into `routes/*`.
- Making `/auth/...` children render inside the `/auth` page when they really belong only to the `_auth` shell.

Do not change route conventions casually. This file SHOULD stay aligned with the real route tree.
