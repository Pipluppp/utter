# Decision Points

Open decisions that need input before or during implementation.

---

## Decision 1: Use Hono adapter or raw SDK?

### Option A: Raw SDK (`@polar-sh/sdk` only)

Write checkout and webhook routes manually using the Polar SDK directly. This is what the migration plan currently shows.

**Pros:**
- Full control over request/response handling
- Matches the existing code style (explicit Hono routes)
- Easier to understand — no magic
- Webhook handler stays in `billing.ts` alongside checkout

**Cons:**
- More code than the adapter (~80-120 lines vs ~30 lines)
- Must import `validateEvent` and handle signature verification yourself (one line, but still manual)

### Option B: Hono adapter (`@polar-sh/hono`)

Use Polar's official Hono adapter which provides `Checkout()` and `Webhooks()` route handlers.

**Pros:**
- Minimal code (~30 lines total)
- Typed event handlers (`onOrderPaid`, `onOrderRefunded`)
- Checkout route is a single function call
- Signature verification is automatic

**Cons:**
- Adds `zod` as a dependency
- Less visible control over request parsing and error handling
- Adapter may not support all custom patterns (e.g. dedup via `billing_events` table before processing)
- Another dependency to maintain/update
- Cloudflare Workers compatibility not guaranteed (adapter may assume Node.js)

### Recommendation

**Option A (raw SDK)** for now. The explicit approach matches the existing codebase style, gives full control over the deduplication and error handling patterns already in place, and avoids a Workers compatibility risk with the Hono adapter. The code is already simple enough with just the SDK.

Revisit Option B later if the SDK approach feels too verbose.

---

## Decision 2: Keep Stripe code or remove it?

### Option A: Remove Stripe code entirely

Delete all Stripe-specific code, types, and helpers from `billing.ts` and `credits.ts`. Clean break.

**Pros:**
- No dead code
- Simpler codebase
- No confusion about which provider is active

**Cons:**
- Harder to revert if Polar doesn't work out (must recover from git)
- Stripe webhook endpoint stops responding (any in-flight Stripe events will fail)

### Option B: Keep Stripe code behind a feature flag

Add a `BILLING_PROVIDER` env var (`"polar"` or `"stripe"`) and route to the appropriate handler.

**Pros:**
- Easy A/B testing or gradual rollover
- Instant rollback by changing one env var

**Cons:**
- More code to maintain
- Both code paths need testing
- Adds complexity for a scenario that may never be needed

### Option C: Keep Stripe webhook alive briefly, only use Polar for new checkouts

Route new checkouts through Polar but keep the Stripe webhook alive for a transition period in case any in-flight Stripe events arrive.

**Pros:**
- Safe transition
- No lost events

**Cons:**
- Stripe has never been used in production (no real events in flight)
- Adds complexity for no real benefit given current state

### Recommendation

**Option A (remove entirely)**. Stripe has never processed a real transaction for Utter. There are no in-flight events. The code is in git history if ever needed. Clean break is simplest.

---

## Decision 3: Customer identity mapping

### Option A: Metadata only (current Stripe pattern)

Pass `user_id` in checkout metadata. On webhook, read `metadata.user_id` to identify the user. No Polar customer record linked to Supabase user.

**Pros:**
- Simplest migration — same pattern as current Stripe implementation
- No new tables or mappings needed
- Works immediately

**Cons:**
- No persistent customer record in Polar tied to your user
- Can't use Polar's Customer Portal or Customer State API
- Each checkout creates a new Polar customer (or anonymous)

### Option B: External customer ID mapping

Pass `external_customer_id` (set to Supabase user UUID) when creating checkouts. Polar creates/reuses a customer record linked to your user ID.

**Pros:**
- Polar maintains a customer record tied to your user
- Can query customer state, order history, and benefits via Polar API
- Customer Portal works (customers can view their orders)
- Foundation for future usage meters and benefits
- `customer.state_changed` webhook gives full customer context

**Cons:**
- Slightly more setup
- Need to pass `external_customer_id` on every checkout

### Recommendation

**Option B (external customer ID)**. The extra effort is one additional field on the checkout call, and it unlocks Polar's customer management for free. This also sets up the path toward usage meters if you go that route later.

---

## Decision 4: Webhook endpoint path

### Option A: `/api/webhooks/polar`

New path, clearly named for the new provider.

**Pros:**
- Clean naming
- No ambiguity

**Cons:**
- Need to update webhook URL in Polar dashboard if you ever change it

### Option B: `/api/webhooks/billing`

Generic path that works regardless of provider.

**Pros:**
- Provider-agnostic — survives future provider changes
- Only one webhook URL to configure

**Cons:**
- Less obvious which provider is behind it
- Would need provider detection if ever supporting multiple

### Recommendation

**Option A (`/api/webhooks/polar`)**. Clear is better than clever. If you switch providers again, changing a webhook URL is trivial.

---

## Decision 5: Refund handling

### Option A: Handle `order.refunded` webhook

Listen for `order.refunded` events and reverse the credit grant (debit the credits back).

**Pros:**
- Correct accounting
- Credits can't be spent after a refund

**Cons:**
- User may have already spent credits — could leave negative balance
- Need to decide behavior when balance < refund amount
- More code

### Option B: Ignore refunds initially

Don't automate refund handling. Process refunds manually if they occur.

**Pros:**
- Simpler launch
- Refunds are rare, especially at $2.99-$9.99 price points
- Can add later when needed

**Cons:**
- Credits remain after refund until manual intervention
- Not scalable long-term

### Recommendation

**Option A (handle refunds)** with a floor of zero — if the user has fewer credits than the refund amount, set balance to zero. Use the existing `paid_reversal` operation in the credit ledger. This is straightforward and prevents the awkward case of refunded-but-still-has-credits.

---

## Decision 6: When to do production cutover?

### Option A: Sandbox-only initially

Set up everything in sandbox, test thoroughly, then cut over to production when ready to accept real payments.

### Option B: Go straight to production

Skip extended sandbox testing, configure production immediately.

### Recommendation

**Option A**. Use sandbox for development and E2E testing. Cut to production once the checkout flow, webhook processing, and credit grants are verified end-to-end. The sandbox environment is free and fully functional.

---

## Decision 7: Future — Polar usage meters vs custom ledger

Not a decision for now, but worth documenting for later.

### Current: Custom credit ledger (keep)

Your `credit_ledger` table with atomic RPC functions handles all credit accounting. Prepaid packs grant credits; usage debits them. This is provider-agnostic and well-tested.

### Future possibility: Polar usage meters

Polar's built-in Meters + Events API could eventually replace the custom ledger:

- Define a meter (e.g. `tts_characters`) in Polar
- On each generation, call `polar.events.ingest()` with character count
- Credit packs would use Polar's Credits benefit (auto-credited on purchase)
- Balance checking via Customer Meters API

**Trade-offs:**

| Aspect | Custom ledger | Polar meters |
|--------|--------------|--------------|
| Latency | Local DB query (~5ms) | API call to Polar (~100-300ms) |
| Atomicity | Postgres transaction | Eventually consistent |
| Control | Full | Limited to Polar's model |
| Complexity | More code to maintain | Less code, but external dependency |
| Offline/outage | Works (DB is up) | Fails if Polar API is down |

**Recommendation:** Keep the custom ledger. It's battle-tested, fast, and provider-agnostic. The latency and availability trade-offs of external meters aren't worth it for a small-to-medium app. Revisit only if maintaining the ledger becomes a significant burden.

---

## Summary of Recommendations

| Decision | Recommendation |
|----------|---------------|
| SDK approach | Raw SDK (`@polar-sh/sdk`), not Hono adapter |
| Stripe code | Remove entirely |
| Customer mapping | External customer ID (Supabase UUID) |
| Webhook path | `/api/webhooks/polar` |
| Refund handling | Handle `order.refunded`, floor at zero |
| Production timing | Sandbox first, then cutover |
| Usage meters | Keep custom ledger, don't use Polar meters |
