# Polar.sh Migration — Research & Plan

Date: 2026-03-23
Status: Research complete, pending decisions
Scope: Evaluate and plan migration from Stripe to Polar.sh for credit-pack billing

## Documents

| Document | Purpose |
|----------|---------|
| [polar-features.md](./polar-features.md) | Complete Polar.sh feature reference |
| [comparison.md](./comparison.md) | Side-by-side Stripe vs Polar comparison |
| [migration-plan.md](./migration-plan.md) | Code changes, file-by-file migration guide |
| [setup-guide.md](./setup-guide.md) | Dashboard setup, secrets, and first checkout |
| [decisions.md](./decisions.md) | Open decision points requiring input |

## Context

The repo has a complete Stripe integration (checkout + webhooks + credit ledger) deployed since 2026-02-25, but Stripe has not been tested end-to-end with real sandbox credentials yet. Polar.sh was identified as a simpler alternative that also acts as Merchant of Record, eliminating tax compliance burden.

## Recommendation

Switch to Polar.sh. The credit-pack model maps cleanly, the Hono adapter reduces code significantly, and the MoR model eliminates tax liability. The existing `credit_ledger` and `billing_events` infrastructure stays intact — this is a provider swap, not an architecture change.
