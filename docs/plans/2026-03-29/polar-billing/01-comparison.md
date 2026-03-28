# Stripe vs Polar — Comparison

## Business model

|                     | Stripe                                                  | Polar                                    |
| ------------------- | ------------------------------------------------------- | ---------------------------------------- |
| Role                | Payment processor (you are the seller)                  | Merchant of Record (Polar is the seller) |
| Tax liability       | Yours — register, collect, file, remit per jurisdiction | Polar handles everything                 |
| Refunds/chargebacks | You handle                                              | Polar handles (you request refunds)      |

## Fees on Utter's packs

| Pack    | Price | Stripe         | Polar          | Delta  |
| ------- | ----- | -------------- | -------------- | ------ |
| Starter | $2.99 | ~$0.39 (13.0%) | ~$0.52 (17.4%) | +$0.13 |
| Studio  | $9.99 | ~$0.59 (5.9%)  | ~$0.80 (8.0%)  | +$0.21 |

Base rates: Stripe 2.9% + 30¢, Polar 4% + 40¢. Both add +1.5% for international cards.
Polar also charges $2/mo + 0.25% + 25¢ per payout (manual withdrawal).

The ~4% premium buys zero tax compliance overhead — no VAT registration, no filing, no remittance. Worth it at this stage.

## Developer experience

|                       | Stripe (current)                  | Polar                                |
| --------------------- | --------------------------------- | ------------------------------------ |
| Checkout              | Raw `fetch` + form-encoded params | `polar.checkouts.create()` typed SDK |
| Webhook verification  | 80 lines manual HMAC-SHA256       | `validateEvent()` one-liner          |
| SDK                   | Not used (raw HTTP)               | `@polar-sh/sdk`                      |
| Hono adapter          | None                              | `@polar-sh/hono` (official)          |
| Local webhook testing | `stripe listen --forward-to`      | `polar listen http://localhost:...`  |
| Sandbox               | Stripe test mode                  | Fully isolated sandbox environment   |
| Secrets needed        | 4                                 | 4                                    |

## Code impact

| Component              | Stripe (current) | Polar (estimated) |
| ---------------------- | :--------------: | :---------------: |
| Checkout route         |    ~60 lines     |     ~20 lines     |
| Webhook route          |    ~185 lines    |     ~50 lines     |
| Signature verification |    ~80 lines     |      0 (SDK)      |
| HTTP helpers           |    ~50 lines     |      0 (SDK)      |
| **Total `billing.ts`** |  **509 lines**   | **~80-120 lines** |

Frontend, mobile, database, credit ledger — all unchanged. This is a provider swap at the API Worker layer only.

## Polar limitations

- Higher per-transaction fees
- 10 currencies (vs Stripe's 135+)
- Younger platform, smaller ecosystem
- May block payments from countries where they lack tax registration
- Rate limit: 500 req/min production (vs Stripe's higher limits)
- Refunds requested through Polar, not processed directly

## Stripe limitations (current implementation)

- Tax compliance is entirely on you
- No official Hono adapter
- Current code uses raw HTTP, not the SDK
- 80 lines of manual webhook crypto
- No built-in credits/meters/entitlements
