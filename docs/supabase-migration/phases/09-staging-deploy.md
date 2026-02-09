# Phase 09 — Supabase Cloud Deploy (Staging)

> **Status**: Not Started
> **Prerequisites**: [Phase 08](./08-testing/) complete (all QA passed)
> **Goal**: Deploy the Supabase backend to a real cloud project (staging) and verify it works outside of Docker. This is the first time the backend runs on Supabase infrastructure.

---

## Why this phase exists

Local development uses Docker containers. Production uses Supabase's managed infrastructure. There can be differences: cold starts, connection limits, real network latency to Modal, real Storage CDN, real Auth (email delivery, not Inbucket). This phase catches those issues against a staging project before touching production.

---

## Environment strategy

We use three environments, all free:

| Environment | Supabase | Vercel | Git branch |
|---|---|---|---|
| **Local dev** | CLI (Docker, port 54321) | — | any |
| **Staging** | Cloud project `utter-staging` | Preview deploys | feature branches |
| **Production** | Cloud project `utter` | Production deploy | `main` |

The free plan allows **2 active cloud projects**. The local CLI runs in Docker and doesn't count. This gives us full isolation — a bad migration or broken edge function on staging can never affect production users.

**Why not just one project?** The Reddit/community consensus is clear: separate projects for staging and production. The cost is minimal (set secrets twice, CORS twice) and the safety is worth it. You can test migrations, edge functions, real email delivery, and real Storage CDN against staging before touching production.

---

## Steps

### 1. Create Supabase account and staging project

- [ ] See [manual-steps.md](../manual-steps.md#phase-9--staging-supabase-deploy) for detailed walkthrough
- [ ] Create account at https://supabase.com (free tier, no credit card)
- [ ] Create project named `utter-staging` (pick region closest to you or Modal)
- [ ] **Save the database password** — needed for `supabase link`
- [ ] Wait for project provisioning (~2 min)

### 2. Get project credentials

- [ ] From the Supabase dashboard, go to **Settings → API**
- [ ] Note:
  - **Project URL**: `https://xyzxyz.supabase.co`
  - **anon key**: `eyJhbGciOi...`
  - **service_role key**: `eyJhbGciOi...` (keep secret)
- [ ] From **Settings → General**, note the **Reference ID**: `xyzxyz`

### 3. Link local repo to staging project

- [ ] Run:
  ```bash
  npx supabase link --project-ref <staging-reference-id>
  ```
- [ ] Enter your database password when prompted
- [ ] Verify: `npx supabase projects list` shows your project

### 4. Push database migrations

- [ ] Preview first:
  ```bash
  npx supabase db push --dry-run
  ```
- [ ] Review the SQL that will be applied — should match your local migrations
- [ ] Apply:
  ```bash
  npx supabase db push
  ```
- [ ] Verify in dashboard: Tables → all 4 tables exist with correct columns

**What to verify**: Go to Supabase dashboard → Table Editor → verify `profiles`, `voices`, `generations`, `tasks` tables exist. Check Authentication → Policies → verify RLS policies are listed.

### 5. Configure Storage CORS

- [ ] Go to **Storage → Configuration** (or **Settings → Storage**) in the dashboard
- [ ] Add CORS rules:

| Setting | Value |
|---------|-------|
| **Allowed Origins** | `http://localhost:5173`, `https://<your-vercel-app>.vercel.app` |
| **Allowed Headers** | `authorization, x-client-info, apikey, content-type, range` |
| **Allowed Methods** | `GET, POST, PUT, DELETE, OPTIONS` |
| **Exposed Headers** | `content-range, content-length, content-type` |
| **Max Age** | `86400` |

**Why `range` header**: Audio playback uses range requests. Without this, `<audio>` seeking and WaveSurfer loading may fail.

**Note**: The Vercel frontend is already deployed. Use your actual Vercel preview URL here. You can also add `https://utter-*.vercel.app` as a wildcard to cover all preview deploys.

### 6. Set Edge Function secrets

- [ ] Run:
  ```bash
  npx supabase secrets set \
    MODAL_JOB_SUBMIT=<url> \
    MODAL_JOB_STATUS=<url> \
    MODAL_JOB_RESULT=<url> \
    MODAL_JOB_CANCEL=<url> \
    MODAL_ENDPOINT_VOICE_DESIGN=<url> \
    TTS_PROVIDER=qwen
  ```
- [ ] Verify: `npx supabase secrets list` shows all secrets (values are hidden)

**Note**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are auto-populated by Supabase. You don't need to set them.

### 7. Deploy Edge Functions

- [ ] Run:
  ```bash
  npx supabase functions deploy api
  ```
- [ ] This bundles and deploys the `api` function
- [ ] Output should show success with the function URL

### 8. Verify public endpoint

- [ ] Open in browser:
  ```
  https://<staging-ref>.supabase.co/functions/v1/api/languages
  ```
- [ ] Should return the languages JSON (same as local)
- [ ] If you get a CORS or 404 error, check:
  - Function name matches `api`
  - `verify_jwt = false` is set in `config.toml`
  - Function deployed successfully (`npx supabase functions list`)

### 9. Test authenticated flow (local frontend → staging backend)

- [ ] Point your local frontend at the staging backend:
  ```env
  # frontend/.env.local
  VITE_SUPABASE_URL=https://<staging-ref>.supabase.co
  VITE_SUPABASE_ANON_KEY=<staging-anon-key>
  ```
  And set the proxy target:
  ```env
  BACKEND_ORIGIN=https://<staging-ref>.supabase.co/functions/v1
  ```
- [ ] Start the frontend: `npm --prefix frontend run dev`
- [ ] Sign up with a real email (staging uses real email delivery, not Inbucket)
- [ ] Confirm via the actual email you receive
- [ ] Test the core flow: clone → generate → play → history

### 10. Full staging smoke test

- [ ] Clone a voice (signed URL upload to real Storage)
- [ ] Generate speech (Modal integration over real network)
- [ ] Verify audio plays (real Storage CDN, real CORS)
- [ ] Delete voice and generation (cleanup works)
- [ ] Profile update works

**What to look for**:
- Cold start latency (first request after idle may take 1-2s)
- Modal integration timing (real network latency vs localhost)
- Storage upload speed (real S3 vs local Docker)

### 11. Revert frontend to local

- [ ] After testing, revert `frontend/.env.local` back to local values:
  ```env
  VITE_SUPABASE_URL=http://127.0.0.1:54321
  VITE_SUPABASE_ANON_KEY=<local-anon-key>
  ```
- [ ] Continue development locally

---

## Files modified

| File | Change |
|------|--------|
| `frontend/.env.local` | Temporarily pointed to staging for testing (reverted after) |

## No new files created

All deployment is done via CLI commands against the existing codebase.

---

## Acceptance criteria

- [ ] Staging project created and linked
- [ ] Migrations pushed successfully (all tables + RLS + storage)
- [ ] Storage CORS configured for Vercel domain
- [ ] Secrets set (Modal endpoints)
- [ ] Edge Functions deployed
- [ ] `GET /api/languages` works on staging URL
- [ ] Authenticated flow works (sign up, sign in, generate, play)
- [ ] Audio playback works through real Storage CDN
- [ ] WaveSurfer loads waveforms correctly (CORS configured)

---

## Gotchas

- **Real email delivery**: Staging uses real email (Supabase's built-in email service). Check your inbox/spam. For testing, consider using a +alias (e.g., `you+test@gmail.com`).
- **Cold starts**: First request to an idle Edge Function takes 1-2s. Subsequent requests are fast. This is expected Supabase behavior.
- **Free tier limits**: 500K Edge Function invocations/month, 500MB database, 1GB storage. More than enough for staging.
- **CORS on Storage**: This is the most likely thing to break. If audio doesn't play, check the CORS config in the dashboard. The `range` header is especially important for audio seeking.
- **Secrets are per-project**: Secrets set on staging are NOT on production. You'll set them again for the production project in a later phase.
- **Free plan pausing**: Inactive free projects pause after 7 days. Paused projects don't count toward your 2-project limit but need to be manually resumed.
- **`supabase link` targets one project at a time**: When you later create the production project, you'll re-link with `supabase link --project-ref <prod-ref>`. The link is stored in `.supabase/` (gitignored).
