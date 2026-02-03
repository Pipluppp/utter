# 2026-02-03 Frontend Refactor + UX Plans

This folder consolidates the React/Tailwind refactor docs and follow-up plans while the legacy Jinja/vanilla frontend is still in place for parity validation.

---

## React refactor docs (source of truth)

| Doc | Purpose |
|-----|---------|
| **[frontend-refactor/](./frontend-refactor/README.md)** | Index of the React refactor docs |
| **[react-refactor-plan.md](./frontend-refactor/react-refactor-plan.md)** | End-to-end plan to migrate the frontend to React + Tailwind |
| **[frontend-inventory.md](./frontend-refactor/frontend-inventory.md)** | Ground truth of current pages/behaviors/state/API calls to preserve |
| **[react-frontend-guidelines.md](./frontend-refactor/react-frontend-guidelines.md)** | Guardrails to keep the React rewrite appropriately simple |

## Codex skills (available)

This repo/session includes:
- `frontend-design`: build/polish UI components/pages with high design quality
- `tailwind-design-system`: Tailwind CSS v4 tokens + component patterns
- `web-design-guidelines`: audit UI against Web Interface Guidelines (UX + accessibility best practices)
- `skill-creator`: create/update a custom skill
- `skill-installer`: install additional skills

---

## Implementation plans (legacy frontend)

These docs were originally written for the Jinja/vanilla frontend, but the React rewrite should preserve the same UX:

| Plan | Goal |
|------|------|
| **[legacy-frontend-plans/README.md](./legacy-frontend-plans/README.md)** | Index of the legacy-frontend implementation plans |
| **[history-search-voice-highlight-plan.md](./legacy-frontend-plans/history-search-voice-highlight-plan.md)** | Search History by voice name + highlight matches |
| **[design-preview-playback-fix-plan.md](./legacy-frontend-plans/design-preview-playback-fix-plan.md)** | Fix `/design` preview play button not playing |
| **[voices-page-improvements-plan.md](./legacy-frontend-plans/voices-page-improvements-plan.md)** | Tag clone vs designed voices, show reference transcript, add Voices search + pagination |

---

## Status (as of 2026-02-03)

- `frontend/` React 19 + Vite + TS + Tailwind v4 exists and builds.
- Dev proxy is in place for `/api/**`, `/uploads/**`, `/static/**`.
- SPA routes implemented: `/`, `/clone`, `/generate`, `/design`, `/voices`, `/history`, `/about`.
- Task system parity is in place (localStorage persistence + polling + dock + badge).
- WaveSurfer is bundled via npm (single player + list player) with cleanup to avoid leaks.
- Fixed: `TaskProvider` no longer depends on Router context (avoids blank screen on load).
- Sanity checks: `cd frontend; npm run typecheck` and `npm run build` pass locally.
- Legacy Jinja pages still exist and are still served by FastAPI (we are validating parity before any deployment).

### Next focus (before Milestone 5 deployment)

- UI/UX hardening pass (fixes + polish + accessibility): **[react-ui-ux-hardening-plan.md](./react-ui-ux-hardening-plan.md)**

---

## How to run locally (FastAPI + React)

### 0) Prereqs

- Python 3.11+ (3.12 recommended)
- `uv` (Astral)
- Node.js 20+

### 1) Backend (FastAPI)

From repo root:

```powershell
cd backend
uv venv --allow-existing
uv pip install -r requirements.txt -p .venv
uv run -p .venv uvicorn main:app --reload --port 8000
```

Backend URL: `http://localhost:8000`

Note: `http://localhost:8000/` serves the legacy Jinja/vanilla frontend (kept for parity validation). The React dev UI is served by Vite on `http://localhost:5173/`.

### 2) Frontend (Vite + React)

In a second PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

### 3) One-command helper scripts (PowerShell)

From repo root:

```powershell
.\scripts\dev-backend.ps1
```

And in another PowerShell:

```powershell
.\scripts\dev-frontend.ps1
```

### Notes

- The React dev server proxies to FastAPI for:
  - `/api/**`
  - `/uploads/**`
  - `/static/**` (used for the Clone "Try Example Voice" assets)
- If your backend is not on `http://localhost:8000`, set `FASTAPI_ORIGIN` before starting Vite:

```powershell
$env:FASTAPI_ORIGIN = "http://localhost:8001"
npm run dev
```
