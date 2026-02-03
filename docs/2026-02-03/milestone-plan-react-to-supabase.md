# Milestone Plan (2026-02-03): React Refactor → Supabase Edge Backend → CloudFront

> **Status**: Planned  
> **Next focus**: React frontend refactor (parity-first)  
> **Target stack**: React (frontend) + AWS S3/CloudFront (hosting) + Supabase Edge Functions/Postgres/Storage (backend) + Modal.com (TTS jobs)

## Milestone 0 — Align docs + contracts (1–2 hrs)

Lock the “source of truth” for current behaviors and API shapes.

- Ground truth behaviors (pages + state + API calls): `docs/2026-02-03/frontend-refactor/frontend-inventory.md`
- React guardrails: `docs/2026-02-03/frontend-refactor/react-frontend-guidelines.md`
- React migration sequence: `docs/2026-02-03/frontend-refactor/react-refactor-plan.md`
- Modal job orchestration bridge: `docs/2026-02-03/job-based-edge-orchestration.md`
- Deployment target architecture: `docs/2026-02-02/deployment-architecture-plan.md`
- Modal job implementation details: `modal_app/qwen3_tts/LONG_RUNNING_TASKS.md`

## Milestone 1 — React foundation in-repo (same repo) (0.5–1 day)

Create `frontend/` (Vite + React + TS + Tailwind). In dev, proxy to the existing FastAPI backend for:

- `/api/**`
- `/uploads/**`

Doc references:
- `docs/2026-02-03/frontend-refactor/react-frontend-guidelines.md`
- `docs/2026-02-03/frontend-refactor/react-refactor-plan.md`

## Milestone 2 — Shared infra (before pages) (1–2 days)

Build the shared foundations first; all pages depend on these:

- API client + types (voices, generations, tasks)
- Task system parity (React replacement for today’s TaskManager behavior):
  - localStorage persistence + formState restoration
  - polling tasks
  - task dock + badge
- WaveSurfer integration:
  - single player (Generate page)
  - shared list player (Voices + History)

Doc references:
- `docs/2026-02-03/frontend-refactor/frontend-inventory.md`
- `docs/2026-02-03/frontend-refactor/react-refactor-plan.md`

## Milestone 3 — Page migrations (parity-first order) (3–6 days)

Migrate pages in order of increasing coupling/complexity:

1) Landing + About  
2) Voices  
3) History  
4) Clone  
5) Generate  
6) Design  

Doc references:
- `docs/2026-02-03/frontend-refactor/frontend-inventory.md`

## Milestone 4 — Parity hardening + cleanup (2–4 days)

- Address known inconsistencies/decisions listed in:
  - `docs/2026-02-03/frontend-refactor/frontend-inventory.md`
- Optional: add tests / a11y and UX audit pass.

Doc references:
- `docs/2026-02-03/frontend-refactor/react-frontend-guidelines.md`

## Milestone 5 — Frontend deployment (CloudFront) while backend stays FastAPI (1–2 days)

Deploy the React build to S3 + CloudFront while still pointing at FastAPI:

- CloudFront (SPA routing behavior)
- Frontend environment config for API base URL

Doc references:
- `docs/2026-02-03/frontend-refactor/react-frontend-guidelines.md`

## Milestone 6 — Supabase foundations (DB/Auth/Storage/RLS) (2–4 days)

Set up Supabase for production:

- Postgres schema + RLS policies
- Storage buckets for references + generations
- Auth integration plan

Doc references:
- `docs/2026-02-02/deployment-architecture-plan.md`

## Milestone 7 — Supabase Edge Functions backend migration (job-based, poll-driven finalization) (4–10 days)

Migrate FastAPI endpoints to Supabase Edge Functions while preserving the frontend-facing API shapes:

- Persist tasks to Postgres (no in-memory TaskStore)
- Store generated audio in Supabase Storage
- Use Modal job-based orchestration:
  - submit job (Modal)
  - poll job status
  - finalize by fetching result + uploading to Storage + updating DB

Doc references:
- `docs/2026-02-03/job-based-edge-orchestration.md`
- `modal_app/qwen3_tts/LONG_RUNNING_TASKS.md`
- `docs/2026-02-02/deployment-architecture-plan.md`

## Milestone 8 — Post-migration tightening (1–3 days)

- Optional: replace polling with Supabase Realtime subscriptions (tasks updates)
- Add monitoring/logging/alerts and cost checks

Doc references:
- `docs/2026-02-02/deployment-architecture-plan.md`

