# Vercel Frontend (Historical)

Last updated: 2026-03-02

This doc is retained as historical context.

Current stack no longer uses Vercel as the primary frontend host. Frontend delivery is now handled by Cloudflare Workers (`workers/frontend`), with `/api/*` proxied to the Cloudflare API Worker.

## What changed

- Previous: Vercel-hosted SPA + `/api/*` rewrite to Supabase Edge Functions
- Current: Cloudflare Worker-hosted SPA + `/api/*` service binding to Cloudflare API Worker

Supabase remains the system of record for Postgres/Auth/RLS/credits/billing.

## Historical references

- Migration implementation details: `2026-03-01/`
- Migration phase audit evidence: `security/audits/2026-03-02/`
- Current architecture source of truth: `architecture.md`
- Current deploy runbook: `deploy.md`
