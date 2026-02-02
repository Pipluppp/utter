# Architecture & Stack (Source of Truth)

> **Locked Decisions** for MVP development sprints

---

## Stack (Final)

| Layer | Choice | Status |
|-------|--------|--------|
| **Frontend** | Vanilla HTML/CSS/JS | ✅ Locked |
| **Backend** | Python FastAPI | ✅ Locked |
| **Database** | PostgreSQL (Neon prod, Docker local) | ✅ Locked |
| **Storage** | Cloudflare R2 (prod), local filesystem (dev) | ✅ Locked |
| **GPU** | Modal.com (A10G) | ✅ Locked |
| **Hosting** | Railway | ✅ Locked |

---

## Key Decisions (Final)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth | **Skip for MVP** | Add later, keep scope small |
| Generation | **Synchronous** | Wait 2-5s for result, simpler |
| Local GPU testing | **Modal free credits** | $30 credit, real GPU calls |
| HTML serving | **FastAPI direct** | No separate static hosting |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│                  Vanilla HTML/CSS/JS                            │
│                                                                 │
│   /clone         → Upload voice reference                       │
│   /generate      → Enter text, generate speech                  │
│   /design        → Create voice from description                │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTP
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FASTAPI SERVER                             │
│                                                                 │
│   Serves HTML:     GET /clone, GET /generate, GET /design       │
│   API endpoints:   POST /api/clone, POST /api/generate          │
│   Static files:    /static/css/*, /static/js/*                  │
│                                                                 │
│   Generation is ASYNCHRONOUS (task polling pattern)             │
└───────────────┬─────────────────┬─────────────────┬─────────────┘
                │                 │                 │
                ▼                 ▼                 ▼
         ┌───────────┐     ┌───────────┐     ┌───────────┐
         │  Modal    │     │  SQLite   │     │  Storage  │
         │  (GPU)    │     │           │     │           │
         │           │     │ voices    │     │ .wav/.mp3 │
         │ Qwen3-TTS │     │   - id    │     │ files     │
         │ inference │     │   - name  │     │           │
         │           │     │   - ref   │     │           │
         └───────────┘     └───────────┘     └───────────┘
```

---

## Database vs Storage Explained

### PostgreSQL (Structured Data)

Stores **metadata** - small, queryable records:

```sql
CREATE TABLE voices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    reference_url TEXT NOT NULL,  -- Points to storage
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Object Storage (Binary Files)

Stores **audio files** - large binary blobs:

```
/uploads/
├── references/
│   ├── {voice_id}.wav      # User's uploaded voice sample
│   └── ...
└── generated/
    ├── {generation_id}.mp3  # Generated speech output
    └── ...
```

### The Connection

```
Database                          Storage
────────                          ───────
voices.reference_url  ──────────→  /references/{voice_id}.wav
(generations.output_url) ───────→  /generated/{gen_id}.mp3
```

---

## File Structure (Implementation Blueprint)

```
utter/
├── backend/
│   ├── main.py                 # FastAPI app, routes, startup
│   ├── config.py               # Environment settings
│   ├── database.py             # SQLAlchemy setup
│   ├── models.py               # Voice model
│   ├── services/
│   │   ├── tts.py              # Modal client wrapper
│   │   └── storage.py          # File storage abstraction
│   ├── templates/
│   │   ├── base.html           # Shared layout
│   │   ├── clone.html          # Voice cloning page
│   │   └── generate.html       # Speech generation page
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       └── app.js
│   └── requirements.txt
├── modal_app/
│   ├── qwen3_tts/          # Qwen3-TTS Modal deployment
│   │   ├── app.py          # 0.6B model for cloning/generation
│   │   └── app_voice_design.py  # VoiceDesign model
│   └── requirements.txt
├── uploads/                     # Local dev storage (gitignored)
│   ├── references/
│   └── generated/
├── docs/                        # This documentation
├── docker-compose.yml           # Local PostgreSQL
├── .env.example
├── .gitignore
└── README.md
```

---

## API Specification

### POST /api/clone

Upload a voice reference audio file.

**Request:**
```
Content-Type: multipart/form-data

name: "My Voice"
audio: <file>
```

**Response:**
```json
{
  "id": "uuid-here",
  "name": "My Voice",
  "reference_url": "/uploads/references/uuid-here.wav"
}
```

**Validation:**
- Audio format: WAV, MP3, M4A
- Duration: 10 seconds - 5 minutes
- File size: Max 50MB

---

### GET /api/voices

List all cloned voices.

**Response:**
```json
{
  "voices": [
    {
      "id": "uuid-1",
      "name": "My Voice",
      "created_at": "2025-01-13T12:00:00Z"
    }
  ]
}
```

---

### POST /api/generate

Generate speech from text using a cloned voice.

**Request:**
```json
{
  "voice_id": "uuid-here",
  "text": "Hello, this is a test."
}
```

**Response:**
```json
{
  "audio_url": "/uploads/generated/gen-uuid.mp3"
}
```

**Behavior:**
- **Synchronous**: Request blocks until audio is ready (~2-5s)
- Text max: 500 characters
- Audio output: MP3, 44.1kHz

---

## Environment Variables

```bash
# .env.example

# Environment
ENV=development  # or "production"

# Database
DATABASE_URL=postgresql://postgres:dev@localhost:5432/utter

# Storage (production only)
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=xxx
R2_BUCKET=utter-voice

# Modal (production only)  
MODAL_TOKEN_ID=xxx
MODAL_TOKEN_SECRET=xxx
```

---

## Local Development Setup

### 1. Start PostgreSQL

```bash
docker run --name utter-db \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=utter \
  -p 5432:5432 \
  -d postgres:15
```

### 2. Create Python Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Create .env

```bash
cp .env.example .env
# Edit .env with local values
```

### 4. Run Database Migrations

```bash
python -c "from database import create_tables; create_tables()"
```

### 5. Start Server

```bash
uvicorn main:app --reload --port 8000
```

### 6. Open Browser

```
http://localhost:8000/clone     → Upload voice
http://localhost:8000/generate  → Generate speech
```

---

## Modal GPU Setup

### 1. Install Modal CLI

```bash
pip install modal
modal token new
```

### 2. Deploy Qwen3-TTS

```bash
cd modal_app/qwen3_tts
modal deploy app.py
```

### 3. Test

```bash
modal run app.py::test_generate
```

### Modal Code Structure

```python
# modal_app/qwen3_tts/app.py
import modal

app = modal.App("utter-qwen3-tts")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch",
    "torchaudio", 
    "transformers",
    "qwen-tts",
)

@app.cls(gpu="A10G", image=image, container_idle_timeout=300)
class Qwen3TTS:
    @modal.enter()
    def load_model(self):
        from qwen_tts import Qwen3TTSModel
        self.model = Qwen3TTSModel.from_pretrained(
            "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
            device_map="cuda"
        )
    
    @modal.method()
    def generate(self, text: str, ref_audio_base64: str, ref_text: str) -> bytes:
        # Implementation here
        pass
```

---

## Production Deployment

### Railway (Backend)

1. Connect GitHub repo
2. Set environment variables
3. Deploy

### Neon (Database)

1. Create project at neon.tech
2. Get connection string
3. Update DATABASE_URL

### Cloudflare R2 (Storage)

1. Create bucket
2. Create API token
3. Update R2_* variables

### Modal (GPU)

1. Deploy with `modal deploy`
2. Note endpoint URL
3. Update backend config

---

## Cost Estimates

### Development (Free)

| Service | Cost |
|---------|------|
| PostgreSQL (Docker) | $0 |
| Storage (local) | $0 |
| Modal ($30 credit) | $0 (for testing) |

### Production (Low Traffic)

| Service | Free Tier | Est. Monthly |
|---------|-----------|--------------|
| Railway | 500 hrs | $5 |
| Neon | 191 compute hrs | $0 |
| R2 | 10GB storage | $0-2 |
| Modal | - | $5-20 |
| **Total** | | **$10-27** |

---

## Testing Checklist

Before considering MVP complete:

- [ ] Can upload audio file on /clone page
- [ ] Audio validates (format, duration)
- [ ] Voice saved to database
- [ ] Voice appears in dropdown on /generate
- [ ] Can enter text and click generate
- [ ] Audio plays in browser
- [ ] Audio can be downloaded
- [ ] Works on Railway deployment
- [ ] Works with Neon database
- [ ] Works with R2 storage
- [ ] Works with Modal GPU
