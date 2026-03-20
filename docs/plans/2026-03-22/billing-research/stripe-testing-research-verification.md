# Stripe Testing Plan — Research Verification Notes

## Verdict: Plan is thorough and correct. One addition.

---

## Confirmed correct

1. Stripe sandbox/test mode is sufficient for all planned testing
2. Stripe CLI `listen --forward-to` is the right local webhook testing tool
3. Webhook endpoints must be publicly accessible HTTPS URLs
4. Tokens are single-use and idempotency is already tested in the repo
5. Price IDs in Worker secrets must match sandbox price objects exactly
6. Success/cancel URLs derived from request origin will work across all hostnames
7. Stripe retries failed deliveries and event ordering is not guaranteed
8. The three testing layers (local webhook, hosted staging, resilience) are
   well-structured

---

## Addition: Stripe CLI install + webhook secret

The local testing section assumes Stripe CLI is available but doesn't specify
the install command. For the execution prompt:

```bash
# Install Stripe CLI (Windows)
scoop install stripe
# or download from https://docs.stripe.com/stripe-cli

# Login
stripe login

# Forward events to local API Worker
stripe listen --forward-to http://127.0.0.1:8787/api/webhooks/stripe
```

The `stripe listen` command outputs a webhook signing secret (starting with
`whsec_`). This needs to go into `workers/api/.dev.vars` as
`STRIPE_WEBHOOK_SECRET` for local testing, overriding whatever production secret
is set.

---

## Confirmed no dependency on domain or auth rollout

The plan correctly identifies that Stripe testing can start in parallel with
auth work. The webhook endpoint works on any publicly accessible hostname
(`workers.dev` or `uttervoice.com`).
