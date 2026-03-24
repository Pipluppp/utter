# Polar.sh Setup Guide

## Prerequisites

- Polar.sh account created (organization: `utter-voice`)
- Access to sandbox environment at https://sandbox.polar.sh

## Step 1: Create Sandbox Organization

If not already done, log into https://sandbox.polar.sh and create/verify the `utter-voice` organization in sandbox mode. Sandbox is fully isolated from production — separate data, tokens, and credentials.

## Step 2: Create Organization Access Token

1. Go to https://sandbox.polar.sh/utter-voice/settings
2. Navigate to **Access Tokens** section
3. Click **Create Token**
4. Name it something like `utter-api-worker-sandbox`
5. Copy the token (format: `polar_oat_xxxxxxxxxxxxxxxxx`)
6. Store it securely — this is your `POLAR_ACCESS_TOKEN`

## Step 3: Create Products

Create two one-time products matching the existing credit packs.

### Starter Pack

1. Go to **Products** > **Create Product**
2. Name: `Starter pack`
3. Description: `30,000 credits — about 80 minutes of generated audio`
4. Billing: **One-time purchase**
5. Price: **$2.99 USD**
6. Save and note the product UUID

### Studio Pack

1. Go to **Products** > **Create Product**
2. Name: `Studio pack`
3. Description: `120,000 credits — about 320 minutes of generated audio`
4. Billing: **One-time purchase**
5. Price: **$9.99 USD**
6. Save and note the product UUID

## Step 4: Configure Webhook Endpoint

1. Go to **Settings** > **Webhooks**
2. Click **Add Endpoint**
3. URL: `https://utter-wheat.vercel.app/api/webhooks/polar` (or your staging Worker URL)
4. Format: **Raw** (JSON)
5. Generate or set a webhook secret
6. Subscribe to events:
   - `order.paid`
   - `order.refunded`
7. Save and copy the webhook secret — this is your `POLAR_WEBHOOK_SECRET`

## Step 5: Set Worker Secrets

### For local development (`workers/api/.dev.vars`)

```
POLAR_ACCESS_TOKEN=polar_oat_sandbox_xxxxxxxxxxxxxxxxx
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxx
POLAR_PRODUCT_PACK_30K=<starter-pack-uuid>
POLAR_PRODUCT_PACK_120K=<studio-pack-uuid>
POLAR_MODE=sandbox
```

### For production (via wrangler)

```bash
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put POLAR_WEBHOOK_SECRET
wrangler secret put POLAR_PRODUCT_PACK_30K
wrangler secret put POLAR_PRODUCT_PACK_120K
```

Set `POLAR_MODE` as a plain text var in `wrangler.toml`:

```toml
[vars]
POLAR_MODE = "production"
```

## Step 6: Install SDK Dependencies

```bash
cd workers/api
npm install @polar-sh/sdk
```

Optionally install the Hono adapter (see decisions.md for trade-offs):

```bash
npm install @polar-sh/hono zod
```

## Step 7: Local Webhook Testing

Install the Polar CLI:

```bash
curl -fsSL https://polar.sh/install.sh | bash
```

Forward webhooks to your local dev server:

```bash
polar listen http://localhost:8787/api/webhooks/polar
```

This creates a tunnel from Polar's servers to your local machine, similar to `stripe listen --forward-to`.

## Step 8: Test Checkout Flow

1. Start the API Worker locally: `cd workers/api && npm run dev`
2. Start the frontend: `cd frontend && npm run dev`
3. Navigate to the credits/billing page
4. Click a credit pack purchase button
5. Complete checkout with test card `4242 4242 4242 4242` (any future expiry, any CVC)
6. Verify:
   - Browser redirects back to billing page with `?checkout=success`
   - Webhook fires (`polar listen` shows the event)
   - Credits appear in the user's balance
   - `billing_events` table has a `processed` row
   - `credit_ledger` table has a `grant` row

## Step 9: Production Cutover

1. Create the same two products in https://polar.sh (production dashboard)
2. Create a production OAT
3. Configure production webhook endpoint
4. Set production secrets via `wrangler secret put`
5. Set `POLAR_MODE = "production"` in `wrangler.toml`
6. Deploy
7. Remove old Stripe secrets

## Cleanup: Remove Stripe Secrets

After production cutover is verified:

```bash
wrangler secret delete STRIPE_SECRET_KEY
wrangler secret delete STRIPE_WEBHOOK_SECRET
wrangler secret delete STRIPE_PRICE_PACK_30K
wrangler secret delete STRIPE_PRICE_PACK_120K
```
