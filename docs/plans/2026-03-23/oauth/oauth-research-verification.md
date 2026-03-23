# OAuth Plan 05 — Research Verification Notes

Grounded from: Supabase Auth docs, current repo state, Jilles.me article patterns.

## Verdict: Plan is correct. Two additions.

---

## Confirmed correct

1. `signInWithOAuth({ provider: 'google' })` is the right Supabase JS call
2. `detectSessionInUrl: true` is already set in `frontend/src/lib/supabase.ts`
3. Google is the right first provider (highest user value, consent screen
   branding benefits from custom domain)
4. Callback URL: `https://jgmivviwockcwjkvpqra.supabase.co/auth/v1/callback`
   (default hosted Supabase pattern)
5. If a Supabase custom domain is added later, both old and new callback URLs
   need to be registered during the migration window
6. OAuth buttons are pure frontend work — no API Worker changes
7. OAuth does not need Turnstile CAPTCHA (Google handles its own bot protection)
8. This is correctly scoped as phase 2, after domain + email verification

---

## Additions

### A. Google OAuth redirect origin

The `signInWithOAuth()` call should pass `redirectTo`:

```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth`,
  },
})
```

This ensures the user returns to the auth page after the Google consent flow,
where `detectSessionInUrl: true` will pick up the session from the URL hash.

Currently the auth pages derive `emailRedirectTo` from `window.location.origin`
for signUp/OTP. The same pattern should be used for OAuth `redirectTo`.

### B. Supabase dashboard redirect URL allowlist

The Supabase dashboard redirect URL configuration already includes:
- `https://uttervoice.com/**`
- `https://utter.duncanb013.workers.dev/**`
- `http://localhost:5173/**`
- `http://127.0.0.1:5173/**`

These wildcards already cover the OAuth redirect. No dashboard changes needed
for the redirect allowlist — just the Google provider credentials.

### C. Google consent screen publish status

The Jilles article notes: "as long as you do not set a logo and do not request
sensitive scopes, you don't need to verify your application and can publish it to
production without any problems. If you do end up setting a logo, you have to
record a small YouTube video."

For Utter's case:
- Only request the default `email` and `profile` scopes (non-sensitive)
- If you add a logo to the consent screen, Google may require verification
- Start without a logo to ship faster, add it later if desired

---

## Execution sequence from the article (adapted for Supabase)

The Jilles article's OAuth flow uses BetterAuth, but the dashboard setup steps
are identical for any Google OAuth integration:

1. Go to Google API Console → create project (or use existing)
2. Create OAuth 2.0 Client ID → Web Application
3. Authorized JavaScript origins: `https://uttervoice.com`, `http://localhost:5173`
4. Authorized redirect URIs: `https://jgmivviwockcwjkvpqra.supabase.co/auth/v1/callback`
5. Copy client ID + secret → paste into Supabase Auth → Google provider settings
6. Add OAuth button to frontend auth pages
7. Deploy and test

The key difference: Supabase's hosted auth handles the callback server-side. The
redirect URI points to the Supabase project, not to the app hostname directly.
