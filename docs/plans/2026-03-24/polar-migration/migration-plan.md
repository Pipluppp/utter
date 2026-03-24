# Polar.sh Migration Plan

## Overview

Replace Stripe as the payment provider with Polar.sh. The credit ledger, trial system, and frontend remain unchanged — this is a provider swap at the API Worker layer.

## Architecture Before & After

```
BEFORE (Stripe):
Frontend → POST /api/billing/checkout → Stripe Checkout Session API → Stripe hosted page
Stripe webhook → POST /api/webhooks/stripe → verify HMAC → billing_events → credit_ledger

AFTER (Polar):
Frontend → POST /api/billing/checkout → Polar Checkout API → Polar hosted page
Polar webhook → POST /api/webhooks/polar → verify signature (SDK) → billing_events → credit_ledger
```

The frontend calls the same `/api/billing/checkout` endpoint and receives `{ url }` back. Nothing changes client-side.

## File-by-File Changes

### 1. `workers/api/package.json`

Add dependency:

```json
"@polar-sh/sdk": "latest"
```

Optional (if using Hono adapter):

```json
"@polar-sh/hono": "latest",
"zod": "latest"
```

### 2. `workers/api/src/env.ts`

Remove:

```typescript
STRIPE_SECRET_KEY: string;
STRIPE_WEBHOOK_SECRET: string;
STRIPE_PRICE_PACK_30K: string;
STRIPE_PRICE_PACK_120K: string;
```

Add:

```typescript
POLAR_ACCESS_TOKEN: string;
POLAR_WEBHOOK_SECRET: string;
POLAR_PRODUCT_PACK_30K: string;
POLAR_PRODUCT_PACK_120K: string;
POLAR_MODE: string; // "sandbox" or "production"
```

### 3. `workers/api/src/_shared/credits.ts`

Change the `PrepaidPack` type and `PREPAID_PACKS` config:

```typescript
// Remove
stripePriceEnv: "STRIPE_PRICE_PACK_30K" | "STRIPE_PRICE_PACK_120K";

// Add
polarProductEnv: "POLAR_PRODUCT_PACK_30K" | "POLAR_PRODUCT_PACK_120K";
```

Update `PREPAID_PACKS`:

```typescript
export const PREPAID_PACKS: Record<PrepaidPackId, PrepaidPack> = {
  pack_30k: {
    id: "pack_30k",
    name: "Starter pack",
    priceUsd: 2.99,
    credits: 30000,
    polarProductEnv: "POLAR_PRODUCT_PACK_30K",
  },
  pack_120k: {
    id: "pack_120k",
    name: "Studio pack",
    priceUsd: 9.99,
    credits: 120000,
    polarProductEnv: "POLAR_PRODUCT_PACK_120K",
  },
};
```

Replace helper functions:

```typescript
// Remove
export function stripePriceIdForPack(packId: PrepaidPackId): string | null
export function prepaidPackFromStripePriceId(priceId: string): PrepaidPack | null

// Add
export function polarProductIdForPack(packId: PrepaidPackId): string | null {
  const raw = envGet(PREPAID_PACKS[packId].polarProductEnv)?.trim();
  return raw || null;
}

export function prepaidPackFromPolarProductId(productId: string): PrepaidPack | null {
  const normalized = productId.trim();
  if (!normalized) return null;
  for (const pack of Object.values(PREPAID_PACKS)) {
    const configuredId = envGet(pack.polarProductEnv)?.trim();
    if (configuredId && configuredId === normalized) return pack;
  }
  return null;
}
```

### 4. `workers/api/src/routes/billing.ts` (major rewrite)

This file drops from ~509 lines to ~80-120 lines.

**Remove entirely:**
- `parseStripeSignature()`
- `computeStripeHmac()`
- `verifyStripeSignature()`
- `stripeRequestJson()`
- `extractStripePriceIdFromSession()`
- `loadCheckoutPriceId()`
- All Stripe-specific types and constants

**Checkout route** — replace Stripe Checkout Session creation:

```typescript
import { Polar } from "@polar-sh/sdk";

billingRoutes.post("/billing/checkout", async (c) => {
  const { user } = await requireUser(c.req.raw);
  const body = await c.req.json();
  const packId = body.pack_id?.trim();
  const pack = prepaidPackFromId(packId);
  if (!pack) return c.json({ detail: "Invalid pack_id." }, 400);

  const productId = polarProductIdForPack(pack.id);
  if (!productId) return c.json({ detail: "Billing not configured." }, 500);

  const polar = new Polar({
    accessToken: envGet("POLAR_ACCESS_TOKEN"),
    server: envGet("POLAR_MODE") === "production" ? "production" : "sandbox",
  });

  const origin = resolveRequestOrigin(c.req.raw);
  const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl: `${origin}/account/billing?checkout=success`,
    metadata: { user_id: user.id, pack_id: pack.id },
    customerEmail: user.email,
  });

  return c.json({ url: checkout.url });
});
```

**Webhook route** — replace Stripe signature verification and event processing:

```typescript
import { validateEvent } from "@polar-sh/sdk/webhooks";

billingRoutes.post("/webhooks/polar", async (c) => {
  const webhookSecret = envGet("POLAR_WEBHOOK_SECRET");
  if (!webhookSecret) return c.json({ detail: "Webhook not configured." }, 500);

  const payload = await c.req.raw.text();
  const headers = Object.fromEntries(c.req.raw.headers.entries());

  let event;
  try {
    event = validateEvent(payload, headers, webhookSecret);
  } catch {
    return c.json({ detail: "Invalid webhook signature." }, 400);
  }

  const admin = createAdminClient();

  if (event.type === "order.paid") {
    const order = event.data;
    const providerEventId = order.id;
    const metadata = order.metadata || {};
    const userId = metadata.user_id;
    const packId = metadata.pack_id;

    // Dedup via billing_events (same pattern as Stripe)
    const { error: insertError } = await admin
      .from("billing_events")
      .insert({
        provider: "polar",
        provider_event_id: providerEventId,
        event_type: "order.paid",
        user_id: userId,
        status: "received",
        payload: order,
      });

    if (insertError && isUniqueViolation(insertError)) {
      return c.json({ received: true, duplicate: true });
    }

    const pack = prepaidPackFromId(packId);
    if (!pack || !userId) {
      await admin.from("billing_events").update({
        status: "failed",
        error_detail: !pack ? "Unknown pack_id" : "Missing user_id",
        processed_at: new Date().toISOString(),
      }).eq("provider_event_id", providerEventId);
      return c.json({ detail: "Invalid order metadata." }, 400);
    }

    const grant = await applyCreditEvent(admin, {
      userId,
      eventKind: "grant",
      operation: "paid_purchase",
      amount: pack.credits,
      referenceType: "billing",
      idempotencyKey: `polar:order:${providerEventId}:grant`,
      metadata: {
        provider: "polar",
        order_id: providerEventId,
        pack_id: pack.id,
        pack_credits: pack.credits,
      },
    });

    if (grant.error || !grant.row) {
      await admin.from("billing_events").update({
        status: "failed",
        error_detail: "Credit grant failed",
        processed_at: new Date().toISOString(),
      }).eq("provider_event_id", providerEventId);
      return c.json({ detail: "Credit grant failed." }, 500);
    }

    await admin.from("billing_events").update({
      status: "processed",
      credits_granted: pack.credits,
      ledger_id: grant.row.ledger_id,
      processed_at: new Date().toISOString(),
    }).eq("provider_event_id", providerEventId);

    return c.json({ received: true, processed: true });
  }

  if (event.type === "order.refunded") {
    // Handle refund — reverse the credit grant
    // Implementation depends on decision about refund handling
  }

  return c.json({ received: true, ignored: true });
});
```

### 5. `workers/api/src/index.ts`

Update route registration if the webhook path changes:

```typescript
// If keeping /webhooks/stripe path for backwards compat during transition:
// No change needed, old path will 404 naturally after deploy

// New path is /webhooks/polar (already in billingRoutes)
```

### 6. `workers/api/wrangler.toml`

Update comments and add POLAR_MODE var:

```toml
[vars]
POLAR_MODE = "sandbox"  # Change to "production" for live

# Secrets (set via `wrangler secret put`):
# POLAR_ACCESS_TOKEN
# POLAR_WEBHOOK_SECRET
# POLAR_PRODUCT_PACK_30K
# POLAR_PRODUCT_PACK_120K
```

### 7. `workers/api/.dev.vars.example`

Replace Stripe examples:

```
# Polar.sh billing (set via sandbox.polar.sh dashboard)
POLAR_ACCESS_TOKEN=polar_oat_sandbox_xxxxxxxxxxxxxxxxx
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxx
POLAR_PRODUCT_PACK_30K=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
POLAR_PRODUCT_PACK_120K=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 8. `workers/api/tests/billing.test.ts`

Rewrite tests to match new webhook format:

- Replace Stripe signature generation with Standard Webhooks signature format
- Replace `checkout.session.completed` payloads with `order.paid` payloads
- Update event structure to match Polar's order object
- Keep idempotency and deduplication tests (same logic, different payloads)

## Database Changes

### No schema migration needed

The `billing_events` table already supports multiple providers via the `provider` text column. New rows will have `provider: 'polar'` instead of `'stripe'`. Old Stripe rows (if any exist from testing) remain as historical data.

### Optional: Add provider check constraint

If desired, add a check to enforce known providers:

```sql
ALTER TABLE public.billing_events
  DROP CONSTRAINT IF EXISTS billing_events_provider_check,
  ADD CONSTRAINT billing_events_provider_check
    CHECK (provider IN ('stripe', 'polar'));
```

This is optional — the existing schema works without it.

## Frontend Changes

### None required

The frontend calls `POST /api/billing/checkout` and receives `{ url }`. It then redirects to that URL. The URL changing from `checkout.stripe.com` to Polar's checkout page is transparent to the frontend code.

The success redirect returns to `/account/billing?checkout=success`, which the frontend already handles.

### Optional: Update success URL handling

If Polar's success URL supports a `{CHECKOUT_ID}` placeholder, we could use it to show order details. But the current success toast pattern works fine.

## Mobile Changes

### None required

The mobile app uses the same `/api/billing/checkout` endpoint via the typed API client. Same redirect pattern.

## Migration Sequence

1. Create Polar sandbox products and webhook endpoint
2. Install `@polar-sh/sdk` in workers/api
3. Update `credits.ts` pack config
4. Update `env.ts` type definitions
5. Rewrite `billing.ts` (checkout + webhook routes)
6. Update `.dev.vars.example` and `wrangler.toml`
7. Update tests
8. Test locally with `polar listen`
9. Deploy to staging
10. Test end-to-end with sandbox checkout
11. Create production Polar products
12. Set production secrets
13. Deploy to production
14. Verify production checkout
15. Remove old Stripe secrets

## Rollback Plan

If Polar doesn't work out:

- The Stripe code exists in git history (current `main` branch)
- The `billing_events` table supports both providers
- Re-set Stripe secrets and revert the code changes
- No database migration to reverse
