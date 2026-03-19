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
| `execution-prompt.md` | Kickstart prompt for implementation in a fresh chat |

## Manual Touchpoints

This workstream may require a user pause for:

- Cloudflare dashboard review of Preview URL behavior/options
- product decisions on shorter TTLs or single-use upload-token complexity
