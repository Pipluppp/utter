# Utter Features Reference

> **Purpose**: Ground-truth documentation of all Utter features, constraints, and implementation details.  
> **Audience**: Developers, deployment planning, architecture decisions  
> **Last Updated**: 2026-02-22

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

### Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| **Frontend** | React 19 + Vite + Tailwind v4 | Hosted on Vercel |
| **Backend API** | Supabase Edge Functions (Deno/Hono) | Single "fat function" with internal routing |
| **Database** | Supabase Postgres | RLS for user isolation |
| **Auth** | Supabase Auth | JWT, magic link + password |
| **File Storage** | Supabase Storage | Private buckets: `references`, `generated` |
| **TTS Engine** | Qwen3-TTS on Modal.com | Serverless GPU (A10G) |
| **Transcription** | Mistral Voxtral | Batch + realtime |
| **Audio Playback** | WaveSurfer.js | Waveform visualization |

In local dev, the React UI runs on `http://localhost:5173` and Vite proxies `/api` to `http://localhost:54321/functions/v1` (Supabase Edge Functions).

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  React 19 SPA + WaveSurfer.js + Supabase Auth SDK       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    /api/* (Vercel rewrite)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Supabase Edge Functions (Deno)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Hono Router │  │  Services   │  │   Supabase Clients      │  │
│  │  /api/*     │  │  modal.ts   │  │  (service role + user)  │  │
│  │             │  │  mistral.ts │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
        │                   │                     │
        ▼                   ▼                     ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────────────────┐
│   Postgres    │  │   Storage     │  │        Modal.com          │
│  profiles     │  │  references/  │  │  Qwen3-TTS-0.6B           │
│  voices       │  │  generated/   │  │  Qwen3-TTS-VoiceDesign    │
│  generations  │  │ (signed URLs) │  │  (Serverless GPU)         │
│  tasks        │  │               │  │                           │
└───────────────┘  └───────────────┘  └───────────────────────────┘
```

---

## 2. Frontend Pages

### Page Inventory

| Route | Component | Auth | Purpose |
|-------|-----------|------|---------|
| `/` | `Landing.tsx` | No | Landing page with hero, demo wall, features, pricing |
| `/clone` | `Clone.tsx` | Yes | Voice cloning (upload + record + transcription) |
| `/generate` | `Generate.tsx` | Yes | Speech generation with task polling |
| `/design` | `Design.tsx` | Yes | Voice design from text description |
| `/voices` | `Voices.tsx` | Yes | Voice library with search + filtering |
| `/history` | `History.tsx` | Yes | Past generations with playback |
| `/auth` | `Auth.tsx` | No | Login / signup (magic link + password) |
| `/account/*` | `AccountLayout.tsx` | Yes | Profile, usage, billing |
| `/about` | `About.tsx` | No | About page |

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
- Generated audio stored in Supabase Storage (`generated` bucket)
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
4. Audio saved to Supabase Storage (`references` bucket)
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
   - Saves audio to Supabase Storage (`generated` bucket)
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

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `POST` | `/api/clone` | Create voice from audio upload | Yes |
| `GET` | `/api/voices` | List user's voices | Yes |
| `DELETE` | `/api/voices/{id}` | Delete voice | Yes |
| `GET` | `/api/voices/{id}/preview` | Signed URL for reference audio | Yes |
| `POST` | `/api/voices/design/preview` | Generate design preview (async) | Yes |
| `POST` | `/api/voices/design` | Save designed voice | Yes |

### Generation Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `POST` | `/api/generate` | Start generation (async) | Yes |
| `GET` | `/api/generations` | List user's generations | Yes |
| `DELETE` | `/api/generations/{id}` | Delete generation | Yes |
| `POST` | `/api/generations/{id}/regenerate` | Get params to re-run | Yes |

### Task Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/tasks/{id}` | Poll task status | Yes |
| `POST` | `/api/tasks/{id}/cancel` | Cancel running task | Yes |

### Profile Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/me` | Get current user profile | Yes |
| `PATCH` | `/api/profile` | Update profile | Yes |

### Utility Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/languages` | List supported languages | No |

All authenticated endpoints require a valid Supabase JWT in the `Authorization: Bearer` header. RLS enforces user isolation at the database level.

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

Audio files are stored in **Supabase Storage** (private buckets with signed URLs).

### Buckets

| Bucket | Content | Access |
|--------|---------|--------|
| `references` | Voice reference audio | User-scoped via RLS on `storage.objects` |
| `generated` | Generated speech files | User-scoped via RLS; uploads via service role |

### Object Key Convention

| Type | Key pattern |
|------|-------------|
| Reference | `{user_id}/{voice_id}/reference.{ext}` |
| Generated | `{user_id}/{generation_id}.wav` |

Database columns store object keys (not full URLs). Edge functions issue signed URLs for playback/download.

### Cleanup Rules

- Reference objects deleted when voice is deleted (edge function handles)
- Generated objects deleted when generation is deleted
- No automatic expiration

---

## 8. Task System

**Storage**: Postgres `tasks` table (durable across restarts).

**Task States**: `pending` → `processing` → `completed` | `failed` | `cancelled`

**Task Flow**:
1. Edge function creates a `tasks` row + submits Modal job
2. Frontend polls `GET /api/tasks/{id}`
3. Edge function checks Modal job status on each poll, updates task row
4. On completion: generation record created, audio saved to Storage, task marked `completed`

**Task Structure** (Postgres row, returned as JSON):
```json
{
    "id": "uuid",
    "type": "generate | design_preview",
    "status": "pending | processing | completed | failed | cancelled",
    "modal_job_id": "modal-job-id",
    "voice_id": "uuid",
    "generation_id": "uuid",
    "metadata": { "voice_name": "...", "text_preview": "...", "language": "..." },
    "result": { "audio_url": "signed-url", "generation_id": "...", "duration": 12.5 },
    "error": "Error message",
    "cancellation_requested": false,
    "created_at": "ISO datetime",
    "updated_at": "ISO datetime",
    "completed_at": "ISO datetime"
}
```

**Frontend**: `TaskProvider` context polls active tasks every 500ms, persists state to localStorage for tab recovery.

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

## 10. Upcoming Features

### Credits & Usage Tracking

**Credit System** (planned):
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

Schema fields already exist on `profiles` (`credits_remaining`, `subscription_tier`) but enforcement logic in edge functions is not yet implemented.

---

### Billing Integration

**Stripe Integration** (planned):

| Component | Implementation |
|-----------|----------------|
| Checkout | Supabase Edge Function → Stripe Checkout |
| Webhooks | Edge Function handles subscription events |
| Portal | Stripe Customer Portal for management |
| Metering | Track usage, deduct credits |

---

## Summary

### Current State

| Aspect | Status |
|--------|--------|
| Core features | ✅ Complete (clone, generate, design) |
| Frontend | ✅ React 19 SPA on Vercel |
| Backend | ✅ Supabase Edge Functions (Deno/Hono) |
| Database | ✅ Supabase Postgres with RLS |
| Auth | ✅ Supabase Auth (magic link + password) |
| Storage | ✅ Supabase Storage (signed URLs) |
| Task system | ✅ Postgres-backed tasks table |
| Modal integration | ✅ Working (Qwen3-TTS) |
| Credit system | ❌ Not enforced yet |
| Billing | ❌ No Stripe integration yet |
| Monitoring | ❌ No error tracking yet |

### Next Up

1. **Credit enforcement** - Deduct credits per generation in edge functions
2. **Billing** - Stripe subscription management
3. **Profile column guards** - Prevent client-side escalation of credits/tier
4. **Monitoring** - Error tracking, structured logging

---

*This document serves as the source of truth for Utter's features and informs all architecture and deployment decisions.*
