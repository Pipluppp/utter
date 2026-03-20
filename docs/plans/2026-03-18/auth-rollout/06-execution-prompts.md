# Auth Rollout Execution Prompts

Use these prompts when you want a coding agent to execute one auth-rollout task at a time inside this repo.

Each prompt assumes the agent should:

- work from the current Utter repo state
- treat `uttervoice.com` as already purchased in Cloudflare Registrar unless the user
  explicitly says otherwise
- treat `uttervoice.com` as the canonical branded app hostname
- treat `www.uttervoice.com` as a redirect alias unless the user explicitly changes
  that decision
- read the referenced plan before making changes
- make repo changes where needed
- update docs if runtime behavior or setup changes
- verify the result as far as the environment allows
- stop for manual dashboard tasks when the plan says a manual checkpoint has been
  reached
- give the user exact values, hostnames, URLs, and settings to enter manually
- wait for user confirmation before continuing past a manual checkpoint

## Prompt 1: App domain cutover

Read `docs/2026-03-18/auth-rollout/01-app-domain-cutover-plan.md` and execute that task for this repo. Treat the goal as getting Utter onto a branded app domain on the frontend Worker without breaking the existing `/api/*` proxy model. Inspect the current Cloudflare Worker config, frontend origin assumptions, and API CORS allowlists first. Then make the smallest repo and config changes needed to support the domain cutover, update any affected docs, and stop at the plan's manual checkpoint with the exact Cloudflare tasks the user must perform. Only continue to final validation after the user confirms those manual tasks are complete.

## Prompt 2: Resend SMTP setup

Read `docs/2026-03-18/auth-rollout/02-resend-smtp-setup-plan.md` and execute the repo side of that task. Treat the chosen architecture as hosted Supabase Auth using Resend custom SMTP, with no Supabase Edge Functions and no Cloudflare Worker email sender. First inspect the existing auth docs, local Supabase config, and any environment or deployment docs that mention auth mail. Then update the repo docs and setup/deploy guidance so the Resend SMTP path is the canonical plan, keeping secrets out of the repo. Stop at the plan's manual checkpoint with the exact Resend and Supabase settings the user must enter, and only continue after user confirmation.

## Prompt 3: Email verification cutover

Read `docs/2026-03-18/auth-rollout/03-email-verification-cutover-plan.md` and execute the task needed to make branded-domain signup confirmation work in this repo. Start by inspecting the frontend password signup flow, redirect handling, and hosted-Supabase assumptions. Preserve the current stack choice of Cloudflare Workers plus hosted Supabase Auth. Follow the plan's explicit phase-1 choice to keep Supabase's default confirmation links instead of inventing a custom `token_hash` confirmation route unless the repo already has that support. Stop at the plan's manual checkpoint with the exact hosted Supabase settings the user must save, then continue to verification only after user confirmation. At the end, list the exact signup-confirmation tests run and any remaining password-reset gaps that still require product work.

## Prompt 4: Turnstile abuse protection

Read both `docs/2026-03-18/auth-rollout/04-turnstile-abuse-protection-plan.md` and `docs/2026-03-18/auth-rollout/04-turnstile-research-verification.md`. The research verification doc is the ground-truth implementation plan with verified package APIs and orchestration phases. Follow it precisely.

This task alternates between agent code work and manual user steps. You MUST stop and wait for my confirmation at each `>> MANUAL STEP` phase before continuing. Do not skip ahead or assume manual steps are done.

**Phase 1 — Agent code work:**

1. Install `@marsidev/react-turnstile` in `frontend/`.
2. Add `VITE_TURNSTILE_SITE_KEY` to `frontend/.env.example` with the test key `1x00000000000000000000AA`.
3. Inspect the existing auth pages (`frontend/src/pages/Auth.tsx` and `frontend/src/pages/account/Auth.tsx`). Identify every Supabase auth call: `signUp()`, `signInWithPassword()`, `signInWithOtp()`.
4. Add the `<Turnstile>` component to both auth pages, inside the form, below the input fields and above the submit button. Use `siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}`, `theme="dark"`, `refreshExpired="auto"`. Use a ref for reset.
5. Thread `captchaToken` through the `options` of ALL THREE auth calls — `signUp`, `signInWithPassword`, and `signInWithOtp`. Supabase rejects all auth requests when CAPTCHA is enabled, not just the ones that send email. Do NOT call Turnstile's siteverify endpoint yourself — Supabase handles server-side validation and tokens are single-use.
6. After every auth call (success or failure), call `ref.current?.reset()`.
7. Disable submit buttons until a valid captcha token is ready.
8. Add a TODO comment noting that `resetPasswordForEmail()` will also need `captchaToken` when that flow is built.
9. No changes to the API Worker or wrangler config.

After completing all code changes, STOP. Tell me exactly what you changed, then give me the Phase 2 manual steps to do in the Cloudflare dashboard to create the Turnstile widget. Wait for me to confirm before continuing.

**Phase 2 — I will create the Turnstile widget in the Cloudflare dashboard and give you the site key.**

**Phase 3 — I will enable CAPTCHA in the Supabase dashboard and confirm.**

**Phase 4 — I will set the production site key in the frontend build environment and confirm.**

**Phase 5 — Verification:** After I confirm all manual steps, walk me through testing all three auth flows (signup, sign-in, magic link) on both the hosted app and local dev.

## Prompt 5: Cloudflare security hardening

Read `docs/2026-03-18/cloudflare-security/execution-prompt.md` and `docs/2026-03-18/cloudflare-security/cloudflare-security-plan.md`, then walk me through implementing the Cloudflare WAF security configuration for `uttervoice.com`.

The full standalone prompt lives in `docs/2026-03-18/cloudflare-security/execution-prompt.md`. See `docs/2026-03-18/cloudflare-security/README.md` for research sources and design decisions.

## Prompt 6: OAuth follow-up (moved to 2026-03-19)

Read `docs/2026-03-22/oauth/oauth-follow-up-plan.md` and implement the first OAuth provider for this repo, using the current auth architecture (Worker-proxied auth at `/api/auth/*`) and branded app domain. Inspect the existing auth pages and confirm there is no current OAuth flow before changing anything. Then implement the minimal Worker route and frontend flow for the first provider, update docs, and stop at the plan's manual checkpoint with the exact Google and Supabase provider settings the user must complete. Continue to verification only after user confirmation.

## Suggested usage order

Run these in this sequence:

1. Prompt 1 — App domain cutover ✅ completed
2. Prompt 2 — Resend SMTP setup
3. Prompt 3 — Email verification cutover
4. Prompt 4 — Turnstile abuse protection
5. Prompt 5 — Cloudflare security hardening (dashboard-only, no code)

Prompts 1–5 are the critical path for "domain + working signup + production-safe security posture."

6. Prompt 6 — OAuth follow-up (moved to `docs/2026-03-22/oauth/`)

Prompt 6 and billing research (`docs/2026-03-22/billing-research/`) can run after or in parallel with the critical path.
