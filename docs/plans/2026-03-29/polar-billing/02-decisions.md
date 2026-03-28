# Decisions

All decisions resolved. Summary at the bottom, details below.

---

## 1. SDK approach — Raw SDK

Use `@polar-sh/sdk` directly, not the `@polar-sh/hono` adapter.

Why: matches existing code style, full control over dedup/error handling, avoids Workers compatibility risk with the adapter. The code is already simple enough (~80-120 lines). The adapter would add `zod` as a dependency for marginal savings.

## 2. Stripe code — Remove entirely

Clean break. Stripe has never processed a real transaction for Utter. No in-flight events exist. Code is in git history if ever needed.

## 3. Customer mapping — External customer ID

Pass `external_customer_id` (Supabase user UUID) on every checkout. One extra field, but it:

- Links Polar customer records to our users
- Enables Customer Portal, Customer State API, order history
- Sets up the path for future usage meters

## 4. Webhook path — `/api/webhooks/polar`

Clear naming over generic. Changing a webhook URL later is trivial.

## 5. Refund handling — Handle `order.refunded`

Reverse the credit grant on refund. Floor at zero if user already spent credits. Uses existing `paid_reversal` operation in the credit ledger.

## 6. Production timing — Sandbox first

Develop and test in sandbox. Cut to production once checkout → webhook → credit grant is verified end-to-end.

## 7. Usage meters — Keep custom ledger

Our `credit_ledger` with atomic Postgres RPCs is fast (~5ms), provider-agnostic, and battle-tested. Polar's meters would add ~100-300ms latency and an external dependency. Not worth it.

---

## Summary

| Decision          | Choice                                 |
| ----------------- | -------------------------------------- |
| SDK approach      | Raw SDK (`@polar-sh/sdk`)              |
| Stripe code       | Remove entirely                        |
| Customer mapping  | External customer ID (Supabase UUID)   |
| Webhook path      | `/api/webhooks/polar`                  |
| Refund handling   | Handle `order.refunded`, floor at zero |
| Production timing | Sandbox first                          |
| Usage meters      | Keep custom ledger                     |
