# Cloudflare Security

Read this when you need the current edge security posture for the branded app domain.

## Scope

This document covers the active Cloudflare security controls on `https://uttervoice.com`.

It does not cover:

- application-layer auth and database protections in Supabase
- Worker route validation inside the API Worker
- direct public `*.workers.dev` hostnames outside the `uttervoice.com` zone

## Protected Surface

- Branded frontend traffic goes through `https://uttervoice.com`
- The frontend Worker serves the SPA and proxies branded `/api/*` traffic to the API Worker
- Zone-level Cloudflare WAF and bot protections apply to requests sent to `uttervoice.com`

## Active Controls

### Security settings

- `Bot Fight Mode`: on
- `Block AI bots`: on
- `Browser Integrity Check`: on
- `Onion Routing`: off

### Custom WAF rules

Rules are evaluated in this order:

1. `Allow Good Bots`
2. `Aggressive Crawlers`
3. `Challenge Large Providers`
4. `Block Scanner Paths, Tor, AI Crawlers`

What they do:

- allow verified good bots to bypass selected edge controls
- managed-challenge suspicious crawlers and generic scripted traffic
- managed-challenge traffic from large cloud-hosting ASNs commonly used by scanners
- block known scanner paths, Tor traffic, and verified AI crawler categories we do not want

### Rate limiting

- Rule name: `API rate limit`
- Scope: branded `/api` and `/api/*`
- Threshold: `50` requests per IP per `10` seconds
- Action: `Block`
- Mitigation timeout: `10` seconds

## Why This Exists

After `uttervoice.com` was attached to Cloudflare, the zone started receiving routine PHP/Laravel/WordPress-style vulnerability probes. The app stack is not vulnerable to those paths, but the traffic still consumed edge and Worker resources.

The current Cloudflare layer is meant to:

- stop obvious scanner traffic before it reaches the Workers
- reduce wasted Worker invocations from automated probing
- add a first edge layer in front of the existing Worker and Supabase protections

## Verification Signals

The current dashboard path for event review is `Analytics -> Events`.

Expected signals:

- `Bot fight mode` challenges on obviously automated clients
- `Custom rules` matches for crawler UAs, cloud ASN traffic, scanner paths, or Tor
- `Rate limiting rules` events if a client floods the branded `/api/*` surface

## Important Caveat

These protections apply to `uttervoice.com` only.

The API Worker's public `workers.dev` hostname was disabled on 2026-03-19, so the main backend bypass path has been removed.

Any separately exposed Worker hostname still sits outside the `uttervoice.com` zone protections and should be treated as a separate exposure surface until it is disabled or protected independently.

## Related Docs

- [architecture.md](./architecture.md)
- [backend.md](./backend.md)
- [deploy.md](./deploy.md)
- [supabase-security.md](./supabase-security.md)
- [2026-03-18/cloudflare-security/cloudflare-security-plan.md](./2026-03-18/cloudflare-security/cloudflare-security-plan.md)
