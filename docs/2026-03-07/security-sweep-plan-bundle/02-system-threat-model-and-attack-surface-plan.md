# Plan 02: System Threat Model and Attack Surface Mapping

## Goal

Build a current-state threat model that covers real trust boundaries, sensitive assets, and attacker paths across the simplified architecture.

## In-scope architecture map

1. Browser -> Frontend Worker (`utter`)
2. Frontend Worker -> API Worker (`utter-api-staging`)
3. API Worker -> Supabase Auth/Postgres
4. API Worker -> R2 (references/generations)
5. API Worker -> Cloudflare Queues consumer path
6. API Worker -> external providers (Qwen, transcription provider, Stripe)

## Threat modeling tasks

1. Inventory crown-jewel assets:
- Access tokens and refresh tokens
- Supabase service role capabilities
- Billing and credit ledger integrity
- User audio objects and signed URLs
- Queue messages and task state transitions

2. Enumerate trust boundaries and identities:
- User-authenticated vs unauthenticated paths
- Service-role operations
- Worker-to-provider calls
- Signed upload/download token validation

3. Enumerate core threat classes:
- Authentication/session abuse
- Authorization and cross-tenant data access
- Task-state tampering and replay
- Queue message abuse/retry abuse
- R2 object enumeration or token forgery
- Billing/credits fraud and webhook abuse

4. Build misuse/abuse cases per route family:
- `/api/clone/*`
- `/api/voices/design*`
- `/api/generate`, `/api/tasks/*`
- `/api/credits/*`, `/api/billing/*`

## Deliverables

1. Threat model diagram set
2. Attack surface register (route-level)
3. Prioritized security hypotheses for test phase

## Exit criteria

1. Every critical data flow has at least one abuse hypothesis.
2. High-risk routes are prioritized for active testing.
