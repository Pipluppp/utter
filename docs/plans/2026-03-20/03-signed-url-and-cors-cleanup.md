# 03 — Signed URL & CORS Cleanup

Priority: MEDIUM
Status: Planned
Scope: Review signed URL TTLs, clean up legacy CORS origins and Vercel rewrite

## Context

Storage uses custom HMAC-signed tokens (not R2 presigned URLs) that route back through the Worker's `/api/storage/upload` and `/api/storage/download`. R2 buckets are never directly exposed. Token format: `base64url(payload).base64url(hmac_sha256)` with expiry in payload.

## TTL Inventory (2026-03-20)

| Route | File | Bucket | Action | TTL |
|---|---|---|---|---|
| Upload URL | `_shared/storage.ts:370` | any | upload | 900s (15 min) |
| Clone finalize | `routes/clone.ts:241` | references | download | 600s (10 min) |
| Design preview | `routes/design.ts:566,649` | references | download | 3600s (1 hour) |
| Voice reference | `routes/voices.ts:109` | references | download | 3600s (1 hour) |
| Generation audio | `routes/generations.ts:112` | generations | download | 3600s (1 hour) |
| Task result | `routes/tasks.ts:344` | references | download | 3600s (1 hour) |

## CORS Finding

`wrangler.toml` production CORS_ALLOWED_ORIGIN has legacy origins:
- `https://uttervoice.com` — intended
- `https://utter.duncanb013.workers.dev` — legacy, likely removable
- `https://utter-wheat.vercel.app` — legacy Vercel deployment, likely removable

## Legacy Vercel Rewrite

`frontend/vercel.json` still has:
```json
{ "source": "/api/:path*", "destination": "https://jgmivviwockcwjkvpqra.supabase.co/functions/v1/api/:path*" }
```
Unused in production (traffic goes through Cloudflare Worker). Leaks Supabase project URL in repo.

## Steps

### Step 1: Evaluate download TTL reduction

Consider reducing from 3600s:
- **300s (5 min)** for design previews — played immediately
- **600s (10 min)** for voice reference and generation audio
- **Keep 3600s** for task results — polling flows may have delays

Don't shorten if it breaks in-progress playback or polling flows.

### Step 2: Upload token replay — accept as-is

Upload tokens are replayable for 900s but scoped to a specific `bucket + key` (includes user ID prefix). Risk is low. Single-use adds state complexity not justified by the threat.

### Step 3: Remove legacy CORS origins

Confirm with user, then remove from `wrangler.toml`:
- **Staging** (line 41): remove `https://utter.duncanb013.workers.dev`
- **Production** (line 53): remove `https://utter.duncanb013.workers.dev` and `https://utter-wheat.vercel.app`

### Step 4: Remove legacy Vercel rewrite

Remove the Supabase rewrite from `frontend/vercel.json`. Keep the SPA fallback rewrite.

### Step 5: Document signed URL scheme

Update `docs/backend.md` or `docs/architecture.md` with:
- HMAC token scheme (not R2 presigned)
- R2 buckets never directly exposed
- TTL values per route
- Token replay posture and rationale

## Verification

- Clone upload flow still works
- Audio playback works (design preview, voice reference, generation)
- CORS preflight succeeds from `uttervoice.com` only
- Removed origins get CORS rejection

## Rollback

- TTL too short → restore previous values
- CORS removal breaks something → re-add the origin, investigate

## Manual Steps

- Confirm legacy CORS origins can be removed before changing
- TTL shortening may need product input
