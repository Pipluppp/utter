# Task 1: Remove Legacy FastAPI Backend

## Problem

The `backend/` directory contains a complete FastAPI + SQLite application (main.py, models, services, templates, uploads, .env with exposed API key). This code is **not used in production** — the app runs entirely on Supabase Edge Functions since 2026-02-17. Its presence:

- Confuses contributors into thinking FastAPI is the active backend
- Contains a committed `.env` with a real Mistral API key (`backend/.env`)
- Adds ~3,000 lines of dead Python code to the repo
- Has stale `backend/AGENTS.md` describing it as the current architecture
- Root `AGENTS.md` also references it as the active backend

## Scope

### Delete entirely

```
backend/
├── main.py              # 1,397 lines, all FastAPI routes
├── models.py            # SQLAlchemy ORM models
├── config.py            # Env config
├── database.py          # SQLite setup
├── services/            # tts_qwen.py, transcription.py, etc.
├── templates/           # Legacy Jinja2 HTML
├── static/              # Legacy CSS/JS
├── uploads/             # Local audio files (references + generated)
├── utter.db             # SQLite database
├── .env                 # EXPOSED SECRETS — must not remain in repo
├── .env.example
├── requirements.txt
└── AGENTS.md
```

### Update references

| File | What to change |
|------|---------------|
| `/AGENTS.md` | Rewrite to describe Supabase Edge Functions + Vercel as the backend. Remove FastAPI setup instructions. |
| `/README.md` | Remove "Legacy backend (optional)" section. Update technology stack description. |
| `/.gitignore` | Remove `backend/`-specific entries if any. Keep `.env` ignoring. |

### Do NOT delete

- `backend/.env.example` patterns — capture useful env var names into `supabase/.env.example` if not already there
- Any Modal endpoint URLs or config values that aren't already in `supabase/.env.local` — verify parity first

## Pre-flight checks

1. Confirm all Modal endpoint URLs from `backend/config.py` exist in `supabase/.env.local`
2. Confirm all Mistral config from `backend/.env` exists in Supabase project secrets
3. Confirm `supabase/functions/api/routes/` covers every `/api/*` route from `backend/main.py`
4. Grep the frontend for any `localhost:8000` or direct FastAPI references — should be zero

## Steps

1. Run pre-flight checks above
2. `git rm -r backend/`
3. Update `/AGENTS.md` to describe current architecture
4. Update `/README.md` to remove legacy backend section
5. Verify `npm run sb:serve` still works (no import from backend/)
6. Verify `npm run test:all` passes
7. Commit

## Security note

After this lands, the Mistral API key in `backend/.env` will still exist in git history. Rotation should happen separately (the key `OIy6A8z8pHDoZNTtq5NV1u8oFhMETV8o` is already in Supabase secrets — just needs rotation on Mistral's dashboard).
