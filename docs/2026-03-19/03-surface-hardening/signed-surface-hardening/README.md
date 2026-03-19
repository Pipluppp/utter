# Signed Surface Hardening

Review and tighten the remaining bearer-style public surfaces after API Worker privatization, especially signed storage URLs and the Preview URL follow-up.

## Context

Removing the public `workers.dev` API bypass does not remove every public surface.

Some surfaces remain public by design:

- signed storage upload URLs
- signed storage download URLs
- possible Cloudflare Preview URLs

These are not automatically unsafe, but they should be deliberately tuned and documented.

## Goal

Reduce residual public exposure by:

- reviewing signed URL TTL and replay posture
- deciding whether single-use upload tokens are worth the complexity
- documenting and, if appropriate, disabling Preview URLs in a follow-up

## Files

| File | Purpose |
|---|---|
| `signed-surface-hardening-plan.md` | Implementation plan and decision points |

## Manual Touchpoints

This workstream may require a user pause for:

- Cloudflare dashboard review of Preview URL behavior/options
- product decisions on shorter TTLs or single-use upload-token complexity

## Execution Prompt

```
Implement the signed-surface hardening plan in this directory.

Objective:

- Review and tighten residual public bearer/token surfaces after API Worker privatization

Required reading before changes:

1. `docs/2026-03-19/03-surface-hardening/signed-surface-hardening/README.md`
2. `docs/2026-03-19/03-surface-hardening/signed-surface-hardening/signed-surface-hardening-plan.md`
3. `workers/api/src/_shared/storage.ts`
4. `workers/api/src/routes/storage.ts`
5. `workers/api/src/routes/clone.ts`
6. `workers/api/src/routes/generations.ts`
7. `workers/api/src/routes/voices.ts`
8. `workers/api/src/routes/tasks.ts`
9. `docs/2026-03-19/01-api-worker-privatization/api-worker-privatization-plan.md`

Implementation requirements:

1. Inventory signed URL creation points and current TTLs.
2. Propose or implement tighter TTLs where safe.
3. Evaluate whether single-use upload tokens are justified.
4. Review Preview URL posture and document any remaining manual Cloudflare step.
5. Do not break the main upload/download/generation flows.

Manual interruption points:

1. Pause before any Cloudflare dashboard change related to Preview URLs.
2. Pause if choosing between replayable-short-TTL and single-use upload tokens needs a product or risk decision.

Deliverables:

1. Repo/doc updates
2. Summary of residual public bearer surfaces
3. Any TTL changes made
4. Any remaining manual Cloudflare step or explicit design decision still needed
```
