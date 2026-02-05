# Billing & Cost Planning

> Billing integration, subscription tiers, credit system, and cost projections for the Supabase-only deployment.
>
> For the core architecture (schema, RLS, Edge Functions, Storage, Auth), see [`architecture.md`](./architecture.md).

---

## Billing Integration (Stripe)

### Architecture

```
Frontend (Pricing Page)
  → supabase.functions.invoke('api/billing/checkout')
  → Edge Function creates Stripe Checkout Session
  → User redirected to Stripe
  → Stripe Webhook → Edge Function → update profiles table
```

### Subscription Tiers

```typescript
const SUBSCRIPTION_TIERS = {
  free: {
    price: 0,
    credits: 100,           // per month
    maxVoices: 3,
    maxGenerationsPerDay: 10,
    features: ["Voice cloning", "Voice design", "Basic support"],
  },
  pro: {
    priceId: "price_xxx",   // Stripe price ID
    price: 19,
    credits: 1000,
    maxVoices: 20,
    maxGenerationsPerDay: 100,
    features: ["Everything in Free", "Priority generation", "Email support"],
  },
  enterprise: {
    priceId: "price_yyy",
    price: 99,
    credits: -1,            // unlimited
    maxVoices: -1,
    maxGenerationsPerDay: -1,
    features: ["Everything in Pro", "API access", "Dedicated support"],
  },
};
```

### Webhook Handler (Edge Function)

Stripe webhooks should target a dedicated edge function with `verify_jwt = false` (webhooks aren't user-authenticated — they use Stripe signature verification instead).

Key events to handle:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set subscription tier + Stripe customer ID on profile |
| `customer.subscription.updated` | Update tier/status if plan changes |
| `customer.subscription.deleted` | Downgrade to free tier |
| `invoice.payment_failed` | Flag profile, notify user |

### Credit Deduction (Postgres function)

Atomic credit check + deduction, called by edge functions before starting a generation:

```sql
create or replace function deduct_credits(
  p_user_id uuid,
  p_amount integer
)
returns boolean as $$
declare
  v_tier text;
  v_remaining integer;
begin
  select subscription_tier, credits_remaining
  into v_tier, v_remaining
  from profiles
  where id = p_user_id
  for update;

  -- Unlimited for enterprise
  if v_tier = 'enterprise' then
    return true;
  end if;

  -- Check if enough credits
  if v_remaining < p_amount then
    return false;
  end if;

  -- Deduct
  update profiles
  set credits_remaining = credits_remaining - p_amount
  where id = p_user_id;

  return true;
end;
$$ language plpgsql;
```

### Profiles Table Extension (billing fields)

The `profiles` table (created via auth trigger) needs these billing columns:

```sql
alter table public.profiles
  add column if not exists subscription_tier text default 'free',
  add column if not exists subscription_status text default 'active',
  add column if not exists stripe_customer_id text,
  add column if not exists credits_remaining integer default 100,
  add column if not exists total_generations integer default 0,
  add column if not exists total_clones integer default 0;
```

---

## Cost Projections (Supabase-Only)

### Monthly Cost by Traffic Level

| Traffic | Users | Generations/mo | Supabase | Modal | Frontend | Stripe | Total |
|---------|-------|----------------|----------|-------|----------|--------|-------|
| Launch  | 100   | 1,000          | $0 (free)| ~$50  | $0 (free)| ~$5    | **~$55** |
| Growth  | 1,000 | 10,000         | $25 (Pro)| ~$500 | $20      | ~$50   | **~$595** |
| Scale   | 10,000| 100,000        | $100     | ~$5,000| ~$50    | ~$500  | **~$5,650** |

No Railway/Render/Fly.io needed. Supabase handles the entire backend.

### Modal Cost Breakdown

| Resource | Rate | Per Generation (60s audio) |
|----------|------|---------------------------|
| A10G GPU | $0.000463/sec | ~$0.028 |
| Container runtime | $0.000032/sec | ~$0.003 |
| Cold start (amortized) | ~30s | ~$0.015 |
| **Total per generation** | | **~$0.05** |

### Break-Even Analysis

At $19/mo Pro tier with 1,000 credits:

- Cost per generation: ~$0.05 (Modal) + ~$0.01 (infra) = **$0.06**
- Revenue per generation: $19 / 1,000 = **$0.019**
- **Gap:** each generation costs ~3x what it earns

Mitigations:
1. Keep containers warm during peak hours (reduce cold starts)
2. Adjust pricing: $29/mo or 500 credits instead of 1,000
3. Add usage-based pricing for overage (e.g., $0.10/credit after allocation)

---

## Rate Limiting (SQL)

```sql
create or replace function check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from rate_limits
  where user_id = p_user_id
    and action = p_action
    and created_at > now() - (p_window_seconds || ' seconds')::interval;

  if v_count >= p_limit then
    return false;
  end if;

  insert into rate_limits (user_id, action) values (p_user_id, p_action);
  return true;
end;
$$ language plpgsql;
```

---

## Frontend Deployment

Vercel is the recommended frontend host (best React/Vite support, automatic CI/CD, free tier).

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

Environment variables:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

*Refactored: 2026-02-06 (stripped from 2,500-line monolith to billing/cost focus)*
*For full architecture: see [`architecture.md`](./architecture.md)*
