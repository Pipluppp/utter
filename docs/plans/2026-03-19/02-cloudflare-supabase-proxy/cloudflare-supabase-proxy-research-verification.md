# Cloudflare Supabase Proxy Research Verification

Date: 2026-03-19
Status: Verified
Scope: Browser-visible Supabase exposure versus Worker-proxied API paths

## Verified Conclusion

Current state is split:

- browser Auth flows still call Supabase directly
- normal app `/api/*` data flows already go through `uttervoice.com` -> frontend Worker -> API Worker

That means:

- the deployed browser bundle and network traffic still expose the Supabase project URL and publishable key today
- moving app data calls behind Workers did not remove direct browser exposure for Auth
- direct invocation of the Supabase HTTPS APIs remains possible wherever the browser has the project URL and publishable key

This document intentionally focuses on invokability and exposure, not whether RLS currently prevents data leaks.

## Repo Ground Truth

### Direct frontend -> Supabase

The frontend creates a Supabase browser client with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` / current publishable key value

Source:

- `frontend/src/lib/supabase.ts`

Current direct frontend Auth call sites:

- `frontend/src/pages/Auth.tsx`
  - `signInWithPassword`
  - `signUp`
  - `signInWithOtp`
- `frontend/src/app/auth/AuthStateProvider.tsx`
  - `getSession`
  - `getUser`
  - `onAuthStateChange`
- `frontend/src/pages/account/accountData.ts`
  - `getUser`
  - `signOut`

### Frontend -> Worker -> API Worker

Normal app data calls use:

- `frontend/src/lib/api.ts`

The frontend Worker proxies `/api/*` through:

- `workers/frontend/src/index.ts`

Current hosted request path for app API traffic:

1. browser -> `https://uttervoice.com/api/*`
2. frontend Worker
3. internal service binding to API Worker
4. API Worker
5. Supabase server-side access

This path does not require the browser to call Supabase Data APIs directly for normal app operations.

## Live Browser Evidence

Observed in the deployed app during signup on 2026-03-19:

- request URL:
  - `https://jgmivviwockcwjkvpqra.supabase.co/auth/v1/signup?...`
- request headers included:
  - `apikey: sb_publishable_...`
  - `authorization: Bearer sb_publishable_...`
- response headers included:
  - `sb-project-ref: jgmivviwockcwjkvpqra`

Observed in the deployed frontend bundle:

- minified client code contains the literal Supabase project URL
- minified client code contains the literal publishable key
- the browser bundle instantiates a Supabase client directly

Interpretation:

- the browser can currently recover both the project URL and publishable key
- this is expected in the present architecture
- the current Cloudflare Worker `/api/*` proxy does not remove that browser-side exposure because Auth still bypasses it

## Supabase Data API Table Matrix

The matrix below answers:

"With the current deployed publishable key in the browser, which table endpoints on `jgmivviwockcwjkvpqra.supabase.co` are directly invokable?"

Live result definitions:

- `200` means the table endpoint is directly invokable with the publishable key and current role context
- `401` means the caller lacks table privilege even before row-return behavior matters

Test shape used:

- `GET /rest/v1/{table}?select=id&limit=1`
- headers:
  - `apikey: <publishable key>`
  - `Authorization: Bearer <publishable key>`

| Table | Live result | Meaning |
|---|---:|---|
| `profiles` | `200` | Directly invokable with publishable key |
| `voices` | `200` | Directly invokable with publishable key |
| `generations` | `200` | Directly invokable with publishable key |
| `tasks` | `200` | Directly invokable with publishable key |
| `rate_limit_counters` | `401` | Not readable by public browser key |
| `credit_ledger` | `401` | Not readable by public browser key |
| `trial_consumption` | `401` | Not readable by public browser key |
| `billing_events` | `401` | Not readable by public browser key |

Important interpretation:

- `200` here does not mean "data leaked"
- it does mean "request reached Supabase and this table endpoint is callable with the browser-visible key"
- the issue being documented is invokability and potential request load, not just data exposure

## Supabase RPC Matrix

Live result definitions:

- `400` means the RPC route is reachable, but the supplied payload shape does not satisfy the function signature or request shape
- this is still evidence that the route is publicly reachable enough to be attempted

Tested RPC routes with typed JSON payload attempts:

| RPC | Live result |
|---|---:|
| `increment_task_modal_poll_count` | `400` |
| `rate_limit_check_and_increment` | `400` |
| `credit_apply_event` | `400` |
| `credit_usage_window_totals` | `400` |
| `trial_or_debit` | `400` |
| `trial_restore` | `400` |

One explicit probe also returned `404 PGRST202` when the RPC request shape did not match a cached signature lookup for parameterless invocation.

Interpretation:

- the public HTTP surface can still be probed
- grants in repo tests indicate `anon` and `authenticated` should not have execute rights on these functions
- the important point for this workstream is that outsiders can still send traffic to the public Supabase HTTP surface

## What `/api/*` Already Fixes

The current Worker API path already avoids direct browser -> Supabase Data API calls for normal app operations.

This is already good:

- browser app data operations target `uttervoice.com/api/*`
- Cloudflare sits in front of those requests
- browser requests to `/api/*` do not need to expose the Supabase project URL or publishable key

So for app data operations, the Cloudflare proxy already helps.

## What `/api/*` Does Not Fix Yet

It does not fix browser Auth exposure.

Because the frontend still instantiates `supabase-js` directly:

- signup
- sign-in
- magic link
- session checks
- sign-out

still go browser -> `jgmivviwockcwjkvpqra.supabase.co`

That is why the project URL and publishable key are still visible in:

- deployed browser network requests
- deployed browser bundle code

## Evaluation

### What is already true

- app data calls are mostly on the Cloudflare Worker path already
- browser Auth is still on the direct Supabase path
- the browser can recover the project URL and publishable key
- direct table endpoint invocation is still possible for at least the user-scoped public-schema tables

### What this means

The current proxy architecture is partial:

- it protects the app API path
- it does not yet remove browser-visible Supabase Auth or public-key exposure

### What would materially change the picture

To remove the Supabase project URL and publishable key from the deployed browser app, Auth must move behind your own Cloudflare Worker path.

That means:

- browser stops creating a Supabase client directly
- browser Auth calls go to your own `uttervoice.com/api/auth/*`
- Worker talks to Supabase Auth server-side
- browser session becomes cookie-driven on your own domain instead of browser-managed Supabase local storage

## Official Source Notes

Supabase docs still say:

- publishable / anon keys are intended for public client-side use
- security comes from RLS and policy design
- SSR/server-side auth uses cookies and requires careful caching behavior

Relevant official docs:

- https://supabase.com/docs/guides/api/api-keys
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://supabase.com/docs/guides/auth/passwords

These docs validate that the current browser-visible project URL and publishable key are normal for the standard client-side model. This workstream exists because the product decision is to move away from that model for stronger perimeter control and less browser-visible Supabase metadata.

