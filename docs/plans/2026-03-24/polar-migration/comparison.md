# Stripe vs Polar.sh Comparison

## Business Model

| Aspect | Stripe | Polar.sh |
|--------|--------|----------|
| Role | Payment Service Provider (PSP) | Merchant of Record (MoR) |
| Legal seller | You | Polar |
| Tax liability | You must register, collect, file, and remit | Polar handles everything |
| Tax registration needed | Yes, per jurisdiction | No |
| VAT/GST invoices | You issue them | Polar issues them |
| Refund handling | You process | Polar processes (you request) |
| Chargeback handling | You handle disputes | Polar handles disputes |

## Fees

| Fee type | Stripe | Polar.sh |
|----------|--------|----------|
| Base transaction | 2.9% + 30¢ | 4% + 40¢ |
| International cards | +1.5% | +1.5% |
| Monthly fee | $0 | $0 |
| Chargebacks | $15 | $15 |
| Payout | Varies | $2/mo + 0.25% + 25¢ per payout |
| Refund fee return | Fees not returned | Fees not returned |

### Real cost on Utter's credit packs

| Pack | Price | Stripe fee | Polar fee | Difference |
|------|-------|------------|-----------|------------|
| Starter | $2.99 | ~$0.39 (13.0%) | ~$0.52 (17.4%) | +$0.13 |
| Studio | $9.99 | ~$0.59 (5.9%) | ~$0.80 (8.0%) | +$0.21 |

Polar costs ~4% more per transaction. The trade-off is zero tax compliance overhead — no VAT registration, no filing, no remittance. As you sell internationally, the tax compliance cost saved far exceeds the fee difference.

## Developer Experience

| Aspect | Stripe (current implementation) | Polar.sh (proposed) |
|--------|-------------------------------|---------------------|
| Checkout creation | Manual form-encoded URLSearchParams, raw `fetch` to Stripe API | `polar.checkouts.create()` typed SDK call or Hono adapter |
| Webhook verification | 80 lines manual HMAC-SHA256 in `billing.ts` | `validateEvent()` one-liner or Hono `Webhooks()` adapter |
| SDK | Not used (raw HTTP) | `@polar-sh/sdk` + `@polar-sh/hono` |
| Price-to-pack mapping | Env var lookup per pack (`STRIPE_PRICE_PACK_30K`) | Direct product UUID |
| Sandbox | Stripe test mode + CLI forwarding | `sandbox-api.polar.sh` + `polar listen` CLI |
| Local webhook testing | `stripe listen --forward-to` | `polar listen http://localhost:...` |
| Dashboard | Stripe Dashboard | Polar Dashboard |
| Secrets needed | 4 (secret key, webhook secret, 2 price IDs) | 4 (access token, webhook secret, 2 product IDs) |

## Feature Comparison

| Feature | Stripe | Polar.sh |
|---------|--------|----------|
| One-time purchases | Yes | Yes |
| Subscriptions | Yes | Yes |
| Usage-based billing | Stripe Billing (metered) | Built-in Meters + Events API |
| Credits / prepaid | Must build yourself | Built-in Credits benefit |
| Checkout hosted page | Yes | Yes |
| Embedded checkout | Stripe Elements | `@polar-sh/checkout` widget |
| Webhooks | Stripe Events | Standard Webhooks spec |
| Webhook retries | Automatic | 10 retries, exponential backoff |
| Signature verification | HMAC-SHA256 (custom) | Standard Webhooks (base64 secret) |
| Customer portal | Stripe Billing Portal | `polar.sh/{org}/portal` |
| Multi-currency | Yes (extensive) | 10 currencies |
| Test/sandbox mode | Yes | Yes (fully isolated) |
| License keys | No (third-party) | Built-in |
| File delivery | No | Built-in (up to 10GB) |
| GitHub/Discord access | No | Built-in |
| Framework adapters | Community | Official (Hono, Next.js, Express, etc.) |
| Hono support | No official adapter | `@polar-sh/hono` official adapter |
| Open source | No | Yes (Apache 2.0) |

## What Changes in the Codebase

### Files that change

| File | Change |
|------|--------|
| `workers/api/src/routes/billing.ts` | Replace Stripe checkout + webhook with Polar equivalents |
| `workers/api/src/_shared/credits.ts` | Remove `stripePriceEnv`, add `polarProductEnv` |
| `workers/api/src/env.ts` | Swap Stripe env vars for Polar ones |
| `workers/api/wrangler.toml` | Update secret comments |
| `workers/api/.dev.vars.example` | Update example env vars |
| `workers/api/package.json` | Add `@polar-sh/sdk` (and optionally `@polar-sh/hono`) |
| `frontend/src/pages/account/Credits.tsx` | No change (already abstracted behind `/api/billing/checkout`) |
| `frontend/src/content/plans.ts` | No change |

### Files that stay the same

| File | Why |
|------|-----|
| `supabase/migrations/20260224001500_credits_ledger_foundation.sql` | Credit ledger is provider-agnostic |
| `supabase/migrations/20260225100000_credits_trials_and_prepaid_billing.sql` | Trial system is provider-agnostic |
| `workers/api/src/routes/credits.ts` | Usage endpoint reads from ledger, not provider |
| `workers/api/src/_shared/credits.ts` (most of it) | `applyCreditEvent`, `trialOrDebit`, `trialRestore` unchanged |
| `frontend/src/components/marketing/PricingGrid.tsx` | Display only |
| `mobile/` (entire app) | Uses `/api/billing/checkout` abstraction |
| All database RPC functions | Provider-agnostic |

### Code size comparison

| Component | Stripe (current lines) | Polar (estimated lines) |
|-----------|----------------------|------------------------|
| Checkout route | ~60 lines | ~20 lines |
| Webhook route | ~185 lines | ~50 lines (or ~15 with Hono adapter) |
| Signature verification | ~80 lines (inline) | 0 (SDK handles it) |
| Stripe HTTP helpers | ~50 lines | 0 (SDK handles it) |
| Total `billing.ts` | 509 lines | ~80-120 lines |

## Limitations of Polar

- Higher per-transaction fees (~4% vs ~2.9%)
- Fewer currencies (10 vs Stripe's 135+)
- Smaller ecosystem (newer platform, fewer integrations)
- Less granular control over payment flows
- Cannot customize invoice templates to the same degree
- Polar can block payments from countries where they're not tax-registered
- Rate limits more restrictive (500 req/min vs Stripe's higher limits)
- Younger platform — less battle-tested at scale
- Refunds are requested through Polar, not processed directly

## Limitations of Stripe (current)

- Tax compliance is entirely your responsibility
- No official Hono adapter
- Current implementation uses raw HTTP instead of SDK
- Webhook verification is 80 lines of manual crypto
- No built-in credits/meters/entitlements — all custom-built
- More operational overhead as you scale internationally
