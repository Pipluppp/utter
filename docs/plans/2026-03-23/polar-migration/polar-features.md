# Polar.sh Feature Reference

## What Polar Is

Polar is a Merchant of Record (MoR) billing platform. Unlike Stripe (a payment processor where you are the seller), Polar is the legal seller of your products. They handle international tax compliance — registration, collection, filing, and remittance — globally.

- Open source (Apache 2.0)
- Built on top of Stripe (uses Stripe as the underlying payment processor)
- Dashboard: https://polar.sh (production), https://sandbox.polar.sh (sandbox)
- API: `https://api.polar.sh/v1` (production), `https://sandbox-api.polar.sh/v1` (sandbox)

## Products

Everything in Polar is modeled as a Product.

### Billing cycles

- **One-time purchase**: customer pays once, gets access forever
- **Recurring**: daily, weekly, monthly, yearly, or custom intervals (e.g. every 2 weeks)

### Pricing types

- **Fixed price**: set amount
- **Pay what you want**: optional minimum and default amounts
- **Free**: no charge

### Multi-currency

10 supported currencies: USD, EUR, GBP, CAD, AUD, JPY, CHF, SEK, INR, BRL. Customer currency is auto-detected by geography. Price structure must be identical across currencies.

### Product management

- Name, markdown description, media uploads (up to 10MB)
- Custom checkout fields (text, number, date, checkbox, select)
- Billing cycle and pricing type cannot change after creation
- Price adjustments apply only to new customers
- Products archive rather than delete; existing customers keep access
- Separate products recommended instead of variants

## Benefits (Entitlements)

Benefits are standalone resources attached to one or many products. Six built-in types:

### 1. Credits

Credits a customer's Usage Meter balance.

- On subscriptions: credited at the start of each billing cycle
- On one-time products: granted once at purchase
- Optional rollover of unused credits to next cycle
- Polar does NOT auto-block usage when credits run out — your app must enforce limits

### 2. License Keys

Auto-generated software license keys with customizable format and branding. API endpoints for activation, deactivation, and validation.

### 3. Feature Flags

Simple API-driven boolean flags with optional metadata.

### 4. File Downloads

Secure file delivery up to 10GB per file, any file type.

### 5. GitHub Repository Access

Auto-invite customers to private repos with permission management.

### 6. Discord Invite

Auto-invite and role assignment for Discord servers.

### Access rules

- Active subscribers get benefits; cancelled/expired users lose access
- One-time purchasers get lifetime access to attached benefits

## Usage-Based Billing

### Events

Track customer actions. Structure:

- `name`: string identifier (e.g. `"tts_generation"`)
- `customer_id` or `external_customer_id`: ties event to customer
- `metadata`: JSON object (e.g. `{"characters": 1500, "voice_id": "abc"}`)

Events are permanent (immutable once ingested). Submitted via the Events Ingestion API.

### Meters

Aggregate and filter events into billable usage metrics. A meter specifies which events to capture and how to calculate totals (e.g. filter events named `tts_generation` and sum the `characters` field).

### Metered Prices

Link meters to subscription products for usage-based charges. Credits are deducted first before overage charges apply.

### Balance tracking

Via Customer State API (full customer overview) or Customer Meters API (specific meter queries).

## Checkout

Three integration methods:

### Checkout Links (no-code)

Shareable URLs created in the dashboard. Support query params: `?products=ID&customerId=X&customerEmail=X&metadata={...}`

### Embedded Checkout

Drop-in widget on your site via `@polar-sh/checkout` npm package or HTML `data-polar-checkout` attribute. Events: `loaded`, `close`, `confirmed`, `success`. Apple Pay / Google Pay require domain validation via Polar support.

### Checkout API (programmatic)

`POST /v1/checkouts/` with full control:

- `products`: array of product UUIDs (required)
- `success_url`: redirect after payment (supports `{CHECKOUT_ID}` placeholder)
- `metadata`: up to 50 key-value pairs (keys max 40 chars, values max 500 chars)
- `customer_email`: pre-fill customer email
- `external_customer_id`: link to your user system
- `customer_metadata`: additional customer info
- `custom_field_data`: custom field values
- `amount`: custom price in cents (for pay-what-you-want)
- `discount_id`: apply existing discount
- `currency`: override detected currency
- `embed_origin`: for iframe security
- `require_billing_address`: boolean

Response includes: `id`, `url`, `client_secret`, `status`, amounts, and all submitted data.

## Webhooks

Follows the Standard Webhooks specification.

### Setup

Dashboard > Organization Settings > Webhooks > Add Endpoint. Configure URL, delivery format (Raw JSON, Discord, Slack), signing secret, and event subscriptions.

### Delivery

- Up to 10 retries with exponential backoff
- 10 second timeout (recommend responding within 2 seconds)
- Endpoints auto-disabled after 10 consecutive failures
- Does NOT follow redirects
- Expected response: 2xx status code

### Signature verification

Built into SDKs (`validateEvent()` in TypeScript). Secret is base64-encoded per Standard Webhooks spec.

### IP allowlist

```
3.134.238.10
3.129.111.220
52.15.118.168
74.220.50.0/24
74.220.58.0/24
```

### Event types

**Checkout**: `checkout.created`, `checkout.updated`, `checkout.expired`

**Customer**: `customer.created`, `customer.updated`, `customer.deleted`, `customer.state_changed`

**Order**: `order.created`, `order.paid`, `order.refunded`, `order.updated`

**Subscription**: `subscription.created`, `subscription.active`, `subscription.updated`, `subscription.canceled`, `subscription.uncanceled`, `subscription.past_due`, `subscription.revoked`

**Benefit grant**: `benefit_grant.created`, `benefit_grant.updated`, `benefit_grant.cycled`, `benefit_grant.revoked`

**Refund**: `refund.created`, `refund.updated`

**Product/Benefit/Org**: `product.created`, `product.updated`, `benefit.created`, `benefit.updated`, `organization.updated`

### Local development

```bash
curl -fsSL https://polar.sh/install.sh | bash
polar listen http://localhost:3000/api/webhooks/polar
```

## Authentication

### Organization Access Tokens (OAT) — recommended for server-to-server

- Generated in organization settings
- Format: `Authorization: Bearer polar_oat_xxxxxxxxxxxxxxxxx`
- Scoped to one organization
- Must be kept server-side only
- Auto-revoked if detected in public repos (GitHub Secret Scanning participant)

### Customer Access Tokens — for customer-facing apps

- Generated server-side via `POST /v1/customer-sessions/`
- Restricted to individual customer data only

### OAuth 2.0 — for partner integrations

## SDKs

### TypeScript

```bash
npm install @polar-sh/sdk
```

```typescript
import { Polar } from '@polar-sh/sdk';

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: 'sandbox', // or 'production'
});
```

### Hono Adapter (`@polar-sh/hono`)

Directly relevant — the Utter API Worker uses Hono.

```bash
npm install @polar-sh/hono zod
```

Provides:

- `Checkout()` handler — mounts as GET route for checkout creation
- `Webhooks({ webhookSecret, onPayload })` — mounts as POST route with typed per-event handlers (`onOrderPaid`, `onOrderRefunded`, etc.)
- `CustomerPortal()` — self-service subscription management

### Other SDKs

Python, Go, PHP. Framework adapters for Next.js, Express, Fastify, Remix, Nuxt, SvelteKit, Astro, Elysia, Deno, BetterAuth, Laravel, Supabase.

## Customer Portal

Hosted at `https://polar.sh/{org-slug}/portal`. Customers can view orders, receipts, access benefits, and manage subscriptions. Pre-authenticated links available via `customerSessions` API.

## Sandbox

- Fully isolated from production (separate accounts, tokens, data)
- Test card: `4242 4242 4242 4242` (any future expiry, any CVC)
- Subscriptions auto-cancel after 90 days
- Rate limit: 100 req/min (vs 500 in production)

## Tax Handling

### Registered jurisdictions

- EU VAT via Irish One Stop Shop (registration: `EU372061545`)
- UK VAT via direct registration
- US state sales taxes (upon reaching thresholds per state)

### How it works

Polar uses Stripe Tax for rate calculation but assumes the liability — registration, filing, and remittance with tax authorities.

### Your responsibility

Income/revenue taxes in your country of residence only.

## Rate Limits

- Production: 500 requests/minute per organization
- Sandbox: 100 requests/minute per organization
- Unauthenticated: 3 requests/second
