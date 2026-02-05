# Utter

Voice cloning + TTS app (Qwen3-TTS on Modal). Backend is FastAPI. Frontend is mid-migration from legacy Jinja pages to a React + Tailwind SPA.

<img width="2785" height="1703" alt="image" src="https://github.com/user-attachments/assets/8902baa6-3995-492c-9085-ef66c6c736b0" />

![demo](https://github.com/user-attachments/assets/82bd2201-81e4-4b0c-b317-8c5a49ba8826)

<img width="2785" height="1710" alt="image" src="https://github.com/user-attachments/assets/db37cea6-7741-4f14-9b58-614a798c625f" />


## What's in here

- `backend/`: FastAPI app + legacy Jinja UI (still served for parity checks)
- `frontend/`: React 19 + Vite + TS + Tailwind v4 (new UI work)
- `modal_app/`: Modal deploy code for Qwen3-TTS
- `docs/`: docs (start with `docs/README.md`)

## Run locally (2 terminals)

### Backend

```powershell
cd backend
uv venv --allow-existing
uv pip install -r requirements.txt -p .venv
uv run -p .venv uvicorn main:app --reload --port 8000
```

Backend: `http://localhost:8000`

### Frontend (React dev server)

```powershell
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Vite proxies these to FastAPI: `/api`, `/uploads`, `/static` (see `frontend/vite.config.ts`).

## Code style

Frontend uses **Biome** (formatter + linter).

- Verify: `npm --prefix frontend run check`
- Fix: `npm --prefix frontend run check:write`
- CI: `npm --prefix frontend run ci`

More: `docs/biome.md`.

