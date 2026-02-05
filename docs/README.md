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
- Frontend hosting: TBD (Vercel vs S3/CloudFront)

---

## Active planning (start here)

| Doc | Purpose |
|---|---|
| **[architecture.md](./architecture.md)** | Comprehensive architecture reference (schema, RLS, Edge Fns, Auth, Storage) |
| **[architecture-learn.md](./architecture-learn.md)** | How the Supabase pieces work under the hood (educational companion) |
| **[milestone.md](./milestone.md)** | Top-level milestone tracker (backend-focused) |
| **[features.md](./features.md)** | Current feature + API reference (parity ground truth) |
| [supabase.md](./supabase.md) | Supabase grounding (official docs + CLI workflows) |
| [backend.md](./backend.md) | Edge API plan (routes, auth, storage flows) |
| [database.md](./database.md) | Schema + RLS + Storage policies |
| [edge-orchestration.md](./edge-orchestration.md) | Modal jobs -> Edge orchestration (poll-driven finalization) |
| [deployment-architecture.md](./deployment-architecture.md) | Billing integration + cost projections |

## Supporting docs

| Doc | Purpose |
|---|---|
| [design.md](./design.md) | Design direction + visual identity (React + Tailwind v4) |
| [tooling.md](./tooling.md) | Local tooling and conventions |
| [biome.md](./biome.md) | Frontend formatting/linting (Biome) |
| [qwen3-tts-models-map.md](./qwen3-tts-models-map.md) | Qwen3-TTS model variants and mapping |
| [transcription.md](./transcription.md) | Voxtral/Mistral transcription plan (optional) |

## Modal deployment guides (historical)

Start here:
- [2026-01-26-qwen3-tts-modal-deployment/README.md](./2026-01-26-qwen3-tts-modal-deployment/README.md)

---

## Links

- Qwen3-TTS: https://github.com/QwenLM/Qwen3-TTS
- Modal: https://modal.com
- Supabase: https://supabase.com
