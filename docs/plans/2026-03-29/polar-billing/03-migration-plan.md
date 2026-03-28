# Migration Plan

Provider swap at the API Worker layer. Frontend, mobile, database, credit ledger all stay the same.

```
Frontend → POST /api/billing/checkout → Polar Checkout API → Polar hosted page
Polar webhook → POST /api/webhooks/polar → verify signature (SDK) → billing_events → credit_ledger
```

## Files that change

### `workers/api/package.json` — add `@polar-sh/sdk`

### `workers/api/src/env.ts` — swap env vars

```typescript
// Remove                          // Add
STRIPE_SECRET_KEY: string;
POLAR_ACCESS_TOKEN: string;
STRIPE_WEBHOOK_SECRET: string;
POLAR_WEBHOOK_SECRET: string;
STRIPE_PRICE_PACK_30K: string;
POLAR_PRODUCT_PACK_30K: string;
STRIPE_PRICE_PACK_120K: string;
POLAR_PRODUCT_PACK_120K: string;
POLAR_MODE: string; // "sandbox" | "production"
```

### `workers/api/src/_shared/credits.ts` — update pack config

```typescript
// stripePriceEnv → polarProductEnv
export const PREPAID_PACKS = {
  pack_30k: {
    id: "pack_30k",
    credits: 30000,
    priceUsd: 2.99,
    polarProductEnv: "POLAR_PRODUCT_PACK_30K",
  },
  pack_120k: {
    id: "pack_120k",
    credits: 120000,
    priceUsd: 9.99,
    polarProductEnv: "POLAR_PRODUCT_PACK_120K",
  },
};
```

Replace `stripePriceIdForPack()` / `prepaidPackFromStripePriceId()` with Polar equivalents.

### `workers/api/src/routes/billing.ts` — major rewrite (509 → ~100 lines)

Remove all Stripe helpers (signature verification, HTTP helpers, price extraction).

Checkout route:

```typescript
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: envGet("POLAR_ACCESS_TOKEN"),
  server: envGet("POLAR_MODE") === "production" ? "production" : "sandbox",
});

const checkout = await polar.checkouts.create({
  products: [productId],
  successUrl: `${origin}/account/billing?checkout=success`,
  metadata: { user_id: user.id, pack_id: pack.id },
  customerEmail: user.email,
  externalCustomerId: user.id,
});

return c.json({ url: checkout.url });
```

Webhook route:

```typescript
import { validateEvent } from "@polar-sh/sdk/webhooks";

// Verify signature (one line), then same dedup pattern:
// billing_events insert → check unique violation → applyCreditEvent → update status
```

### `workers/api/wrangler.toml` + `.dev.vars.example` — update vars/secrets

### `workers/api/tests/billing.test.ts` — update payloads

Replace Stripe signature format with Standard Webhooks, `checkout.session.completed` with `order.paid`.

## Files that stay the same

- All database migrations and RPC functions (provider-agnostic)
- `credit_ledger` table and all credit logic
- Frontend (`/api/billing/checkout` returns `{ url }` — same interface)
- Mobile app (same API abstraction)
- `PricingGrid.tsx`, `plans.ts` (display only)

## Database

No migration needed. `billing_events.provider` column already supports multiple values — new rows use `"polar"` instead of `"stripe"`.

## Execution order

1. Create Polar sandbox products + webhook endpoint
2. `npm install @polar-sh/sdk` in workers/api
3. Update `credits.ts` → `env.ts` → rewrite `billing.ts`
4. Update config files
5. Update tests
6. Test locally with `polar listen`
7. Deploy to staging, test E2E with sandbox checkout
8. Create production products, set secrets, deploy
9. Delete old Stripe secrets

## Rollback

Stripe code is in git history. `billing_events` supports both providers. Re-set Stripe secrets and revert code. No database migration to reverse.
