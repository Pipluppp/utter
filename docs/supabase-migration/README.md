# Supabase Backend Migration

> **Goal**: Replace the FastAPI + SQLite backend with Supabase (Postgres + Edge Functions + Auth + Storage) while keeping the SPA's `/api/*` contract stable.

---

## Progress

| Phase | Name | Status | Manual steps? |
|-------|------|--------|---------------|
| [00](./phases/00-prerequisites.md) | Repo Prerequisites | Not Started | [Docker install](./manual-steps.md#phase-0--repo-prerequisites) |
| [01](./phases/01-init-scaffold-proxy.md) | Init + Scaffold + Proxy Switch | Not Started | [Copy keys, Inbucket auth](./manual-steps.md#phase-1--init--scaffold--proxy-switch) |
| [02](./phases/02-schema-rls-storage.md) | Schema + RLS + Storage | Not Started | None |
| [03](./phases/03-read-endpoints.md) | Read Endpoints | Not Started | [Seed test data](./manual-steps.md#phase-3--read-endpoints) |
| [04](./phases/04-write-endpoints.md) | Write Endpoints (Clone + Deletes) | Not Started | None |
| [05](./phases/05-generate-tasks.md) | Generate + Task Orchestration | Not Started | None |
| [06](./phases/06-voice-design.md) | Voice Design | Not Started | None |
| [07](./phases/07-frontend-cleanup.md) | Frontend Cleanup | Not Started | None |
| [08](./phases/08-qa-security.md) | QA + Security Validation | Not Started | [Create second user](./manual-steps.md#phase-8--qa--security-validation) |
| [09](./phases/09-staging-deploy.md) | Staging Supabase Deploy | Not Started | [Account + project setup](./manual-steps.md#phase-9--staging-supabase-deploy) |
| [10](./phases/10-vercel.md) | Vercel (Deferred) | Not Started | [Vercel account + project](./manual-steps.md#phase-10--vercel-deferred) |

Related docs: [manual-steps.md](./manual-steps.md) | [architecture.md](../architecture.md) | [database.md](../database.md) | [edge-orchestration.md](../edge-orchestration.md) | [supabase-security.md](../supabase-security.md)

---

## Decisions Locked

These are binding for implementation. Changes require explicit re-evaluation.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Transcription disabled for MVP** | `/api/languages` returns `transcription.enabled = false`. Clone works via upload + manual transcript. |
| 2 | **Audio delivery via stable API URLs** | `GET /api/voices/:id/preview` and `GET /api/generations/:id/audio` return **302 → signed Storage URL**. `Generation.audio_path` = `/api/generations/:id/audio` (stable, never a raw signed URL). |
| 3 | **Supabase CLI as devDependency** | Pinned in repo-root `package.json`, not global install. |
| 4 | **Route auth model** | `verify_jwt = false` at Function level (public `/api/languages`). Protected routes validate Bearer token per-route. |
| 5 | **Edge Functions = orchestration only** | Long-running compute stays on Modal. Edge handles validation, DB, Storage, signed URLs. |
| 6 | **Error response shape** | `{ detail: string }` — matches existing `parseErrorMessage` in `api.ts`. |
| 7 | **Design preview audio → Storage** | Signed URL, not base64-in-DB. |
| 8 | **Finalization guard** | `generation.audio_object_key IS NOT NULL` check. No `finalizing` boolean column. |
| 9 | **`generation_time_seconds`** | `completed_at - created_at`, stored on `generations` row during finalization. |
| 10 | **`modal_poll_count`** | Incremented atomically per `GET /tasks/:id` that triggers a Modal status check. |
| 11 | **Clone → 2-step signed-URL upload** | `POST /clone/upload-url` → browser upload → `POST /clone/finalize`. |
| 12 | **`apiForm` retained for voice design** | `POST /voices/design` accepts preview audio blob as multipart (< 1MB). |

---

## Architecture

### Local dev topology

```
Frontend:  Vite at http://localhost:5173
Supabase:  http://localhost:54321 (gateway)
Studio:    http://localhost:54323
Inbucket:  http://localhost:54324 (local email for auth)

SPA calls relative /api/* (unchanged)
Vite proxy: /api/* → http://localhost:54321/functions/v1/api/*
```

### Production (later)

```
Vercel rewrites: /api/* → https://<ref>.supabase.co/functions/v1/api/*
```

### Two Supabase clients in Edge Functions

| Client | When to use |
|--------|-------------|
| **User-scoped** (anon key + user's Bearer token) | Reads governed by RLS ("only my rows") |
| **Service-role** (bypasses RLS) | Edge-only writes (tasks, generations), Storage operations |

### Edge Function file layout

```
supabase/functions/
  api/
    index.ts                  Hono router entry point
    routes/
      languages.ts            GET /languages
      me.ts                   GET /me, PATCH /profile
      voices.ts               GET /voices, GET /voices/:id/preview, DELETE /voices/:id
      clone.ts                POST /clone/upload-url, POST /clone/finalize
      generate.ts             POST /generate
      tasks.ts                GET /tasks/:id, POST /tasks/:id/cancel, DELETE /tasks/:id
      generations.ts          GET /generations, GET /generations/:id/audio, DELETE /generations/:id, POST /generations/:id/regenerate
      design.ts               POST /voices/design/preview, POST /voices/design
  _shared/
    cors.ts                   CORS headers helper
    supabase.ts               createUserClient(req), createAdminClient()
    auth.ts                   requireUser(req) middleware
    modal.ts                  Modal HTTP client (submit, status, result, cancel)
```

---

## API Contract Summary

### Kept (same routes, same shapes)

`GET /api/languages` | `GET /api/me` | `PATCH /api/profile` | `GET /api/voices` | `DELETE /api/voices/:id` | `GET /api/voices/:id/preview` | `POST /api/generate` | `GET /api/tasks/:id` | `POST /api/tasks/:id/cancel` | `DELETE /api/tasks/:id` | `GET /api/generations` | `DELETE /api/generations/:id` | `POST /api/generations/:id/regenerate` | `GET /api/generations/:id/audio` | `POST /api/voices/design/preview` | `POST /api/voices/design`

### Changed

| Old | New | Why |
|-----|-----|-----|
| `POST /api/clone` (multipart 50MB) | `POST /api/clone/upload-url` → browser upload → `POST /api/clone/finalize` | Avoid large uploads through Edge Functions |

---

## Response Shape Reference

Per `frontend/src/lib/types.ts`:

| Type | Key fields |
|------|-----------|
| `BackendTask` | `id`, `type`, `status`, `result?`, `error?`, `modal_status?`, `modal_elapsed_seconds?`, `modal_poll_count?` |
| `Voice` | `id`, `name`, `source`, `language`, `reference_transcript?`, `description?`, `created_at` |
| `Generation` | `id`, `voice_id`, `voice_name`, `text`, `audio_path`, `duration_seconds?`, `language`, `status`, `generation_time_seconds?`, `error_message?`, `created_at` |
| `VoicesResponse` | `{ voices: Voice[], pagination: { page, per_page, total, pages } }` |
| `GenerationsResponse` | `{ generations: Generation[], pagination: { page, per_page, total, pages } }` |
| `LanguagesResponse` | `{ languages, default, provider, transcription?: { enabled, ... } }` |
| `GenerateResponse` | `{ task_id, status, is_long_running, estimated_duration_minutes, generation_id }` |
| `CloneResponse` | `{ id, name }` |
| `DesignPreviewResponse` | `{ task_id, status }` |
| `RegenerateResponse` | `{ voice_id, text, language, redirect_url }` |

---

## Local Dev Runbook

### Start (3 terminals)

```bash
npm run sb:start        # Terminal 1: Supabase stack
npm run sb:serve        # Terminal 2: Edge Functions (hot reload)
npm --prefix frontend run dev  # Terminal 3: Frontend
```

### Key URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Supabase API | http://localhost:54321 |
| Studio (DB browser) | http://localhost:54323 |
| Inbucket (local email) | http://localhost:54324 |

### Useful commands

```bash
npm run sb:reset                       # Recreate DB from migrations (wipes data)
npx supabase migration new <name>      # Create empty migration file
npx supabase db diff -f <name>         # Generate migration from Studio changes
```
