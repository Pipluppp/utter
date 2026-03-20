# Billing Research (2026-03-22)

Evaluate billing provider options and test the chosen integration.

## Context

The repo already has a working Stripe integration (checkout, webhook, credit grants, idempotency). However, Polar.sh may be a better fit — potentially simpler, smoother, and more aligned with the project's needs.

## Tasks

### 1. Polar.sh Research

Evaluate Polar.sh as an alternative to Stripe for credit-pack billing:

- Can it handle one-time credit-pack purchases?
- Webhook model and reliability
- SDK/API simplicity compared to Stripe
- Pricing and fees
- How it handles test/sandbox mode
- Any limitations that would block the current billing model

See `polar-research-plan.md` for details.

### 2. Provider Decision

Compare Polar.sh vs Stripe based on research findings and decide which to use.

### 3. Integration Testing

Test the chosen provider end-to-end (plan already exists for Stripe in `stripe-testing-plan.md`; create equivalent for Polar if chosen).

## Files

| File | Purpose |
|---|---|
| `stripe-testing-plan.md` | Existing Stripe testing plan (from 2026-03-19) |
| `stripe-testing-research-verification.md` | Stripe plan verification notes |
| `polar-research-plan.md` | Polar.sh evaluation plan |
