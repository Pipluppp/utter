# Manual Steps — Things You Do By Hand

> Companion to the [phase guides](./phases/). This documents every step that requires your manual action — account creation, dashboard clicks, copying keys, etc. — organized by phase.

---

## Phase 0 — Repo Prerequisites

### Install Docker Desktop (if not already installed)

Supabase local runs ~10 Docker containers. You need Docker Desktop running before `supabase start` will work.

1. Download from https://www.docker.com/products/docker-desktop/
2. Install and launch
3. Verify: open a terminal and run `docker --version`
4. Make sure Docker Desktop is **running** (check system tray) — it doesn't auto-start on Windows by default

**Time**: ~5 min if not already installed. Skip if you already have Docker.

### (Optional) Install Deno for IDE support

Not required to run anything, but gives you autocomplete and type checking in Edge Function files.

1. In PowerShell: `irm https://deno.land/install.ps1 | iex`
2. Verify: `deno --version`
3. In VS Code: install the "Deno" extension and enable it for the `supabase/functions/` directory

**Time**: ~2 min. Completely optional.

---

## Phase 1 — Init + Scaffold + Proxy Switch

### Copy local Supabase keys into frontend `.env`

When you run `npm run sb:start` for the first time, Supabase prints output like this:

```
         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOi...  (long JWT string)
service_role key: eyJhbGciOi...  (different long JWT string)
   S3 Access Key: ...
   S3 Secret Key: ...
```

You need to copy two values into `frontend/.env`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   # the anon key from above
```

These values are **stable** — they stay the same across restarts unless you run `supabase stop --no-backup`. You only need to do this once.

**Time**: 1 min (copy-paste).

### Copy Modal endpoint URLs into `supabase/.env.local`

These are the same URLs your current FastAPI backend uses. Find them in `backend/config.py` or your existing `.env` file.

```env
MODAL_JOB_SUBMIT=https://your-modal-username--qwen-tts-...
MODAL_JOB_STATUS=https://your-modal-username--qwen-tts-...
MODAL_JOB_RESULT=https://your-modal-username--qwen-tts-...
MODAL_JOB_CANCEL=https://your-modal-username--qwen-tts-...
MODAL_ENDPOINT_VOICE_DESIGN=https://your-modal-username--qwen-tts-...
TTS_PROVIDER=qwen
```

**Time**: 2 min (find and copy from existing config).

### How local auth works (Inbucket)

The local Supabase stack includes **Inbucket**, a fake email server at `http://localhost:54324`. When you sign up or request a magic link through the SPA:

1. The SPA calls `supabase.auth.signInWithOtp({ email: '...' })`
2. Supabase Auth sends a "magic link" email — but locally, it goes to Inbucket instead of real email
3. Open `http://localhost:54324` in your browser
4. Find the email for your address
5. Click the magic link — it redirects back to `localhost:5173` and you're signed in

You can use any email address you want locally (e.g., `test@test.com`) — Inbucket catches everything.

**For password-based sign up** (if the SPA supports it): sign up normally, then confirm the email via Inbucket.

**Shortcut**: You can also create users directly via Supabase Studio (`http://localhost:54323` → Authentication → Users → Add User). Studio lets you create pre-confirmed users with email + password, skipping the email confirmation step.

---

## Phase 2 — Schema + RLS + Storage

### No manual steps

Everything in this phase is SQL migrations applied by `npm run sb:reset`. No dashboard clicks needed.

---

## Phase 3 — Read Endpoints

### Seed test data for validation

Before the read endpoints can be tested, you need some data in the database. Two options:

**Option A — Studio SQL Editor** (quick, one-off):
1. Open `http://localhost:54323` (Supabase Studio)
2. Go to SQL Editor
3. Run INSERT statements for test voices/generations using service role (bypasses RLS)
4. Use the `user_id` of the user you created in Phase 1

**Option B — `supabase/seed.sql`** (repeatable):
1. Add INSERT statements to `supabase/seed.sql`
2. Run `npm run sb:reset` — this replays migrations + runs seed.sql
3. Seed data is recreated every time you reset

Option B is better for development since it survives resets.

---

## Phases 4–7 — No Manual Steps

Everything in these phases is code changes and (mostly) automated verification. No extra accounts or dashboard interactions needed beyond what you already set up in Phase 1.

---

## Phase 8 — QA + Security Validation

### Create a second test user

For multi-tenant RLS testing, you need two separate users:

1. Open the SPA in a **private/incognito window**
2. Sign up with a different email (e.g., `user2@test.com`)
3. If using **password sign-up**, local config uses `enable_confirmations = false`, so you'll be signed in immediately.
4. If using **magic link**, confirm via Inbucket (`http://localhost:54324`).
5. Alternative: create via Studio: Authentication → Users → Add User

Then verify that user 1's data is invisible to user 2 and vice versa.

---

## Phase 9 — Staging Supabase Deploy

This is the first phase that requires a **real Supabase account** and cloud resources.

### Step 1: Create a Supabase account

1. Go to https://supabase.com
2. Click "Start your project" (or "Sign up")
3. Sign in with GitHub (recommended) or email
4. Free tier is sufficient — no credit card needed

**Time**: 2 min.

### Step 2: Create a staging project

1. From the Supabase dashboard, click "New Project"
2. Choose your organization (created automatically on first sign-up)
3. Fill in:
   - **Name**: `utter-staging` (or whatever you prefer)
   - **Database password**: generate a strong one and **save it** — you'll need it for `supabase link`
   - **Region**: pick the closest to you (or closest to your Modal endpoints for lower latency)
   - **Pricing plan**: Free tier is fine for staging
4. Click "Create new project"
5. Wait ~2 minutes for provisioning

**Time**: 3 min.

### Step 3: Get your project credentials

Once the project is ready:

1. Go to **Settings → API** in the Supabase dashboard
2. Note these values:
   - **Project URL**: `https://xyzxyz.supabase.co` — this is your `VITE_SUPABASE_URL` for staging
   - **anon (public) key**: `eyJhbGciOi...` — this is your `VITE_SUPABASE_ANON_KEY` for staging
   - **service_role key**: `eyJhbGciOi...` — never expose this to the frontend
3. Go to **Settings → General**
   - Note the **Reference ID** (e.g., `xyzxyz`) — this is your `<project-ref>` for CLI commands

**Time**: 1 min.

### Step 4: Link your local repo to the staging project

```bash
npx supabase link --project-ref <your-project-ref>
```

It will ask for your database password (the one you set in Step 2).

### Step 5: Push migrations

```bash
npx supabase db push --dry-run   # Preview what will be applied
npx supabase db push              # Apply migrations to staging
```

### Step 6: Configure Storage CORS

This is a **dashboard step** (not in migrations):

1. Go to **Storage → Configuration** (or Settings → Storage) in the Supabase dashboard
2. Under CORS, add allowed origins:
   - `https://your-staging-domain.vercel.app` (add this when you know your Vercel URL)
   - For now, you can add `*` temporarily for testing (restrict later)
3. Allowed headers: `authorization, x-client-info, apikey, content-type`
4. Allowed methods: `GET, POST, PUT, DELETE, OPTIONS`

**Time**: 2 min.

### Step 7: Set secrets

```bash
npx supabase secrets set \
  MODAL_JOB_SUBMIT=<url> \
  MODAL_JOB_STATUS=<url> \
  MODAL_JOB_RESULT=<url> \
  MODAL_JOB_CANCEL=<url> \
  MODAL_ENDPOINT_VOICE_DESIGN=<url> \
  TTS_PROVIDER=qwen
```

### Step 8: Deploy Edge Functions

```bash
npx supabase functions deploy api
```

### Step 9: Verify

Open in browser: `https://<your-project-ref>.supabase.co/functions/v1/api/languages`

Should return JSON with languages. If it does, staging backend is live.

**Total Phase 9 time**: ~15-20 min of manual work.

---

## Phase 10 — Vercel (Deferred)

### Create a Vercel account (if needed)

1. Go to https://vercel.com
2. Sign in with GitHub (recommended)
3. Free tier (Hobby) is sufficient for staging

### Create Vercel project

1. Click "Add New Project"
2. Import the utter repo from GitHub
3. Set **Root Directory** to `frontend/`
4. Set **Framework Preset** to Vite
5. Add environment variables:
   - `VITE_SUPABASE_URL` = your staging project URL
   - `VITE_SUPABASE_ANON_KEY` = your staging anon key
6. Deploy

The `vercel.json` rewrite rules (created in code during this phase) handle routing `/api/*` to Supabase.

**Total Phase 10 time**: ~10-15 min of manual work.

---

## Quick Reference: All Manual Actions

| Phase | Action | Time | One-time? |
|-------|--------|------|-----------|
| 0 | Install Docker Desktop | 5 min | Yes |
| 0 | (Optional) Install Deno | 2 min | Yes |
| 1 | Copy local Supabase keys to `frontend/.env` | 1 min | Yes |
| 1 | Copy Modal URLs to `supabase/.env.local` | 2 min | Yes |
| 1 | Create first test user (via SPA + Inbucket) | 2 min | Yes |
| 3 | Seed test data (Studio or seed.sql) | 5 min | Optional |
| 8 | Create second test user for RLS testing | 2 min | Yes |
| 9 | Create Supabase account | 2 min | Yes |
| 9 | Create staging project + get keys | 5 min | Yes |
| 9 | Link, push migrations, set secrets, deploy | 10 min | Yes |
| 9 | Configure Storage CORS in dashboard | 2 min | Yes |
| 10 | Create Vercel account + project | 10 min | Yes |

**Total across all phases**: ~45 min of manual work, spread over the entire migration. Phases 0-8 (local development) require only ~12 min of manual setup.
