# Supabase Direct Surface Hardening Plan

Date: 2026-03-19
Status: Planned
Scope: Direct browser and public HTTPS traffic to Supabase-hosted endpoints

## Goal

Harden the parts of the system that can still be called directly on `*.supabase.co`, independent of your Cloudflare Worker path.

## Why This Work Exists

Current repo facts:

- frontend auth uses `@supabase/supabase-js` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- sign-in/sign-up/magic link go directly to Supabase Auth
- app API traffic primarily goes through your own `/api/*`

This means Cloudflare Worker hardening does not fully cover:

- `/auth/v1/*`
- any still-exposed Data API usage on `/rest/v1/*` or `/rpc/*`
- any other direct Supabase HTTPS API you intentionally leave public

## Decision Summary

We will:

1. Treat Supabase Auth as its own direct surface with Supabase-native protections
2. Verify and tune Auth rate limits
3. Verify CAPTCHA / Turnstile configuration matches the frontend integration already in code
4. Review Data API posture so anon/public exposure is only what the architecture actually needs
5. Document network restrictions correctly as database/pooler protection, not HTTPS API protection

We will not, in this workstream:

- proxy all Supabase Auth through Cloudflare Workers
- change OAuth architecture
- replace Supabase Auth with custom auth
- disable the Data API if Worker code still depends on it

## Official Source Notes

Relevant docs to use during implementation:

- Supabase Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Supabase CAPTCHA / Turnstile: https://supabase.com/docs/guides/auth/auth-captcha
- API keys and anon/public exposure model: https://supabase.com/docs/guides/api/api-keys
- Securing the Data API / `db_pre_request`: https://supabase.com/docs/guides/api/securing-your-api
- Network restrictions: https://supabase.com/docs/guides/platform/network-restrictions

## Implementation Steps

### Step 1: Inventory direct Supabase traffic in the frontend

Confirm from code what still talks directly to Supabase:

- auth session lookup
- sign-in
- sign-up
- magic link
- sign-out

Expected conclusion:

- Auth is direct
- app data/actions are mostly not direct

### Step 2: Verify Auth CAPTCHA / Turnstile end to end

The frontend already provides `captchaToken` in auth flows.

Verify Supabase dashboard settings match that code:

- CAPTCHA protection enabled
- provider set correctly
- secret key set correctly
- target auth flows covered

Manual interruption:

- stop for the user if the dashboard settings are missing, unclear, or require key rotation / secret entry

### Step 3: Review and tune Supabase Auth rate limits

Use the Supabase dashboard or Management API to inspect current auth rate-limit values.

Tune as needed for:

- password sign-in
- sign-up
- magic link / OTP
- password reset if relevant

Goal:

- make direct auth abuse expensive for attackers without causing normal-user friction

Manual interruption:

- pause before changing live auth rate-limit settings if the desired values are not already agreed

### Step 4: Review direct Data API posture

Because your Workers use `supabase-js` `.from()` and `.rpc()`, the Data API is still part of your current server architecture.

That means this work is not “turn it off.”

Instead, verify:

- exposed schemas are intentional
- anon/public role access is minimal
- sensitive RPCs remain uncallable by `anon` and `authenticated` where intended
- RLS is in place for every user-facing table

Use existing repo evidence plus Supabase dashboard/API review where needed.

### Step 5: Decide whether `db_pre_request` is needed

Do not default to adding `db_pre_request`.

Reason:

- it only applies to the Data API
- it does not protect Auth, Storage, or Realtime
- your current Worker-mediated server traffic would also traverse it

Use it only if you identify a real direct Data API exposure gap that RLS/grants do not already solve.

### Step 6: Document network restrictions correctly

Ensure docs and implementation notes do not treat Supabase network restrictions as protection for Auth/Data API HTTPS traffic.

They are for:

- direct Postgres connections
- pooled database connections

They are not the primary answer for:

- `/auth/v1/*`
- `/rest/v1/*`
- `/storage/v1/*`

## Verification Plan

Success looks like:

- direct auth flows still work
- CAPTCHA/Turnstile is verified active
- current auth rate-limit settings are known and documented
- direct Data API exposure has been reviewed intentionally
- no misleading guidance remains about network restrictions covering HTTPS APIs

Suggested checks:

- browser sign-in/sign-up still function
- bad/no CAPTCHA token fails when expected
- Management API or dashboard confirms auth rate-limit values
- `supa-sniffer`/outside-in checks remain clean for direct data exposure

## Rollback Plan

If auth changes become too aggressive:

1. revert only the tuned rate-limit values
2. keep CAPTCHA enabled unless it clearly breaks legitimate flow

If a Data API hardening change breaks Worker server traffic:

1. revert the schema/grant exposure change
2. confirm server-side `.from()` / `.rpc()` paths recover

## Manual Dashboard / UI Notes

Expected user-interrupted steps:

1. Supabase Dashboard review of Auth CAPTCHA / Turnstile
2. Supabase Dashboard or Management API review/change of Auth rate limits
3. Any settings that require the user to confirm live production values before changing them

## Fresh-Chat Context

A fresh implementation chat should know:

- this task is about direct Supabase-hosted surfaces, not your Cloudflare `/api/*`
- frontend auth already uses direct Supabase client calls
- the code already sends CAPTCHA tokens; this work verifies and tunes the server-side side of that setup
