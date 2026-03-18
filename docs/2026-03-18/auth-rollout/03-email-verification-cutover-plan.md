# Email Verification Cutover Plan

## Purpose

Turn hosted Supabase password auth into a real branded signup-confirmation flow on the
new app domain using Resend-backed SMTP.

This is the third task in the auth rollout critical path and the task that actually
achieves the first real external-inbox auth milestone.

## End goal

- branded app domain is live
- password signup confirmation works for real external inboxes
- signup confirmation returns the browser to the branded app domain

## Starting assumptions

This plan assumes:

1. `uttervoice.com` is the canonical branded app hostname.
2. `uttervoice.com` is already bought and active in Cloudflare.
3. custom SMTP through Resend is already configured or being finished in the prior step.

## Dependencies

- `01-app-domain-cutover-plan.md`
- `02-resend-smtp-setup-plan.md`

## Blocks

- `04-turnstile-abuse-protection-plan.md` should follow before broad public rollout
- `05-oauth-follow-up-plan.md` should happen after this, but is not required to declare signup confirmation complete

## What this task changes

1. Hosted Supabase URL configuration
2. Hosted Supabase email-confirmation behavior
3. Hosted Supabase redirect allow-list entries
4. A deliberate choice to keep the default Supabase confirmation/recovery links in phase 1
5. End-to-end validation against real inboxes

## What this task does not change

1. It does not add a custom in-app `/auth/confirm` route using `token_hash`.
2. It does not complete password reset UX for this repo.
3. It does not add OAuth.

## Scope

1. Set hosted Supabase `Site URL` to the branded app domain.
2. Add exact redirect allow-list entries for:
   - `https://uttervoice.com/**`
   - `https://www.uttervoice.com/**` only if `www` will be allowed to hit the app
     before redirect
   - localhost dev URLs
   - temporary staging URLs only if still needed
3. Enable email confirmations in hosted Supabase.
4. Keep the default Supabase confirmation and recovery link templates for phase 1
   (`{{ .ConfirmationURL }}`), rather than switching to a custom
   `{{ .RedirectTo }}` + `token_hash` route.
5. Preserve the existing frontend `emailRedirectTo` behavior that derives redirects
   from `window.location.origin`.
6. Test the signup confirmation flow end to end against real inboxes.
7. Record the password reset gap as follow-up work instead of marking it complete.

## Expected runtime flow

1. User signs up with email/password on the branded app domain.
2. Supabase creates the user and sends the confirmation email through Resend SMTP.
3. User clicks the confirmation link.
4. Supabase redirects the browser back to the branded app domain.
5. The frontend client detects the returned auth session in the URL.
6. The app lands the user in a safe in-app route.

## Repo assumptions already in place

The frontend is already close to supporting this flow:

- `signUp(...)` exists
- `emailRedirectTo` uses the current origin
- `detectSessionInUrl: true` is enabled
- auth state is tracked centrally

That means the minimal signup-confirmation path is mostly hosted configuration plus
testing, not a large code build.

## Repo-specific caveats that must stay in the plan

1. `frontend/src/pages/Auth.tsx` currently navigates away immediately after
   `signUp(...)`.
   - This is acceptable for phase 1 validation but is not ideal long-term UX.
   - A later improvement should show an explicit "check your inbox" state.
2. There is no frontend `verifyOtp(...)` confirmation route today.
   - That is why phase 1 should keep the default Supabase `{{ .ConfirmationURL }}`
     link behavior.
3. There is no password reset product flow yet.
   - no `resetPasswordForEmail(...)`
   - no `PASSWORD_RECOVERY` handling
   - no `updateUser({ password })`
   Because of that, password reset cannot be accepted as complete in this task.

## Important risk note

Supabase documents that some email providers or security products can prefetch
`{{ .ConfirmationURL }}` links and consume them before the user clicks. If this shows
up in real-world testing, the next escalation is to add a custom confirmation page or
OTP-based flow, not to abandon the branded-domain rollout.

## Manual tasks for the user

Supabase dashboard:

1. Set `Site URL` to the branded app domain.
2. Add redirect allow-list entries for:
   - `https://uttervoice.com/**`
   - `http://localhost:5173/**`
   - any temporary staging URL still intentionally in use
3. Enable email confirmations for password signup.
4. Review the confirmation and recovery templates and keep the default
   `{{ .ConfirmationURL }}` approach for phase 1 unless the repo has changed.

## Manual checkpoint

The agent should stop before end-to-end verification unless the user confirms:

1. `Site URL` is set
2. redirect allow-list entries are saved
3. email confirmations are enabled
4. no unintended template rewrite to a custom `token_hash` route was made

## Validation checklist

1. A non-team external inbox can sign up.
2. The verification email arrives.
3. The link returns to the branded app domain.
4. The browser becomes authenticated after redirect.
5. Repeat sends no longer fail because of the built-in provider restrictions.
6. Temporary staging and localhost redirects still behave as expected.

## Verification split

Agent-side:

1. verify frontend signup code still uses `emailRedirectTo` with the current origin
2. verify auth session handling still supports redirected sessions
3. document any remaining UX or password-reset gaps

User-side / shared:

1. sign up from the branded hostname with a real external inbox
2. click the confirmation email link
3. confirm the browser lands back on the branded hostname
4. confirm the user is authenticated after redirect

## Acceptance criteria

This task is complete when Utter has:

1. a live branded app domain
2. working password-signup email verification
3. hosted Supabase settings documented for the branded-domain flow

Password reset is explicitly not part of this task's acceptance criteria.

## Decision note

This plan intentionally chooses the shortest supported path:

- branded app domain
- Resend-backed SMTP
- default Supabase confirmation links
- real signup confirmation testing

Do not switch to custom `token_hash` email templates in phase 1 unless you also add
the corresponding frontend confirmation route and testing.

## Source anchors

- Supabase redirect URLs
- Supabase email templates
- Supabase custom SMTP
- Supabase auth rate limits
