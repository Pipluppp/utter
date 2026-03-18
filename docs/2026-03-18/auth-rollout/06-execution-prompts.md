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

Read `docs/2026-03-18/auth-rollout/04-turnstile-abuse-protection-plan.md` and execute that task for this repo. Inspect the existing auth pages first and identify every auth flow that can trigger email sends. Then implement the minimal Turnstile integration needed for hosted auth hardening, thread the `captchaToken` through the supported Supabase calls, update docs, and stop at the plan's manual checkpoint with the exact Cloudflare and Supabase CAPTCHA settings the user must complete. Continue to hosted verification only after user confirmation.

## Prompt 5: OAuth follow-up

Read `docs/2026-03-18/auth-rollout/05-oauth-follow-up-plan.md` and implement the first OAuth provider for this repo, using the current auth architecture and branded app domain assumptions. Inspect the existing auth pages and confirm there is no current `signInWithOAuth(...)` flow before changing anything. Then implement the minimal frontend flow for the first provider, keep redirects consistent with the existing `window.location.origin` pattern, update docs, and stop at the plan's manual checkpoint with the exact Google and Supabase provider settings the user must complete. Continue to verification only after user confirmation.

## Suggested usage order

Run these in this sequence:

1. Prompt 1
2. Prompt 2
3. Prompt 3
4. Prompt 4
5. Prompt 5

Only Prompts 1 through 4 are required for the current goal of "domain now plus
working signup confirmation with production-safe auth email posture."
