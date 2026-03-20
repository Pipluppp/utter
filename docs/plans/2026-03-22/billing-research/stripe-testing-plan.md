# Stripe Testing Plan

## Goal

Verify that Stripe checkout and webhook-driven credit grants work reliably before the Qwen enterprise key becomes the only remaining launch blocker.

## Current repo state

The Stripe implementation is already meaningfully built.

### Checkout creation exists

The API route:

- validates the authenticated user
- validates the requested pack
- creates a Stripe Checkout Session
- sets `success_url` and `cancel_url` from the incoming request origin
- stores `user_id` and `pack_id` in Stripe session metadata

### Webhook processing exists

The webhook route:

- verifies the Stripe signature
- persists the event into `billing_events`
- ignores unsupported event types
- processes `checkout.session.completed`
- resolves the Stripe price back to a configured pack
- grants credits through the database ledger path
- marks the billing event as processed or failed

### Idempotency is already tested

The worker tests already check duplicate webhook delivery and confirm that the credit grant only happens once for `pack_30k`.

### Current prepaid packs

From the repo:

- `pack_30k` -> `$2.99` -> `30,000` credits
- `pack_120k` -> `$9.99` -> `120,000` credits

These map to:

- `STRIPE_PRICE_PACK_30K`
- `STRIPE_PRICE_PACK_120K`

## What Stripe testing needs

## Accounts and environments

You need a Stripe account now, but only in sandbox/test mode for this phase.

That is enough to test:

- Checkout redirects
- successful card payments
- webhook delivery
- retry behavior
- credit grants
- idempotency behavior under duplicate delivery

You do not need live mode or real charges for this work.

## Public webhook endpoint

Stripe requires registered webhook endpoints to be publicly accessible HTTPS URLs.

For Utter, the simplest hosted endpoint is likely:

- `https://<app-domain>/api/webhooks/stripe`

because the frontend Worker already proxies `/api/*` to the API Worker.

You can also keep testing against the current public worker domain before the branded domain is live.

## Local webhook testing

Stripe documents the Stripe CLI as the fastest way to test locally:

```bash
stripe listen --forward-to localhost:4242/webhook
```

Translated to this repo's local API Worker, the local target would be your local API webhook route under the Worker dev server.

This is the right tool for:

- local signature verification
- local webhook handling
- replaying and debugging event processing

## Recommended testing layers

### Layer 1: local API webhook tests

Goal:

- prove webhook verification and processing logic

Use:

- existing worker tests
- Stripe CLI forwarding
- sandbox test data

What to verify:

- invalid signature fails
- valid `checkout.session.completed` succeeds
- duplicate event delivery does not double-grant credits
- pack-to-price mapping is correct

### Layer 2: hosted staging end-to-end

Goal:

- prove browser redirect plus hosted webhook delivery

Use:

- the hosted staging app domain
- Stripe sandbox/test mode
- real public webhook endpoint in Stripe dashboard

What to verify:

1. Clicking Buy opens Checkout.
2. Successful payment returns the browser to the app billing page.
3. Stripe sends the webhook to the hosted endpoint.
4. Credits appear in the user's balance.
5. Activity history reflects the purchase.

### Layer 3: resilience checks

Goal:

- prove that Stripe delivery quirks do not corrupt credits

What to verify:

- webhook retries do not double-grant credits
- events arriving out of order do not break the integration
- webhook endpoint returns success fast enough

Stripe's docs explicitly say:

- use webhooks for reliable fulfillment
- handle duplicate events
- event ordering is not guaranteed
- registered webhook endpoints must be public HTTPS URLs
- Stripe retries failed deliveries automatically
- Stripe CLI can forward events locally with `stripe listen --forward-to ...`

## Repo-specific checks to perform

### Secrets and config

Confirm hosted worker secrets exist for:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PACK_30K`
- `STRIPE_PRICE_PACK_120K`

### Price mapping

Confirm the Stripe sandbox price IDs match the intended packs exactly:

- `pack_30k`
- `pack_120k`

Any mismatch here will cause checkout creation or webhook credit grants to fail.

### Success and cancel behavior

Because checkout success and cancel URLs are derived from the request origin, this behavior should naturally move with the domain cutover. That is good. It means the same code path should work on:

- localhost
- current `workers.dev`
- final branded domain

### Webhook speed

Stripe's Checkout fulfillment docs note that hosted Checkout can wait up to 10 seconds for a `checkout.session.completed` webhook response before redirecting the customer to the success URL. The current webhook should stay lean and avoid extra slow work.

## Recommended execution order

1. Create or use an existing Stripe account in sandbox/test mode.
2. Create the two sandbox price objects matching the repo pack model.
3. Put those price IDs into the worker secrets/env used by the API Worker.
4. Run local webhook tests with Stripe CLI forwarding.
5. Register a public staging webhook endpoint in Stripe.
6. Run real browser Checkout flows on staging with test cards.
7. Confirm credits, ledger, and billing activity update correctly.
8. Manually replay the same webhook event and confirm no duplicate grant occurs.

## Suggested test cases

### Happy path

- Buy `pack_30k` with `4242 4242 4242 4242`
- Buy `pack_120k` with the same test card

### Failure and recovery

- Cancel out of Checkout and verify no balance change
- Use a 3DS-required test card to verify auth-required flows
- Replay a successful webhook event
- Temporarily break the webhook secret locally and confirm signature verification fails

## Small hardening note

Stripe documents that webhook retries can continue automatically after failures and
that event ordering is not guaranteed. Keep the webhook path lean, return `2xx`
promptly after durable processing decisions, and continue treating idempotency as a
first-class requirement.

## Decision summary

Stripe testing is not blocked by the Qwen key.

It is also not fundamentally blocked by the custom app domain, although the branded domain makes the final end-to-end environment cleaner. This work can run in parallel with the auth/domain workstream.

## Sources

- Stripe Testing:
  - https://docs.stripe.com/testing
- Stripe Webhooks:
  - https://docs.stripe.com/webhooks
- Stripe Checkout fulfillment:
  - https://docs.stripe.com/checkout/fulfillment
