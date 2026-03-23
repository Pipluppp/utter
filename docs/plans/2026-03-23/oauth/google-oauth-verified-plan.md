# Google OAuth — Verified Implementation Plan

Date: 2026-03-23
Status: Verified against codebase + Supabase docs + Google OAuth docs

## Current State (verified)

- **All auth flows go through the Cloudflare Worker** — frontend calls `/api/auth/*`, never Supabase directly
- **No OAuth code exists** — no OAuth routes in Worker, no OAuth UI in frontend, no Google provider in Supabase config
- **`/api/auth/callback` already handles code exchange** — calls `exchangeCodeForSession(code)`, sets HTTP-only cookies, redirects to app. This is reusable for OAuth.
- **Frontend auth** (`frontend/src/lib/auth.ts`) — all functions are fetch calls to Worker routes
- **Auth UI** (`frontend/src/pages/Auth.tsx`) — password + magic link modes, no OAuth buttons

## Corrections to Previous Plans

### Follow-up plan (oauth-follow-up-plan.md)

- **WRONG**: "Google redirect URI should point to `https://uttervoice.com/api/auth/callback`"
  - Google's redirect URI must point to **Supabase's hosted callback**: `https://jgmivviwockcwjkvpqra.supabase.co/auth/v1/callback`
  - Supabase handles the Google token exchange, then redirects to the app's `redirectTo` (which is the Worker's callback)

- **CORRECT**: "The frontend calls the Worker to initiate OAuth, not `supabase.auth.signInWithOAuth()` directly"

- **CORRECT**: "No Supabase custom domain is needed for clean OAuth callback URLs" — but note the *Google* redirect URI still shows the Supabase project URL. The user only sees it briefly during the redirect chain.

### Research verification (oauth-research-verification.md)

- **WRONG**: "OAuth buttons are pure frontend work — no API Worker changes"
  - Since frontend never calls Supabase SDK directly, a **Worker route is required** to initiate OAuth

- **WRONG**: `detectSessionInUrl: true` claim — the Worker's Supabase client has `detectSessionInUrl: false` (stateless server-side client). This setting is irrelevant because the Worker handles the callback server-side.

- **CORRECT**: Google redirect URI is `https://jgmivviwockcwjkvpqra.supabase.co/auth/v1/callback`

- **CORRECT**: Consent screen advice (no logo = no verification needed, non-sensitive scopes only)

## OAuth Flow (how it actually works with our stack)

```
1. User clicks "Sign in with Google" → browser navigates to /api/auth/oauth/google
2. Worker calls supabase.auth.signInWithOAuth({ provider: 'google', skipBrowserRedirect: true })
   → gets a Supabase authorize URL
3. Worker 302 redirects browser to that URL
4. Browser → Supabase authorize endpoint → Google consent screen
5. User consents → Google redirects to Supabase callback
   (https://jgmivviwockcwjkvpqra.supabase.co/auth/v1/callback)
6. Supabase exchanges Google token, creates session, redirects to our redirectTo URL
   with ?code=... appended
7. Browser → /api/auth/callback?code=... (Worker)
8. Worker's existing callback: exchangeCodeForSession(code) → set cookies → redirect to app
9. Frontend loads, session cookies are present, user is authenticated
```

## Implementation Steps

### Phase 1: Google Cloud Console (manual, user task)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. If prompted, configure the **OAuth Consent Screen** first:
   - App name: "Utter"
   - User support email: your email
   - Audience: External
   - **Do NOT add a logo** (avoids Google verification requirement)
   - Scopes: just `email` and `profile` (defaults, non-sensitive)
   - Contact info: your email
   - Accept terms
6. Create OAuth Client:
   - Application type: **Web Application**
   - Name: "Utter Web"
   - Authorized JavaScript origins:
     - `https://jgmivviwockcwjkvpqra.supabase.co`
   - Authorized redirect URIs:
     - `https://jgmivviwockcwjkvpqra.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**

**Potential friction**: Google's new "Google Auth Platform" UI has replaced the old API Console for some accounts. The flow is the same but menu names differ — look for "Clients" instead of "Credentials" if you don't see the old layout.

**Potential friction**: If you set a logo, Google puts you into verification. You'll need to record a YouTube video of your app. Skip the logo to avoid this.

### Phase 2: Supabase Dashboard (manual, user task)

1. Go to Supabase Dashboard → Authentication → Providers
2. Find **Google** in the list, enable it
3. Paste the Client ID and Client Secret from step 1
4. The **Callback URL** shown should be: `https://jgmivviwockcwjkvpqra.supabase.co/auth/v1/callback`
   - This must match the redirect URI configured in Google Console
5. Save

### Phase 3: Worker — OAuth Initiation Route (code change)

Add `GET /api/auth/oauth/google` to `workers/api/src/routes/auth.ts`:

```ts
authRoutes.get("/auth/oauth/google", async (c) => {
  const url = new URL(c.req.url);
  const returnTo = getSafeReturnTo(url.searchParams.get("returnTo"));

  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getRequestOrigin(c.req.raw)}/api/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return Response.redirect(
      buildAuthPageUrl(c.req.raw, returnTo, "Failed to start Google sign-in."),
      303,
    );
  }

  return Response.redirect(data.url, 302);
});
```

Key details:
- `skipBrowserRedirect: true` — returns the URL instead of trying to do `window.location` (which doesn't exist in Workers)
- `redirectTo` — tells Supabase where to send the user after Google auth. Passes through `returnTo` so the callback knows where to send the user in the app.
- No CAPTCHA needed — Google handles bot protection
- Rate limiting should still apply (existing middleware)

### Phase 4: Frontend — OAuth Button (code change)

Add a "Sign in with Google" button to `frontend/src/pages/Auth.tsx`:

```tsx
<a href="/api/auth/oauth/google" className="...">
  Sign in with Google
</a>
```

This is a simple link/navigation, not a fetch call — the browser follows the redirect chain.

Optionally pass `returnTo`:
```tsx
<a href={`/api/auth/oauth/google?returnTo=${encodeURIComponent(returnTo)}`}>
```

### Phase 5: Worker Secrets (deployment)

Add Google OAuth credentials as Cloudflare Worker secrets (not needed if Supabase handles the Google token exchange, which it does — but verify Supabase doesn't need them passed through).

Actually: **No Worker secrets needed for Google OAuth.** The credentials live in Supabase's dashboard. Supabase's hosted auth handles the Google token exchange. The Worker just initiates the flow via `signInWithOAuth()`.

### Phase 6: Local Development

For local dev (`localhost:5173`):
- The Worker dev server runs at a different port — the `redirectTo` in the OAuth initiation route uses `getRequestOrigin()` which should resolve to the Worker's local origin
- The Supabase redirect allowlist already includes `http://localhost:5173/**` and `http://127.0.0.1:5173/**`
- Google Console: optionally add `http://localhost:*` origins for local testing (Google allows localhost without HTTPS)

**Note**: Local OAuth testing requires the Supabase project's Google provider to be configured (Phase 2). The redirect chain goes through the live Supabase project even in local dev.

## Validation Checklist

1. [ ] Google OAuth project created, credentials obtained
2. [ ] Supabase Google provider enabled with credentials
3. [ ] Worker OAuth initiation route works (`/api/auth/oauth/google`)
4. [ ] Google consent screen appears with correct app name
5. [ ] After consent, user is redirected back to the app
6. [ ] Session cookies are set, user is authenticated
7. [ ] Works on production domain (`uttervoice.com` or `utter-wheat.vercel.app`)
8. [ ] Turnstile is NOT shown for OAuth (Google handles bot protection)
9. [ ] Existing email/password and magic link flows still work

## Open Questions

1. **Which domain?** Plan assumes `uttervoice.com` but current production is `utter-wheat.vercel.app`. Google Console origins must match the actual production URL. If domain cutover hasn't happened yet, configure for `utter-wheat.vercel.app` initially.

2. **Account linking**: If a user signs up with email+password, then later tries Google OAuth with the same email — Supabase's default behavior is to create a separate identity. `enable_manual_linking` is currently `false`. Consider enabling automatic linking or handling this in the UI.

3. **Mobile app**: The mobile app (`mobile/`) uses Supabase auth via `SecureStore`. OAuth for mobile would need a different flow (deep linking). Out of scope for this plan.
