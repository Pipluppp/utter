# Execution Prompt

Implement the API rate-limit hardening plan in this directory.

Objective:

- Add a cheap Worker-native coarse limiter ahead of the current Supabase RPC limiter
- Keep the Supabase limiter as the durable application/business limiter
- Fix rate-limit identity trust order
- Add a cleanup/retention path for `rate_limit_counters`

Required reading before changes:

1. `docs/2026-03-19/03-surface-hardening/api-rate-limit-hardening/README.md`
2. `docs/2026-03-19/03-surface-hardening/api-rate-limit-hardening/api-rate-limit-hardening-plan.md`
3. `docs/2026-03-19/01-api-worker-privatization/README.md`
4. `workers/api/src/index.ts`
5. `workers/api/src/_shared/rate_limit.ts`
6. `supabase/migrations/20260223193000_rate_limits_observability.sql`
7. `workers/api/tests/rate_limits.test.ts`

Implementation requirements:

1. Add a Worker-native coarse limiter that runs before the existing Supabase RPC limiter.
2. Keep the Supabase RPC limiter; do not remove it.
3. Prefer `cf-connecting-ip` over `x-forwarded-for`.
4. Use verified user identity for durable limiting on protected routes where feasible.
5. Add or document a retention path for `rate_limit_counters`.
6. Update tests to cover the new layering and identity behavior.

Manual interruption points:

1. Pause if Cloudflare rate-limit binding namespace IDs cannot be chosen confidently from repo context alone.
2. Pause if adding DB-side cleanup requires introducing a new scheduling mechanism not already present in the project.

Deliverables:

1. Code/config changes
2. Short summary of the new limiter layering
3. Test/verification notes
4. Any remaining manual Cloudflare or Supabase step
