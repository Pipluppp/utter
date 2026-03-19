# Execution Prompt

Implement the Cloudflare Supabase Auth proxy plan in this directory.

Objective:

- remove direct browser Supabase Auth usage
- move auth flows behind `uttervoice.com/api/auth/*`
- stop shipping the Supabase project URL and publishable key in the deployed browser app

Required reading before changes:

1. `docs/2026-03-19/02-cloudflare-supabase-proxy/README.md`
2. `docs/2026-03-19/02-cloudflare-supabase-proxy/cloudflare-supabase-proxy-research-verification.md`
3. `docs/2026-03-19/02-cloudflare-supabase-proxy/cloudflare-supabase-auth-proxy-plan.md`
4. `frontend/src/lib/supabase.ts`
5. `frontend/src/pages/Auth.tsx`
6. `frontend/src/app/auth/AuthStateProvider.tsx`
7. `frontend/src/pages/account/accountData.ts`
8. `frontend/src/lib/api.ts`
9. `workers/frontend/src/index.ts`
10. `workers/api/src/_shared/supabase.ts`
11. `workers/api/src/index.ts`

Implementation requirements:

1. Remove direct browser `supabase-js` Auth usage from the frontend bundle.
2. Add Worker-backed auth endpoints under your own domain.
3. Use same-domain cookie-backed auth/session handling.
4. Update protected API access so browser JS no longer needs to inject Supabase bearer tokens.
5. Preserve CAPTCHA / Turnstile and existing auth UX where practical.
6. Ensure auth routes and any `Set-Cookie` responses are `no-store` and not accidentally cached.
7. Verify the deployed browser bundle no longer contains the Supabase project URL or publishable key.

Manual interruption points:

1. Pause before changing Supabase redirect URLs or other dashboard auth settings.
2. Pause if CAPTCHA / Turnstile configuration needs dashboard verification or secret rotation.
3. Pause if the chosen session-cookie design needs an explicit product/security decision.

Deliverables:

1. Code/config changes
2. Summary of the new auth request flow
3. Verification notes showing browser network and bundle no longer expose Supabase project metadata
4. Any remaining manual Cloudflare or Supabase dashboard step
