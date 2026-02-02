# Utter Features Reference

> **Purpose**: Ground-truth documentation of all Utter features, constraints, and implementation details.  
> **Audience**: Developers, deployment planning, architecture decisions  
> **Last Updated**: 2026-02-02

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Frontend Pages](#2-frontend-pages)
3. [Core Features](#3-core-features)
   - [Voice Cloning](#31-voice-cloning)
   - [Speech Generation](#32-speech-generation)
   - [Voice Design](#33-voice-design)
4. [Data Models](#4-data-models)
5. [API Endpoints](#5-api-endpoints)
6. [External Services](#6-external-services)
7. [File Storage](#7-file-storage)
8. [Task System](#8-task-system)
9. [Constraints & Limits](#9-constraints--limits)
10. [Future Features](#10-future-features-deployment-related)

---

## 1. Application Overview

### What is Utter?

Utter is an AI-powered voice cloning and text-to-speech application. Users can:

1. **Clone** voices from audio samples (10s–5min)
2. **Design** new voices from text descriptions (no audio needed)
3. **Generate** speech in any saved voice (up to 5,000 characters)

### Current Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| **Backend** | FastAPI (Python 3.11+) | Async, single instance |
| **Database** | SQLite + SQLAlchemy | Local file `utter.db` |
| **Frontend** | Jinja2 Templates + Vanilla JS | Server-rendered |
| **TTS Engine** | Qwen3-TTS on Modal.com | Serverless GPU (A10G) |
| **Audio Playback** | WaveSurfer.js | Waveform visualization |
| **File Storage** | Local filesystem | `uploads/` directory |

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Jinja2 Templates + Vanilla JS + WaveSurfer.js          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Routes    │  │  Services   │  │      TaskStore          │  │
│  │  /api/*     │  │  tts_qwen   │  │  (in-memory dict)       │  │
│  │  HTML pages │  │  audio      │  │                         │  │
│  └─────────────┘  │  storage    │  └─────────────────────────┘  │
│                   └─────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
        │                   │                     │
        ▼                   ▼                     ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────────────────┐
│    SQLite     │  │  Local Files  │  │        Modal.com          │
│   utter.db    │  │  uploads/     │  │  Qwen3-TTS-0.6B           │
│               │  │  ├─ refs/     │  │  Qwen3-TTS-VoiceDesign    │
│               │  │  └─ generated/│  │  (Serverless GPU)         │
└───────────────┘  └───────────────┘  └───────────────────────────┘
```

---

## 2. Frontend Pages

### Page Inventory

| Route | Template | Purpose |
|-------|----------|---------|
| `/` | `index.html` | Landing page with feature cards |
| `/clone` | `clone.html` | Voice cloning form |
| `/generate` | `generate.html` | Speech generation form |
| `/design` | `design.html` | Voice design from text |
| `/voices` | `voices.html` | Voice library management |
| `/history` | `history.html` | Past generations list |
| `/about` | `about.html` | About/info page |

### Page Details

#### Landing Page (`/`)

**Purpose**: Introduce Utter and guide users to core features

**Components**:
- Hero section with tagline
- Three feature cards linking to Clone, Design, Generate
- Responsive layout

**User Actions**:
- Click "Get Started" → `/clone`
- Click feature cards → respective pages

---

#### Clone Page (`/clone`)

**Purpose**: Upload audio to create a cloned voice

**Form Fields**:
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `audio` | File upload | Yes | WAV/MP3/M4A, 10s–5min, max 50MB |
| `name` | Text input | Yes | 1–100 characters |
| `transcript` | Textarea | Yes | Min 10 characters |
| `language` | Select | Yes | 11 options (default: Auto) |

**UI Components**:
- Dropzone for drag-and-drop upload
- "Try Example Voice" button (loads pre-made sample)
- Progress spinner during upload
- Character counter for transcript

**User Flow**:
1. Drop or select audio file
2. Enter voice name
3. Type transcript of what's spoken in the audio
4. Select language (or leave Auto)
5. Click "Create Voice Clone"
6. Wait 10–30 seconds
7. Success → Redirect to `/generate?voice={id}`

---

#### Generate Page (`/generate`)

**Purpose**: Generate speech using a saved voice

**Form Fields**:
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `voice_id` | Select | Yes | From user's voice library |
| `text` | Textarea | Yes | 1–5,000 characters |
| `language` | Select | Yes | 11 options (default: Auto) |

**UI Components**:
- Voice dropdown (populated from API)
- Character counter (0/5000)
- WaveSurfer.js audio player for result
- Download button for generated audio
- Progress spinner with elapsed time

**User Flow**:
1. Select a voice from dropdown
2. Enter text (up to 5,000 chars)
3. Select language
4. Click "Generate Speech"
5. Poll task status (every 2s)
6. On complete: Display waveform player
7. Play or download result

**Technical Notes**:
- Uses async task system (returns `task_id` immediately)
- Polling endpoint: `GET /api/tasks/{task_id}`
- Generated audio stored in `uploads/generated/`
- Generation record saved to database

---

#### Design Page (`/design`)

**Purpose**: Create a new voice from a text description (no audio upload)

**Form Fields**:
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | Text input | Yes | 1–100 characters |
| `instruct` | Textarea | Yes | 1–500 characters (voice description) |
| `text` | Textarea | Yes | 1–500 characters (preview text) |
| `language` | Select | Yes | 10 options (no Auto - explicit required) |

**UI Components**:
- Example voice description cards (6 presets)
- "Generate Preview" button
- WaveSurfer.js preview player
- "Save Voice" button (enabled after preview)
- Progress spinner during generation

**User Flow**:
1. Enter voice name
2. Describe desired voice (tone, gender, age, accent)
3. Enter preview text
4. Select language
5. Click "Generate Preview" (15–45 seconds)
6. Listen to preview
7. If satisfied: Click "Save Voice"
8. Success → Voice saved, can use in Generate page

**Technical Notes**:
- Uses different Modal endpoint (VoiceDesign model)
- Preview audio is saved as the voice's reference
- Preview text becomes the voice's transcript
- Voice marked as `source: "designed"` in database

---

#### Voices Page (`/voices`)

**Purpose**: Manage voice library

**Features**:
- Grid of voice cards
- Each card shows: Name, created date
- Actions per voice: Preview, Generate, Delete

**User Actions**:
- Preview: Plays reference audio with WaveSurfer
- Generate: Links to `/generate?voice={id}`
- Delete: Removes voice and reference file

---

#### History Page (`/history`)

**Purpose**: Browse past generations

**Features**:
- Chronological list (newest first)
- Limited to 50 most recent
- Each card shows: Voice name, text preview, duration, date

**User Actions**:
- Play: Inline WaveSurfer player
- Download: Direct file download
- Delete: Removes generation and audio file

---

## 3. Core Features

### 3.1 Voice Cloning

**What it does**: Creates a digital replica of a voice from an audio sample.

**How it works**:
1. User uploads reference audio (WAV/MP3/M4A)
2. User provides transcript of what's spoken
3. Backend validates audio duration (10s–5min)
4. Audio saved to `uploads/references/{voice_id}.{ext}`
5. Voice record created in database
6. Voice can now be used for generation

**Constraints**:
| Parameter | Limit | Reason |
|-----------|-------|--------|
| Min duration | 10 seconds | Model needs sufficient audio to learn voice |
| Max duration | 5 minutes | Diminishing returns, memory limits |
| Max file size | 50 MB | Server upload limits |
| Transcript | Min 10 chars | Model requires text alignment |
| Formats | WAV, MP3, M4A | Supported by audio processing |

**API Endpoint**: `POST /api/clone`

**Database Record** (Voice table):
```
id: UUID
name: string (1-100 chars)
reference_path: string (file path)
reference_transcript: string
language: string
source: "uploaded"
created_at: datetime
```

---

### 3.2 Speech Generation

**What it does**: Converts text to speech using a cloned/designed voice.

**How it works**:
1. User selects a voice and enters text
2. Backend creates async task (returns `task_id`)
3. Background process:
   - Loads reference audio from storage
   - Calls Modal.com Qwen3-TTS endpoint
   - Receives generated WAV audio
   - Saves to `uploads/generated/{generation_id}.wav`
   - Creates Generation record in database
   - Updates task status to "completed"
4. Frontend polls task status until complete
5. On complete: Displays audio player

**Constraints**:
| Parameter | Limit | Reason |
|-----------|-------|--------|
| Max text | 5,000 characters | Model context window |
| Min text | 1 character | Must have content |
| Generation time | 30–120 seconds | GPU processing + cold start |

**API Endpoint**: `POST /api/generate`

**Task Flow**:
```
POST /api/generate
  └─→ Returns: { task_id, status: "pending" }
  
GET /api/tasks/{task_id} (poll every 2s)
  └─→ Returns: { status: "processing" }
  └─→ Returns: { status: "completed", result: { audio_url, duration } }
```

**Database Record** (Generation table):
```
id: UUID
voice_id: UUID (foreign key)
text: string
audio_path: string (file path)
duration_seconds: float
language: string
created_at: datetime
```

---

### 3.3 Voice Design

**What it does**: Creates a new voice from a natural language description.

**How it works**:
1. User describes desired voice characteristics
2. User enters preview text
3. Backend calls Modal.com VoiceDesign endpoint
4. Model generates audio matching description
5. Preview audio returned to frontend
6. If user saves: Preview audio becomes voice reference
7. Voice can then be used for generation like any cloned voice

**Constraints**:
| Parameter | Limit | Reason |
|-----------|-------|--------|
| Description | Max 500 chars | Model input limit |
| Preview text | Max 500 chars | Keep previews fast |
| Generation time | 15–45 seconds | Different model, no reference audio |

**API Endpoints**:
- `POST /api/voices/design/preview` - Generate preview (async task)
- `POST /api/voices/design` - Save designed voice

**Design vs Clone Differences**:
| Aspect | Clone | Design |
|--------|-------|--------|
| Input | Audio file | Text description |
| Reference | Uploaded audio | Generated preview |
| Model | Qwen3-TTS-0.6B | Qwen3-TTS-VoiceDesign |
| Speed | 10-30s | 15-45s |
| Accuracy | High (exact voice) | Variable (interpretation) |

---

## 4. Data Models

### Voice Model

```python
class Voice(Base):
    __tablename__ = "voices"
    
    id: str                    # UUID, primary key
    name: str                  # 1-100 chars, required
    reference_path: str        # File path to reference audio
    reference_transcript: str  # Transcript text (optional for legacy)
    language: str              # Default "Auto"
    source: str                # "uploaded" | "designed"
    description: str           # Voice design instruct (for designed voices)
    created_at: datetime       # Auto-set
```

### Generation Model

```python
class Generation(Base):
    __tablename__ = "generations"
    
    id: str                    # UUID, primary key
    voice_id: str              # Foreign key → voices.id (CASCADE delete)
    text: str                  # Input text
    audio_path: str            # File path to generated audio
    duration_seconds: float    # Audio duration
    language: str              # Default "Auto"
    created_at: datetime       # Auto-set
    
    # Relationship
    voice: Voice               # Backref to voice
```

---

## 5. API Endpoints

### Voice Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `POST` | `/api/clone` | Create voice from audio upload | No* |
| `GET` | `/api/voices` | List all voices | No* |
| `DELETE` | `/api/voices/{id}` | Delete voice | No* |
| `GET` | `/api/voices/{id}/preview` | Stream reference audio | No* |
| `POST` | `/api/voices/design/preview` | Generate design preview (async) | No* |
| `POST` | `/api/voices/design` | Save designed voice | No* |

### Generation Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `POST` | `/api/generate` | Start generation (async) | No* |
| `GET` | `/api/generations` | List past generations | No* |
| `DELETE` | `/api/generations/{id}` | Delete generation | No* |

### Task Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `GET` | `/api/tasks/{id}` | Poll task status | No* |
| `DELETE` | `/api/tasks/{id}` | Cancel/delete task | No* |

### Utility Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/languages` | List supported languages |

*\*Currently no auth - single user assumed. Auth required for production.*

---

## 6. External Services

### Modal.com - Qwen3-TTS

**Service**: Serverless GPU inference for text-to-speech

**Endpoints**:
| Endpoint Variable | Model | Purpose |
|-------------------|-------|---------|
| `QWEN_MODAL_ENDPOINT_0_6B` | Qwen3-TTS-0.6B | Voice cloning + generation |
| `QWEN_MODAL_ENDPOINT_1_7B` | Qwen3-TTS-1.7B | Larger model (currently stopped) |
| `QWEN_MODAL_ENDPOINT_VOICE_DESIGN` | VoiceDesign | Voice creation from description |

**Request Format** (Clone/Generate):
```json
{
  "text": "Text to speak",
  "language": "English",
  "ref_audio_base64": "base64-encoded-wav",
  "ref_text": "Transcript of reference audio",
  "max_new_tokens": 2048
}
```

**Request Format** (Voice Design):
```json
{
  "text": "Preview text to speak",
  "language": "English",
  "instruct": "A warm, friendly female voice..."
}
```

**Response**: Raw WAV audio bytes (not JSON)

**Timeout**: 300 seconds (5 minutes)

**Typical Latency**:
- Cold start: 30–60 seconds (GPU initialization)
- Warm: 10–30 seconds (depending on text length)

---

## 7. File Storage

### Directory Structure

```
uploads/
├── references/           # Voice reference audio files
│   ├── {voice_id}.wav
│   ├── {voice_id}.mp3
│   └── {voice_id}.m4a
└── generated/            # Generated speech files
    └── {generation_id}.wav
```

### File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Reference | `{voice_id}.{ext}` | `a1b2c3d4-....wav` |
| Generated | `{generation_id}.wav` | `e5f6g7h8-....wav` |

### Cleanup Rules (Current)

- Reference files deleted when voice is deleted
- Generated files deleted when generation is deleted
- No automatic expiration (manual cleanup only)

---

## 8. Task System

### Current Implementation

**Storage**: In-memory Python dictionary (`TaskStore` class)

**Task States**:
```python
class TaskStatus(str, Enum):
    PENDING = "pending"       # Created, not started
    PROCESSING = "processing" # Worker picked up
    COMPLETED = "completed"   # Success, result available
    FAILED = "failed"         # Error occurred
```

**Task Structure**:
```python
{
    "id": "uuid-string",
    "type": "generate" | "design_preview",
    "status": TaskStatus,
    "created_at": "ISO datetime",
    "updated_at": "ISO datetime",
    "metadata": {
        "voice_id": "...",
        "voice_name": "...",
        "text_preview": "first 50 chars...",
        "language": "..."
    },
    "result": {              # On completion
        "audio_url": "/uploads/generated/...",
        "generation_id": "...",
        "duration": 12.5
    },
    "error": "Error message"  # On failure
}
```

**TTL**: 10 minutes (tasks auto-deleted)

**Cleanup**: Background task every 5 minutes

### Limitations

| Issue | Impact | Production Fix |
|-------|--------|----------------|
| In-memory storage | Lost on restart | Database-backed tasks |
| Single process | No horizontal scaling | Distributed task queue |
| No retries | Failed tasks stay failed | Retry logic with backoff |
| No progress | Only status changes | Percentage/stage tracking |

---

## 9. Constraints & Limits

### Audio Constraints

| Constraint | Value | Configurable |
|------------|-------|--------------|
| Min reference duration | 10 seconds | `config.py` |
| Max reference duration | 5 minutes (300s) | `config.py` |
| Max file size | 50 MB | `config.py` |
| Allowed formats | WAV, MP3, M4A | `config.py` |

### Text Constraints

| Constraint | Value | Reason |
|------------|-------|--------|
| Max generation text | 5,000 chars | Model limit |
| Min transcript | 10 chars | Qwen3-TTS requirement |
| Max voice name | 100 chars | UI/DB design |
| Max voice description | 500 chars | Design model limit |
| Max preview text | 500 chars | Keep previews fast |

### Language Support

```python
SUPPORTED_LANGUAGES = [
    "Auto",       # Auto-detect (generation only)
    "Chinese",
    "English",
    "Japanese",
    "Korean",
    "German",
    "French",
    "Russian",
    "Portuguese",
    "Spanish",
    "Italian",
]
```

### Performance Expectations

| Operation | Cold | Warm | Max |
|-----------|------|------|-----|
| Voice clone | N/A | 10-30s | 60s |
| Generation | 30-90s | 10-30s | 120s |
| Voice design preview | 30-60s | 15-30s | 90s |

---

## 10. Future Features (Deployment-Related)

### Authentication & Users

**Required for production**:

| Feature | Implementation |
|---------|----------------|
| User accounts | Supabase Auth (OAuth, email/password) |
| User isolation | Row Level Security on all tables |
| Session management | JWT tokens |
| Profile data | New `profiles` table |

**Schema Addition**:
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT,
    display_name TEXT,
    subscription_tier TEXT DEFAULT 'free',
    credits_remaining INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user_id to existing tables
ALTER TABLE voices ADD COLUMN user_id UUID REFERENCES profiles(id);
ALTER TABLE generations ADD COLUMN user_id UUID REFERENCES profiles(id);
```

---

### Credits & Usage Tracking

**Credit System**:
| Tier | Monthly Credits | Price |
|------|----------------|-------|
| Free | 100 | $0 |
| Pro | 1,000 | $19/mo |
| Enterprise | Unlimited | $99/mo |

**Credit Consumption**:
| Action | Credits |
|--------|---------|
| Voice clone | 0 (free) |
| Voice design preview | 1 |
| Generation (per 500 chars) | 1 |

**Tracking Fields**:
```sql
-- On profiles table
credits_remaining INTEGER
total_generations INTEGER
total_clones INTEGER

-- On generations table  
credits_used INTEGER
```

---

### Billing Integration

**Stripe Integration**:

| Component | Implementation |
|-----------|----------------|
| Checkout | Supabase Edge Function → Stripe Checkout |
| Webhooks | Edge Function handles subscription events |
| Portal | Stripe Customer Portal for management |
| Metering | Track usage, deduct credits |

**Subscription Events to Handle**:
- `checkout.session.completed` - New subscription
- `customer.subscription.updated` - Plan change
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_failed` - Payment issue

---

### Storage Migration

**From local filesystem to Supabase Storage**:

| Current | Production |
|---------|------------|
| `uploads/references/` | Supabase Storage `references` bucket |
| `uploads/generated/` | Supabase Storage `generations` bucket |
| Direct file paths | Signed URLs with expiration |

**Access Control**:
```sql
-- Users can only access their own files
CREATE POLICY "Users access own files"
ON storage.objects FOR ALL
USING (auth.uid()::text = (storage.foldername(name))[1]);
```

---

### Task System Migration

**From in-memory to database**:

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    type TEXT NOT NULL,         -- 'generate' | 'design_preview' | 'clone'
    status TEXT DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);
```

**Benefits**:
- Persistent across restarts
- Queryable history
- Real-time subscriptions (Supabase Realtime)
- Distributed processing support

---

## Summary

### Current State

| Aspect | Status |
|--------|--------|
| Core features | ✅ Complete (clone, generate, design) |
| Database | ✅ Working (SQLite) |
| Modal integration | ✅ Working (Qwen3-TTS) |
| Task system | ⚠️ In-memory only |
| Auth | ❌ None |
| Billing | ❌ None |
| Multi-user | ❌ Single user |
| Production storage | ❌ Local filesystem |

### Production Requirements

1. **Authentication** - Supabase Auth with RLS
2. **Database migration** - SQLite → PostgreSQL
3. **Storage migration** - Local → Supabase Storage
4. **Task persistence** - In-memory → Database
5. **Credit system** - Track usage per user
6. **Billing** - Stripe subscription management
7. **Monitoring** - Error tracking, logging

---

*This document serves as the source of truth for Utter's features and informs all architecture and deployment decisions.*
