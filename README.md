# Utter

Voice cloning + TTS app (Qwen3‑TTS on Modal). Backend is FastAPI. Frontend is mid‑migration from legacy Jinja pages to a React + Tailwind SPA.

## What’s in here

- `backend/`: FastAPI app + legacy Jinja UI (still served for parity checks)
- `frontend/`: React 19 + Vite + TS + Tailwind v4 (new UI work)
- `modal_app/`: Modal deploy code for Qwen3‑TTS
- `docs/`: actual docs (start here: `docs/2026-02-03/README.md`)

## Run locally (2 terminals)

### Backend

PowerShell:

```powershell
.\scripts\dev-backend.ps1
```

Backend: `http://localhost:8000`

### Frontend (React dev server)

PowerShell:

```powershell
.\scripts\dev-frontend.ps1
```

Frontend: `http://localhost:5173`

Vite proxies these to FastAPI: `/api`, `/uploads`, `/static` (see `frontend/vite.config.ts`).

## Code style

Frontend uses **Biome** (formatter + linter).

- Verify: `npm --prefix frontend run check`
- Fix: `npm --prefix frontend run check:write`
- CI: `npm --prefix frontend run ci`

More: `docs/biome.md`.

## Docs entry points

- Current refactor status + how to run: `docs/2026-02-03/README.md`
- Tooling notes: `docs/tooling.md`

