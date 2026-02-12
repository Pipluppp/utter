# Utter docs

Start here to understand the project, find the current "source of truth", and track the Supabase deployment refactor.

The current planning docs live at the `docs/` root. Historical notes live under date folders like `docs/2026-02-05/` (and a few date+topic folders like `docs/2026-01-26-qwen3-tts-modal-deployment/`).

---

## Quick start (local dev)

Backend:

```powershell
cd backend
uv venv --allow-existing
uv pip install -r requirements.txt -p .venv
uv run -p .venv uvicorn main:app --reload --port 8000
```

Frontend (React dev server):

```powershell
cd frontend
npm install
npm run dev
```

- FastAPI (legacy Jinja UI + APIs): `http://localhost:8000`
- React dev UI (proxies `/api`, `/uploads`, `/static`): `http://localhost:5173`

---

## Current state (Feb 2026)

- Backend: FastAPI + SQLite (`backend/utter.db`) + local uploads (`backend/uploads/`)
- Frontend: React 19 + Vite + TS + Tailwind v4 (legacy Jinja pages still served for parity)
- TTS: Qwen3-TTS on Modal.com (job-based spawn/poll supported)

## Target state (deployment)

- Backend: Supabase Postgres + Storage + Edge Functions (job-based, poll-driven finalization)
- Auth: Supabase Auth + RLS
- Billing: Stripe (planned)
- Frontend hosting: Vercel (Vite/React SPA) with `/api/*` rewrites to Supabase Edge Functions

---

## Active planning (start here)

| Doc | Purpose |
|---|---|
| **[tasks.md](./tasks.md)** | Quick jump point for current staged deployment sequence |
| **[2026-02-13/README.md](./2026-02-13/README.md)** | Latest deployment task index (Task 1: Supabase staging deploy, Task 2: Vercel wiring, then Qwen cutover) |
| [2026-02-13/deploy-supabase/README.md](./2026-02-13/deploy-supabase/README.md) | Full task plan: deploy local-working Supabase backend stack to live staging |
| [2026-02-13/wire-vercel-supabase/README.md](./2026-02-13/wire-vercel-supabase/README.md) | Full task plan: wire deployed Vercel frontend to staging Supabase backend |
| **[architecture.md](./architecture.md)** | Comprehensive architecture reference (schema, RLS, Edge Fns, Auth, Storage) |
| **[architecture-learn.md](./architecture-learn.md)** | How the Supabase pieces work under the hood (educational companion) |
| **[milestone.md](./milestone.md)** | Top-level milestone tracker (backend-focused) |
| **[features.md](./features.md)** | Current feature + API reference (parity ground truth) |
| [supabase.md](./supabase.md) | Supabase grounding (official docs + CLI workflows) |
| [backend.md](./backend.md) | Edge API plan (routes, auth, storage flows) |
| [database.md](./database.md) | Schema + RLS + Storage policies |
| [supabase-security.md](./supabase-security.md) | Supabase security checklist (RLS, hardening, keys, Storage) |
| [edge-orchestration.md](./edge-orchestration.md) | Modal jobs -> Edge orchestration (poll-driven finalization) |
| [deployment-architecture.md](./deployment-architecture.md) | Billing integration + cost projections |
| [vercel-frontend.md](./vercel-frontend.md) | Vercel frontend (React + Vite SPA) with `/api/*` rewrites to Supabase Edge Functions |
| **[qwen-integration/README.md](./qwen-integration/README.md)** | Official Qwen integration orchestration (dual provider rollout, streaming v2, restoration) |

## Supporting docs

| Doc | Purpose |
|---|---|
| [design.md](./design.md) | Design direction + visual identity (React + Tailwind v4) |
| [tooling.md](./tooling.md) | Local tooling and conventions |
| [biome.md](./biome.md) | Frontend formatting/linting (Biome) |
| [qwen3-tts-models-map.md](./qwen3-tts-models-map.md) | Qwen3-TTS model variants and mapping |
| [qwen-api.md](./qwen-api.md) | Official Alibaba (DashScope) Qwen TTS APIs (clone/design + realtime synthesis) |
| [transcription.md](./transcription.md) | Voxtral/Mistral transcription plan (optional) |

## Modal deployment guides (historical)

Start here:
- [2026-01-26-qwen3-tts-modal-deployment/README.md](./2026-01-26-qwen3-tts-modal-deployment/README.md)

---

## Links

- Qwen3-TTS: https://github.com/QwenLM/Qwen3-TTS
- Modal: https://modal.com
- Supabase: https://supabase.com
