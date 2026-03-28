# Polar.sh Research Plan

Date: 2026-03-29 (moved from 2026-03-22)
Status: Planned
Scope: Evaluate Polar.sh as a billing provider alternative to Stripe

## Goal

Determine whether Polar.sh is a better fit than Stripe for Utter's credit-pack billing model, considering simplicity, developer experience, and operational overhead.

## Current Stripe Implementation (for comparison)

The repo already has:

- `POST /api/billing/checkout` — creates a Stripe Checkout Session
- `POST /api/webhooks/stripe` — processes `checkout.session.completed`, grants credits
- `billing_events` table — event persistence and deduplication
- `credit_ledger` table — credit grants with idempotency
- Two prepaid packs: `pack_30k` ($2.99, 30k credits) and `pack_120k` ($9.99, 120k credits)
- Worker secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PACK_*`

## Research Questions

### Core fit

1. Does Polar.sh support one-time purchases (not just subscriptions)?
2. Can it model prepaid credit packs with custom metadata (user_id, pack_id)?
3. Does it support webhooks for fulfillment (equivalent to Stripe's `checkout.session.completed`)?
4. Is webhook delivery reliable, with retries and signature verification?

### Developer experience

5. How does the SDK/API compare to Stripe in complexity?
6. Is there a sandbox/test mode for development?
7. How does local webhook testing work (equivalent to `stripe listen --forward-to`)?
8. What does checkout integration look like — hosted page, embedded, or API-only?

### Operational

9. What are the fees (percentage + fixed per transaction)?
10. How does payout work?
11. What currencies are supported?
12. Is there a dashboard for managing products, viewing events, debugging webhooks?

### Migration considerations

13. How much of the current Stripe code would need to change?
14. Can the same `billing_events` + `credit_ledger` pattern work with Polar webhooks?
15. Are there any limitations that would block the current billing model?

## Research Method

1. Read Polar.sh documentation (API, webhooks, products, checkout)
2. Check for one-time purchase support specifically
3. Compare webhook model to Stripe's
4. Evaluate SDK availability for TypeScript/Workers environment
5. Check sandbox/test mode capabilities
6. Estimate migration effort if switching from Stripe

## Decision Criteria

Choose Polar.sh over Stripe if:

- It supports the credit-pack model (one-time purchases with metadata)
- Webhook model is reliable with signature verification
- Developer experience is meaningfully simpler
- Fees are comparable or better
- No blocking limitations for the current billing design

Stay with Stripe if:

- Polar.sh doesn't support one-time purchases well
- Webhook model is immature or unreliable
- Migration effort outweighs simplicity gains
- Missing critical features (sandbox mode, webhook testing, etc.)

## Deliverable

A comparison document with a clear recommendation and migration estimate if switching.
