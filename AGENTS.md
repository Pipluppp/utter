# Agent notes (repo working guide)

This repo is split into a Python FastAPI backend and a React + TS + Tailwind frontend.

## Layout

- `backend/`: FastAPI app (still serves the legacy Jinja pages for parity validation)
- `frontend/`: React 19 + Vite + TypeScript + Tailwind v4 SPA (current UI work)
- `modal_app/`: Modal deployment code for Qwen3-TTS
- `docs/`: source-of-truth documentation (start with `docs/2026-02-03/README.md`)

## Local dev (fast path)

- Backend (PowerShell): `.\scripts\dev-backend.ps1`
- Frontend (PowerShell): `.\scripts\dev-frontend.ps1`

Backend: `http://localhost:8000` (legacy Jinja pages)  
Frontend: `http://localhost:5173` (React dev server; proxies `/api`, `/uploads`, `/static` to FastAPI)

## Python deps (use uv)

Backend uses `requirements.txt` + a local venv:

- `cd backend`
- `uv venv --allow-existing`
- `uv pip install -r requirements.txt -p .venv`
- `uv run -p .venv uvicorn main:app --reload --port 8000`

## Frontend formatting + linting (Biome)

Biome is the formatter+linter for `frontend/src`:

- Verify: `npm --prefix frontend run check`
- Fix: `npm --prefix frontend run check:write`
- CI check: `npm --prefix frontend run ci`

Config lives at `frontend/biome.json`. VS Code integration lives in `.vscode/`.

Avoid adding ESLint/Prettier unless explicitly requested; Biome is the source of truth.

## Docs pointers

- Biome explainer: `docs/biome.md`
- Frontend refactor index: `docs/2026-02-03/README.md`

