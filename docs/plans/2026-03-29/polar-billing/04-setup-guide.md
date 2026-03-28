# Setup Guide

No approval process. No waiting period. Sandbox is available immediately.

## 1. Sandbox org + products

1. Log into https://sandbox.polar.sh (fully isolated from production)
2. Create/verify the `utter-voice` organization
3. Create two one-time products:
   - **Starter pack** — $2.99 USD, description: "30,000 credits"
   - **Studio pack** — $9.99 USD, description: "120,000 credits"
4. Note both product UUIDs

## 2. Access token

1. Org settings → Developers → Access Tokens → Create Token
2. Name: `utter-api-worker-sandbox`
3. Copy token (format: `polar_oat_xxxxxxxxxxxxxxxxx`) → this is `POLAR_ACCESS_TOKEN`

## 3. Webhook endpoint

1. Org settings → Webhooks → Add Endpoint
2. URL: your staging Worker URL + `/api/webhooks/polar`
3. Format: Raw JSON
4. Subscribe to: `order.paid`, `order.refunded`
5. Copy webhook secret → this is `POLAR_WEBHOOK_SECRET`

## 4. Local dev secrets

`workers/api/.dev.vars`:

```
POLAR_ACCESS_TOKEN=polar_oat_sandbox_xxxxxxxxxxxxxxxxx
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxx
POLAR_PRODUCT_PACK_30K=<starter-pack-uuid>
POLAR_PRODUCT_PACK_120K=<studio-pack-uuid>
POLAR_MODE=sandbox
```

## 5. Local webhook testing

```bash
# Install Polar CLI
curl -fsSL https://polar.sh/install.sh | bash

# Forward webhooks to local API Worker
polar listen http://localhost:8787/api/webhooks/polar
```

## 6. Test checkout

1. Start API Worker + frontend locally
2. Buy a credit pack
3. Test card: `4242 4242 4242 4242` (any future expiry, any CVC)
4. Verify: redirect back, webhook fires, credits appear, `billing_events` row is `processed`

## 7. Production cutover

1. Create same products in https://polar.sh (production dashboard)
2. Create production OAT + webhook endpoint
3. Connect payout account: Finance → Setup → Stripe Connect Express (~5 min)
4. Set secrets:

```bash
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put POLAR_WEBHOOK_SECRET
wrangler secret put POLAR_PRODUCT_PACK_30K
wrangler secret put POLAR_PRODUCT_PACK_120K
```

5. Set `POLAR_MODE = "production"` in `wrangler.toml`
6. Deploy
7. Clean up old Stripe secrets:

```bash
wrangler secret delete STRIPE_SECRET_KEY
wrangler secret delete STRIPE_WEBHOOK_SECRET
wrangler secret delete STRIPE_PRICE_PACK_30K
wrangler secret delete STRIPE_PRICE_PACK_120K
```
