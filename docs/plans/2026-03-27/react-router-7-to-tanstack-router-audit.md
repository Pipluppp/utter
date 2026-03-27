# React Router 7 to TanStack Router Audit

Date: 2026-03-27

## Scope

This audit inventories the React Router 7 surface in the frontend, maps it to TanStack Router, and proposes the migration structure and sequence that best fits this repo.

Important clarification: this codebase does **not** currently use `@tanstack/react-query`. The direct migration target is **TanStack Router**. TanStack Query is an optional follow-on improvement for route-owned data loading and shared cache management, not the direct replacement for the current React Router APIs.

## Executive Summary

The current app uses React Router 7 in a contained way:

- one hand-written `createBrowserRouter` tree in `frontend/src/app/router.tsx`
- no React Router loaders, actions, fetchers, or route modules
- auth protection done with element wrappers via `RequireAuth`
- component-owned data fetching with `useEffect`
- manual URL state parsing and syncing with `useSearchParams`
- shared layout state inferred from `handle.routeFamily` plus `useMatches`
- nested account state passed via `Outlet context`

That makes the migration very feasible, but it is not a pure import swap. The main changes are:

1. Move from a central code-defined route array to file-based TanStack Router routes.
2. Replace element-level auth guards with route-level `beforeLoad` redirects.
3. Replace raw `useSearchParams` logic with route-owned `validateSearch`.
4. Replace account `Outlet context` with route-owned data.
5. Replace React Router links and navigation hooks with TanStack Router equivalents.
6. For `react-aria-components`, use the documented `createLink(...)` integration and remove React Aria `RouterProvider`.

## Current Router Topology

Current implementation:

- `frontend/src/app/App.tsx` mounts `RouterProvider` from `react-router-dom`.
- `frontend/src/app/router.tsx` builds the full route tree with `createBrowserRouter`.
- `frontend/src/app/Layout.tsx` is the shared shell and uses:
  - `useLocation`
  - `useMatches`
  - `useNavigate`
  - `Outlet`
- `frontend/src/app/RequireAuth.tsx` protects authenticated pages with `<Navigate />`.

Current route families:

| Family | Current mechanism | Purpose |
| --- | --- | --- |
| Marketing | `handle: { routeFamily: "marketing" }` | Landing and static pages |
| Auth | `handle: { routeFamily: "auth" }` | Sign in and forgot password |
| App | `handle: { routeFamily: "app" }` plus `RequireAuth` | Product surfaces for signed-in users |

Current route inventory:

| Route | Current component | Auth | Current behavior | TanStack Router target |
| --- | --- | --- | --- | --- |
| `/` | `LandingPage` | Public | Static marketing page | `routes/_marketing/index.tsx` |
| `/pricing` | redirect | Public | Redirects to `/#pricing` | Redirect route to `/` with `hash: "pricing"` |
| `/privacy` | `PrivacyPage` | Public | Static | `routes/_marketing/privacy.tsx` |
| `/terms` | `TermsPage` | Public | Static | `routes/_marketing/terms.tsx` |
| `/about` | `AboutPage` | Public | Static | `routes/_marketing/about.tsx` |
| `/auth` | `AuthPage` | Public | Search-driven auth UI | `routes/_auth/auth.tsx` with `validateSearch` |
| `/auth/forgot-password` | `ForgotPasswordPage` | Public | Static auth page | nested auth route |
| `/clone` | `ClonePage` | Protected | Reads `demo` search param | `routes/_app/clone.tsx` |
| `/generate` | `GeneratePage` | Protected | Reads seed search params | `routes/_app/generate.tsx` |
| `/design` | `DesignPage` | Protected | Programmatic nav to generate | `routes/_app/design.tsx` |
| `/voices` | `VoicesPage` | Protected | Search-param filters | `routes/_app/voices.tsx` |
| `/history` | `HistoryPage` | Protected | Search-param filters | `routes/_app/history.tsx` |
| `/tasks` | `TasksPage` | Protected | Job center | `routes/_app/tasks.tsx` |
| `/account` | `AccountLayoutPage` + profile index | Protected | Nested layout with outlet context | `routes/_app/account.tsx` + children |
| `/account/overview` | `AccountOverviewPage` | Protected | Nested child | `routes/_app/account/overview.tsx` |
| `/account/credits` | `AccountCreditsPage` | Protected | Nested child plus `checkout` query state | `routes/_app/account/credits.tsx` |
| `/account/update-password` | `UpdatePasswordPage` | Protected | Nested child | `routes/_app/account/update-password.tsx` |
| `/account/usage` | redirect | Protected | Redirects to credits, preserving search/hash | Redirect route |
| `/account/billing` | redirect | Protected | Redirects to credits, preserving search/hash | Redirect route |
| `/account/auth` | redirect | Protected | Redirects to `/auth` | Redirect route |
| `/account/profile` | redirect | Protected | Redirects to `/account` | Redirect route |

## Full React Router 7 Surface Area

### Core Router Setup

| File | React Router usage | What it does now | Migration target |
| --- | --- | --- | --- |
| `frontend/src/app/App.tsx` | `RouterProvider` | Mounts the app router | Replace with TanStack `RouterProvider` |
| `frontend/src/app/router.tsx` | `createBrowserRouter`, `Navigate`, `useLocation` | Defines the route tree, redirects, lazy imports | Replace with file-based route tree plus `createRouter` |
| `frontend/src/app/Layout.tsx` | `Outlet`, `useLocation`, `useMatches`, `useNavigate` | Shell selection, suspense fallback choice, hash scrolling, React Aria bridge | Move to root/pathless layout routes and remove React Aria `RouterProvider` |
| `frontend/src/app/RequireAuth.tsx` | `Navigate`, `useLocation` | Element-level auth guard with `returnTo` | Replace with `beforeLoad` on protected layout route |

### Navigation and Linking

| File | React Router usage | What it does now | Migration target |
| --- | --- | --- | --- |
| `frontend/src/app/FeatureEntryLink.tsx` | `Link` | Sends signed-in users to features and signed-out users to `/auth?returnTo=...` | Replace with TanStack `Link`; stop hand-building query strings where possible |
| `frontend/src/app/TopBar.tsx` | `To`, `useLocation` | Active nav styling and route/hash link rendering | Use TanStack `Link` active props and typed `to/search/hash` |
| `frontend/src/app/Footer.tsx` | `useLocation` | Builds account/sign-in href using current location | Use TanStack `useLocation` and route helpers |
| `frontend/src/app/useGlobalShortcuts.ts` | `useNavigate`, `useLocation` | Keyboard shortcuts to `/clone`, `/generate`, `/design` | Replace with TanStack `useNavigate` |
| `frontend/src/components/organisms/TaskDock.tsx` | `NavLink`, `useLocation` | Links tasks back to origin route and hides dock on `/tasks` | Replace with TanStack `Link`; hide using TanStack location |
| `frontend/src/features/landing/LandingHero.tsx` | `Link` | Hash navigation to demos | Replace with typed `Link` using `hash` |
| `frontend/src/features/landing/PricingGrid.tsx` | `NavLink` | Links into account credits | Replace with TanStack `Link` |
| `frontend/src/features/tasks/Tasks.tsx` | `Link` | Links to task origin page | Replace with TanStack `Link` |
| `frontend/src/features/account/Overview.tsx` | `Link` | Internal account/history links | Replace with TanStack `Link` |
| `frontend/src/features/account/Credits.tsx` | `Link`, `useNavigate`, `useLocation` | Internal links and checkout query cleanup | Replace with TanStack `Link` and typed search updates |
| `frontend/src/features/voices/Voices.tsx` | `NavLink` | Deep link to generate with selected voice | Replace with `Link to="/generate" search={{ voice: ... }}` |

### Search, Location, and Match State

| File | Current usage | Search keys | Migration target |
| --- | --- | --- | --- |
| `frontend/src/features/auth/Auth.tsx` | `useSearchParams` | `returnTo`, `error`, `intent` | Route `validateSearch` |
| `frontend/src/features/clone/Clone.tsx` | `useSearchParams` | `demo` | Route `validateSearch` |
| `frontend/src/features/generate/Generate.tsx` | `useSearchParams` | `voice`, `text`, `language`, `demo` | Route `validateSearch` |
| `frontend/src/features/history/History.tsx` | `useSearchParams`, `setSearchParams` | `search`, `status`, `page`, `sort`, `sort_dir`, `voice_id` | Route `validateSearch` plus `loaderDeps` |
| `frontend/src/features/voices/Voices.tsx` | `useSearchParams`, `setSearchParams` | `search`, `source`, `page`, `sort`, `sort_dir`, `favorites` | Route `validateSearch` plus `loaderDeps` |
| `frontend/src/features/account/Credits.tsx` | `useLocation` | `checkout` | Route `validateSearch` |
| `frontend/src/app/Layout.tsx` | `useLocation`, `useMatches` | pathname, hash, route family lookup | Replace with pathless layout routes and typed location hooks |

### Nested Routes and Outlet Context

| File | React Router usage | What it does now | Migration target |
| --- | --- | --- | --- |
| `frontend/src/features/account/AccountLayout.tsx` | `Outlet`, `useLocation`, `useNavigate` | Account tabs, nested render, outlet context provider | Use TanStack layout route; tabs navigate with typed `to`; replace outlet context |
| `frontend/src/features/account/accountData.ts` | `useOutletContext` | Reads parent account data snapshot | Replace with route loader data or route context |
| `frontend/src/features/account/Billing.tsx` | `Navigate`, `useLocation` | Redirect legacy route to credits | Replace with redirect route |
| `frontend/src/features/account/Usage.tsx` | `Navigate`, `useLocation` | Redirect legacy route to credits | Replace with redirect route |

## What Is Not In Scope for a Router Port

These are not React Router features and do not need 1:1 router migration work:

- `TaskProvider` polling and local storage persistence
- `AuthStateProvider` session refresh behavior
- feature-level API clients in `frontend/src/lib/api.ts`
- voice/design/generate business logic
- Cloudflare/Supabase runtime contracts

They still influence route design, especially auth and origin links, but they are separate from the routing library itself.

## TanStack Router Target Architecture

## Recommended Stack

- `@tanstack/react-router`
- `@tanstack/router-plugin` for Vite
- `@tanstack/react-router-devtools` during migration
- optional later: `@tanstack/react-query`

React Aria integration choice, verified against the docs:

- This repo uses `react-aria-components` `^1.16.0`, which is newer than the React Aria docs threshold for TanStack Router support.
- The React Aria routing docs say that for `react-aria-components` v1.11.0 or later, TanStack Router should use `createLink(...)` and that React Aria `RouterProvider` is not needed.
- TanStack Router's custom-link guide documents the same pattern and explicitly calls out React Aria Components support, including `preload="intent"`.

Best-fit decision for this repo:

- Keep TanStack Router's own app `RouterProvider`
- Remove React Aria `RouterProvider` from the shared shell
- Replace our local link wrappers with `createLink(ReactAriaLink)`
- Continue using TanStack Router `useNavigate` for imperative navigation such as tabs, keyboard shortcuts, redirects, and post-action flows

## Recommended Route Layout

Use file-based routing. The current route families map cleanly to pathless layout routes:

```text
frontend/src/routes/
  __root.tsx
  _marketing.tsx
  _marketing.index.tsx
  _marketing.about.tsx
  _marketing.privacy.tsx
  _marketing.terms.tsx
  pricing.tsx

  _auth.tsx
  _auth.auth.tsx
  _auth.auth.forgot-password.tsx

  _app.tsx
  _app.clone.tsx
  _app.generate.tsx
  _app.design.tsx
  _app.voices.tsx
  _app.history.tsx
  _app.tasks.tsx

  _app.account.tsx
  _app.account.index.tsx
  _app.account.overview.tsx
  _app.account.credits.tsx
  _app.account.update-password.tsx
  _app.account.usage.tsx
  _app.account.billing.tsx
  _app.account.auth.tsx
  _app.account.profile.tsx
```

Why this shape:

- `__root.tsx` holds the top-level shell contract and typed router context.
- `_marketing`, `_auth`, and `_app` replace `handle.routeFamily` and remove the need for a `useMatches` scan.
- `_app.tsx` owns auth protection via `beforeLoad`.
- `_app.account.tsx` becomes the account layout route rather than using nested React Router routes plus outlet context.

## Recommended Router Context

Use `createRootRouteWithContext` and pass shared runtime dependencies through the TanStack `RouterProvider` context:

- `authState`
- task accessors if routes need them
- optional later: `queryClient`

This matches TanStack Router best practice and avoids route modules importing global singletons directly.

## Recommended Router Defaults

Use router-level defaults for:

- `defaultPreload: "intent"`
- `scrollRestoration: true`
- `defaultErrorComponent`
- `defaultNotFoundComponent`

If TanStack Query is added later, also set:

- `defaultPreloadStaleTime: 0`

## React Router 7 to TanStack Router Mapping

| Current React Router pattern | Current usage in repo | TanStack Router equivalent | Migration note |
| --- | --- | --- | --- |
| `createBrowserRouter([...])` | Entire route tree in `app/router.tsx` | `createRouter({ routeTree })` plus file-based routes | Foundational migration |
| `RouterProvider router={router}` | `app/App.tsx` | `RouterProvider router={router}` from TanStack | Also register router type for inference |
| `handle.routeFamily` plus `useMatches()` | `app/Layout.tsx` | Pathless layout routes or static route data | Prefer pathless layouts here |
| `<Navigate to=... replace />` | redirects and auth | `throw redirect({ ... })` in `beforeLoad` or redirect-only route | Redirect-only routes should not render |
| `RequireAuth` element wrapper | app routes | Protected pathless layout route with `beforeLoad` | Avoid rendering protected screens before redirect |
| `useNavigate()` string API | shortcuts, tabs, post-action nav | `useNavigate()` object API | Update every call site |
| `Link` and `NavLink` | top nav, landing CTAs, tasks, account links | TanStack `Link` | Prefer `to` plus `search` plus `hash` over hand-built strings |
| `useSearchParams()` | auth, clone, generate, voices, history | `validateSearch`, `Route.useSearch()`, `navigate({ search })` | Strongly typed URL state |
| `useLocation()` | returnTo, active UI, checkout query parsing | TanStack `useLocation()` | Most usages port directly |
| `Outlet` | root layout and account layout | TanStack `Outlet` | Similar concept |
| `useOutletContext()` | account subtree | route loader data or route context | Do not keep this pattern as-is |
| `React.lazy` inside route array | page splitting | `.lazy.tsx` or auto code splitting | Prefer route-level lazy files |
| React Aria `RouterProvider` bridge | `app/Layout.tsx` | `createLink(ReactAriaLink)` wrappers | This is the documented integration for our stack |

## Page-by-Page Migration Notes

### Marketing Shell

Current behavior:

- `/`, `/about`, `/privacy`, `/terms`
- `/pricing` redirects to `/#pricing`
- hash-aware header state for `#demos`, `#features`, `#pricing`
- manual smooth-scroll effect in `Layout`

Target:

- Move these routes under `_marketing`
- Keep the hash-scroll effect, but scope it to the marketing layout instead of the global shell
- Replace string links like `"/#pricing"` with `Link to="/" hash="pricing"`
- Convert `/pricing` to a redirect route

### Auth Shell

Current behavior:

- `/auth` uses URL state to choose sign-in or sign-up mode and destination
- authenticated users are redirected to `safeReturnTo`
- `returnTo` is built from current pathname, search, and hash

Search schema to validate:

```ts
type AuthSearch = {
  returnTo?: string
  error?: string
  intent?: "sign_in" | "sign_up"
}
```

Target:

- Put auth pages under `_auth`
- Define `validateSearch` on `/auth`
- Keep `getSafeReturnTo`, but stop reading raw `URLSearchParams` inside the component
- Navigate with typed route objects rather than hand-built `"/auth?..."`

### Protected App Shell

Current behavior:

- `/clone`, `/generate`, `/design`, `/voices`, `/history`, `/tasks`, `/account/**`
- protection happens after render selection, inside `<RequireAuth>`

Target:

- Create a pathless protected route, e.g. `_app.tsx`
- In `_app.tsx`, use `beforeLoad(({ context, location }) => { ... })`
- If auth is unresolved, render a pending component or keep the current skeleton strategy
- If signed out, `throw redirect({ to: "/auth", search: { returnTo: location.href } })`

This removes auth logic from every route element and matches TanStack Router best practice.

### `/clone`

Current URL behavior:

- reads `demo`

Current non-router behavior:

- local component state for the form
- success modal links into `/generate?voice=...`

Target:

- `validateSearch` for `demo`
- keep form state local unless deep-linking more fields becomes a requirement
- replace success CTA with `Link to="/generate" search={{ voice: created.id }}`

### `/generate`

Current URL behavior:

- reads `voice`, `text`, `language`, `demo`
- does not write search state back

Current data behavior:

- fetches voices on mount
- restores form state from `TaskProvider`

Target:

- `validateSearch` for the seed values
- candidate loader: preload voices and languages
- keep task restoration in component logic unless task state becomes router-owned

### `/design`

Current URL behavior:

- no search state today
- programmatic navigation to `/generate?voice=...`

Target:

- likely no route search schema needed initially
- replace `navigate("/generate?voice=...")` with typed navigation
- candidate loader: preload languages

### `/voices`

Current URL behavior:

- `search`
- `source`
- `page`
- `sort`
- `sort_dir`
- `favorites`

Current data behavior:

- fetches voices in-component
- mirrors filter state into the URL

Target:

- define full `validateSearch`
- use `loaderDeps` for the search state that affects the request
- candidate loader or Query-backed loader for `/api/voices`
- replace deep links to generate with typed route objects

Recommended search shape:

```ts
type VoicesSearch = {
  search: string
  source: "all" | "uploaded" | "designed"
  page: number
  sort: "created_at" | "name" | "generation_count"
  sort_dir: "asc" | "desc"
  favorites: "all" | "true"
}
```

### `/history`

Current URL behavior:

- `search`
- `status`
- `page`
- `sort`
- `sort_dir`
- `voice_id`

Current data behavior:

- fetches generations in-component
- fetches voice options separately
- re-polls when active jobs exist
- uses `navigate(res.redirect_url)` on regenerate

Target:

- define full `validateSearch`
- use `loaderDeps`
- candidate loader or Query-backed loader for `/api/generations`
- candidate loader for voice filter options
- strongly consider changing the regenerate API response away from an opaque string URL and into structured route data; otherwise the navigation stays untyped

This route benefits the most from TanStack Router search validation.

### `/tasks`

Current URL behavior:

- none

Current data behavior:

- in-component fetch plus polling

Target:

- route can remain simple initially
- optional later loader for initial tasks list

### `/account` subtree

Current structure:

- `AccountLayoutPage` fetches account data via `useAccountData()`
- child routes consume it with `useOutletContext()`
- tabs derive selected state from `location.pathname`
- legacy redirects preserve search and hash
- `/account/credits` reads `checkout` from query string and clears it with `navigate({ pathname, search })`

Target:

- `routes/_app.account.tsx` becomes the loader/layout owner
- load account snapshot in the route
- children read loader data via route APIs, not `useOutletContext`
- tabs navigate with typed `to`
- `/account/credits` gets `validateSearch` for `checkout`
- redirect-only routes become route redirects, preserving search and hash where needed

This is the second biggest structural migration after the root route tree.

## Strong Recommendations

### 1. Adopt File-Based Routing

This repo currently has a single central route file. TanStack Router works with code-based routing too, but file-based routing is the better fit here because:

- the route tree is already page-oriented
- the app has clear layout boundaries
- the Vite plugin gives typed route generation
- lazy route splitting becomes straightforward

### 2. Replace Hand-Built Hrefs With Structured Navigation

This codebase frequently builds route strings manually:

- `"/auth?..."` in `buildAuthHref`
- `"/generate?voice=..."`
- `"/#pricing"`

During migration, prefer:

- `to`
- `search`
- `hash`
- `params`

That is where TanStack Router's type safety pays off.

### 3. Replace `Outlet context` With Route-Owned Data

The account subtree is the main place where React Router nesting is carrying data. The cleaner TanStack model is:

- parent account route loads the account snapshot
- child routes read typed loader data or route context

### 4. Move Search State Ownership to Routes

`voices`, `history`, `auth`, `generate`, `clone`, and `account/credits` all parse URL state manually today. Those routes should each own a search schema with defaults and coercion.

### 5. Use `createLink(...)` for React Aria Components

This recommendation is verified against both the React Aria routing docs and TanStack Router custom-link docs.

What fits this repo:

- We use `react-aria-components`, not the older React Spectrum-only surface.
- We already centralize most link rendering in `frontend/src/components/atoms/Link.tsx`.
- Our installed version, `react-aria-components` `^1.16.0`, is within the range where React Aria documents direct TanStack Router `createLink(...)` support.

What to do:

- Replace the current `AppLink` and `NavAppLink` base implementation with `createLink(ReactAriaLink)`.
- Remove React Aria `RouterProvider` from `frontend/src/app/Layout.tsx`.
- Keep plain TanStack Router primitives for imperative navigation in places like:
  - `frontend/src/app/useGlobalShortcuts.ts`
  - `frontend/src/features/account/AccountLayout.tsx`
  - `frontend/src/features/design/Design.tsx`
  - `frontend/src/features/history/History.tsx`

Why this is the best fit:

- It matches the official documented integration instead of forcing a custom bridge.
- It preserves our current wrapper pattern, so the migration stays localized.
- It supports TanStack Router link typing and preloading behavior on React Aria link components.

## TanStack Query Decision

Current conclusion:

- Integrating TanStack Query now does not make the router migration simpler.
- It is a separate concern that expands scope into data ownership, cache invalidation, and loader composition.
- It becomes valuable once the route tree exists and we want route-owned data loading with cache reuse.

Best-fit recommendation:

- Do the TanStack Router migration first.
- Add TanStack Query later if we want to move `voices`, `history`, `account`, `tasks`, and `languages` from component-owned `useEffect` fetching into route loaders plus shared cache.

Why this fits the docs and the repo:

- TanStack Router's migration guide treats Query as a later enhancement, not a prerequisite.
- The current repo has zero `@tanstack/react-query` usage, so combining both changes would turn one migration into two.
- The router migration already has enough moving parts: route tree generation, auth, search validation, nested account layout, and React Aria link integration.

## Recommended Migration Sequence

1. Add TanStack Router dependencies and Vite plugin without removing React Router yet.
2. Create `frontend/src/routes` and scaffold `__root.tsx`, `_marketing.tsx`, `_auth.tsx`, and `_app.tsx`.
3. Create the TanStack router instance and register the router type in `main.tsx`.
4. Port the static marketing and auth routes first.
5. Port protected app routes and replace `RequireAuth` with `_app.tsx` `beforeLoad`.
6. Port account layout and remove `useOutletContext`.
7. Port search-heavy routes (`voices`, `history`, `auth`, `generate`, `clone`, and `account/credits`) with `validateSearch`.
8. Replace all remaining `Link`, `NavLink`, `useNavigate`, `useLocation`, and `useSearchParams` imports.
9. Convert `frontend/src/components/atoms/Link.tsx` to TanStack Router `createLink(...)` wrappers and remove React Aria `RouterProvider`.
10. Remove React Router dependencies and dead code. A clean way to force the final sweep is to uninstall `react-router-dom` once the TanStack router is wired and then resolve the remaining TypeScript errors.
11. Optionally add TanStack Query as a follow-up optimization pass.

## Alignment With the Official TanStack Migration Guide

Our migration plan is grounded in and aligned with the official guide:

- install TanStack Router before removing React Router
- add the Vite router plugin
- create a generated route tree
- move to file-based routes
- register the router type
- replace `Link`
- replace `useNavigate`
- replace `Outlet`
- move `useSearchParams` logic into `validateSearch`
- remove React Router only after the new router is working

Where our plan intentionally goes further than the generic guide:

- it accounts for the repo's `react-aria-components` usage and chooses the doc-recommended `createLink(...)` integration
- it replaces `handle.routeFamily` with pathless layout routes
- it moves auth from element wrappers to `beforeLoad`
- it replaces account `useOutletContext` with route-owned data
- it preserves the landing-page hash-scroll behavior explicitly

Where our plan intentionally narrows scope:

- we are not bundling TanStack Query into the initial router migration
- we are not treating SSR as a migration requirement, because this frontend is a Vite SPA served by a Cloudflare frontend worker
- we are not spending effort on React Router loader or action parity because the repo does not currently use those APIs

Bottom line on alignment:

- Yes, the plan is already aligned with the official TanStack migration tips.
- After this revision, it is more tightly aligned because the React Aria integration now follows the documented `createLink(...)` path rather than a custom adapter assumption.

## Risk Register

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| React Aria link migration | Current shell passes React Router navigation through React Aria `RouterProvider` | Replace with documented `createLink(...)` wrappers and verify internal links, active states, and external-link behavior |
| Auth redirect loops | Auth state is async and currently guarded in render | Keep auth status in router context and define a clear pending path |
| Search param regressions | Several screens depend on implicit defaults today | Add explicit `validateSearch` defaults and malformed URL tests |
| Hash scroll parity | Marketing sections rely on custom smooth scrolling | Re-implement in marketing layout and test direct deep links |
| Untyped opaque redirects | `history` regenerates via API-returned URL string | Prefer structured redirect payloads or route helper parsing |
| Account data ownership | Child account pages assume outlet context | Move to parent route loader or context before porting children |
| Lazy loading parity | Current route suspense fallbacks are family-specific | Keep fallback ownership in layout routes or `.lazy.tsx` files |

## Concrete Deliverables for the Implementation Phase

The migration branch should produce at least:

- a new TanStack Router setup in `frontend/src/routes` and `frontend/src/router.tsx`
- typed route search schemas for `auth`, `clone`, `generate`, `voices`, `history`, and `account/credits`
- a protected `_app` layout route with `beforeLoad`
- an account layout route that no longer uses `useOutletContext`
- TanStack Router `createLink(...)` wrappers for our React Aria link components
- removal of `react-router-dom` imports from `frontend/src`

## Bottom Line

This codebase is a good candidate for TanStack Router because the routing surface is moderate, there are no React Router data APIs to unwind, and the current route families map naturally to TanStack pathless layouts.

The migration should be treated as:

1. a router tree rewrite
2. a URL-state normalization pass
3. a small shared-shell refactor

It should **not** be treated as a TanStack Query migration unless you explicitly decide to combine the work.

## Reference Sources

- React Router Data Mode and `createBrowserRouter`: https://reactrouter.com/start/data/custom
- TanStack Router migration guide: https://tanstack.com/router/latest/docs/how-to/migrate-from-react-router
- TanStack Router data loading guide: https://tanstack.com/router/latest/docs/framework/react/guide/data-loading
- TanStack Router `Link` API: https://tanstack.com/router/latest/docs/api/router/linkComponent
- TanStack Router custom link guide: https://tanstack.com/router/latest/docs/framework/react/guide/custom-link
- TanStack Router `redirect` API: https://tanstack.com/router/v1/docs/api/router/redirectFunction
- TanStack Router `useMatches` API: https://tanstack.com/router/v1/docs/api/router/useMatchesHook
- React Aria client-side routing guide: https://react-spectrum.adobe.com/react-aria/routing.html
