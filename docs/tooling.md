# Tooling & Development Guidelines

> How we build this project

---

## Package Management

| Tool | Use For | Why |
|------|---------|-----|
| **uv** | Python dependencies | Fast, reliable, modern |

### Commands

```bash
# Install dependencies
uv pip install -r requirements.txt

# Add new package
uv pip install <package>
uv pip freeze > requirements.txt

# Create virtual environment
uv venv
```

---

## Development Environment

| Tool | Purpose |
|------|---------|
| Docker | Local PostgreSQL |
| Modal CLI | GPU deployment |
| uvicorn | Dev server |

---

## Code Style

| Language | Tool | Config |
|----------|------|--------|
| Python | (TBD) | - |
| CSS | (TBD) | - |
| JS/TS/JSON/CSS (frontend) | Biome | `frontend/biome.json` (see `docs/biome.md`) |

---

## Pre-commit (Future)

```bash
# TBD - will add when needed
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
