# Cloudflare Supabase Auth Proxy Plan

Date: 2026-03-19
Status: Planned
Scope: Replace direct browser Supabase Auth usage with a Cloudflare Worker-mediated auth flow

## Goal

Move Supabase Auth off the direct browser path so that:

- the deployed browser app no longer ships the Supabase project URL
- the deployed browser app no longer ships the Supabase publishable key
- browser Auth network traffic goes to `uttervoice.com/api/auth/*`, not `*.supabase.co`
- the app uses same-domain cookie-backed auth state that Workers can enforce and forward internally

## Why This Work Exists

Verified current state:

- frontend directly uses `supabase-js`
- signup/sign-in/session/sign-out requests go from browser to `jgmivviwockcwjkvpqra.supabase.co`
- browser bundle contains the project URL and publishable key
- app data requests are already mostly Worker-proxied, but Auth is not

This means the current proxy architecture is incomplete for the user goal of removing browser-visible Supabase metadata and direct Auth surface.

## Decision Summary

We will plan for:

1. Replacing browser `supabase-js` Auth usage with Worker-owned auth endpoints
2. Using same-domain cookies for session continuity
3. Reading auth state in the API Worker from cookies or Worker-managed session material, not browser-managed Supabase local storage
4. Updating frontend auth state management to use your own `/api/auth/*` endpoints
5. Preserving CAPTCHA / Turnstile and email redirect behavior
6. Ensuring Cloudflare responses that set auth cookies are never cached

We will not, in this workstream:

- expose `service_role` to the browser
- keep the browser Supabase client as a fallback
- treat this as a small configuration-only change

## Architecture Change

### Current

1. browser creates Supabase client
2. browser calls `*.supabase.co/auth/v1/*`
3. browser stores/manages session via Supabase client storage
4. browser calls `uttervoice.com/api/*` with bearer token

### Desired

1. browser calls `uttervoice.com/api/auth/*`
2. frontend Worker / API Worker calls Supabase Auth server-side
3. Worker sets same-domain session cookies
4. browser calls `uttervoice.com/api/*` using cookie-backed session
5. API Worker resolves the user from cookie-backed auth state

## Key Design Implications

### 1. This is more than proxying signup/signin

If the browser no longer owns the Supabase session, the implementation must also solve:

- session refresh
- current-user resolution
- sign-out
- auth callback handling
- API route authentication without browser `Authorization` headers

### 2. Cookie auth becomes a first-class security concern

Once auth is cookie-based, state-changing routes need CSRF thinking.

At minimum, evaluate and likely implement:

- strict same-site cookie policy where compatible
- origin checks for sensitive auth and app write routes
- explicit no-cache / no-store on auth routes and any response that sets cookies

### 3. Cloudflare caching must be treated carefully

Supabase's server-side auth docs explicitly warn about caching responses that contain `Set-Cookie`.

For this repo, auth routes on Workers must:

- return `Cache-Control: no-store`
- avoid accidental CDN caching
- be reviewed carefully anywhere a refreshed session is written back

## Recommended Implementation Phases

### Phase 1: Decide session model

Choose one concrete session model before coding:

- Worker-managed cookies that store the Supabase session material directly, or
- Worker-managed server session with opaque session ID and server-side session store

Default recommendation:

- start with same-domain cookie-based session material, because it aligns better with Supabase's server-side session model and avoids introducing a new persistence layer immediately

Open caution:

- if tokens are stored in cookies instead of local storage, the refresh path and cookie security attributes must be handled deliberately

### Phase 2: Add dedicated auth endpoints

Expected route family:

- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`
- `POST /api/auth/magic-link`
- `POST /api/auth/sign-out`
- `GET /api/auth/session`
- `POST /api/auth/refresh`
- callback/verification route(s) as required by email auth flow

These routes should:

- call Supabase Auth server-side
- relay CAPTCHA token where needed
- set and clear cookies on `uttervoice.com`
- never expose Supabase project metadata back to the browser unless unavoidable

### Phase 3: Add API Worker auth-from-cookie support

Current API Worker auth assumes browser bearer tokens.

That must be extended or replaced so protected `/api/*` routes can authenticate from the Worker-owned cookie/session model.

Review:

- `workers/api/src/_shared/supabase.ts`
- existing `Authorization`-header assumptions
- any route helpers that call `requireUser()`

### Phase 4: Replace frontend auth client code

Frontend changes should remove direct `supabase-js` Auth usage from:

- `frontend/src/lib/supabase.ts`
- `frontend/src/pages/Auth.tsx`
- `frontend/src/app/auth/AuthStateProvider.tsx`
- `frontend/src/pages/account/accountData.ts`

Expected direction:

- auth page posts to your own `/api/auth/*`
- auth state provider uses your own `/api/auth/session`
- sign-out uses your own `/api/auth/sign-out`
- frontend no longer ships `VITE_SUPABASE_URL` or publishable key

### Phase 5: Update app API auth transport

Current `frontend/src/lib/api.ts` injects bearer tokens from the browser-side Supabase session.

After the auth proxy change:

- same-origin `/api/*` requests should rely on cookies
- browser auth-header injection logic should be removed or simplified
- API Worker should trust cookie-backed auth resolution instead of browser JS access tokens

### Phase 6: Verify no browser-visible Supabase client remains

Success means:

- no `VITE_SUPABASE_URL` in shipped browser bundle
- no publishable key in shipped browser bundle
- signup/sign-in/session/sign-out requests are visible only on `uttervoice.com`
- no direct browser `*.supabase.co/auth/v1/*` requests remain during normal auth flows

## Manual Dashboard / UI Notes

Expected user-interrupted steps:

1. Supabase dashboard review of redirect URLs if callback endpoints change
2. Supabase dashboard verification of CAPTCHA / Turnstile still matching the new Worker-auth flow
3. Cloudflare verification that auth routes are not cached and are behaving correctly with `Set-Cookie`

## Verification Plan

Browser checks:

- DevTools network during sign-up shows `uttervoice.com/api/auth/...`, not `*.supabase.co/auth/v1/*`
- deployed browser sources no longer contain the Supabase project URL
- deployed browser sources no longer contain the publishable key

App behavior checks:

- sign-up works
- sign-in works
- magic link works if still supported
- sign-out works
- session refresh works after page reload
- authenticated `/api/*` requests still succeed

Security checks:

- cookie-setting responses are `no-store`
- write routes are reviewed for CSRF implications
- no server secret leaks into frontend bundle

## Rollback Plan

If the new cookie-backed auth path is unstable:

1. revert frontend auth to the direct Supabase browser client
2. keep the research docs and route skeleton if already landed
3. restore the existing bearer-token path in `frontend/src/lib/api.ts`

## Risks And Complexity

This is a meaningful auth architecture change, not a cosmetic cleanup.

Main complexity areas:

- replacing browser-managed session storage
- reworking API auth from bearer-token to cookie/session-based auth
- handling refresh and sign-out correctly
- ensuring no caching of auth cookie responses
- preserving CAPTCHA and redirect-based email flows

The user goal is achievable, but it requires deliberate auth/session design and should not be treated as a small refactor.

## Fresh-Chat Context

A fresh implementation chat should know:

- the goal is specifically to remove browser-visible Supabase URL + publishable key exposure
- `/api/*` app data calls are already Worker-proxied
- the remaining direct browser exposure is Supabase Auth
- success requires removing direct frontend `supabase-js` Auth usage, not just adding more proxying around existing code

