# Phase 10 — Vercel Backend Connection

> **Status**: In Progress
> **Prerequisites**: [Phase 09](./09-staging-deploy.md) complete (Supabase cloud verified end-to-end)
> **Goal**: Connect the already-deployed Vercel frontend to the Supabase cloud backend via API rewrites and environment variables. After this phase, the app is publicly accessible with the full clone → generate → play cycle working over the internet.

---

## What's already done

The frontend SPA is **already deployed to Vercel** (completed Feb 8, 2026, before this phase):
- Vercel project exists, linked to the `utter` GitHub repo
- Root directory set to `frontend/`, framework detected as Vite
- `frontend/vercel.json` exists with SPA fallback and asset cache headers
- All pages are navigable at the Vercel URL
- Pages that need backend data show graceful error states (no crashes)
- No environment variables are set yet (Supabase client returns `null`)

This phase just wires the existing deployment to the Supabase backend.

---

## Why this phase exists

The frontend is deployed but disconnected — it can't make API calls or authenticate users. This phase adds the API rewrite so `/api/*` requests proxy to Supabase Edge Functions, sets the Supabase env vars so the auth client initializes, and verifies the full production topology works.

## Environment context

We use two Supabase cloud projects (both on the free plan):

| Project | Purpose | Vercel connection |
|---|---|---|
| `utter-staging` | Testing, staging | Preview deploys (branch pushes) |
| `utter` | Production | Production deploy (`main` branch) |

This phase connects the Vercel deployment to the **staging** Supabase project first. Once verified, a future step creates the production Supabase project and updates `vercel.json` for the `main` branch.

**`vercel.json` limitation**: Vercel doesn't support env var interpolation in `vercel.json`, so the Supabase project ref is hardcoded. To handle staging vs production, you either maintain a single `vercel.json` pointing at production (preview deploys also hit prod Supabase — acceptable for now since auth isolates users), or manage the ref per branch. For a solo dev, pointing everything at one project and switching when ready is simpler.

---

## Steps

### 1. Update `frontend/vercel.json` with API rewrite

The file already exists with SPA fallback. Add the API rewrite **before** the catch-all:

- [ ] Update `frontend/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://<project-ref>.supabase.co/functions/v1/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

- [ ] Replace `<project-ref>` with your actual Supabase project reference ID from Phase 09

**Why `no-store` on `/api/*`**: API responses are user-scoped (authenticated). Caching them at the CDN edge would leak data between users or serve stale data.

**Why the API rewrite must come first**: Vercel processes rewrites in order. The catch-all `/(.*) → /index.html` would swallow API requests if it came first.

**Why `vercel.json` is static**: Vercel doesn't support environment variable interpolation in `vercel.json`. The Supabase project ref is not a secret — it's embedded in every frontend request's anon key JWT already.

### 2. Set environment variables

- [ ] In the Vercel project dashboard, go to **Settings → Environment Variables**
- [ ] Add these variables (apply to all environments):

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Your project URL from Phase 09 |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Your anon key from Phase 09 |

**Important**: These are `VITE_*` variables — they're embedded in the JS bundle at build time. They are **not** secrets (the anon key is public by design in Supabase). Never add the service role key here.

**What to verify**: Both variables appear in Vercel's Environment Variables settings.

### 3. Push and deploy

- [ ] Commit the updated `vercel.json` and push
- [ ] Vercel will auto-deploy from the push
- [ ] Wait for the build to complete (typically 30-60s)

**What to check if build fails**:
- Check build logs in Vercel dashboard
- Common issues: missing `VITE_*` env vars (causes undefined Supabase client), TypeScript errors not caught locally
- Verify the build works locally first: `npm --prefix frontend run build`

### 4. Update Storage CORS for Vercel domain

- [ ] Go to your Supabase dashboard → **Storage → Configuration**
- [ ] Add the Vercel deployment URL to **Allowed Origins** (should already be there from Phase 09 step 5):
  ```
  https://<your-app>.vercel.app
  ```
- [ ] If you previously had `*` for testing, replace it with the specific origin

**Why this matters**: WaveSurfer uses `fetch()` to load audio files. The 302 redirect from `/api/generations/:id/audio` lands on the Supabase Storage CDN, which needs CORS headers matching the Vercel origin.

### 5. Add Vercel URL to Supabase Auth redirect allowlist

- [ ] Go to Supabase dashboard → **Authentication → URL Configuration**
- [ ] Add the Vercel URL to **Redirect URLs**:
  ```
  https://<your-app>.vercel.app/**
  ```
- [ ] This is needed for magic link redirects and email confirmation links to work from the Vercel domain

### 6. Verify public endpoint

- [ ] Open in browser:
  ```
  https://<your-app>.vercel.app/api/languages
  ```
- [ ] Should return the languages JSON (same as local)
- [ ] If you get a 404: check `vercel.json` rewrite rules and that the Edge Function is deployed
- [ ] If you get a timeout (504/502): the Supabase Edge Function might be cold-starting. Retry after a few seconds.

### 7. Test authenticated flow

- [ ] Open the Vercel deployment URL in a browser
- [ ] Sign up with a real email
- [ ] Confirm via the email you receive
- [ ] Verify the SPA loads and you're signed in
- [ ] Navigate through pages: Profile, Voices, History, Clone, Generate, Design

**What to check in browser DevTools**:
- Network tab: All `/api/*` requests should show 200 (not 302 redirect loops)
- Console: No CORS errors, no `SUPABASE_URL is undefined` errors
- Application tab: Supabase session exists in localStorage

### 8. Full end-to-end smoke test

- [ ] **Clone a voice**: Upload audio + enter transcript → submit → voice appears
- [ ] **Preview voice**: Click play → WaveSurfer renders waveform → audio plays from Storage CDN
- [ ] **Generate speech**: Select voice, enter text → Generate → task polling → audio plays
- [ ] **History**: Generation appears → playback works → download works
- [ ] **Delete**: Delete voice and generation → cleaned up properly

**What to look for**:
- **Vercel proxy timeout**: The 120s timeout on external rewrites. Normal API calls complete in < 5s. The only risk is if Modal finalization takes extremely long — but poll-driven architecture keeps individual requests short.
- **Cold start stacking**: First request after idle hits both Vercel edge (warm) and Supabase Edge Function (cold, 1-2s). May feel slow on first load.
- **Audio playback latency**: Storage CDN vs localhost. First play may be slightly slower, but CDN caching kicks in for replays.

### 9. Verify no secrets exposed

- [ ] View page source on the deployed site → no service role key, no Modal URLs
- [ ] Check Network tab → only the anon key appears in requests (this is expected and safe)
- [ ] Run in browser console:
  ```javascript
  // Should return undefined — service role key must NOT be in the bundle
  console.log(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY)
  ```

---

## Files modified

| File | Change |
|------|--------|
| `frontend/vercel.json` | Add API rewrite to Supabase (was SPA-fallback only) |

---

## Acceptance criteria

- [x] `frontend/vercel.json` exists with SPA fallback and asset cache headers *(done in initial deployment)*
- [ ] API rewrite added to `vercel.json` pointing at Supabase project
- [x] Vercel project created, linked to repo, root directory set to `frontend/` *(done in initial deployment)*
- [ ] Environment variables set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Build succeeds and deploys to Vercel
- [ ] Storage CORS updated with Vercel deployment origin
- [ ] Auth redirect allowlist includes Vercel URL
- [ ] `GET /api/languages` works at the Vercel URL
- [ ] Authenticated flow works (sign up, sign in, generate, play)
- [ ] Audio playback works (WaveSurfer renders waveforms, download works)
- [ ] No secrets exposed in page source or network requests

---

## Gotchas

- **`vercel.json` location**: Must be at `frontend/vercel.json` (inside the root directory), not at the repo root. Vercel reads it relative to the project's root directory setting.
- **120s proxy timeout**: Vercel external rewrites timeout after 120s. Normal API calls complete in < 5s. The poll-driven architecture keeps individual requests short.
- **Build-time env vars**: `VITE_*` variables are embedded at build time. Changing them requires a re-deploy (Vercel triggers this automatically when you update env vars and push, but you can also manually trigger a redeploy).
- **No WebSocket support**: Vercel external rewrites are HTTP only. The SPA uses HTTP polling for tasks, not WebSockets, so this is fine.
- **Storage CORS is the #1 failure mode**: If audio doesn't play or WaveSurfer can't render, check the Storage CORS configuration in the Supabase dashboard first.
- **Preview deployments**: Each PR gets a unique Vercel preview URL. These won't work with Storage CORS unless you add a wildcard origin — consider `https://utter-*.vercel.app` for preview deploys.
- **Deployment Protection**: Vercel enables auth on preview deployments by default. To share preview URLs publicly, disable it in Settings → Deployment Protection.
