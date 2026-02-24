# Task 2B: Paid Credit Addition Pipeline (Prepaid Packs)

## Goal

Ship a secure prepaid purchase flow that grants credits exactly once on successful verified payments.

## Finalized Commercial Model

- `pack_150k`: `$10` -> `150000` credits
- `pack_500k`: `$25` -> `500000` credits
- no subscriptions
- no monthly replenishment
- no expiry in this phase

## Scope

- `POST /api/billing/checkout` (authenticated)
- `POST /api/webhooks/stripe` (signature-verified webhook endpoint)
- ledger-backed grants via `credit_apply_event`
- billing event storage for replay safety and audit
- frontend purchase flow updates (`/pricing`, `/account/billing`)

## Core Invariants

1. Balance source of truth remains `profiles.credits_remaining` + immutable `credit_ledger`.
2. Every paid grant is idempotent by provider event ID.
3. Grant amount is resolved from trusted server mapping (`price_id -> credits`), not raw metadata amount.
4. Client endpoints never grant credits directly.
5. Replayed/duplicate webhook events never double-grant credits.

## Data Model

### `public.billing_events`

Recommended minimal table:

- `id bigserial primary key`
- `provider text not null default 'stripe'`
- `provider_event_id text not null unique`
- `event_type text not null`
- `user_id uuid references auth.users(id) on delete set null`
- `status text not null check (status in ('received','processed','ignored','failed'))`
- `credits_granted integer`
- `ledger_id bigint references public.credit_ledger(id)`
- `error_detail text`
- `payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `processed_at timestamptz`

Indexes:

- `(user_id, created_at desc)`
- `(provider_event_id)` unique

## Security Model for `billing_events`

- enable RLS
- no authenticated/anon policies
- revoke all table privileges from `public`, `anon`, `authenticated`
- grant `service_role` only required privileges
- add pgTAP grants/RLS tests aligned with existing hardening style

## API Behavior

### `POST /api/billing/checkout`

- requires authenticated JWT
- accepts `pack_id` from allowlist: `pack_150k|pack_500k`
- creates Stripe Checkout session in `mode=payment`
- stores metadata for reconciliation (`user_id`, `pack_id`)
- returns checkout URL only

### `POST /api/webhooks/stripe`

- verifies Stripe signature before business logic
- dedupes by `provider_event_id`
- handles `checkout.session.completed`
- expands session line items and resolves `price_id`
- maps `price_id -> credits` from server config
- grants credits via `credit_apply_event`:
  - `event_kind='grant'`
  - `operation='paid_purchase'`
  - `reference_type='billing'`
  - idempotency key like `stripe:event:<event_id>:grant`
- writes processing result back to `billing_events`
- ignores unsupported events safely

## Observability + Reconciliation

Log and query by:

- request ID
- provider event ID
- user ID
- ledger ID
- grant outcome

Reconciliation must support: `billing_event -> ledger row -> final balance`.

## Frontend Implications

- pricing page uses prepaid pack cards
- billing page provides purchase CTA and purchase history
- usage page shows granted `paid_purchase` events via ledger history
- remove monthly-plan copy and monthly-credit framing

## Testing Requirements

### Database

- grants/rls for `billing_events`
- paid grant idempotency behavior
- operation/reference constraints updated for paid flow

### Edge

- checkout requires auth
- invalid pack ID rejected
- invalid webhook signature rejected
- duplicate webhook does not double-grant

### Security probes

- direct client attempts to grant credits fail
- forged/replayed webhook payloads do not mint extra credits

## Non-goals (this phase)

- subscription billing lifecycle
- customer portal features
- tax/VAT/PDF invoice workflows
- multi-provider abstraction

## Required Security Gate

Before release completion, execute:

- `docs/2026-02-23/security-supabase/S9-post-credits-security-gate.md`

Store evidence under:

- `docs/security/audits/YYYY-MM-DD/paid-credits-gate.md`
