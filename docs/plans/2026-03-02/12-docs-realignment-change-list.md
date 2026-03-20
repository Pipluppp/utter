# Docs Realignment Change List

Date: 2026-03-02

## Summary

Core docs were updated from Supabase Edge/Vercel-first narrative to current Cloudflare hybrid narrative.

## Updated files

1. `README.md`
- Updated stack description and local run path to Worker API + Supabase local services.

2. `docs/README.md`
- Simplified docs index and added canonical setup/deploy path.

3. `docs/architecture.md`
- Rewritten as current-state architecture source of truth.

4. `docs/backend.md`
- Rewritten to API Worker route/runtime model.

5. `docs/deployment-architecture.md`
- Rewritten to Cloudflare deployment topology and release gates.

6. `docs/vercel-frontend.md`
- Repositioned as historical reference.

7. `docs/tasks.md`
- Updated active task queue to post-implementation continuation work.

8. `AGENTS.md`
- Updated repo working guide to current stack and commands.

## Added files

1. `docs/setup.md` - canonical local setup runbook
2. `docs/deploy.md` - canonical deploy runbook
3. `docs/2026-03-02/09-cloudflare-wrangler-audit-report.md`
4. `docs/2026-03-02/10-cloudflare-wrangler-remediation-backlog.md`
5. `docs/2026-03-02/11-security-hybrid-hardening-actions.md`

## Security/config updates in this pass

1. `workers/api/wrangler.toml`
- Tightened CORS defaults from wildcard to explicit local/staging/prod allowlists.

2. `workers/api/src/_shared/rate_limit.ts`
- Switched limiter identity to IP-based actors to remove unverified JWT payload trust.

## Follow-up

- Keep old date-stamped docs immutable as implementation/audit history.
- Treat core docs (`architecture`, `setup`, `deploy`, `backend`) as maintained source-of-truth set.
