# Turnstile Abuse Protection — Implementation Plan

Grounded from: Cloudflare Turnstile docs, Supabase CAPTCHA integration docs,
`@marsidev/react-turnstile` package, current repo auth pages, and
[supabase/discussions#19291](https://github.com/orgs/supabase/discussions/19291).

## Purpose

Protect public auth entry points once custom SMTP is enabled, so signup and
recovery traffic cannot burn sender reputation or exhaust auth email limits.

This is the fourth task in the auth rollout sequence and the hardening step
before public rollout.

## Dependencies

- `02-resend-smtp-setup-plan.md` (completed)
- `03-email-verification-cutover-plan.md` (completed)

## Blocks

- opening public email/password signup broadly
- treating auth email delivery as production-ready

---

## How hosted Supabase Auth + Turnstile works

Supabase Auth does its own server-side `siteverify` call against the Turnstile
API. The frontend collects a token from the Turnstile widget and passes it via
`options: { captchaToken }` in the Supabase JS client. The Turnstile secret key
is stored only in the Supabase dashboard.

The API Worker never touches Turnstile at all. No `TURNSTILE_SECRET` goes into
`wrangler.toml` or `.dev.vars`.

Do not call Turnstile's `siteverify` endpoint yourself before passing the token
to Supabase. Turnstile tokens are single-use. If you validate it first, Supabase
gets a consumed token and returns `timeout-or-duplicate`
([supabase/discussions#19291](https://github.com/orgs/supabase/discussions/19291)
confirms this failure mode).

---

## Which auth flows need a Turnstile token

The current auth pages (`frontend/src/pages/Auth.tsx` and
`frontend/src/pages/account/Auth.tsx`) expose three Supabase auth calls:

| Call | Where | Triggers email? |
|------|-------|-----------------|
| `signUp()` | both auth pages, password mode, sign_up intent | yes (confirmation) |
| `signInWithPassword()` | both auth pages, password mode, sign_in intent | no |
| `signInWithOtp()` | both auth pages, magic link mode | yes (magic link) |

A fourth call, `resetPasswordForEmail()`, does not exist yet. It will need
`captchaToken` when the password reset flow is added.

All three existing calls should pass `captchaToken` because once Supabase
CAPTCHA is enabled in the dashboard, it applies to all auth endpoints — not just
the ones that send email. If `signInWithPassword()` does not pass a token, it
will be rejected.

```ts
// signUp
await supabase.auth.signUp({
  email, password,
  options: { captchaToken, emailRedirectTo },
})

// signInWithPassword
await supabase.auth.signInWithPassword({
  email, password,
  options: { captchaToken },
})

// signInWithOtp (magic link)
await supabase.auth.signInWithOtp({
  email,
  options: { captchaToken, emailRedirectTo },
})

// future: resetPasswordForEmail
await supabase.auth.resetPasswordForEmail(email, { captchaToken })
```

The Turnstile widget renders once per form — not once per auth method. Both auth
pages share a single email form with a mode toggle (password vs magic link) and
an intent toggle (sign in vs sign up). One widget per page covers all flows.

---

## React package

Use `@marsidev/react-turnstile`:

```bash
npm --prefix frontend install @marsidev/react-turnstile
```

It handles React StrictMode double-render cleanup, provides `onSuccess`,
`onError`, `onExpire` callbacks, and supports `ref` for `reset()` calls. The
alternative (raw `window.turnstile.render()` with `useRef`/`useEffect`) requires
manual lifecycle management and explicit SPA navigation cleanup.

---

## Frontend environment variable

The site key is public. Utter's React SPA uses Vite env vars, so:

- Add `VITE_TURNSTILE_SITE_KEY` to `frontend/.env.example`
- Set the production site key in `frontend/.env` (or in the build environment)

For local development, use Cloudflare's test keys:

| Key type | Value | Behavior |
|----------|-------|----------|
| Site key (always passes) | `1x00000000000000000000AA` | Widget succeeds |
| Secret key (testing) | `1x0000000000000000000000000000000AA` | Validates test tokens |

The test secret key goes into the Supabase local config if testing CAPTCHA
locally. For hosted Supabase, only the real secret goes to the dashboard.

---

## Token lifecycle

Turnstile tokens expire after 5 minutes and are single-use.

- Set `refreshExpired="auto"` on the component so tokens auto-refresh if the
  user sits on the form for more than 5 minutes
- After every auth call (success or failure), call `ref.current?.reset()` to get
  a fresh token for the next attempt
- Disable the submit button until a valid token is ready (set token state in
  `onSuccess`, clear it in `onExpire`)

---

## Widget placement

The Turnstile widget should render inside the auth form, below the input fields
and above (or beside) the submit button. Both auth pages need it:

- `frontend/src/pages/Auth.tsx` — the public landing auth page
- `frontend/src/pages/account/Auth.tsx` — the account settings auth page

Use `theme="dark"` (or `"auto"`) to match the app's dark UI. The widget
provides `size="normal"` (300x65px) or `size="compact"` (130x120px) — normal
fits the current form width.

---

## CSP note

If the frontend Worker or any future middleware sets Content-Security-Policy
headers, these directives are required:

```
script-src https://challenges.cloudflare.com
frame-src https://challenges.cloudflare.com
```

The frontend Worker does not currently set CSP headers, so this is not a
blocker.

---

## Orchestration sequence

This is the step-by-step order for executing this task. Steps alternate between
agent work and manual user actions. The agent should pause at each
`>> MANUAL STEP` and wait for the user to confirm before continuing.

### Phase 1: Agent — frontend code changes

1. Install `@marsidev/react-turnstile` in `frontend/`.
2. Add `VITE_TURNSTILE_SITE_KEY` to `frontend/.env.example` with the test key
   `1x00000000000000000000AA` as default.
3. Add the Turnstile widget to both auth pages, inside the form, below inputs
   and above the submit button.
4. Thread `captchaToken` through all three current auth calls:
   `signUp()`, `signInWithPassword()`, `signInWithOtp()`.
5. Reset the widget after every auth call (success or failure).
6. Disable submit buttons until a valid token is ready.
7. Use `refreshExpired="auto"` and `theme="dark"` (or `"auto"`).
8. No API Worker changes.

After this phase, the frontend code is ready but CAPTCHA is not enforced yet
because Supabase and Cloudflare are not configured. Local dev should still work
with the test site key (widget always passes, Supabase does not gate on it yet).

**Agent pauses here.**

---

### Phase 2: User — create Turnstile widget in Cloudflare

`>> MANUAL STEP`

1. Go to the Cloudflare dashboard: https://dash.cloudflare.com/
2. In the left sidebar, find **Turnstile** (or search for it).
3. Click **Add Widget**.
4. Name: `Utter Auth` (or any descriptive name).
5. Under **Hostnames**, add:
   - `uttervoice.com`
   - `localhost`
6. Widget mode: **Managed** (recommended — shows a checkbox only when needed).
7. Click **Create**.
8. You will see a **Site Key** and a **Secret Key**. Copy both.

Tell the agent:
- the site key (public, goes in `frontend/.env`)
- that you have the secret key ready for the next step

---

### Phase 3: User — enable CAPTCHA in Supabase

`>> MANUAL STEP`

1. Go to the Supabase dashboard: https://supabase.com/dashboard/project/jgmivviwockcwjkvpqra
2. In the left sidebar, go to **Authentication** > **Protection**.
   (Or navigate to: Settings > Authentication > Bot and Abuse Protection)
3. Toggle **Enable CAPTCHA protection** on.
4. In the provider dropdown, select **Cloudflare Turnstile**.
5. Paste the **Turnstile secret key** from the previous step.
6. Click **Save**.

Tell the agent that CAPTCHA is enabled in Supabase.

---

### Phase 4: User — set production site key

`>> MANUAL STEP`

1. Set `VITE_TURNSTILE_SITE_KEY` in the frontend build environment:
   - For local `.env`: set it to the test key `1x00000000000000000000AA`
     (or the real key if you want to test the real widget locally)
   - For hosted/CI builds: set it to the **real production site key** from
     phase 2
2. If deploying via `wrangler deploy`, the site key needs to be baked into the
   Vite build before the frontend Worker is deployed.

Tell the agent the site key is configured.

---

### Phase 5: Verification — test all auth flows

After all manual steps are confirmed, verify:

**On the hosted app (`uttervoice.com`):**

1. **Signup (password mode):**
   - Go to the auth page, select password mode, sign up intent.
   - Confirm the Turnstile widget appears.
   - Fill in email + password. Submit.
   - Confirm signup succeeds and confirmation email arrives via Resend.

2. **Sign-in (password mode):**
   - Go to the auth page, select password mode, sign in intent.
   - Confirm the Turnstile widget appears.
   - Fill in email + password. Submit.
   - Confirm sign-in succeeds.

3. **Magic link:**
   - Go to the auth page, select magic link mode.
   - Confirm the Turnstile widget appears.
   - Fill in email. Submit.
   - Confirm magic link email arrives.

4. **Rejection test:**
   - Temporarily remove or break the `captchaToken` in a local build.
   - Attempt any auth flow against the hosted Supabase.
   - Confirm Supabase rejects the request (expected error from Supabase).

**On local dev (`localhost:5173`):**

5. Confirm auth pages load with the test Turnstile widget.
6. Confirm the widget shows the "success" checkmark immediately (test key
   behavior).
7. Confirm auth flows still work against local Supabase (if running) or fail
   gracefully against hosted Supabase (which now requires a real token).

---

### Remaining gap

`resetPasswordForEmail()` does not exist yet. When the password reset flow is
added, it needs `captchaToken` too. Document this in a TODO comment near the
other auth calls.

## Source anchors

- [Supabase CAPTCHA docs](https://supabase.com/docs/guides/auth/auth-captcha)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
- [supabase/discussions#19291](https://github.com/orgs/supabase/discussions/19291) — do not self-validate tokens before passing to Supabase
- [@marsidev/react-turnstile](https://github.com/marsidev/react-turnstile)
