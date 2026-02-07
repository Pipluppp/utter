# Phase 10 — Vercel Deployment

> **Status**: Not Started
> **Prerequisites**: [Phase 09](./09-staging-deploy.md) complete (staging Supabase verified end-to-end)
> **Goal**: Deploy the React SPA to Vercel with API rewrites pointing at the staging Supabase project. After this phase, the app is publicly accessible at a Vercel URL with the full clone → generate → play cycle working over the internet.

---

## Why this phase exists

Until now, everything has run on localhost. This phase validates the full production topology: Vercel CDN serves the SPA, Vercel rewrites proxy `/api/*` to Supabase Edge Functions, Edge Functions talk to Modal over real network, and audio streams from Supabase Storage CDN. This catches issues invisible in local dev: CORS misconfigurations, Vercel's 120s proxy timeout, CDN caching behavior, and real-world latency.

---

## Steps

### 1. Create `frontend/vercel.json`

**Goal**: Configure Vercel's routing — rewrite `/api/*` to Supabase Edge Functions and add SPA fallback.

- [ ] Create the file at `frontend/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://<staging-project-ref>.supabase.co/functions/v1/api/:path*"
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

- [ ] Replace `<staging-project-ref>` with your actual Supabase staging project reference ID (e.g., `xyzxyz`)

**Why `no-store` on `/api/*`**: API responses are user-scoped (authenticated). Caching them at the CDN edge would leak data between users or serve stale data. Force fresh fetches always.

**Why `immutable` on `/assets/*`**: Vite produces content-hashed filenames (`/assets/index-abc123.js`). These never change, so aggressive caching is safe and optimal.

**Why `vercel.json` is static**: Vercel doesn't support environment variable interpolation in `vercel.json`. The Supabase project ref is not a secret — it's embedded in every frontend request's anon key JWT already. Committing it is acceptable.

**What to verify**: File exists at `frontend/vercel.json`, JSON is valid, project ref is correct.

### 2. Create Vercel account and project

- [ ] See [manual-steps.md](../manual-steps.md#phase-10--vercel-deferred) for detailed walkthrough
- [ ] Go to https://vercel.com and sign in with GitHub (recommended)
- [ ] Free tier (Hobby) is sufficient — no credit card needed
- [ ] Click "Add New Project"
- [ ] Import the utter GitHub repo
- [ ] Configure the project:

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend/` |
| **Framework Preset** | Vite |
| **Install Command** | `npm ci` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

**Why `frontend/` root**: The repo is a monorepo with `frontend/` and `backend/` (and `supabase/`). Vercel needs to build from the frontend directory only.

**Why `npm ci`**: Uses `package-lock.json` for reproducible builds (faster and deterministic vs `npm install`).

### 3. Set environment variables

- [ ] In the Vercel project dashboard, go to **Settings → Environment Variables**
- [ ] Add these variables (apply to all environments, or staging-specific):

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | `https://<staging-ref>.supabase.co` | Your staging project URL from Phase 09 |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Your staging anon key from Phase 09 |

**Important**: These are `VITE_*` variables — they're embedded in the JS bundle at build time. They are **not** secrets (the anon key is public by design in Supabase). Never add the service role key here.

**What to verify**: Both variables appear in Vercel's Environment Variables settings.

### 4. Deploy

- [ ] Click "Deploy" (or push to the branch connected to this Vercel project)
- [ ] Wait for the build to complete (typically 30-60s for a Vite SPA)
- [ ] Vercel will show the deployment URL (e.g., `https://utter-staging.vercel.app`)

**What to check if build fails**:
- Check build logs in Vercel dashboard
- Common issues: missing `VITE_*` env vars (causes undefined Supabase client), TypeScript errors not caught locally, missing dependencies
- Verify the build works locally first: `npm --prefix frontend run build`

### 5. Update Storage CORS for Vercel domain

- [ ] Go to your Supabase staging dashboard → **Storage → Configuration**
- [ ] Add the Vercel deployment URL to **Allowed Origins**:
  ```
  https://utter-staging.vercel.app
  ```
  (Use your actual Vercel URL)
- [ ] If you previously had `*` for testing, replace it with the specific origin

**Why this matters**: WaveSurfer uses `fetch()` to load audio files. The 302 redirect from `/api/generations/:id/audio` lands on the Supabase Storage CDN, which needs CORS headers matching the Vercel origin. Without this, waveform rendering fails silently.

### 6. Verify public endpoint

- [ ] Open in browser:
  ```
  https://utter-staging.vercel.app/api/languages
  ```
- [ ] Should return the languages JSON (same as local and staging Supabase)
- [ ] If you get a 404: check `vercel.json` rewrite rules and that the Edge Function is deployed
- [ ] If you get a timeout (504/502): the Supabase Edge Function might be cold-starting. Retry after a few seconds.
- [ ] If you get a CORS error: this endpoint doesn't need CORS (same-origin via rewrite), but check browser console for details

### 7. Test authenticated flow

- [ ] Open the Vercel deployment URL in a browser
- [ ] Sign up with a real email (staging uses real email delivery)
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
- **Vercel proxy timeout**: The 120s timeout on external rewrites. If a single `GET /tasks/:id` poll takes > 120s (it shouldn't — typical is < 2s), you'll get `ROUTER_EXTERNAL_TARGET_ERROR`. This is extremely unlikely for poll requests.
- **Cold start stacking**: First request after idle hits both Vercel edge (warm) and Supabase Edge Function (cold, 1-2s). May feel slow on first load. Subsequent requests are fast.
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

## Two-project strategy (staging + production)

For production, create a **separate** Vercel project pointing at the **production** Supabase project. This prevents staging preview deployments from touching production data.

| Project | Branch | Supabase target | `vercel.json` rewrite destination |
|---------|--------|-----------------|-----------------------------------|
| `utter-staging` | `develop` or feature branches | Staging Supabase | `https://<staging-ref>.supabase.co/functions/v1/api/:path*` |
| `utter-production` | `main` | Production Supabase | `https://<prod-ref>.supabase.co/functions/v1/api/:path*` |

**Why two projects**: `vercel.json` rewrites are static — no env var interpolation. A single project can't dynamically switch between staging and production Supabase based on the deployment branch.

**Production setup**: Repeat steps 2-8 of this phase with the production Supabase project credentials. Add a custom domain in Vercel Settings → Domains.

---

## Files created

| File | Purpose |
|------|---------|
| `frontend/vercel.json` | API rewrites to Supabase + SPA fallback + cache headers |

## Files modified

None — this phase is configuration and deployment only.

---

## Acceptance criteria

- [ ] `frontend/vercel.json` created with correct rewrites and cache headers
- [ ] Vercel project created, linked to repo, root directory set to `frontend/`
- [ ] Environment variables set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Build succeeds and deploys to a Vercel URL
- [ ] Storage CORS updated with Vercel deployment origin
- [ ] `GET /api/languages` works at the Vercel URL
- [ ] Authenticated flow works (sign up, sign in, generate, play)
- [ ] Audio playback works (WaveSurfer renders waveforms, download works)
- [ ] No secrets exposed in page source or network requests

---

## Gotchas

- **`vercel.json` location**: Must be at `frontend/vercel.json` (inside the root directory), not at the repo root. Vercel reads it relative to the project's root directory setting.
- **120s proxy timeout**: Vercel external rewrites timeout after 120s. Normal API calls complete in < 5s. The only risk is if Modal finalization (download audio + upload to Storage) takes extremely long — but the poll-driven architecture keeps individual requests short.
- **Build-time env vars**: `VITE_*` variables are embedded at build time. Changing them requires a re-deploy (Vercel triggers this automatically when you update env vars and push, but you can also manually trigger a redeploy).
- **No WebSocket support**: Vercel external rewrites are HTTP only. The SPA uses HTTP polling for tasks, not WebSockets, so this is fine. The old FastAPI WebSocket for transcription is disabled.
- **Storage CORS is the #1 failure mode**: If audio doesn't play or WaveSurfer can't render, check the Storage CORS configuration in the Supabase dashboard first. The Vercel origin must be in the allowed origins list.
- **Preview deployments**: Each PR gets a unique Vercel preview URL (`https://utter-git-branch-name.vercel.app`). These won't work with Storage CORS unless you add a wildcard origin — consider adding `https://utter-*.vercel.app` for preview deploys if needed.
