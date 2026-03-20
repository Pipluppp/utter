# Utter MVP - Development Log

> **Date**: 2026-01-17  
> **Status**: Initial MVP Implementation Complete

---

## What Was Done

### Backend (FastAPI + SQLite)

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app with HTML routes and API endpoints |
| `config.py` | Environment configuration (DATABASE_URL, UPLOAD_DIR, limits) |
| `database.py` | SQLAlchemy async setup with SQLite |
| `models.py` | Voice model (id, name, reference_path, created_at) |
| `services/storage.py` | Local file storage for audio files |
| `services/tts.py` | **Mock TTS service** |
| `requirements.txt` | Python dependencies |
| `.env` / `.env.example` | Environment variables |

### Frontend (Vanilla HTML/CSS/JS)

| File | Purpose |
|------|---------|
| `templates/base.html` | Shared layout with header/nav |
| `templates/clone.html` | Voice cloning page |
| `templates/generate.html` | Speech generation page |
| `static/css/style.css` | Gatsby Carbon theme (dark, monospace, sharp edges) |
| `static/js/app.js` | Dropzone, form handling, audio player |

---

## What's Working ✅

- **Clone Page** (`/clone`)
  - File dropzone (drag & drop, click to browse)
  - Voice name input with validation
  - File type validation (WAV, MP3, M4A)
  - Form submission → saves to database + storage
  - Redirect to /generate on success

- **Generate Page** (`/generate`)
  - Voice dropdown populated from database
  - Text input with live character counter (0/500)
  - Generate button triggers API call
  - Audio player with play/pause, progress bar
  - Download button for generated audio

- **API Endpoints**
  - `POST /api/clone` - Upload voice reference
  - `GET /api/voices` - List all voices
  - `POST /api/generate` - Generate speech (mock)

- **Dev Server**
  - Runs on `http://localhost:8000`
  - Hot reload enabled
  - SQLite database auto-creates on startup

---

## Mocks & Placeholders ⚠️

### Mock TTS Service (`services/tts.py`)

The TTS service is **mocked** because:
- No local GPU available
- Echo-TTS requires 8-24GB VRAM
- Real inference needs Modal.com deployment

**What the mock does:**
```python
# Instead of generating speech with Echo-TTS:
# 1. Takes the voice's reference audio
# 2. Copies it as the "generated" output
```

This means:
- ✅ Full UI workflow is testable
- ✅ API contracts are finalized
- ❌ Output audio is just a copy of input (not actual TTS)

---

## Limitations

| Limitation | Reason | Resolution |
|------------|--------|------------|
| No real TTS | No GPU, Echo-TTS needs VRAM | Deploy to Modal.com |
| No audio duration validation | Need audio library (pydub/mutagen) | Add in future sprint |
| SQLite only | Simplified for MVP | Use PostgreSQL + Docker for prod |
| No auth | Out of MVP scope | Add in Phase 2 |
| No voice deletion | Not in MVP | Add in Phase 2 |
| Max 30s TTS output | Echo-TTS model limit | Chunking for longer text |

---

## How to Run

```bash
cd c:\Users\Duncan\Desktop\utter\backend

# First time setup
uv venv
.\.venv\Scripts\activate
uv pip install -r requirements.txt

# Run dev server
uvicorn main:app --reload --port 8000
```

Open: http://localhost:8000/clone

---

## Next Steps

1. **Add audio duration validation** - Validate 10s-5min on upload
2. **Deploy Mock to Modal** - Test Modal.com connection
3. **Integrate real Echo-TTS** - Replace mock with Modal GPU inference
4. **Add PostgreSQL support** - For production readiness
5. **Add error handling polish** - Better UX for edge cases

---

## Dependencies Installed

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy>=2.0.35  # Updated for Python 3.13 compatibility
aiosqlite==0.19.0
python-multipart==0.0.6
aiofiles==23.2.1
python-dotenv==1.0.0
jinja2==3.1.3
```

---

## Screenshots

### Clone Page
![Clone Page](file:///C:/Users/Duncan/.gemini/antigravity/brain/a71b5973-5ed1-40dd-8703-0d532c3185d4/clone_page_verification_1768671300248.png)

### Generate Page  
![Generate Page](file:///C:/Users/Duncan/.gemini/antigravity/brain/a71b5973-5ed1-40dd-8703-0d532c3185d4/generate_page_verification_1768671331303.png)
