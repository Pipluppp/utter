# Signed Surface Hardening Plan

Date: 2026-03-19
Status: Planned
Scope: residual public bearer/token surfaces after API Worker privatization

## Goal

Review and tighten the remaining public-by-design surfaces so they are:

- intentionally exposed
- short-lived where possible
- documented clearly
- not broader than needed

## Why This Work Exists

Current design includes signed bearer-style URLs for storage flows.

Those are reasonable, but they have properties that matter operationally:

- anyone with the URL can use it until expiry
- upload tokens are replayable until expiry
- some download URLs are fairly long-lived

Separately, Cloudflare Preview URLs remain a separate exposure question even after `workers.dev` is disabled.

## Decision Summary

We will:

1. Inventory every signed upload/download URL creation point
2. Review TTL choices per route
3. Decide whether upload URLs should stay replayable-until-expiry or become single-use
4. Document Preview URL posture and, if feasible, disable or constrain it in a separate verified step

We will not, in this workstream:

- redesign storage architecture away from R2-backed signed URLs
- replace signed URLs with authenticated streaming through the API for every media path
- bundle Preview URL work into API Worker privatization without explicit review

## Implementation Steps

### Step 1: Inventory signed surface entry points

Review:

- signed upload URL creation
- signed download URL creation
- route-specific TTL values
- where direct redirects are returned to the browser

Expected files include:

- `workers/api/src/_shared/storage.ts`
- `workers/api/src/routes/storage.ts`
- `workers/api/src/routes/clone.ts`
- `workers/api/src/routes/generations.ts`
- `workers/api/src/routes/voices.ts`
- `workers/api/src/routes/tasks.ts`

### Step 2: Tune signed URL TTLs

Review current lifetimes and reduce where UX allows.

Default direction:

- upload URLs: shorten if practical
- download URLs: keep only as long as needed for the immediate user flow

Do not shorten blindly if it breaks:

- long audio downloads
- retry UX
- task completion polling flows

### Step 3: Decide on single-use upload tokens

Current tradeoff:

- replayable-until-expiry is simple
- single-use is stricter but adds server-side state and consumption logic

Recommended approach:

- evaluate single-use only for upload paths, not all download paths
- stop at a clear decision if complexity is not justified yet

Manual interruption:

- pause if the design choice between replayable-short-TTL and single-use needs product/engineering approval

### Step 4: Review Preview URL posture

Treat Preview URLs as a separate Cloudflare surface review.

Implementation task here is to:

- verify whether Preview URLs are enabled or relied on
- document the current posture
- disable them only if the required setting/mechanism is confirmed during execution

Manual interruption:

- pause before changing any Cloudflare Preview URL-related setting if repo context alone cannot prove the impact

### Step 5: Update docs and operator guidance

Document:

- which surfaces remain public by design
- their TTLs
- how to reason about bearer-token leakage risk
- any manual Cloudflare setting needed for Preview URLs

## Verification Plan

Success looks like:

- signed URL lifetimes are intentionally chosen and documented
- upload-token replay posture is explicitly accepted or improved
- Preview URL posture is documented and no longer ambiguous

Checks:

- normal upload/download flows still work
- shortened TTLs do not break core UX
- docs clearly distinguish:
  - private API path
  - tokenized public storage path
  - any remaining Cloudflare preview surface

## Rollback Plan

If TTL shortening breaks user flows:

1. restore the previous TTL values
2. keep the docs improvements

If Preview URL changes break a relied-on developer workflow:

1. revert only the Preview URL change
2. leave signed URL hardening intact

## Manual Dashboard / UI Notes

Expected user-interrupted steps:

1. any Cloudflare dashboard step related to Preview URLs
2. any explicit product decision on single-use upload tokens versus short-lived replayable tokens

## Fresh-Chat Context

A fresh implementation chat should know:

- this workstream is intentionally smaller than API privatization and rate-limit hardening
- not every public surface is a bug; some are signed/bearer surfaces by design
- the task is to tighten and document them, not to remove them indiscriminately
