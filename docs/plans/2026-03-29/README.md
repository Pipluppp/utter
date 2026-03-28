# Polar.sh Billing Migration

Replace Stripe with Polar.sh for credit-pack billing. Polar is a Merchant of Record — they handle all international tax compliance so we don't have to.

No approval process or waiting period. Sandbox is available immediately, production once you connect a Stripe payout account (~5 min).

Status: ready to implement.

## Quick summary

- Provider swap only — `credit_ledger`, `billing_events`, frontend, mobile all stay the same
- `billing.ts` shrinks from ~509 lines to ~80-120 lines
- No database migration needed
- Fees are ~4% higher per transaction, but zero tax compliance overhead

## Docs

| Doc                                                          | What's in it                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [01-comparison.md](./polar-billing/01-comparison.md)         | Stripe vs Polar side-by-side (fees, DX, features, limitations)                                |
| [02-decisions.md](./polar-billing/02-decisions.md)           | 7 decision points with recommendations (SDK approach, Stripe removal, customer mapping, etc.) |
| [03-migration-plan.md](./polar-billing/03-migration-plan.md) | File-by-file code changes with snippets                                                       |
| [04-setup-guide.md](./polar-billing/04-setup-guide.md)       | Dashboard setup, secrets, local testing, production cutover                                   |
| [polar-reference.md](./polar-billing/polar-reference.md)     | Polar.sh feature/API reference doc                                                            |
| [archive/](./polar-billing/archive/)                         | Superseded Stripe research (kept for history)                                                 |

## Implementation phases

**Phase 1 — Polar dashboard setup** (~30 min, manual)

1. Create org + products in sandbox.polar.sh
2. Generate OAT + webhook endpoint
3. Note down: token, webhook secret, 2 product UUIDs

**Phase 2 — Code migration** (~2-3 hours)

1. `npm install @polar-sh/sdk` in workers/api
2. Update `env.ts`, `credits.ts`, rewrite `billing.ts`
3. Update `.dev.vars.example` + `wrangler.toml`

**Phase 3 — Local testing** (~1-2 hours)

1. Install Polar CLI, run `polar listen`
2. Test checkout + webhook + credit grant end-to-end
3. Test card: `4242 4242 4242 4242`

**Phase 4 — Production cutover** (~30 min)

1. Create production products + OAT + webhook
2. Connect payout account (Stripe Connect Express)
3. Set secrets via `wrangler secret put`, deploy
4. Delete old Stripe secrets
