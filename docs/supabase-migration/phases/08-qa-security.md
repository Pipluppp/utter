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

- [ ] **Sign in** → Profile page loads, shows user info
- [ ] **Update profile** → Change display name → refresh → persists
- [ ] **Clone voice** → Upload audio + enter transcript → submit → voice appears in Voices list
- [ ] **Preview voice** → Click play on the cloned voice → WaveSurfer renders waveform → audio plays
- [ ] **Generate speech** → Select voice, enter text → Generate → task polling starts → audio plays on completion
- [ ] **History** → Generation appears in History → playback works → download works
- [ ] **Cancel generation** → Start a new generation → cancel mid-flight → task shows cancelled
- [ ] **Design voice** → Describe a voice → preview → audio plays → save → designed voice appears in Voices
- [ ] **Generate with designed voice** → Use the designed voice to generate speech → works
- [ ] **Delete generation** → Delete from History → disappears → audio file gone from Storage
- [ ] **Delete voice** → Delete from Voices list → disappears → reference audio gone from Storage

### 3. Multi-tenant RLS isolation (as User A + User B)

- [ ] As User A: create a voice and a generation
- [ ] Switch to User B's session (incognito window)
- [x] As User B: verify Voices page shows **empty** (no User A voices) *(verified via curl)*
- [x] As User B: verify History page shows **empty** (no User A generations) *(verified via curl)*
- [x] As User B: try to access User A's voice preview directly:
  ```
  GET /api/voices/<user-a-voice-id>/preview
  ```
  → Returns 404 (RLS blocks access) *(verified via curl)*
- [x] As User B: try to access User A's generation audio:
  ```
  GET /api/generations/<user-a-generation-id>/audio
  ```
  → Returns 404 *(verified via curl)*
- [ ] As User B: try to delete User A's voice:
  ```
  DELETE /api/voices/<user-a-voice-id>
  ```
  → Should return 404 or 403
- [ ] As User B: create own voice and generation → verify they only see their own data

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

- [ ] **Modal endpoints missing**: Temporarily rename a Modal URL in `supabase/.env.local` → restart `sb:serve` → try to generate → should get a clear error message (not a 500 with no detail)
- [ ] **Double-poll finalize**: Open two browser tabs → generate speech → both tabs should be polling → when Modal completes, exactly one tab finalizes (uploads audio) → both tabs see the completed result → no duplicate audio files in Storage
- [ ] **Expired signed URL**: Generate speech → wait for completion → wait > 1 hour (or manually test with a short TTL) → navigate to History → click play → should get a fresh 302 with a new signed URL (the Edge Function generates a new one each time)
- [ ] **Expired JWT**: Let a session expire (or manually clear the token) → Supabase client auto-refreshes → API calls should resume without user intervention

### 6. WaveSurfer CORS verification

- [ ] Play a voice preview → WaveSurfer should render the waveform (not just the `<audio>` element)
- [ ] Play a generation → same: waveform renders
- [ ] If WaveSurfer fails to load audio (fetch fails with CORS error):
  - Check browser console for CORS errors
  - The issue is that the 302 redirect lands on a different origin (Storage) and WaveSurfer's fetch doesn't follow redirects with CORS
  - **Local workaround**: Everything is on localhost, so this should work locally
  - **Remote fix**: Configure Storage CORS in Phase 09

### 7. Security checklist

- [ ] **No debug headers**: Open Network tab → make several API calls → verify NO request contains `x-utter-user-id`
- [ ] **Authenticated task deletion**: Dismiss a completed task → verify the DELETE request has `Authorization` header
- [ ] **Service role key not exposed**: Check all requests in Network tab → none should contain the service role key. Only the anon key should appear in frontend requests.
- [x] **`supabase/.env.local` not in git**: Run `git log --all --full-history -- supabase/.env.local` → returns nothing. *(verified via git)*
- [ ] **No sensitive data in HTML source**: View page source → no API keys, no service role key, no Modal URLs

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

- [ ] All core user flows work end-to-end
- [ ] Multi-tenant isolation is verified (User A and User B can't see each other's data)
- [x] PostgREST direct access is hardened (grants revoked, verified)
- [ ] Failure modes produce clear errors (not crashes)
- [ ] Double-poll finalization is idempotent
- [ ] WaveSurfer renders waveforms correctly
- [ ] No security regressions (no debug headers, no exposed keys)
- [ ] No console errors on any page

---

## Verification notes

Partial automated checks completed on **2026-02-07**:
- RLS isolation (partial): User B cannot list or access User A's voices/generations via curl (returns 404s / empty lists). Cross-user delete and User B creating own data not yet verified.
- PostgREST hardening: authenticated writes to `tasks` / `generations`, and `voices` updates fail with `permission denied` as intended.
- `.env.local` not in git history: confirmed via `git log`.

Remaining items require manual browser testing (see [08-testing-guide.md](./08-testing-guide.md) for the full breakdown of CLI-testable vs browser-required checks).

---

## Gotchas

- **Inbucket emails expire**: If you can't find confirmation emails, check that Inbucket is running and you're looking at the right inbox.
- **Multi-tenant testing requires two browser sessions**: Use normal + incognito. Or use two different browsers. Supabase auth sessions are per-browser.
- **Storage cleanup**: Test deletions leave no orphan files. Check Storage in Studio after deleting voices/generations.
- **This phase takes time**: Budget 1-2 hours for a thorough walkthrough. Don't rush it.
