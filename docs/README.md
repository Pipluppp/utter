# Utter Docs

Canonical docs for the active Cloudflare + Supabase runtime.

## Start Here

1. [stack.md](./stack.md)
2. [architecture.md](./architecture.md)
3. [setup.md](./setup.md)
4. [deploy.md](./deploy.md)

## Core Docs

- [backend.md](./backend.md): API Worker routes, queue model, storage and billing touchpoints
- [cloudflare-security.md](./cloudflare-security.md): active zone-level WAF, bot, and rate-limit protections on `uttervoice.com`
- [database.md](./database.md): tables, RLS, credit ledger, storage policy model
- [features.md](./features.md): user-facing flows and where they live in code

## Package Docs

- [frontend/README.md](../frontend/README.md)
- [workers/api/README.md](../workers/api/README.md)
- [workers/frontend/README.md](../workers/frontend/README.md)
- [supabase/README.md](../supabase/README.md)

## Canonical vs Historical

- The files listed above are the main onboarding path.
- Dated folders under `docs/20*/` are historical plans, audits, and execution notes.
- Top-level supporting notes in `docs/` may still be useful, but they are not the primary read order unless linked from a canonical doc.

## Update Rule

If you change runtime behavior, routes, bindings, schema, or deploy flow, update the matching canonical doc in the same change.
