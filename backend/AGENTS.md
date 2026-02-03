# Agent notes (backend)

## Stack

- FastAPI + Uvicorn
- SQLAlchemy + SQLite for local dev
- Templates: Jinja2 (legacy UI still served for parity validation)

## Python env (use uv)

This backend is managed with `requirements.txt` and a local venv at `backend/.venv`.

Setup + run:

```powershell
cd backend
uv venv --allow-existing
uv pip install -r requirements.txt -p .venv
uv run -p .venv uvicorn main:app --reload --port 8000
```

## Frontend interaction

- FastAPI serves APIs under `/api/**`.
- React dev server (in `frontend/`) proxies `/api`, `/uploads`, `/static` to this backend.
