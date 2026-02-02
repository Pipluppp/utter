# Utter Voice Clone

> Clone a voice → Generate speech. Powered by **Qwen3-TTS** on Modal.com.

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

# 3. Deploy Qwen3-TTS to Modal (if not already deployed)
python -m modal deploy ../modal_app/qwen3_tts/app.py

# 4. Run server
uvicorn main:app --reload

# 5. Open browser
# http://localhost:8000/clone → upload 10+ sec audio
# http://localhost:8000/generate → select voice, enter text
# http://localhost:8000/design → create voice from description
```

> **Note:** First generation takes ~30-90s (GPU cold start). Subsequent: ~10-30s.

---

## TTS Backend

Utter is powered exclusively by **Qwen3-TTS** models:

| Model | Use Case | Description |
|-------|----------|-------------|
| **Qwen3-TTS-12Hz-0.6B-Base** | Voice Cloning & Generation | Clone from reference audio, generate speech |
| **Qwen3-TTS-12Hz-1.7B-VoiceDesign** | Voice Design | Create new voices from text descriptions |

See [qwen3-tts-models-map.md](./qwen3-tts-models-map.md) for detailed model comparison.

---

## Core Documentation

| Document | What It Covers |
|----------|----------------|
| **[Features](./features.md)** | **Complete feature reference** — all pages, APIs, constraints, data models |
| [Design System](./design.md) | Gatsby Carbon theme, color palette, typography, component CSS |
| [Architecture](./architecture-infrastructure.md) | Stack decisions, file structure, API endpoints |

## Active Planning Documents

> **Focus: `2026-02-03/`**

| Document | What It Covers |
|----------|----------------|
| **[2026-02-03/](./2026-02-03/README.md)** | Frontend refactor + UX fix plans index |
| **[frontend-refactor/](./2026-02-03/frontend-refactor/README.md)** | React refactor docs index |
| **[react-refactor-plan.md](./2026-02-03/frontend-refactor/react-refactor-plan.md)** | React + Tailwind frontend migration |
| **[frontend-inventory.md](./2026-02-03/frontend-refactor/frontend-inventory.md)** | Ground truth map of current frontend for migration parity |
| **[react-frontend-guidelines.md](./2026-02-03/frontend-refactor/react-frontend-guidelines.md)** | Guardrails to keep the React rewrite appropriately simple |
| **[deployment-architecture-plan.md](./2026-02-02/deployment-architecture-plan.md)** | Supabase-only deployment, auth, billing |

## Deployment Guides

| Document | What It Covers |
|----------|----------------|
| [2026-01-26-qwen3-tts-modal-deployment/](./2026-01-26-qwen3-tts-modal-deployment/) | Modal.com deployment guides, optimization |

## Reference

| Document | What It Covers |
|----------|----------------|
| [ElevenLabs Features](./elevenlabs-features.md) | MVP user flow, wireframes |
| [Tooling](./tooling.md) | Dev environment setup |
| [Qwen3-TTS Models Map](./qwen3-tts-models-map.md) | Model variants comparison |

---

## Current Stack

| Layer | Technology |
|-------|------------|
| Frontend | Jinja2 Templates + Vanilla JS |
| Backend | Python FastAPI |
| Database | SQLite (local dev) |
| Storage | Local filesystem |
| GPU/AI | Modal.com (Qwen3-TTS) |
| Auth | None (single user) |

## Target Stack (Production)

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Tailwind V4 on Vercel |
| Backend | Supabase Edge Functions |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage |
| GPU/AI | Modal.com (unchanged) |
| Auth | Supabase Auth |
| Billing | Stripe |

---

## Application Flow

```
Landing (/)
    │
    ├──> Clone (/clone)
    │       Upload audio + transcript
    │       Creates voice in database
    │       ↓
    ├──> Generate (/generate)
    │       Select voice, enter text
    │       Async task → Modal.com → Audio
    │       Save to history
    │       ↓
    ├──> Design (/design)
    │       Describe voice in text
    │       Preview → Save as voice
    │       ↓
    ├──> Voices (/voices)
    │       Manage voice library
    │       ↓
    └──> History (/history)
            Browse past generations
```

---

## Historical Session Notes

| Folder | What It Covers |
|--------|----------------|
| [2026-01-17/](./2026-01-17/) | Initial MVP implementation |
| [2026-01-18-modal-integration-plan/](./2026-01-18-modal-integration-plan/) | Modal.com integration planning |
| [2026-01-19/](./2026-01-19/) | Early development session |
| [2026-01-22/](./2026-01-22/) | Advanced features planning |

---

## Links

- Qwen3-TTS: https://github.com/QwenLM/Qwen3-TTS
- Modal.com: https://modal.com
- Supabase: https://supabase.com
