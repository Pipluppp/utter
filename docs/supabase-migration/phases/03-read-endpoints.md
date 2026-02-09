# Phase 03 — Read Endpoints

> **Status**: Complete
> **Prerequisites**: [Phase 02](./02-schema-rls-storage.md) complete
> **Goal**: Implement all read-only API endpoints and verify the full pipeline: Edge Function → Supabase client → Postgres (RLS) → JSON response → React SPA.

---

## Why this phase exists

Read endpoints are the simplest to implement and test. They prove that auth, RLS, pagination, joins, and signed URLs all work before we attempt writes. Every endpoint gets shape-verified against `frontend/src/lib/types.ts` immediately.

---

## Steps

### 1. Create route file structure

- [x] Create the route files:
  ```
  supabase/functions/api/routes/
    languages.ts
    me.ts
    voices.ts
    generations.ts
    tasks.ts
  ```
- [x] Move the `/languages` handler from `index.ts` into `routes/languages.ts`
- [x] Update `index.ts` to import and mount all route modules

**`index.ts` pattern after refactor:**
```typescript
import { Hono } from 'npm:hono@4'
import { corsHeaders } from '../_shared/cors.ts'
import { languagesRoutes } from './routes/languages.ts'
import { meRoutes } from './routes/me.ts'
import { voicesRoutes } from './routes/voices.ts'
import { generationsRoutes } from './routes/generations.ts'
import { tasksRoutes } from './routes/tasks.ts'

const app = new Hono().basePath('/api')

// CORS (must be first)
app.options('*', (c) => c.body(null, 204, corsHeaders))
app.use('*', async (c, next) => {
  await next()
  Object.entries(corsHeaders).forEach(([k, v]) => c.header(k, v))
})

// Mount routes
app.route('/', languagesRoutes)
app.route('/', meRoutes)
app.route('/', voicesRoutes)
app.route('/', generationsRoutes)
app.route('/', tasksRoutes)

Deno.serve(app.fetch)
```

### 2. Seed test data

- [x] Before testing reads, you need data in the database
- [x] See [manual-steps.md](../manual-steps.md#phase-3--read-endpoints) for options (Studio SQL Editor or `seed.sql`)
- [x] At minimum, create a test user, a few voices, and a few generations

**Option: Add to `supabase/seed.sql`** for repeatable data:
```sql
-- Create a test user (password: 'password123')
-- Note: local auth accepts any email without verification
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  'authenticated'
);

-- Seed voices
INSERT INTO public.voices (id, user_id, name, language, source, created_at)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Test Voice 1', 'English', 'uploaded', now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Designed Voice', 'Auto', 'designed', now());

-- Seed generations (status=completed for testing list display)
INSERT INTO public.generations (id, user_id, voice_id, text, language, status, created_at)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001', v.id, 'Hello world test', 'English', 'completed', now()
FROM public.voices v
WHERE v.name = 'Test Voice 1'
LIMIT 1;
```

### 3. Implement `GET /me`

- [x] Create `routes/me.ts`

**Goal**: Return the current user's profile, creating one if it doesn't exist (defensive — the trigger should have created it on signup, but handle the edge case).

**Shape** (must match frontend expectations):
```typescript
{
  signed_in: boolean,
  user: { id: string } | null,
  profile: {
    id: string,
    handle: string | null,
    display_name: string | null,
    avatar_url: string | null,
    subscription_tier: string,
    credits_remaining: number,
    created_at: string,
    updated_at: string
  } | null
}
```

**Implementation notes**:
- Use `requireUser()` to get the authenticated user
- Use user-scoped client to SELECT from `profiles` (RLS ensures own row only)
- If no profile found, create one with admin client (handles trigger failure edge case)

**Test**: Sign in via SPA → navigate to Profile page → should display user info.

### 4. Implement `PATCH /profile`

- [x] Add to `routes/me.ts`

**Goal**: Update allowed profile fields with server-side validation.

**Allowed fields**: `display_name`, `avatar_url`, `handle`

**Validation**:
- `handle`: 3-30 chars, alphanumeric + underscores, unique
- `display_name`: 1-100 chars
- `avatar_url`: valid URL or null

**Implementation notes**:
- Use `requireUser()` for auth
- Use service-role client for the UPDATE (because we revoked UPDATE from `authenticated` to prevent clients from modifying `credits_remaining` / `subscription_tier` directly)
- Only update fields that were provided in the request body

**Shape**: `{ profile: Profile }`

**Test**: Update display name in Profile page → refresh → name persists.

### 5. Implement `GET /voices`

- [x] Create `routes/voices.ts`

**Goal**: Paginated list of the user's voices with optional search and source filter.

**Query params**: `page` (default 1), `per_page` (default 20), `search` (optional, `ilike`), `source` (optional, `'uploaded'` | `'designed'`)

**Shape** (must match `VoicesResponse`):
```typescript
{
  voices: Voice[],
  pagination: { page: number, per_page: number, total: number, pages: number }
}
```

**Implementation notes**:
- Use user-scoped client — RLS auto-filters by `user_id`
- Order by `created_at DESC`
- Search: `name.ilike('%search_term%')` (simple substring for MVP)
- Source filter: `.eq('source', source)` when provided
- Calculate `total` with a count query, `pages` = `Math.ceil(total / per_page)`

**Test**: Voices page shows seeded voices. Search filters by name. Pagination works.

### 6. Implement `GET /voices/:id/preview`

- [x] Add to `routes/voices.ts`

**Goal**: Return a 302 redirect to a signed Storage URL for the voice's reference audio.

**Implementation notes**:
- Use `requireUser()` for auth
- Use user-scoped client to SELECT the voice (RLS enforces ownership)
- Read `reference_object_key` from the voice row
- Use admin client to create a signed URL: `storage.from('references').createSignedUrl(key, 3600)`
- Return 302 redirect to the signed URL

**Response**: HTTP 302 with `Location` header pointing to the signed URL.

**Test**: Click play on a voice in the Voices page. Audio should play via WaveSurfer. Check Network tab — should see a 302 → signed Storage URL.

**Note**: If WaveSurfer fails to load the waveform (CORS issue on the redirect), this is the WaveSurfer CORS issue documented in the [README decisions](../README.md). The Storage CORS configuration will be done in Phase 09 for remote, and locally it should work since everything is on localhost.

### 7. Implement `GET /generations`

- [x] Create `routes/generations.ts`

**Goal**: Paginated list of the user's generations with voice name join.

**Query params**: `page`, `per_page`, `search` (on text), `status` (optional filter)

**Shape** (must match `GenerationsResponse`):
```typescript
{
  generations: Generation[],
  pagination: { page, per_page, total, pages }
}
```

**Critical field**: `audio_path` must be set to `/api/generations/${id}/audio` (the stable URL), NOT the raw Storage path or a signed URL.

**Implementation notes**:
- Use user-scoped client — RLS auto-filters
- Join with `voices` to get `voice_name`: `.select('*, voices(name)')`
- Map the Supabase response to flatten `voices.name` into `voice_name`
- Set `audio_path = '/api/generations/' + id + '/audio'` for each generation
- Order by `created_at DESC`

**Test**: History page shows seeded generations with voice names and correct audio paths.

### 8. Implement `GET /generations/:id/audio`

- [x] Add to `routes/generations.ts`

**Goal**: Return a 302 redirect to a signed Storage URL for the generation's audio.

**Implementation notes**:
- Use `requireUser()` for auth
- Use user-scoped client to SELECT the generation (RLS enforces ownership)
- Read `audio_object_key` from the row
- If null (generation not yet completed), return 404
- Use admin client to create signed URL from `generations` bucket
- Return 302 redirect

**Test**: Click play on a generation in History. Audio plays via the redirect.

### 9. Implement `GET /tasks/:id` (simple read, no Modal polling yet)

- [x] Create `routes/tasks.ts`

**Goal**: Return a task by ID. In this phase, just a simple read — no Modal status check. Modal polling is added in Phase 05.

**Shape** (must match `BackendTask`):
```typescript
{
  id: string,
  type: string,
  status: TaskStatus,
  result?: unknown,
  error?: string | null,
  modal_status?: string | null,
  modal_elapsed_seconds?: number | null,
  modal_poll_count?: number | null
}
```

**Implementation notes**:
- Use `requireUser()` for auth
- Use user-scoped client to SELECT (RLS enforces ownership)
- Return 404 if not found
- Map DB row to `BackendTask` shape

**Test**: Directly `curl` a task ID (or use the SPA's TaskProvider, which polls this endpoint).

---

## Files created

| File | Purpose |
|------|---------|
| `supabase/functions/api/routes/languages.ts` | `GET /languages` (extracted from index.ts) |
| `supabase/functions/api/routes/me.ts` | `GET /me`, `PATCH /profile` |
| `supabase/functions/api/routes/voices.ts` | `GET /voices`, `GET /voices/:id/preview` |
| `supabase/functions/api/routes/generations.ts` | `GET /generations`, `GET /generations/:id/audio` |
| `supabase/functions/api/routes/tasks.ts` | `GET /tasks/:id` |

## Files modified

| File | Change |
|------|--------|
| `supabase/functions/api/index.ts` | Refactored to import route modules instead of inline handlers |
| `supabase/seed.sql` | (Optional) Test data for voices and generations |

---

## Acceptance criteria

- [x] `GET /api/me` returns `{ signed_in: true, user, profile }` when authenticated
- [x] `GET /api/me` returns `{ signed_in: false }` (or 401) when unauthenticated
- [x] `PATCH /api/profile` updates display_name and persists across refreshes
- [x] `GET /api/voices` returns paginated voices with correct shape
- [x] `GET /api/voices` with `?search=test` filters results
- [x] `GET /api/voices/:id/preview` returns 302 to a signed URL
- [x] `GET /api/generations` returns generations with `voice_name` populated and `audio_path` set to `/api/generations/:id/audio`
- [x] `GET /api/generations/:id/audio` returns 302 to a signed URL
- [x] `GET /api/tasks/:id` returns a task with correct `BackendTask` shape
- [x] Cross-user isolation: User A cannot see User B's voices/generations/tasks
- [x] SPA pages work: Voices page, History page, Profile page all render correctly

---

## Shape verification checklist

After implementing each endpoint, compare response JSON against `frontend/src/lib/types.ts`:

- [x] `GET /me` response matches what `Profile.tsx` expects
- [x] `GET /voices` response matches `VoicesResponse` type
- [x] `GET /generations` response matches `GenerationsResponse` type
- [x] `GET /tasks/:id` response matches `BackendTask` type

---

## Gotchas

- **Supabase join syntax**: `.select('*, voices(name)')` returns `{ ..., voices: { name: '...' } }`. You need to flatten this to `voice_name` in your response mapper.
- **Pagination count**: Use `.select('*', { count: 'exact', head: false })` to get both rows and total count in one query.
- **audio_path vs audio_object_key**: The DB stores `audio_object_key` (Storage path). The API returns `audio_path` = `/api/generations/:id/audio` (stable URL). These are different things.
- **302 redirects**: Set the `Location` header and return status 302. Don't return the signed URL in JSON — the frontend expects a redirect for audio playback.
