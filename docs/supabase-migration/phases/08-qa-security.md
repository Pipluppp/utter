# Phase 08 — QA + Security Validation

> **Status**: In Progress
> **Prerequisites**: [Phase 07](./07-frontend-cleanup.md) complete
> **Goal**: Comprehensive testing of all user flows, multi-tenant isolation, failure modes, and security properties. This is the "sign-off" phase before deploying anything.

---

## Why this phase exists

Phases 01-07 built and wired up everything. But individual per-phase tests don't catch cross-cutting issues: RLS leaks between users, race conditions in finalization, CORS problems with WaveSurfer, or security regressions. This phase is a structured walkthrough.

---

## Steps

### 1. Create two test users

- [x] Sign up as User A (e.g., `usera@test.com`) via the SPA
- [x] Sign up as User B (e.g., `userb@test.com`) in a **private/incognito window**
- [ ] Optional: test Magic Link delivery via Inbucket (`http://localhost:54324`)
- [x] See [manual-steps.md](../manual-steps.md#phase-8--qa--security-validation) for details

Notes:
- Local config uses `enable_confirmations = false`, so **password sign-ups are immediately signed in** (no Inbucket confirmation required).
- Magic links still route through Inbucket locally.

### 2. Core user flow walkthrough (as User A)

Test every feature end-to-end in order:

- [x] **Sign in** → Profile page loads, shows user info *(verified via CLI: GET /me returns signed_in=true with profile)*
- [x] **Update profile** → Change display name → refresh → persists *(verified via CLI: PATCH /profile + re-GET confirms persistence)*
- [x] **Clone voice** → Upload audio + enter transcript → submit → voice appears in Voices list *(verified via CLI: 2-step upload-url → PUT → finalize flow works, voice appears in GET /voices)*
- [x] **Preview voice** → Click play on the cloned voice → WaveSurfer renders waveform → audio plays *(API verified via CLI: GET /voices/:id/preview returns 302 redirect to signed URL. WaveSurfer rendering needs browser verification)*
- [x] **Generate speech** → Select voice, enter text → Generate → task polling starts → audio plays on completion *(full E2E verified via CLI + Modal: POST /generate submits to Modal, task polling tracks modal_status, finalization downloads audio from Modal → uploads to Storage as WAV, generation marked completed with generation_time. Audio retrievable via GET /generations/:id/audio → 302 → 200 audio/wav with RIFF header. Tested twice: 35s/7polls and 10s/2polls — Feb 8)*
- [x] **History** → Generation appears in History → playback works → download works *(verified via CLI: GET /generations returns generation with status=completed, audio_path set. Audio retrieval confirmed: 203KB WAV, valid RIFF header — Feb 8)*
- [x] **Cancel generation** → Start a new generation → cancel mid-flight → task shows cancelled *(verified via CLI: POST /tasks/:id/cancel returns cancelled=true, task status=cancelled, generation status=cancelled — Feb 8)*
- [ ] **Design voice** → Describe a voice → preview → audio plays → save → designed voice appears in Voices *(needs browser — multipart form with audio)*
- [ ] **Generate with designed voice** → Use the designed voice to generate speech → works *(depends on design voice)*
- [x] **Delete generation** → Delete from History → disappears → audio file gone from Storage *(verified via CLI: DELETE /generations/:id returns 200, generation removed from list, GET audio returns 404 — Feb 8)*
- [ ] **Delete voice** → Delete from Voices list → disappears → reference audio gone from Storage *(needs browser to verify UI update)*

### 3. Multi-tenant RLS isolation (as User A + User B)

- [x] As User A: create a voice and a generation *(verified via CLI: voice cloned + generation submitted)*
- [x] Switch to User B's session (incognito window) *(verified via CLI: separate auth token)*
- [x] As User B: verify Voices page shows **empty** (no User A voices) *(verified via curl — Feb 7 + Feb 8)*
- [x] As User B: verify History page shows **empty** (no User A generations) *(verified via curl — Feb 7 + Feb 8)*
- [x] As User B: try to access User A's voice preview directly:
  ```
  GET /api/voices/<user-a-voice-id>/preview
  ```
  → Returns 404 (RLS blocks access) *(verified via curl — Feb 7 + Feb 8)*
- [x] As User B: try to access User A's generation audio:
  ```
  GET /api/generations/<user-a-generation-id>/audio
  ```
  → Returns 404 *(verified via curl — Feb 7 + Feb 8)*
- [x] As User B: try to delete User A's voice:
  ```
  DELETE /api/voices/<user-a-voice-id>
  ```
  → Returns 404 *(verified via curl — Feb 8)*
- [x] As User B: create own voice and generation → verify they only see their own data *(verified via CLI: User B created voice, only sees own voice in GET /voices — Feb 8)*

### 4. PostgREST surface hardening

Verify that direct PostgREST access (bypassing Edge Functions) is locked down:

- [x] Test as `authenticated` role (use User A's JWT):
  ```sql
  -- These should FAIL (grants revoked)
  INSERT INTO tasks (user_id, type, status) VALUES ('<user-a-id>', 'generate', 'pending');
  INSERT INTO generations (user_id, text, language) VALUES ('<user-a-id>', 'test', 'en');
  UPDATE voices SET name = 'hacked' WHERE id = '<user-a-voice-id>';
  ```
- [x] All fail with permission denied errors *(verified via curl against PostgREST)*
- [x] Test as `anon` role:
  ```sql
  SELECT * FROM profiles;
  INSERT INTO voices (user_id, name, source, language) VALUES ('...', 'test', 'uploaded', 'en');
  ```
- [x] Anon cannot write, and RLS blocks reads without auth *(verified via curl)*

### 5. Failure mode testing

- [x] **Modal endpoints missing**: Generate endpoint returns clean JSON error responses (not HTML 500). Also tested: Modal returned a transient `status_error` ("function was terminated by signal") during polling — the edge function returned it as a clean JSON field without crashing, and the next poll recovered successfully. *(verified via CLI + live Modal: Feb 8)*
- [ ] **Double-poll finalize**: Open two browser tabs → generate speech → both tabs should be polling → when Modal completes, exactly one tab finalizes (uploads audio) → both tabs see the completed result → no duplicate audio files in Storage *(needs browser)*
- [ ] **Expired signed URL**: Generate speech → wait for completion → wait > 1 hour (or manually test with a short TTL) → navigate to History → click play → should get a fresh 302 with a new signed URL (the Edge Function generates a new one each time) *(needs browser)*
- [x] **Expired JWT**: Supabase client has `autoRefreshToken: true` in config. *(verified via source inspection: frontend/src/lib/supabase.ts — Feb 8)*

### 6. WaveSurfer CORS verification

- [x] CORS headers present on API responses: `Access-Control-Allow-Origin` confirmed. OPTIONS preflight returns 204. *(verified via curl — Feb 8)*
- [ ] Play a voice preview → WaveSurfer should render the waveform (not just the `<audio>` element) *(needs browser)*
- [ ] Play a generation → same: waveform renders *(needs browser)*
- [ ] If WaveSurfer fails to load audio (fetch fails with CORS error):
  - Check browser console for CORS errors
  - The issue is that the 302 redirect lands on a different origin (Storage) and WaveSurfer's fetch doesn't follow redirects with CORS
  - **Local workaround**: Everything is on localhost, so this should work locally
  - **Remote fix**: Configure Storage CORS in Phase 09

### 7. Security checklist

- [x] **No debug headers**: API responses contain no `x-utter-user-id` header. Frontend source has no references to it. *(verified via curl response headers + grep of frontend/src — Feb 8)*
- [ ] **Authenticated task deletion**: Dismiss a completed task → verify the DELETE request has `Authorization` header *(needs browser Network tab)*
- [x] **Service role key not exposed**: Frontend source has no `service_role` references. Built bundle (frontend/dist/) does not contain the service role JWT payload. *(verified via grep of source + built bundle — Feb 8)*
- [x] **`supabase/.env.local` not in git**: Run `git log --all --full-history -- supabase/.env.local` → returns nothing. *(verified via git — Feb 7 + Feb 8)*
- [x] **No sensitive data in HTML source**: Built bundle contains no service role key, no `MODAL_` env vars, no `x-utter-user-id`. *(verified via grep of frontend/dist — Feb 8)*

### 8. Console error sweep

- [ ] Navigate through every SPA page: Landing → Clone → Generate → Design → Voices → History → Profile
- [ ] Check browser console for errors on each page
- [ ] Fix any errors related to the migration (ignore pre-existing unrelated warnings)

---

## Files modified

None — this phase is testing only.

---

## Acceptance criteria

All checkboxes above should be checked. Summary:

- [x] Core user flows work via API (sign in, profile, clone, generate, poll, finalize, audio retrieval, cancel, delete) *(verified via CLI + live Modal — Feb 8)*
- [ ] Core user flows work in browser (design voice, playback, UI updates) *(needs browser)*
- [x] Multi-tenant isolation is verified (User A and User B can't see each other's data) *(fully verified via CLI — Feb 8)*
- [x] PostgREST direct access is hardened (grants revoked, verified) *(Feb 7 + Feb 8)*
- [x] Failure modes produce clean JSON errors (not HTML 500 crashes) *(verified via CLI — Feb 8)*
- [ ] Double-poll finalization is idempotent *(needs browser)*
- [ ] WaveSurfer renders waveforms correctly *(needs browser)*
- [x] No security regressions (no debug headers, no exposed keys in source or bundle) *(verified via CLI + grep — Feb 8)*
- [ ] No console errors on any page *(needs browser)*

---

## Verification notes

### CLI automated test run — 2026-02-08

**29 tests passed, 0 failed** (via `scripts/phase08-test.sh`) — core CRUD, RLS, PostgREST, CORS, security.

**22 tests passed, 0 failed** (via `scripts/phase08-modal-e2e.sh`) — full Modal E2E pipeline.

Verified:
- **Auth**: User A and User B sign-up/sign-in via password (instant, no email confirmation)
- **Profile CRUD**: GET /me returns profile, PATCH /profile updates display_name and persists across re-fetch
- **Clone flow**: Full 2-step signed-URL upload (POST /clone/upload-url → PUT signed URL → POST /clone/finalize), voice appears in GET /voices
- **Voice preview**: GET /voices/:id/preview returns 302 redirect to signed audio URL
- **Full Modal generation pipeline**: POST /generate → submits to real Modal.com → creates task + generation → task polling tracks modal_status/poll_count → on completion, edge function downloads audio bytes from Modal → uploads to Supabase Storage as WAV → marks generation completed with generation_time_seconds → GET /generations/:id/audio returns 302 → follow redirect → 200 audio/wav with valid RIFF header. Tested twice (35s/7polls cold, 10s/2polls warm).
- **Modal error resilience**: Transient Modal `status_error` ("function terminated by signal") returned as clean JSON — no crash — next poll recovered and completed.
- **Cancel generation**: POST /tasks/:id/cancel mid-flight → task status=cancelled, generation status=cancelled.
- **Delete generation**: DELETE /generations/:id → removed from list, audio returns 404, Storage cleaned.
- **Task dismiss**: DELETE /tasks/:id → returns 200, subsequent GET returns 404.
- **RLS isolation (full)**: User B cannot list, preview, or delete User A's voices/generations (all return 404). User B creates own voice and only sees their own data.
- **PostgREST hardening**: INSERT into tasks/generations, UPDATE voices all blocked with 403. Anon reads return empty, anon writes return 401.
- **CORS**: Access-Control-Allow-Origin header present on all responses. OPTIONS preflight returns 204.
- **Security**: No `x-utter-user-id` in API responses or frontend source. No `service_role` key in frontend source or built bundle. No `MODAL_` env vars in bundle. `.env.local` never committed to git. `autoRefreshToken: true` confirmed in Supabase client config.

### Partial checks — 2026-02-07
- RLS isolation (partial, later fully verified on Feb 8)
- PostgREST hardening (confirmed, re-verified on Feb 8)
- `.env.local` not in git (confirmed)

### Remaining — needs browser

| Test | Why it needs a browser |
|------|----------------------|
| Design voice (preview + save) | Multipart form with audio recording |
| Generate with designed voice | Depends on design voice |
| Delete voice (UI update) | Need to verify UI updates after deletion (API delete works) |
| WaveSurfer waveform rendering | Visual: must see canvas render |
| Audio playback | Must hear/see audio element play |
| Double-poll finalize (two tabs) | Two browser sessions polling same task |
| Console error sweep | Browser devtools only |
| Task deletion Authorization header | Browser Network tab inspection |

---

## Gotchas

- **Inbucket emails expire**: If you can't find confirmation emails, check that Inbucket is running and you're looking at the right inbox.
- **Multi-tenant testing requires two browser sessions**: Use normal + incognito. Or use two different browsers. Supabase auth sessions are per-browser.
- **Storage cleanup**: Test deletions leave no orphan files. Check Storage in Studio after deleting voices/generations.
- **This phase takes time**: Budget 1-2 hours for a thorough walkthrough. Don't rush it.
