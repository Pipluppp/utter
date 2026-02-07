# Phase 08 — Testing Guide for AI Agent

This is a companion to `08-qa-security.md`. That document lists what to test. This document tells you how to set up, execute, and verify each test as a CLI agent that can run shell commands but cannot interact with a browser GUI.

## Understanding your limitations

You can run shell commands, read files, query APIs with `curl`, and run SQL via `psql` or the Supabase CLI. You **cannot** click buttons in a browser, see WaveSurfer render, or visually inspect the UI. This means:

- Steps that require API calls (CRUD, RLS, auth, security headers): you can test directly
- Steps that require visual verification (WaveSurfer rendering, console errors, UI navigation): you must guide the human to test manually, or verify indirectly (e.g. confirm the API returns audio bytes and correct CORS headers)
- Steps that require two browser sessions (multi-tenant RLS via the SPA): you can simulate with two different auth tokens via `curl`

## Local stack setup

The Supabase local stack runs in Docker. Three processes are needed:

```bash
# Terminal 1 — Supabase services (Postgres, Auth, Storage, Studio, Inbucket)
npm run sb:start

# Terminal 2 — Edge Functions (Hono API server on Deno)
npm run sb:serve

# Terminal 3 — Frontend dev server (Vite on port 5173)
npm --prefix frontend run dev
```

What each command does:
- `sb:start` → `supabase start` — starts all Docker containers. First run pulls images (~2 min). Subsequent runs take ~10s. Applies migrations from `supabase/migrations/` automatically.
- `sb:serve` → `supabase functions serve api --env-file ./supabase/.env.local --no-verify-jwt` — serves the single `api` Edge Function locally with hot reload. The `--no-verify-jwt` flag means the function itself handles JWT verification (via `supabase.auth.getUser()`), not the gateway.
- `sb:status` → `supabase status` — shows all service URLs and keys. Use this to get the anon key and service role key.

### Verifying the stack is up

```bash
# Check services
npm run sb:status

# Health check on the Edge Function
curl -s http://127.0.0.1:54321/functions/v1/api/health
# Expected: {"ok":true}

# Check languages endpoint (public, no auth needed)
curl -s http://127.0.0.1:54321/functions/v1/api/languages
# Expected: JSON with language list and transcription config
```

If `sb:serve` crashes or you change `supabase/.env.local`, restart it. If you need a clean database, run `npm run sb:reset` (drops and recreates from migrations + seed).

### Key URLs

| Service | URL |
|---------|-----|
| API (Edge Functions) | `http://127.0.0.1:54321/functions/v1/api/` |
| Supabase Auth | `http://127.0.0.1:54321/auth/v1/` |
| Supabase Storage | `http://127.0.0.1:54321/storage/v1/` |
| Studio (DB GUI) | `http://127.0.0.1:54323` |
| Inbucket (email) | `http://127.0.0.1:54324` |
| Frontend | `http://127.0.0.1:5173` |
| PostgREST (direct) | `http://127.0.0.1:54321/rest/v1/` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### Keys (from `sb:status`)

```
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

These are the standard local dev keys (hard-coded in the Supabase CLI, not secrets).

## Creating test users via CLI

Email confirmations are **off** (`enable_confirmations = false` in `supabase/config.toml`), so sign-ups are instant. No Inbucket step needed for password auth.

```bash
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Create User A
curl -s -X POST http://127.0.0.1:54321/auth/v1/signup \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"usera@test.com","password":"password123"}' | head -c 500

# Create User B
curl -s -X POST http://127.0.0.1:54321/auth/v1/signup \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"userb@test.com","password":"password123"}' | head -c 500
```

Both return a JSON response with `access_token` and `user.id`. Save these:

```bash
# Sign in and extract tokens (if you need to re-auth later)
USER_A_TOKEN=$(curl -s -X POST http://127.0.0.1:54321/auth/v1/token?grant_type=password \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"usera@test.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

USER_B_TOKEN=$(curl -s -X POST http://127.0.0.1:54321/auth/v1/token?grant_type=password \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"userb@test.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "User A token: $USER_A_TOKEN"
echo "User B token: $USER_B_TOKEN"
```

Note: On Windows/PowerShell the `python3 -c` pipe may need adjustment. Use `python` instead of `python3`, or parse with `jq` if available. Alternatively, just copy the `access_token` value from the full JSON output.

## Making authenticated API calls

All Edge Function endpoints expect the access token as a Bearer token:

```bash
API=http://127.0.0.1:54321/functions/v1/api

# As User A
curl -s "$API/voices" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "apikey: $ANON_KEY"

# As User B
curl -s "$API/voices" \
  -H "Authorization: Bearer $USER_B_TOKEN" \
  -H "apikey: $ANON_KEY"
```

The `apikey` header is required by the Supabase gateway (it identifies the project). The `Authorization` header identifies the user.

## Testing each Phase 08 section

### Section 1 & 2: User creation + core flows

Create both users as shown above. For the core CRUD walkthrough, you need to test the full lifecycle. The edge function routes (from `supabase/functions/api/index.ts`) are:

```
GET    /api/languages         — public, no auth
GET    /api/me                — profile
PATCH  /api/me                — update profile
POST   /api/clone             — clone a voice (multipart: audio file + transcript)
GET    /api/voices            — list user's voices
GET    /api/voices/:id/preview — stream voice preview audio
DELETE /api/voices/:id        — delete voice
POST   /api/generate          — start generation (returns task)
GET    /api/generations       — list user's generations
GET    /api/generations/:id/audio — stream generation audio
DELETE /api/generations/:id   — delete generation
POST   /api/voices/design/preview — preview a designed voice
POST   /api/voices/design     — save a designed voice
GET    /api/tasks/:id         — poll task status
DELETE /api/tasks/:id         — dismiss task
```

To test clone (multipart upload), you need a sample audio file. Use the demo files already in the repo:

```bash
# Clone a voice as User A
curl -s -X POST "$API/clone" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "apikey: $ANON_KEY" \
  -F "audio=@frontend/public/static/utter_demo/gojo/reference.mp3" \
  -F "transcript=This is a test transcript for voice cloning." \
  -F "name=Test Voice A" \
  -F "language=en"
```

This returns a voice object with an `id`. Save it for subsequent tests.

Note: Clone uses a 2-step signed-URL upload flow (`POST /clone/upload-url` → browser uploads → `POST /clone/finalize`). The simple multipart `POST /clone` may not exist — check the route file. If so, test the 2-step flow:

```bash
# Step 1: Get upload URL
UPLOAD_RESP=$(curl -s -X POST "$API/clone/upload-url" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filename":"reference.mp3","content_type":"audio/mpeg"}')
echo "$UPLOAD_RESP"
# Extract the signed URL and voice_id from response

# Step 2: Upload to signed URL
# curl -X PUT "<signed-url>" -H "Content-Type: audio/mpeg" --data-binary @frontend/public/static/utter_demo/gojo/reference.mp3

# Step 3: Finalize
# curl -s -X POST "$API/clone/finalize" -H "Authorization: Bearer $USER_A_TOKEN" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{"voice_id":"...","name":"Test Voice A","transcript":"...","language":"en"}'
```

For generate (starts an async Modal job):

```bash
# Generate speech as User A
curl -s -X POST "$API/generate" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"voice_id\":\"$VOICE_A_ID\",\"text\":\"Hello world, this is a test.\",\"language\":\"en\"}"
```

This returns a task object. Poll it:

```bash
curl -s "$API/tasks/$TASK_ID" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "apikey: $ANON_KEY"
```

Note: generate requires Modal to be running. If Modal endpoints aren't configured in `supabase/.env.local`, the task will fail — this is expected and tests Section 5 (failure modes). If Modal IS configured, poll until `status` is `completed`, then check generations.

### Section 3: Multi-tenant RLS isolation

This is the most important test and you CAN do it entirely via `curl`:

```bash
# User A creates a voice (done above, save VOICE_A_ID)

# User B tries to list voices — should see empty array, NOT User A's voice
curl -s "$API/voices" \
  -H "Authorization: Bearer $USER_B_TOKEN" \
  -H "apikey: $ANON_KEY"
# Expected: {"voices":[],...} or empty list

# User B tries to access User A's voice preview — should get 404 or 403
curl -s -o /dev/null -w "%{http_code}" "$API/voices/$VOICE_A_ID/preview" \
  -H "Authorization: Bearer $USER_B_TOKEN" \
  -H "apikey: $ANON_KEY"
# Expected: 404 or 403

# User B tries to delete User A's voice — should get 404 or 403
curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/voices/$VOICE_A_ID" \
  -H "Authorization: Bearer $USER_B_TOKEN" \
  -H "apikey: $ANON_KEY"
# Expected: 404 or 403

# Unauthenticated request — should get 401
curl -s -o /dev/null -w "%{http_code}" "$API/voices" \
  -H "apikey: $ANON_KEY"
# Expected: 401
```

Repeat the same pattern for generations if a generation exists.

### Section 4: PostgREST surface hardening

Test direct PostgREST access (bypassing Edge Functions entirely). The PostgREST endpoint is at `/rest/v1/`:

```bash
REST=http://127.0.0.1:54321/rest/v1

# As authenticated user — direct table reads should work (RLS filters)
curl -s "$REST/voices" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "apikey: $ANON_KEY"
# Expected: only User A's voices (RLS)

# As authenticated user — direct writes should FAIL (grants revoked)
curl -s -X POST "$REST/tasks" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000","type":"generate","status":"pending"}'
# Expected: 403 or permission denied

# As anon — reads should return empty (RLS blocks)
curl -s "$REST/profiles" \
  -H "apikey: $ANON_KEY"
# Expected: empty array or 403

# As anon — writes should fail
curl -s -X POST "$REST/voices" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000","name":"hack","source":"uploaded","language":"en"}'
# Expected: 403 or permission denied
```

You can also test via `psql` directly for more control:

```bash
# Connect as postgres (superuser, for inspecting data)
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Inside psql, simulate the authenticated role:
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"<user-a-uuid>","role":"authenticated"}';
SELECT * FROM voices;  -- should see only User A's voices
SELECT * FROM voices WHERE user_id != '<user-a-uuid>';  -- should return 0 rows
RESET ROLE;
```

### Section 5: Failure modes

**Modal missing:** Rename the Modal URL in `supabase/.env.local` (e.g. `MODAL_JOB_SUBMIT` → `MODAL_JOB_SUBMIT_DISABLED`), restart `sb:serve`, then try to generate. Check that the error response is a clean JSON error, not a 500 with an HTML stack trace. Restore the env var after.

**Double-poll finalize:** This requires two browser tabs and is hard to test via CLI alone. Flag this as a manual test for the human. The key thing to verify afterward: check Storage for duplicate audio files for the same generation.

**Expired JWT:** You can simulate this by waiting for the JWT to expire (default `jwt_expiry = 3600` in config.toml — 1 hour) or by manually crafting an expired token. In practice, just verify that the Supabase client config has `autoRefreshToken: true` (it does, in `frontend/src/lib/supabase.ts`).

### Section 6: WaveSurfer CORS

This is a visual/browser test — you cannot verify waveform rendering from CLI. What you CAN verify:

```bash
# Check that audio endpoints return actual audio bytes with correct headers
curl -s -o /dev/null -w "status: %{http_code}, content-type: %{content_type}, size: %{size_download}" \
  "$API/voices/$VOICE_A_ID/preview" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "apikey: $ANON_KEY"
# Expected: status 200, content-type audio/*, size > 0

# Check CORS headers are present
curl -s -D - -o /dev/null "$API/voices" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "apikey: $ANON_KEY" | grep -i "access-control"
# Expected: Access-Control-Allow-Origin, Access-Control-Allow-Headers, etc.
```

Flag waveform rendering as a manual visual test.

### Section 7: Security checklist

```bash
# Verify .env.local is not tracked
git status -- supabase/.env.local
# Expected: nothing (not tracked)

git log --all --full-history -- supabase/.env.local
# Expected: empty (never committed)

# Check that the x-utter-user-id debug header was removed from api.ts
grep -r "x-utter-user-id" frontend/src/
# Expected: no matches

# Check service role key doesn't appear in frontend source
grep -r "service_role" frontend/src/
# Expected: no matches (or only in comments/docs, not actual code)

# Check the built bundle doesn't contain the service role key
npm --prefix frontend run build
grep -r "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSI" frontend/dist/
# Expected: no matches (that's the base64 of the service_role JWT payload)
```

### Section 8: Console error sweep

This is a browser-only test. You can partially verify by checking that every page's primary API call returns valid JSON:

```bash
# Languages (used by multiple pages)
curl -s "$API/languages" -H "apikey: $ANON_KEY" | python3 -c "import sys,json; json.load(sys.stdin); print('OK')"

# Voices
curl -s "$API/voices" -H "Authorization: Bearer $USER_A_TOKEN" -H "apikey: $ANON_KEY" | python3 -c "import sys,json; json.load(sys.stdin); print('OK')"

# Generations
curl -s "$API/generations" -H "Authorization: Bearer $USER_A_TOKEN" -H "apikey: $ANON_KEY" | python3 -c "import sys,json; json.load(sys.stdin); print('OK')"

# Me
curl -s "$API/me" -H "Authorization: Bearer $USER_A_TOKEN" -H "apikey: $ANON_KEY" | python3 -c "import sys,json; json.load(sys.stdin); print('OK')"
```

But flag the full console sweep as a manual test — only a browser can catch React rendering errors, missing assets, etc.

## Summary: what you can test vs. what needs a human

| Test | CLI-testable | Needs human |
|------|:---:|:---:|
| User creation | Yes | |
| API CRUD (clone, generate, list, delete) | Yes | |
| RLS isolation between users | Yes | |
| PostgREST hardening | Yes | |
| Modal failure mode | Yes | |
| Double-poll finalize | | Yes |
| Security headers / no debug headers | Yes | |
| Service role key not in bundle | Yes | |
| .env.local not in git | Yes | |
| WaveSurfer waveform rendering | | Yes |
| CORS headers present | Yes | |
| Audio playback | | Yes |
| Console error sweep | Partial | Yes |
| Visual UI navigation | | Yes |

Run all CLI-testable items first. Report results. Then list the manual items for the human to verify in the browser.
