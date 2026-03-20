# Task 1 - Deploy Supabase Staging Backend

Status: `Done` (2026-02-17)  
Owner: `Backend/Supabase`  
Priority: `P0`

---

## Objective

Deploy local-working Supabase backend pieces (DB schema, RLS/grants, storage policies, edge function, auth config dependencies) to a live **staging** Supabase project, then prove end-to-end correctness outside Docker.

---

## Scope

In:
- create/link staging project
- push migrations
- set secrets
- deploy edge function `api`
- run staging smoke tests
- validate hardening migration is applied and active

Out:
- production Supabase deployment
- Vercel rewrite/env wiring (Task 2)
- Qwen official API cutover work

---

## Source docs

- Primary extracted from: `docs/supabase-migration/phases/09-staging-deploy.md`
- Supporting:
  - `docs/supabase-security.md`
  - `docs/vercel-frontend.md`
  - `docs/supabase-migration/manual-steps.md`

---

## Preconditions (Go / No-Go)

- [ ] `npm run test:db` passing locally (`144/144`)
- [ ] edge tests validated:
  - [ ] local `npm run test:edge` pass, or
  - [ ] green CI `edge-function-tests` on latest relevant commit
- [ ] Docker + Supabase CLI working locally
- [ ] staging secrets/credentials available

No-Go if edge test status is unknown.

---

## Implementation plan

### A. Create and link staging project

- [ ] Create Supabase project `utter-staging`
- [ ] save DB password
- [ ] capture:
  - project URL
  - anon key
  - service_role key (server-only)
  - project ref
- [ ] link repo:

```bash
npx supabase link --project-ref <staging-ref>
```

### B. Push database migrations

- [ ] dry run:

```bash
npx supabase db push --dry-run
```

- [ ] apply:

```bash
npx supabase db push
```

- [ ] verify migration list includes:
  - `20260212120000_profiles_voices_write_hardening.sql`

```bash
npx supabase migration list
```

### C. Verify schema + privileges in staging

- [ ] verify `profiles`, `voices`, `generations`, `tasks` tables
- [ ] verify RLS policies exist
- [ ] verify hardened privileges:

```sql
select
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as auth_can_update_profiles,
  has_table_privilege('authenticated', 'public.voices', 'INSERT') as auth_can_insert_voices;
```

Expected: both `false`.

### D. Configure storage + auth platform settings

- [ ] Storage CORS:
  - include local + staging Vercel origin
  - allow `range` header
- [ ] Auth URL config:
  - set redirect URLs for staging Vercel domain(s)

### E. Set secrets + deploy edge function

- [ ] set secrets:

```bash
npx supabase secrets set \
  MODAL_JOB_SUBMIT=<url> \
  MODAL_JOB_STATUS=<url> \
  MODAL_JOB_RESULT=<url> \
  MODAL_JOB_CANCEL=<url> \
  MODAL_ENDPOINT_VOICE_DESIGN=<url> \
  TTS_PROVIDER=qwen
```

- [ ] deploy function:

```bash
npx supabase functions deploy api
```

### F. Staging smoke test

- [ ] public endpoint:
  - `GET https://<staging-ref>.supabase.co/functions/v1/api/languages`
- [ ] auth flow:
  - sign-up/sign-in
  - `/api/me`
  - `/api/profile`
- [ ] product flow:
  - clone -> generate -> play -> history
  - delete voice/generation

---

## Deliverables / evidence to capture

- [ ] command transcript for `db push`, `migration list`, `functions deploy`
- [ ] screenshot or note of Storage CORS and Auth URL config
- [ ] smoke test notes (pass/fail + observed issues)
- [ ] explicit go/no-go decision for Task 2

---

## Exit criteria

- [ ] staging backend reachable
- [ ] migrations applied correctly
- [ ] hardening privileges confirmed
- [ ] edge function live and healthy
- [ ] core flows work on staging backend

---

## Risks / common failure points

- Storage CORS misconfig (audio playback failures)
- missing/incorrect secrets
- stale or partial migration push
- cold-start misinterpreted as functional failure

---

## Next task gate

Do **not** start Qwen official API wiring work yet.  
After this task completes, execute Task 2 (`../wire-vercel-supabase/README.md`) first.
