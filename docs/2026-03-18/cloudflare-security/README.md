# Cloudflare Security Hardening

WAF, bot protection, and rate limiting configuration for `uttervoice.com` on the Cloudflare Free plan.

## Context

Within hours of attaching `uttervoice.com` to our Cloudflare Workers on 2026-03-18, automated vulnerability scanners probed the site for PHP, Laravel, and WordPress vectors. The SPA catch-all returned `200 OK` for every path, encouraging continued probing. This triggered the security hardening research documented here.

## Files

| File | Purpose |
|---|---|
| `cloudflare-security-plan.md` | Final validated implementation plan - 4 WAF custom rules, rate limiting, dashboard toggles |
| `execution-prompt.md` | Agent execution prompt for walking a user through the dashboard steps |
| `vulnerability-scan-event.md` | Post-mortem of the 2026-03-18 scanner burst that triggered this work |
| `cloudflare-security-hardening-plan.md` | Superseded initial draft - kept for reference only |

## How we arrived at this plan

### Trigger

The vulnerability scan event (`vulnerability-scan-event.md`) showed that a single IP from FBW NETWORKS SAS (Paris) fired dozens of PHP and Laravel probes in about 8 seconds. None were effective because we have no PHP stack, but the `200` responses for every path signaled "keep probing" to the scanner.

### Research sources

1. **Cloudflare WAF documentation** - Free plan limits (5 custom rules, 1 rate limiting rule), expression language, Bot Fight Mode, Block AI Bots, Browser Integrity Check, Onion Routing toggle, current Skip behavior, and current Tor / ASN fields.

2. **Cloudflare Workers Rate Limit binding docs** - Evaluated for in-Worker rate limiting. Deferred as P2 since the dashboard rate limiting rule covers the branded `/api/*` surface and our Supabase RPC already has 3-tier rate limits.

3. **webagencyhero "WAF Rules V3" guide** - The primary structural influence. This community guide provides a useful 5-rule pattern designed to fit within the Free plan's 5-rule limit:
   - Rule 1: Allow Good Bots (Skip)
   - Rule 2: Aggressive Crawlers (Managed Challenge)
   - Rule 3: Challenge Large Cloud Providers (Managed Challenge)
   - Rule 4: Challenge VPNs + sensitive paths (Managed Challenge)
   - Rule 5: Block bad hosts + Tor + specific paths (Block)

   We adapted this to 4 rules for our non-WordPress SPA stack: merged Rules 4 and 5 into a single Block rule, replaced WordPress-specific paths with our scanner-targeted paths (`.php`, `.env`, `wp-*`, `storage/logs`), and kept one rule slot reserved for emergency response.

   The final plan in this directory corrects several now-outdated assumptions from older community guides:
   - Bot Fight Mode cannot be skipped by a WAF Skip rule
   - Security Level / threat score should not drive new rules
   - Tor traffic uses `ip.src.continent eq "T1"`
   - Zone WAF rules protect `uttervoice.com`, not direct `*.workers.dev` hostnames

4. **Cloudflare dashboard screenshots from the webagencyhero guide** - Useful for rough UI orientation only. Current Cloudflare docs take precedence for actual behavior.

### Design decisions

- **Dashboard-only, no code changes** - Minimizes implementation risk. Code-level hardening such as security headers and Workers Rate Limit bindings remains a separate follow-up.
- **4 rules, not 5** - Keeps one slot reserved for emergency response.
- **Managed Challenge over Block for Rules 2-3** - Less aggressive than blocking; real humans can still solve the challenge if they happen to match.
- **Good bots skip selected controls, not Bot Fight Mode** - Current Cloudflare behavior does not let Free-plan WAF Skip rules bypass Bot Fight Mode, so later custom rules still carry explicit bot exclusions.
- **Rate limiting on the branded `/api/*` surface only** - Static SPA assets are cheap; API invocations are where abuse costs credits and compute. Direct `workers.dev` API access remains a separate exposure until hostname policy changes.
- **Complements existing defenses** - Supabase RPC 3-tier rate limits, JWT auth, and CORS origin lock already exist at the application layer.

## Execution

Use `execution-prompt.md` to walk through the dashboard configuration step by step.

## Sequence position

This is task **05** in the [2026-03-18 auth rollout](../README.md) critical path:

1. App domain cutover
2. Resend SMTP setup
3. Email verification cutover
4. Turnstile abuse protection
5. **Cloudflare security hardening** <- this directory
