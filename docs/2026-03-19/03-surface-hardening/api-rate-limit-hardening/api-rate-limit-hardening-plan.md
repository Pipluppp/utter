# API Rate-Limit Hardening Plan

Date: 2026-03-19
Status: Planned
Scope: API abuse-control path in `workers/api`

## Goal

Keep the existing Supabase-backed limiter, but change its role from:

- first-line abuse gate

to:

- durable, application-aware limiter behind cheaper Cloudflare and Worker-native gates

## Why This Work Exists

Current state:

- most `/api/*` requests hit the Supabase RPC limiter before route logic
- protected routes then often perform an additional Supabase auth lookup
- current rate-limit identity is IP-only in practice
- current IP extraction trusts `x-forwarded-for` first
- no explicit counter retention/cleanup path was found in repo migrations

This is acceptable for business semantics, but inefficient for volumetric abuse.

## Decision Summary

We will:

1. Add a very early Worker-native coarse limiter for `/api/*`
2. Keep the Supabase RPC limiter, but reposition it as the durable business limiter
3. Fix IP trust order to prefer `cf-connecting-ip`
4. Use verified user identity for user-scoped limiting where auth already exists
5. Add a retention path for `rate_limit_counters`
6. Expand tests around identity, limiter layering, and 429 behavior

We will not, in this workstream:

- remove the Supabase RPC limiter
- move all limiting into Cloudflare only
- redesign credits or billing rules
- proxy Supabase Auth through the Worker

## Recommended Architecture

Desired order for hosted API traffic:

1. `uttervoice.com` zone protections
2. frontend Worker
3. API Worker coarse limiter
4. auth resolution where needed
5. Supabase RPC durable limiter
6. route logic

This gives:

- cheap outer rejection for noisy traffic
- durable app-aware enforcement for authenticated and business-sensitive traffic

## Implementation Steps

### Step 1: Add a Worker-native coarse limiter

Target:

- a coarse per-IP limiter for `/api/*`
- runs before any Supabase RPC

Recommended implementation:

- use Cloudflare Workers Rate Limiting bindings in `workers/api/wrangler.toml`
- choose unique account-wide `namespace_id` values
- define at least one coarse limiter for hosted API traffic

Notes:

- this limiter is intentionally coarse and IP-based
- it is not the business/account limiter
- tune it to catch bursts, not legitimate product usage

Manual interruption:

- if unique namespace IDs cannot be chosen confidently from repo context, stop and ask the user to confirm the IDs or verify them in Cloudflare

### Step 2: Insert early coarse-limiter middleware

Add middleware in `workers/api/src/index.ts` before the Supabase RPC middleware:

- resolve the client IP using trusted header order
- run the coarse limiter
- return `429` immediately on denial

The coarse limiter should cover:

- all `/api/*` except `OPTIONS`
- possibly exempt `/api/health`

### Step 3: Fix IP trust order

Update client IP extraction so it prefers:

1. `cf-connecting-ip`
2. `x-forwarded-for` only as fallback
3. any last-resort local/dev fallback

Reason:

- Cloudflare is the trusted edge in hosted traffic
- current `x-forwarded-for` first behavior is weaker than necessary

### Step 4: Split coarse IP limiting from durable business limiting

Keep the existing Supabase RPC limiter, but refactor its role:

- public/anonymous routes: IP-based durable limiter remains acceptable
- protected routes: use verified user identity after auth where practical

Recommended implementation direction:

- add shared auth-context middleware for protected route groups or a cached per-request auth helper
- avoid repeating `requireUser()` multiple times once a verified user is already available
- feed verified `user.id` into the durable limiter for protected routes

This preserves the value of the Supabase limiter:

- durability
- centralization
- consistent app-level 429 behavior
- future tier-by-account logic

### Step 5: Add retention for `rate_limit_counters`

No cleanup path was found in repo migrations.

Add a retention mechanism so old fixed-window rows do not accumulate forever.

Recommended options, in order:

1. `pg_cron` cleanup job in Supabase if available in the project
2. scheduled Cloudflare Worker cleanup path if `pg_cron` is unavailable
3. explicit operator runbook if automation is temporarily blocked

Default retention recommendation:

- keep only a short operational window, for example 7 to 14 days, unless analytics requirements need more

Manual interruption:

- if the project does not already use `pg_cron`, stop and ask the user before introducing a new scheduling mechanism

### Step 6: Expand tests

Add or update tests for:

- coarse limiter executes before Supabase RPC path
- `cf-connecting-ip` precedence over `x-forwarded-for`
- protected-route limiter can key on verified user identity
- old IP-only fallback still works where auth is absent
- 429 responses still include stable contract fields

## Verification Plan

Success criteria:

- bursty anonymous traffic can be rejected without a Supabase RPC
- protected routes still receive durable 429 behavior when business limits are exceeded
- rate-limit identity is no longer `x-forwarded-for` first
- old counter rows are not left to grow forever

Hosted checks:

- normal `uttervoice.com/api/*` flows still work
- repeated burst traffic gets rejected before the current Supabase limiter path

Repo checks:

- `workers/api/wrangler.toml` contains the binding config
- `workers/api/src/index.ts` shows coarse limiter before admin RPC
- `workers/api/src/_shared/rate_limit.ts` uses trusted header order

## Rollback Plan

If the coarse limiter causes false positives:

1. reduce threshold and redeploy, or
2. temporarily remove the coarse middleware while leaving the Supabase durable limiter in place

If the durable limiter refactor causes auth-context issues:

1. revert only the user-aware durable-limiter change
2. keep the new coarse outer limiter if stable

## Manual Dashboard / UI Notes

Potential manual steps:

- Cloudflare account verification of chosen rate-limit `namespace_id` values
- optional review of existing branded-domain dashboard rate-limit rules before final threshold tuning

Supabase manual step only if retention uses `pg_cron` or another DB-level scheduler not already present.

## Fresh-Chat Context

A fresh implementation chat should know:

- API Worker privatization is the adjacent workstream and is preferred first
- Supabase limiter is to be kept, not deleted
- this task is about layering and identity correctness, not replacing Supabase with Cloudflare entirely
