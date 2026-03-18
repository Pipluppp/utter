# Features

Read this when you need the active product surfaces and where they live in code.

## Frontend Routes

Public:

- `/`
- `/about`
- `/privacy`
- `/terms`
- `/auth`

Protected:

- `/clone`
- `/generate`
- `/design`
- `/voices`
- `/history`
- `/tasks`
- `/account`

Router source:

- `frontend/src/app/router.tsx`

## Active User Flows

### Clone a voice

- UI: `frontend/src/pages/Clone.tsx`
- API: `POST /api/clone/upload-url`, `POST /api/clone/finalize`
- Data: inserts `voices`, touches credits/trials, stores reference audio in `references`

Notes:

- upload is a signed storage flow through the API Worker, backed by R2
- finalize verifies the uploaded object and calls qwen voice cloning

### Generate audio

- UI: `frontend/src/pages/Generate.tsx`
- API: `POST /api/generate`, `GET /api/tasks/:id`, `GET /api/generations/:id/audio`
- Data: inserts `generations` + `tasks`, debits credits, stores audio in `generations`

Notes:

- generation is queue-backed
- task status is durable in Postgres

### Design a voice

- UI: `frontend/src/pages/Design.tsx`
- API: `POST /api/voices/design/preview`, `POST /api/voices/design`
- Data: design preview task, preview audio in `references`, eventual `voices` insert on save

Notes:

- route exists in UI and backend
- backend gate `VOICE_DESIGN_ENABLED` currently defaults to `false` in `workers/api/wrangler.toml`

### Manage voices and history

- UI: `frontend/src/pages/Voices.tsx`, `frontend/src/pages/History.tsx`, `frontend/src/pages/Tasks.tsx`
- API: `GET /api/voices`, `GET /api/generations`, `GET /api/tasks`, delete and preview routes

### Auth, account, credits

- UI: `frontend/src/pages/Auth.tsx`, `frontend/src/pages/account/*`
- API: `GET /api/me`, `PATCH /api/profile`, `GET /api/credits/usage`

Notes:

- `/account/billing` and `/account/usage` currently redirect to `/account/credits` in the router
- billing backend exists even though account billing has no distinct live page right now

### Transcription

- API: `POST /api/transcriptions`
- Backend source: `workers/api/src/routes/transcriptions.ts`

Notes:

- only available when transcription config is enabled
- accepts WAV, MP3, M4A up to 10MB

## Shared Frontend Building Blocks

- auth state: `frontend/src/app/auth/AuthStateProvider.tsx`
- task state: `frontend/src/components/tasks/TaskProvider.tsx`
- API client: `frontend/src/lib/api.ts`
- protected media helpers: `frontend/src/lib/protectedMedia.ts`

## Invariants

- Frontend goes through `/api/*`, not direct provider APIs.
- Long-running work is represented as tasks.
- R2 object access stays signed and private.
- Feature docs should describe active runtime behavior, not historical stack behavior.

## Read Next

- [backend.md](./backend.md)
- [architecture.md](./architecture.md)
- [frontend/README.md](../frontend/README.md)
