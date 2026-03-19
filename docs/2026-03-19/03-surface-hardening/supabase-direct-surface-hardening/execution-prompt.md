# Execution Prompt

Implement the Supabase direct-surface hardening plan in this directory.

Objective:

- Harden direct browser/API traffic to Supabase-hosted endpoints that Cloudflare Workers do not sit in front of

Required reading before changes:

1. `docs/2026-03-19/03-surface-hardening/supabase-direct-surface-hardening/README.md`
2. `docs/2026-03-19/03-surface-hardening/supabase-direct-surface-hardening/supabase-direct-surface-hardening-plan.md`
3. `frontend/src/lib/supabase.ts`
4. `frontend/src/pages/Auth.tsx`
5. `frontend/src/app/auth/AuthStateProvider.tsx`
6. `docs/2026-02-23/security-supabase/README.md`

Implementation requirements:

1. Confirm what frontend traffic still goes directly to Supabase.
2. Verify Supabase Auth CAPTCHA / Turnstile configuration against the existing frontend code.
3. Inspect and document current Supabase Auth rate-limit settings.
4. Review direct Data API posture for unnecessary anon/public exposure.
5. Do not disable the Data API if Worker code still depends on it.
6. Document or implement only what can be justified from repo context plus current Supabase docs.

Manual interruption points:

1. Pause before changing live Supabase Auth rate limits.
2. Pause if dashboard confirmation of CAPTCHA / Turnstile settings is required.
3. Pause if direct Data API exposure review depends on dashboard-only settings not derivable from repo context.

Deliverables:

1. Repo/doc updates
2. Summary of direct Supabase surfaces still in use
3. Current or proposed Auth rate-limit values
4. Any remaining manual Supabase dashboard step
