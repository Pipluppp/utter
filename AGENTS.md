# Agent notes (repo working guide)

This repo is a voice cloning + TTS app. The active runtime is Cloudflare + Supabase with a simplified stack:
- Cloudflare Workers for frontend and API runtime
- Cloudflare R2 for object storage
- Cloudflare Queues for async processing (queue-first)
- Supabase for Postgres/Auth/RLS/credits/billing source-of-truth
- Qwen as the only active TTS provider

## Coding guidelines

Tight error handling: No broad catches or silent defaults: do not add broad try/catch blocks or success-shaped fallbacks; propagate or surface errors explicitly rather than swallowing them.


## Layout

- `frontend/`: React 19 + Vite + TypeScript + Tailwind v4 SPA
- `workers/frontend/`: Cloudflare frontend Worker (assets + SPA + `/api/*` proxy)
- `workers/api/`: Cloudflare API Worker (`/api/*`)
- `supabase/`: Postgres migrations, declarative schemas, SQL tests
- `supabase/schemas/`: Declarative DDL files (authoring source of truth for schema changes — see `supabase/schemas/README.md`)
- `docs/`: documentation (start with `docs/README.md`)

## Current deployed surfaces

- Frontend Worker: `https://uttervoice.com`
- Browser API surface: `https://uttervoice.com/api/*`
- API Worker public `workers.dev` route: disabled
- Supabase project: `utter-dev` (`jgmivviwockcwjkvpqra`)

## Local dev

Terminal 1 (Supabase local services):

```bash
supabase start
```

Terminal 2 (API Worker):

```bash
npm --prefix workers/api install
cp workers/api/.dev.vars.example workers/api/.dev.vars
npm --prefix workers/api run dev
```

Terminal 3 (Frontend):

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Queue/R2 local notes:
- Wrangler env keys like `vars` / `r2_buckets` / `queues` are non-inheritable.
- Local queue/R2 bindings are defined at top level in `workers/api/wrangler.toml`.
- Queue-backed local dev should run with `wrangler dev --local` (the default in `npm --prefix workers/api run dev`), not `--remote`.

## Frontend formatting + linting (Oxc)

Oxfmt + Oxlint are the formatter/linter for `frontend/src`:

- Verify: `npm --prefix frontend run check`
- Fix: `npm --prefix frontend run check:write`
- CI check: `npm --prefix frontend run ci`

Config lives at `frontend/.oxfmtrc.jsonc` and `frontend/.oxlintrc.json`. VS Code integration lives in `.vscode/`.

Avoid adding ESLint/Prettier unless explicitly requested; Oxc is the source of truth.

## Testing

```bash
# Database tests (pgTAP)
supabase test db

# Worker parity target (requires workers/api dev server)
npm run test:worker:local
```

## Docs pointers

- Project docs index: `docs/README.md`
- Architecture: `docs/architecture.md`
- Setup runbook: `docs/setup.md`
- Deploy runbook: `docs/deploy.md`
- API backend: `docs/backend.md`
- Database schema + RLS: `docs/database.md`

<!-- TANSTACK-QUERY-DOCS-START -->
[TanStack Query v5 React Docs]|root: ./.tanstack-query-docs|STOP. What you remember about TanStack Query APIs may be outdated. Always read the relevant section below before any task.|ALWAYS READ FIRST: react/guides:{important-defaults.md,queries.md,mutations.md,query-keys.md,query-functions.md},react/reference:{queryOptions.md,useQuery.md,useMutation.md,useQueryClient.md},core:{QueryClient.md}|BOOTSTRAP (QueryClient+Provider setup): react/reference:{QueryClientProvider.md},core:{MutationCache.md,QueryCache.md}|QUERY FACTORIES (key structure+invalidation scoping): react/guides:{query-options.md,query-invalidation.md,filters.md},react/reference:{infiniteQueryOptions.md,mutationOptions.md}|PAGINATED LISTS (Voices,History — keepPreviousData+placeholders): react/guides:{paginated-queries.md,placeholder-query-data.md,disabling-queries.md,background-fetching-indicators.md}|POLLING (History active gens,Tasks active items): react/guides:{window-focus-refetching.md,network-mode.md}|INFINITE SCROLL (Tasks cursor load-more): react/guides:{infinite-queries.md},react/reference:{useInfiniteQuery.md}|MUTATIONS (delete,favorite,rename,optimistic cache updates): react/guides:{invalidations-from-mutations.md,updates-from-mutation-responses.md,optimistic-updates.md},react/reference:{useMutationState.md}|TYPESCRIPT (inference,narrowing,no manual generics): react:{typescript.md}|SUSPENSE+SSR (future — not first-wave): react/guides:{suspense.md,ssr.md,advanced-ssr.md,prefetching.md},react/reference:{useSuspenseQuery.md,useSuspenseQueries.md,useSuspenseInfiniteQuery.md,usePrefetchQuery.md,usePrefetchInfiniteQuery.md,hydration.md,QueryErrorResetBoundary.md,useQueryErrorResetBoundary.md}|TESTING: react/guides:{testing.md}|PLUGINS (persistence,broadcast — not first-wave): react/plugins:{persistQueryClient.md,createAsyncStoragePersister.md,createSyncStoragePersister.md,createPersister.md,broadcastQueryClient.md}|ESLINT: eslint:{eslint-plugin-query.md,exhaustive-deps.md,infinite-query-property-order.md,mutation-property-order.md,no-rest-destructuring.md,no-unstable-deps.md,no-void-query-fn.md,stable-query-client.md}|REMAINING REFERENCE: react:{overview.md,installation.md,quick-start.md,comparison.md,devtools.md,graphql.md,react-native.md},react/guides:{default-query-function.md,dependent-queries.md,initial-query-data.md,parallel-queries.md,query-cancellation.md,query-retries.md,render-optimizations.md,request-waterfalls.md,scroll-restoration.md,caching.md,does-this-replace-client-state.md,migrating-to-v5.md,migrating-to-react-query-4.md,migrating-to-react-query-3.md},core:{QueryObserver.md,InfiniteQueryObserver.md,QueriesObserver.md,QueryCache.md,focusManager.md,onlineManager.md,notifyManager.md,environmentManager.md,timeoutManager.md,streamedQuery.md},react/reference:{useQueries.md,useIsFetching.md,useIsMutating.md}
<!-- TANSTACK-QUERY-DOCS-END -->
