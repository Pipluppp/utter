# Utter Voice Clone

> Clone a voice → Generate speech. Powered by Echo-TTS.

---

## Quick Start

```bash
# 1. Install Python deps (use uv)
cd backend
uv venv
.venv\Scripts\activate  # Windows
uv pip install -r requirements.txt

# 2. Authenticate Modal (one time)
python -m modal setup

# 3. Deploy Echo-TTS to Modal
python -m modal deploy ../modal_app/echo_tts.py

# 4. Run server
uvicorn main:app --reload

# 5. Open browser
# http://localhost:8000/clone → upload 10+ sec audio
# http://localhost:8000/generate → select voice, enter text
```

> **Note:** First generation takes ~30-60s (GPU cold start). Subsequent: ~5-10s.

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
                                    ⏳ First: 30-60s, Then: 5-10s
                                    Play audio
                                    Download WAV
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
