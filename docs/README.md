# Utter docs

Start here to understand the project and find current documentation.

**Production**: React 19 SPA on Vercel (`https://utter-wheat.vercel.app`) backed by Supabase project `utter-dev` (`jgmivviwockcwjkvpqra`). Supabase migration completed 2026-02-17.

---

## Quick start (local dev)

Supabase (database + edge functions):

```bash
supabase start
supabase functions serve --env-file supabase/.env.local
```

Frontend (React dev server):

```bash
cd frontend
npm install
npm run dev
```

- Supabase local stack: `http://localhost:54321`
- React dev UI (proxies `/api` to Supabase): `http://localhost:5173`

---

## Active tasks

See **[tasks.md](./tasks.md)** for the current task queue.

Latest: **[2026-02-27/README.md](./2026-02-27/README.md)** — UI/UX polish sprint planning for frontend improvements.

---

## Core reference docs

| Doc | Purpose |
|---|---|
| **[features.md](./features.md)** | Feature + API reference (ground truth) |
| **[architecture.md](./architecture.md)** | Comprehensive architecture reference (schema, RLS, Edge Fns, Auth, Storage) |
| **[milestone.md](./milestone.md)** | Migration milestone tracker (all complete) |
| [backend.md](./backend.md) | Edge Function backend (routes, auth, storage flows) |
| [database.md](./database.md) | Postgres schema + RLS + Storage policies |
| [supabase-security.md](./supabase-security.md) | Security checklist (RLS, hardening, keys, Storage) |
| [edge-orchestration.md](./edge-orchestration.md) | Modal jobs + Edge orchestration (poll-driven finalization) |
| [vercel-frontend.md](./vercel-frontend.md) | Vercel frontend hosting + `/api/*` rewrites |
| [deployment-architecture.md](./deployment-architecture.md) | Billing integration + cost projections |
| **[qwen-integration/README.md](./qwen-integration/README.md)** | Official Qwen API integration (dual provider rollout) |
| [qwen-integration/current-state.md](./qwen-integration/current-state.md) | Current deployed Qwen/Modal state and validated checks |
| [qwen-integration/implementation-guide.md](./qwen-integration/implementation-guide.md) | Implementation summary + setup/deploy runbook |

## Supporting docs

| Doc | Purpose |
|---|---|
| [architecture-learn.md](./architecture-learn.md) | How the Supabase pieces work (educational) |
| [supabase.md](./supabase.md) | Supabase CLI workflows + grounding |
| [supabase-learn.md](./supabase-learn.md) | Supabase concepts explainer |
| [design.md](./design.md) | Design direction + visual identity |
| [tooling.md](./tooling.md) | Local tooling and conventions |
| [biome.md](./biome.md) | Frontend formatting/linting (Biome) |
| [qwen3-tts-models-map.md](./qwen3-tts-models-map.md) | Qwen3-TTS model variants |
| [qwen-api.md](./qwen-api.md) | Official Qwen TTS API reference |
| [transcription.md](./transcription.md) | Mistral Voxtral transcription |
| [costs.md](./costs.md) | Cost projections |

## Historical / planning docs

Date-stamped folders contain planning notes, brain dumps, and progress tracking from various phases. These are kept for historical reference:

- `2026-02-19/` — Auth pages + Qwen cutover planning
- `2026-02-16/` — Staging deploy + Vercel wiring (completed)
- `2026-02-05/` — Migration planning
- `2026-01-*/` — Early project planning, Modal deployment guides
- `supabase-migration/phases/` — Phase-by-phase implementation guides (all complete)

---

## Links

- Qwen3-TTS: https://github.com/QwenLM/Qwen3-TTS
- Modal: https://modal.com
- Supabase: https://supabase.com
