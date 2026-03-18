# 2026-03-19 Follow-up Workstreams

Follow-up tasks moved from [2026-03-18](../2026-03-18/README.md) to keep that folder focused on the auth critical path + Cloudflare security.

These workstreams are not blockers for the current goal of "branded domain + working signup + production security." They can run after or in parallel.

## OAuth (`oauth/`)

Add OAuth sign-in (Google first) to the branded app domain.

- `oauth-follow-up-plan.md` — implementation plan
- `oauth-research-verification.md` — research verification notes

**Depends on:** Domain cutover (01) and ideally email verification (03) from [2026-03-18 auth-rollout](../2026-03-18/auth-rollout/).

**Execution prompt:** Prompt 6 in `docs/2026-03-18/auth-rollout/06-execution-prompts.md`

## Stripe Testing (`stripe-testing/`)

Verify Stripe checkout + webhook credit grants in test mode.

- `stripe-testing-plan.md` — full testing plan (local + hosted + resilience)
- `stripe-testing-research-verification.md` — research verification notes

**No dependency** on auth rollout or domain. Can start anytime.

**No execution prompt written yet.** The plan is self-contained with clear testing layers.
