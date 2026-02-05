# Tooling & development

How we build and run this project locally.

---

## Package Management

| Tool | Use For | Why |
|------|---------|-----|
| **uv** | Python dependencies | Fast, reliable, modern |

### Backend (Python) commands

```powershell
cd backend
uv venv --allow-existing
uv pip install -r requirements.txt -p .venv
uv run -p .venv uvicorn main:app --reload --port 8000
```

---

## Development Environment

| Tool | Purpose |
|------|---------|
| Node.js 20+ | Frontend dev + build |
| npm | Frontend package manager |
| uv | Python env + deps |
| uvicorn | FastAPI dev server |
| Modal CLI | GPU deployment (Qwen3-TTS) |

---

## Code Style

| Language | Tool | Config |
|----------|------|--------|
| Python | None enforced (yet) | - |
| JS/TS/JSON/CSS (frontend) | Biome | `frontend/biome.json` (see `docs/biome.md`) |

---

## Frontend checks

```powershell
npm --prefix frontend run check
npm --prefix frontend run check:write
npm --prefix frontend run ci
```

---

## Commit Convention

```
type: short description

Types:
- feat: new feature
- fix: bug fix
- docs: documentation
- refactor: code change that doesn't add feature or fix bug
- chore: maintenance tasks
```

---

## Notes

Add more guidelines here as the project evolves.
