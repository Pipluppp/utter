# Utter Voice Clone

> Clone a voice → Generate speech. Powered by Echo-TTS.

---

## Quick Start

```bash
# 1. Start PostgreSQL
docker run --name utter-db -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=utter -p 5432:5432 -d postgres:15

# 2. Install Python deps
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Create .env
cp .env.example .env

# 4. Run server
uvicorn main:app --reload

# 5. Open browser
# http://localhost:8000/clone
```

---

## Documentation (Source of Truth)

| Document | What It Covers |
|----------|----------------|
| [Echo-TTS Model](./echo-tts-model.md) | Model constraints (30s max output, 5min reference), text formatting tips, VRAM requirements |
| [Feature Scope](./elevenlabs-features.md) | MVP user flow, page wireframes, API specs, validation rules |
| [Architecture](./architecture-infrastructure.md) | Stack decisions, file structure, API endpoints, environment variables, deployment steps |
| [Design System](./design.md) | Gatsby Carbon theme, color palette, typography, component CSS, page layouts |
| [Roadmap](./roadmap.md) | 3-week sprint plan, day-by-day tasks, verification checklists |
| [Tooling](./tooling.md) | Dev environment setup (uv, Docker), code style, commit conventions |

---

## Locked Decisions

| Decision | Choice |
|----------|--------|
| Frontend | Vanilla HTML/CSS/JS |
| Backend | Python FastAPI |
| Database | PostgreSQL (Neon prod) |
| Storage | Cloudflare R2 |
| GPU | Modal.com |
| Auth | Skip for MVP |
| Generation | Synchronous |

---

## MVP Flow

```
/clone                              /generate
──────                              ─────────
Upload audio (10s-5min)  ────────>  Select voice
Enter voice name                    Enter text (500 chars)
Click Create                        Click Generate
                                    Wait 2-5 seconds
                                    Play audio
                                    Download MP3
```

---

## Stack

```
Browser (HTML/CSS/JS)
         │
    FastAPI (Python)
         │
    ┌────┼────┬────────┐
    │    │    │        │
 Modal  Neon  R2   Filesystem
 (GPU)  (DB) (prod)  (dev)
```

---

## Links

- Echo-TTS: https://github.com/jordandare/echo-tts
- Demo: https://huggingface.co/spaces/jordand/echo-tts-preview
- Blog: https://jordandarefsky.com/blog/2025/echo/
