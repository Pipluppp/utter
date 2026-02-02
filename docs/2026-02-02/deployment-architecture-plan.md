# Utter Deployment Architecture Plan

> **Date**: 2026-02-02  
> **Scope**: Production deployment architecture with Supabase, Modal.com, and CDN  
> **Goal**: Scalable, cost-effective deployment supporting auth, billing, and multi-tenancy  
> **Reference**: See [features.md](../features.md) for complete feature documentation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Technology Assessment](#4-technology-assessment)
5. [Supabase Deep Dive](#5-supabase-deep-dive)
6. [Task Queue & Long-Running Jobs](#6-task-queue--long-running-jobs)
7. [File Storage Strategy](#7-file-storage-strategy)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Billing Integration](#9-billing-integration)
10. [Frontend Deployment](#10-frontend-deployment)
11. [API Architecture](#11-api-architecture)
12. [Database Schema Evolution](#12-database-schema-evolution)
13. [Cost Analysis](#13-cost-analysis)
14. [Migration Strategy](#14-migration-strategy)
15. [Security Considerations](#15-security-considerations)
16. [Monitoring & Observability](#16-monitoring--observability)

---

## 1. Executive Summary

### Utter Feature Overview

> **Full feature documentation**: [features.md](../features.md)

Utter provides three core features:

| Feature | Description | Modal Endpoint | Typical Latency |
|---------|-------------|----------------|-----------------|
| **Voice Clone** | Create voice from audio sample (10s–5min) | Qwen3-TTS-0.6B | 10–30s |
| **Speech Generation** | Generate speech up to 5,000 chars | Qwen3-TTS-0.6B | 30–120s |
| **Voice Design** | Create voice from text description | VoiceDesign model | 15–45s |

### Current State

| Component | Technology | Limitations |
|-----------|------------|-------------|
| Backend | FastAPI (local) | Single instance, no scaling |
| Database | SQLite (`utter.db`) | Single file, no concurrent writes |
| Task Queue | In-memory dict (`TaskStore`) | Lost on restart, single process |
| File Storage | Local filesystem (`uploads/`) | No redundancy, no CDN |
| Auth | None | Single user assumed |
| AI Models | Modal.com | ✓ Already cloud-deployed |

### Target State

| Component | Technology | Benefits |
|-----------|------------|----------|
| Database | Supabase PostgreSQL | Scalable, managed, real-time |
| Auth | Supabase Auth | OAuth, JWT, Row Level Security |
| API | Supabase Edge Functions | Serverless, 400s timeout, `waitUntil()` |
| Task Queue | PostgreSQL + Realtime | Persistent, subscriptions |
| File Storage | Supabase Storage (S3) | CDN, signed URLs, policies |
| AI Models | Modal.com | Unchanged |
| Frontend | Vercel | Global CDN, edge caching |

### Architecture Decision

**✅ YES: 100% Supabase Backend IS Possible!**

After reviewing the updated Supabase Edge Functions capabilities, **Utter CAN run entirely on Supabase** with no Railway/Render needed.

#### Key Findings (2026 Supabase Limits)

| Limit | Free Plan | Pro Plan | Utter Requirement | ✓/✗ |
|-------|-----------|----------|-------------------|-----|
| **Wall clock (worker lifetime)** | 150s | **400s** | TTS: 30-120s | ✅ |
| **Request idle timeout** | 150s | 150s | Awaiting Modal response | ✅ |
| **CPU time per request** | 2s | 2s | Orchestration only | ✅ |
| **Memory** | 256MB | 256MB | No heavy processing | ✅ |
| **Max functions** | 100 | 500 | ~10-15 functions | ✅ |
| **Background tasks** | ✅ `waitUntil()` | ✅ | Fire-and-forget | ✅ |

**The 400s wall-clock limit on Pro plan comfortably handles our Modal.com TTS calls (typically 30-120s).**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                    (Vercel / CloudFront + S3)                               │
│                         React 19 SPA                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE (ENTIRE BACKEND)                               │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Auth     │  │  Database   │  │   Storage   │  │  Realtime   │        │
│  │  (GoTrue)   │  │ (PostgreSQL)│  │    (S3)     │  │ (WebSocket) │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                    Edge Functions (Deno)                         │        │
│  │                                                                   │        │
│  │  /generate     → Create task → waitUntil(call Modal) → Update DB │        │
│  │  /clone        → Upload to Storage → Create voice record         │        │
│  │  /design       → Create task → waitUntil(call Modal) → Update DB │        │
│  │  /tasks/:id    → Poll task status from DB                        │        │
│  │  /voices       → CRUD operations on voices table                 │        │
│  │  /generations  → CRUD operations on generations table            │        │
│  │  /webhooks/*   → Stripe billing webhooks                         │        │
│  │                                                                   │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MODAL.COM                                          │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │  Qwen3-TTS-0.6B (Clone/Generate)                                 │        │
│  │  Qwen3-TTS-1.7B-VoiceDesign (Design)                            │        │
│  │  GPU: A10G | Scaling: 0-N | Cold start: ~30s                    │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### The Magic: `EdgeRuntime.waitUntil()` + Background Tasks

Supabase Edge Functions now support **background tasks** that continue after the response is sent:

```typescript
// /generate endpoint - returns task_id immediately, processes in background
Deno.serve(async (req) => {
  const { voice_id, text } = await req.json();
  
  // Create task in DB
  const task = await supabase.from("tasks").insert({ status: "pending" }).select().single();
  
  // Start background processing (does NOT block response!)
  EdgeRuntime.waitUntil(processGeneration(task.data.id, voice_id, text));
  
  // Return immediately with task_id for polling
  return new Response(JSON.stringify({ task_id: task.data.id }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function processGeneration(taskId: string, voiceId: string, text: string) {
  try {
    // Update task to processing
    await supabase.from("tasks").update({ status: "processing" }).eq("id", taskId);
    
    // Call Modal.com (this can take 30-120s - that's fine!)
    const response = await fetch(MODAL_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ voice_id: voiceId, text }),
    });
    const result = await response.json();
    
    // Upload audio to Supabase Storage
    await supabase.storage.from("generations").upload(`${taskId}.wav`, result.audio);
    
    // Update task as completed
    await supabase.from("tasks").update({
      status: "completed",
      result: { audio_path: `${taskId}.wav` },
    }).eq("id", taskId);
  } catch (error) {
    await supabase.from("tasks").update({
      status: "failed",
      error: error.message,
    }).eq("id", taskId);
  }
}
```

This is **exactly** what we need for Utter!

---

## 2. Current Architecture Analysis

> **Complete current implementation details**: [features.md](../features.md)

### Data Flow (Current)

```
User → FastAPI → SQLite (voices, generations)
                → Local FS (audio files)
                → Modal.com (TTS generation)
                → In-memory TaskStore (task status)
```

### Current Pages & Features

| Page | Route | Features | API Calls |
|------|-------|----------|-----------|
| Landing | `/` | Feature cards, CTA | None |
| Clone | `/clone` | Audio upload, transcript, language | `POST /api/clone` |
| Generate | `/generate` | Voice select, text input, player | `POST /api/generate`, `GET /api/tasks/{id}` |
| Design | `/design` | Description, preview, save | `POST /api/voices/design/preview`, `POST /api/voices/design` |
| Voices | `/voices` | List, preview, delete | `GET /api/voices`, `DELETE /api/voices/{id}` |
| History | `/history` | List, play, delete | `GET /api/generations`, `DELETE /api/generations/{id}` |

### Current Constraints (from [features.md](../features.md))

| Parameter | Value |
|-----------|-------|
| Reference audio | 10s–5min, max 50MB |
| Generation text | Max 5,000 characters |
| Voice description | Max 500 characters |
| Supported languages | 11 (Auto + 10 explicit) |
| Task TTL | 10 minutes |

### Pain Points

| Issue | Impact | Severity |
|-------|--------|----------|
| SQLite single-writer | Can't scale horizontally | 🔴 High |
| In-memory task store | Lost on restart | 🔴 High |
| Local file storage | No redundancy | 🔴 High |
| No authentication | Single user only | 🔴 High |
| No billing | Can't monetize | 🟡 Medium |
| Monolithic backend | Deploy all or nothing | 🟡 Medium |

### What Works Well

| Component | Status |
|-----------|--------|
| Modal.com integration | ✅ Already serverless, scales automatically |
| Task polling pattern | ✅ Good UX, can be migrated |
| API design | ✅ Clean REST endpoints |
| React migration plan | ✅ Ready for SPA deployment |

### Feature → Deployment Requirements Matrix

> Based on features documented in [features.md](../features.md)

| Feature | Database | Storage | Auth | Long-Running | Billing |
|---------|----------|---------|------|--------------|---------|
| **Voice Clone** | Voice record | Reference audio (50MB max) | User isolation | No (sync) | Free |
| **Speech Generation** | Generation record | Generated audio | User isolation | **Yes** (30-120s) | Credits |
| **Voice Design** | Voice record | Preview as reference | User isolation | **Yes** (15-45s) | Credits |
| **Voice Library** | Query voices | Serve audio | User isolation | No | - |
| **History** | Query generations | Serve audio | User isolation | No | - |
| **Task Polling** | Task status | - | User isolation | - | - |

---

## 3. Proposed Architecture

### High-Level Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                USERS                                        │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │   VERCEL (CDN)    │           │  CLOUDFLARE CDN   │
        │   React SPA       │    OR     │  + S3 Static      │
        │   Edge Functions  │           │                   │
        └───────────────────┘           └───────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
        ┌────────────────────────────────────────────────────┐
        │                    SUPABASE                         │
        │                                                     │
        │  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
        │  │  Auth   │  │Postgres │  │ Storage │            │
        │  │         │  │   DB    │  │  (S3)   │            │
        │  └────┬────┘  └────┬────┘  └────┬────┘            │
        │       │            │            │                  │
        │       └────────────┼────────────┘                  │
        │                    │                               │
        │  ┌─────────────────┴─────────────────┐            │
        │  │         Edge Functions            │            │
        │  │  • /api/tasks/* (polling)         │            │
        │  │  • /api/voices/* (CRUD)           │            │
        │  │  • /api/generations/* (CRUD)      │            │
        │  └─────────────────┬─────────────────┘            │
        └────────────────────┼────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────────┐
        │              FASTAPI (Railway/Fly.io)              │
        │                                                     │
        │  • POST /internal/generate (long-running)          │
        │  • POST /internal/clone (file processing)          │
        │  • POST /internal/design (voice design)            │
        │  • Webhook endpoints for billing                   │
        │                                                     │
        │  Connects to: Supabase DB, Supabase Storage        │
        └────────────────────┬────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────────┐
        │                   MODAL.COM                         │
        │                                                     │
        │  • Qwen3-TTS-0.6B (voice cloning & generation)     │
        │  • Qwen3-TTS-1.7B-VoiceDesign (voice design)       │
        │  • Serverless GPU (A10G)                           │
        │  • Auto-scales 0 → N                               │
        └────────────────────────────────────────────────────┘
```

### Request Flow Examples

#### Voice Cloning Flow

```
1. User uploads audio file
   Frontend → Supabase Storage (signed upload URL)

2. User submits clone request
   Frontend → Supabase Edge Function → Create task in DB
                                     → Call FastAPI /internal/clone

3. FastAPI processes clone
   FastAPI → Download from Supabase Storage
          → Validate audio
          → Save voice record to Supabase DB
          → Update task status

4. Frontend polls task status
   Frontend → Supabase Edge Function → Read task from DB
```

#### Speech Generation Flow

```
1. User submits generation request
   Frontend → Supabase Edge Function → Create task in DB
                                     → Call FastAPI /internal/generate

2. FastAPI orchestrates generation
   FastAPI → Read voice from Supabase DB
          → Download reference audio from Storage
          → Call Modal.com TTS endpoint
          → Upload result to Supabase Storage
          → Save generation record
          → Update task status

3. Frontend polls task status
   Frontend → Supabase Edge Function → Read task from DB
          → On complete: Get signed URL for audio
```

---

## 4. Technology Assessment

### 🎯 Can Utter Run 100% on Supabase? YES!

After analyzing the current Supabase Edge Functions capabilities, **a full Supabase backend is viable** for Utter.

#### Feature-by-Feature Analysis

| Utter Feature | Supabase Capability | How It Works |
|---------------|---------------------|--------------|
| **Voice Cloning** | ✅ Edge Function + Storage | Upload to Storage, create voice record |
| **Speech Generation** | ✅ Edge Function + `waitUntil()` | Background task calls Modal, updates DB |
| **Voice Design** | ✅ Edge Function + `waitUntil()` | Same pattern as generation |
| **Task Polling** | ✅ Edge Function + PostgreSQL | Simple SELECT from tasks table |
| **Real-time Updates** | ✅ Supabase Realtime | Subscribe to task status changes |
| **File Storage** | ✅ Supabase Storage | S3-compatible with signed URLs |
| **Auth** | ✅ Supabase Auth | OAuth, email/password, JWT |
| **Billing/Stripe** | ✅ Edge Function | Webhook handling, customer portal |
| **Audio Processing** | ⚠️ Limited | No sharp/ffmpeg, but Modal handles this |

#### What About the Limits?

| Concern | Reality | Verdict |
|---------|---------|---------|
| "Edge Functions timeout too fast" | **400s wall-clock on Pro** (was 150s) | ✅ Plenty for TTS |
| "Can't do background processing" | `EdgeRuntime.waitUntil()` runs after response | ✅ Perfect for our pattern |
| "No Python ecosystem" | Deno/TypeScript is fine for orchestration; **Modal handles the AI** | ✅ We only orchestrate |
| "256MB memory limit" | We're not processing audio, just passing bytes | ✅ Sufficient |
| "Can't use sharp/ffmpeg" | Modal.com can do any audio processing needed | ✅ Offload to Modal |

### Supabase-Only Architecture (RECOMMENDED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE PROJECT                                   │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Edge Functions (Deno)                           │  │
│  │                                                                         │  │
│  │  POST /generate     →  Create task, waitUntil(Modal call)              │  │
│  │  POST /clone        →  Validate, store file, create voice              │  │
│  │  POST /design       →  Create task, waitUntil(Modal call)              │  │
│  │  GET  /tasks/:id    →  Return task status from DB                      │  │
│  │  GET  /voices       →  List user's voices                              │  │
│  │  POST /checkout     →  Create Stripe checkout session                  │  │
│  │  POST /webhook      →  Handle Stripe events                            │  │
│  │                                                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐   │
│  │     Auth     │   │   Postgres   │   │   Storage    │   │  Realtime  │   │
│  │  • OAuth     │   │  • voices    │   │  • refs/     │   │  • tasks   │   │
│  │  • JWT       │   │  • gens      │   │  • gens/     │   │  subscribe │   │
│  │  • RLS       │   │  • tasks     │   │  • signed    │   │            │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   └────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (fetch)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MODAL.COM                                          │
│                   (Serverless GPU - unchanged)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Comparison: Supabase-Only vs Hybrid

| Aspect | Supabase-Only | Hybrid (+ Railway) |
|--------|---------------|-------------------|
| **Complexity** | ✅ Simpler | More moving parts |
| **Cost** | ✅ $25/mo (Pro) | $45+/mo |
| **Cold starts** | ~500ms | ~2s (Railway sleeps) |
| **Deployment** | ✅ `supabase functions deploy` | Multiple deploys |
| **Monitoring** | ✅ Unified dashboard | Fragmented |
| **Vendor lock-in** | Supabase | Supabase + Railway |
| **Python ecosystem** | ❌ Deno only | ✅ Full Python |
| **Heavy audio processing** | ⚠️ Offload to Modal | ✅ Can do locally |

**Recommendation: Go Supabase-Only** unless you need heavy server-side audio processing (which we don't—Modal handles it).

### What We Lose Going Supabase-Only

1. **Python ecosystem** - Can't use librosa, pydub for audio analysis
   - *Mitigation*: Add audio analysis to Modal endpoint if needed
   
2. **Heavy file processing** - No ffmpeg, sharp, imagemagick
   - *Mitigation*: Modal can do format conversion; Supabase handles basic uploads

3. **Complex background jobs** - No Celery-style task queues
   - *Mitigation*: `waitUntil()` + PostgreSQL tasks table is sufficient

4. **Long-running processes** - 400s max (Pro plan)
   - *Mitigation*: TTS rarely exceeds 120s; can split very long texts

### What We GAIN Going Supabase-Only

1. **Simpler architecture** - One platform to manage
2. **Lower cost** - $25/mo vs $45+/mo
3. **Faster iteration** - Single deploy command
4. **Better DX** - Unified dashboard, logs, metrics
5. **Real-time built-in** - Subscribe to task updates via WebSocket
6. **Auth/RLS integrated** - No custom JWT verification needed

---

## 5. Supabase Deep Dive

### Project Structure

```
supabase/
├── config.toml              # Supabase configuration
├── migrations/              # Database migrations
│   ├── 20260202000000_init.sql
│   ├── 20260202000001_auth.sql
│   ├── 20260202000002_rls.sql
│   └── 20260202000003_tasks.sql
├── functions/               # Edge Functions
│   ├── _shared/            # Shared utilities
│   │   ├── cors.ts
│   │   ├── auth.ts
│   │   └── supabase.ts
│   ├── tasks/              # Task management
│   │   └── index.ts
│   ├── voices/             # Voice CRUD
│   │   └── index.ts
│   ├── generations/        # Generation CRUD
│   │   └── index.ts
│   └── webhooks/           # Billing webhooks
│       └── index.ts
└── seed.sql                 # Development seed data
```

### Database Schema (Supabase PostgreSQL)

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  
  -- Subscription/billing
  subscription_tier TEXT DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  subscription_status TEXT DEFAULT 'active',
  stripe_customer_id TEXT,
  
  -- Usage tracking
  credits_remaining INTEGER DEFAULT 100, -- Free tier credits
  total_generations INTEGER DEFAULT 0,
  total_clones INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voices (user's cloned/designed voices)
CREATE TABLE public.voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'uploaded', -- 'uploaded' | 'designed'
  language TEXT NOT NULL DEFAULT 'Auto',
  description TEXT, -- Design prompt for designed voices
  
  -- Storage paths (relative to Supabase Storage)
  reference_path TEXT NOT NULL,
  reference_transcript TEXT,
  
  -- Metadata
  duration_seconds FLOAT,
  file_size_bytes INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generations (generated audio)
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voice_id UUID NOT NULL REFERENCES public.voices(id) ON DELETE CASCADE,
  
  text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'Auto',
  
  -- Storage path
  audio_path TEXT NOT NULL,
  
  -- Metadata
  duration_seconds FLOAT,
  file_size_bytes INTEGER,
  character_count INTEGER,
  
  -- Cost tracking
  credits_used INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (async job tracking)
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL, -- 'generate' | 'clone' | 'design'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  
  -- Input/Output
  metadata JSONB DEFAULT '{}',
  result JSONB,
  error TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- TTL for cleanup
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

-- Indexes for performance
CREATE INDEX idx_voices_user_id ON public.voices(user_id);
CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_voice_id ON public.generations(voice_id);
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_expires_at ON public.tasks(expires_at);
```

### Row Level Security Policies

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only access their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Voices: Users can only access their own voices
CREATE POLICY "Users can view own voices"
  ON public.voices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voices"
  ON public.voices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own voices"
  ON public.voices FOR DELETE
  USING (auth.uid() = user_id);

-- Generations: Users can only access their own generations
CREATE POLICY "Users can view own generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations"
  ON public.generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations"
  ON public.generations FOR DELETE
  USING (auth.uid() = user_id);

-- Tasks: Users can only access their own tasks
CREATE POLICY "Users can view own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can access all (for backend)
CREATE POLICY "Service role has full access to voices"
  ON public.voices FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### Edge Functions

#### Complete Supabase-Only Edge Functions Structure

```
supabase/
├── config.toml
├── functions/
│   ├── _shared/
│   │   ├── cors.ts           # CORS headers
│   │   ├── supabase.ts       # Supabase client factory
│   │   └── modal.ts          # Modal.com API client
│   │
│   ├── generate/
│   │   └── index.ts          # POST: Start generation task
│   │
│   ├── clone/
│   │   └── index.ts          # POST: Clone voice from upload
│   │
│   ├── design/
│   │   └── index.ts          # POST: Design voice from text
│   │
│   ├── tasks/
│   │   └── index.ts          # GET: Poll task status
│   │
│   ├── voices/
│   │   └── index.ts          # GET/POST/DELETE: Voice CRUD
│   │
│   ├── generations/
│   │   └── index.ts          # GET/DELETE: Generations CRUD
│   │
│   ├── billing/
│   │   └── index.ts          # POST: Create checkout/portal
│   │
│   └── webhooks/
│       └── stripe/
│           └── index.ts      # POST: Stripe webhook handler
│
└── migrations/
    └── ...
```

#### Generation Edge Function (Complete Example)

```typescript
// supabase/functions/generate/index.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODAL_ENDPOINT = Deno.env.get("MODAL_ENDPOINT_0_6B")!;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create authenticated Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { voice_id, text, language = "Auto" } = await req.json();

    if (!voice_id || !text) {
      return new Response(
        JSON.stringify({ error: "voice_id and text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check credits (for paid plans)
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits_remaining, subscription_tier")
      .eq("id", user.id)
      .single();

    if (profile?.subscription_tier === "free" && (profile?.credits_remaining ?? 0) <= 0) {
      return new Response(
        JSON.stringify({ error: "No credits remaining. Please upgrade." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create task record
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        type: "generate",
        status: "pending",
        metadata: {
          voice_id,
          text_preview: text.slice(0, 100),
          language,
        },
      })
      .select()
      .single();

    if (taskError) throw taskError;

    // 🎯 THE KEY: Use waitUntil for background processing
    // This returns immediately but continues processing
    EdgeRuntime.waitUntil(
      processGeneration(supabase, user.id, task.id, voice_id, text, language)
    );

    // Return task ID immediately (client will poll for status)
    return new Response(
      JSON.stringify({
        task_id: task.id,
        status: "pending",
        message: "Generation started. Poll /tasks/{id} for status.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Generation error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Background processing function
async function processGeneration(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  taskId: string,
  voiceId: string,
  text: string,
  language: string
) {
  try {
    // Update task to processing
    await supabase
      .from("tasks")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", taskId);

    // Get voice reference
    const { data: voice, error: voiceError } = await supabase
      .from("voices")
      .select("reference_path, reference_transcript")
      .eq("id", voiceId)
      .eq("user_id", userId)
      .single();

    if (voiceError || !voice) {
      throw new Error("Voice not found");
    }

    // Download reference audio from Supabase Storage
    const { data: audioData, error: downloadError } = await supabase.storage
      .from("references")
      .download(voice.reference_path);

    if (downloadError) throw downloadError;

    // Convert to base64 for Modal API
    const audioBuffer = await audioData.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    // Call Modal.com TTS endpoint
    const modalResponse = await fetch(MODAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language,
        reference_audio: audioBase64,
        reference_text: voice.reference_transcript,
      }),
    });

    if (!modalResponse.ok) {
      const errorText = await modalResponse.text();
      throw new Error(`Modal API error: ${errorText}`);
    }

    const modalResult = await modalResponse.json();

    // Decode the generated audio
    const generatedAudio = Uint8Array.from(atob(modalResult.audio), c => c.charCodeAt(0));

    // Upload to Supabase Storage
    const audioPath = `${userId}/${taskId}.wav`;
    const { error: uploadError } = await supabase.storage
      .from("generations")
      .upload(audioPath, generatedAudio, {
        contentType: "audio/wav",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Create generation record
    const { data: generation, error: genError } = await supabase
      .from("generations")
      .insert({
        id: taskId, // Use task ID as generation ID for simplicity
        user_id: userId,
        voice_id: voiceId,
        text,
        language,
        audio_path: audioPath,
        duration_seconds: modalResult.duration_seconds,
        character_count: text.length,
      })
      .select()
      .single();

    if (genError) throw genError;

    // Deduct credits (using service role for RLS bypass)
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    await serviceSupabase.rpc("deduct_credits", {
      p_user_id: userId,
      p_amount: 1,
    });

    // Update task as completed
    await supabase
      .from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result: {
          generation_id: generation.id,
          audio_path: audioPath,
          duration_seconds: modalResult.duration_seconds,
        },
      })
      .eq("id", taskId);

    console.log(`Generation ${taskId} completed successfully`);

  } catch (error) {
    console.error(`Generation ${taskId} failed:`, error);

    // Update task as failed
    await supabase
      .from("tasks")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: error.message || "Unknown error",
      })
      .eq("id", taskId);
  }
}
```

#### Task Polling Function

```typescript
// supabase/functions/tasks/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const taskId = url.pathname.split("/").pop();

    if (req.method === "GET" && taskId) {
      // Get single task
      const { data: task, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (error || !task) {
        return new Response(JSON.stringify({ error: "Task not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(task), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE" && taskId) {
      // Delete task
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

#### Generation Trigger Function

```typescript
// supabase/functions/generate/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FASTAPI_URL = Deno.env.get("FASTAPI_INTERNAL_URL");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const { voice_id, text, language } = await req.json();

    // Validate
    if (!voice_id || !text) {
      return new Response(
        JSON.stringify({ error: "voice_id and text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user credits
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits_remaining, subscription_tier")
      .eq("id", user.id)
      .single();

    if (profile?.subscription_tier === "free" && profile?.credits_remaining <= 0) {
      return new Response(
        JSON.stringify({ error: "No credits remaining. Please upgrade." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        type: "generate",
        status: "pending",
        metadata: { voice_id, text_preview: text.slice(0, 50), language },
      })
      .select()
      .single();

    if (taskError) {
      return new Response(JSON.stringify({ error: taskError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trigger FastAPI backend (fire and forget)
    // FastAPI will update task status directly in Supabase
    fetch(`${FASTAPI_URL}/internal/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": Deno.env.get("FASTAPI_SERVICE_KEY")!,
      },
      body: JSON.stringify({
        task_id: task.id,
        user_id: user.id,
        voice_id,
        text,
        language,
      }),
    }).catch(console.error); // Don't await, let it run in background

    return new Response(
      JSON.stringify({ task_id: task.id, status: "pending" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## 6. Task Queue & Long-Running Jobs

### Option A: Database-Backed Tasks (Recommended)

Use Supabase PostgreSQL as the task queue with FastAPI as the worker.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Edge Function  │───▶│  tasks table    │◀───│    FastAPI      │
│  (create task)  │    │  (PostgreSQL)   │    │  (poll & work)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                      │                      │
        │                      │                      ▼
        │                      │              ┌─────────────────┐
        │                      │              │   Modal.com     │
        │                      │              │  (TTS models)   │
        │                      │              └─────────────────┘
        ▼                      ▼                      │
┌─────────────────┐    ┌─────────────────┐           │
│    Frontend     │◀───│  Poll status    │◀──────────┘
│  (React SPA)    │    │  via Edge Fn    │    (update status)
└─────────────────┘    └─────────────────┘
```

**FastAPI Worker Pattern:**

```python
# backend/worker.py
import asyncio
from supabase import create_async_client
import httpx

async def process_tasks():
    """Poll for pending tasks and process them."""
    supabase = await create_async_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"]
    )
    
    while True:
        # Claim a pending task
        result = await supabase.rpc(
            "claim_pending_task",
            {"worker_id": WORKER_ID}
        ).execute()
        
        if result.data:
            task = result.data[0]
            await process_task(supabase, task)
        else:
            # No tasks, wait before polling again
            await asyncio.sleep(1)

async def process_task(supabase, task):
    """Process a single task."""
    try:
        if task["type"] == "generate":
            result = await generate_speech(task)
        elif task["type"] == "clone":
            result = await clone_voice(task)
        elif task["type"] == "design":
            result = await design_voice(task)
        
        # Update task as completed
        await supabase.from_("tasks").update({
            "status": "completed",
            "result": result,
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", task["id"]).execute()
        
    except Exception as e:
        # Update task as failed
        await supabase.from_("tasks").update({
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", task["id"]).execute()
```

**SQL function for atomic task claiming:**

```sql
CREATE OR REPLACE FUNCTION claim_pending_task(worker_id TEXT)
RETURNS SETOF tasks AS $$
  UPDATE tasks
  SET 
    status = 'processing',
    started_at = NOW(),
    metadata = metadata || jsonb_build_object('worker_id', worker_id)
  WHERE id = (
    SELECT id FROM tasks
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql;
```

### Option B: Inngest (External Task Queue)

For more robust task management with retries, scheduling, and observability.

```typescript
// Using Inngest with Supabase
import { Inngest } from "inngest";

const inngest = new Inngest({ id: "utter" });

// Define the generation function
export const generateSpeech = inngest.createFunction(
  { id: "generate-speech", retries: 3 },
  { event: "speech/generate" },
  async ({ event, step }) => {
    const { taskId, userId, voiceId, text, language } = event.data;
    
    // Step 1: Get voice from Supabase
    const voice = await step.run("get-voice", async () => {
      return await supabase.from("voices").select("*").eq("id", voiceId).single();
    });
    
    // Step 2: Download reference audio
    const audioPath = await step.run("download-audio", async () => {
      return await downloadFromStorage(voice.data.reference_path);
    });
    
    // Step 3: Call Modal.com
    const result = await step.run("call-modal", async () => {
      return await callModalTTS(audioPath, text, language);
    });
    
    // Step 4: Upload result
    const outputPath = await step.run("upload-result", async () => {
      return await uploadToStorage(result.audioBuffer, userId);
    });
    
    // Step 5: Update task
    await step.run("complete-task", async () => {
      await supabase.from("tasks").update({
        status: "completed",
        result: { audio_path: outputPath },
      }).eq("id", taskId);
    });
  }
);
```

**Comparison:**

| Aspect | DB-Backed Tasks | Inngest |
|--------|-----------------|---------|
| Setup complexity | Low | Medium |
| Cost | Included in Supabase | $0-25/mo |
| Retries | Manual | Built-in |
| Observability | Custom | Dashboard |
| Scaling | Manual workers | Auto-scale |

**Recommendation**: Start with DB-backed tasks, migrate to Inngest if needed.

---

## 7. File Storage Strategy

### Supabase Storage Configuration

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('references', 'references', false),  -- Voice reference audio (private)
  ('generations', 'generations', false); -- Generated audio (private)

-- RLS Policies for references bucket
CREATE POLICY "Users can upload references"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'references' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own references"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'references' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS Policies for generations bucket
CREATE POLICY "Users can read own generations"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'generations' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### File Path Structure

```
references/
└── {user_id}/
    └── {voice_id}/
        └── reference.wav

generations/
└── {user_id}/
    └── {generation_id}.wav
```

### Signed URLs for Access

```typescript
// Frontend: Get signed URL for playback
const { data } = await supabase.storage
  .from("generations")
  .createSignedUrl(`${userId}/${generationId}.wav`, 3600); // 1 hour

// Backend: Upload generated audio
const { data, error } = await supabase.storage
  .from("generations")
  .upload(`${userId}/${generationId}.wav`, audioBuffer, {
    contentType: "audio/wav",
    upsert: false,
  });
```

---

## 8. Authentication & Authorization

### Supabase Auth Configuration

```typescript
// supabase/config.toml
[auth]
site_url = "https://utter.app"
additional_redirect_urls = ["http://localhost:5173"]

[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"

[auth.external.github]
enabled = true
client_id = "env(GITHUB_CLIENT_ID)"
secret = "env(GITHUB_CLIENT_SECRET)"
```

### Frontend Auth Flow (React)

```typescript
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  signIn: (provider: "google" | "github") => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (provider: "google" | "github") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
```

### Profile Auto-Creation (Database Trigger)

```sql
-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 9. Billing Integration

### Stripe Integration Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│  Supabase Edge  │────▶│     Stripe      │
│  (Pricing Page) │     │  (create-checkout)│    │   (Checkout)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Supabase     │◀────│    FastAPI      │◀────│  Stripe Webhook │
│   (profiles)    │     │  (handle event) │     │ (subscription)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Subscription Tiers

```typescript
// Stripe Products
const SUBSCRIPTION_TIERS = {
  free: {
    price: 0,
    credits: 100, // per month
    maxVoices: 3,
    maxGenerationsPerDay: 10,
    features: ["Voice cloning", "Voice design", "Basic support"],
  },
  pro: {
    priceId: "price_xxx",
    price: 19,
    credits: 1000, // per month
    maxVoices: 20,
    maxGenerationsPerDay: 100,
    features: ["Everything in Free", "Priority generation", "Email support"],
  },
  enterprise: {
    priceId: "price_yyy",
    price: 99,
    credits: -1, // unlimited
    maxVoices: -1, // unlimited
    maxGenerationsPerDay: -1,
    features: ["Everything in Pro", "API access", "Dedicated support"],
  },
};
```

### Webhook Handler

```python
# backend/routes/webhooks.py
from fastapi import APIRouter, Request, HTTPException
import stripe

router = APIRouter()

@router.post("/webhooks/stripe")
async def handle_stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.environ["STRIPE_WEBHOOK_SECRET"]
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await handle_checkout_completed(session)
    
    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        await handle_subscription_updated(subscription)
    
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        await handle_subscription_deleted(subscription)
    
    return {"received": True}

async def handle_checkout_completed(session):
    user_id = session["client_reference_id"]
    subscription_id = session["subscription"]
    customer_id = session["customer"]
    
    # Get subscription details
    subscription = stripe.Subscription.retrieve(subscription_id)
    price_id = subscription["items"]["data"][0]["price"]["id"]
    
    # Map price to tier
    tier = "pro" if price_id == TIERS["pro"]["priceId"] else "enterprise"
    
    # Update Supabase profile
    await supabase.from_("profiles").update({
        "subscription_tier": tier,
        "subscription_status": "active",
        "stripe_customer_id": customer_id,
        "credits_remaining": TIERS[tier]["credits"],
    }).eq("id", user_id).execute()
```

### Credit Deduction

```sql
-- Function to deduct credits atomically
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier TEXT;
  v_remaining INTEGER;
BEGIN
  -- Get current credits
  SELECT subscription_tier, credits_remaining
  INTO v_tier, v_remaining
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Unlimited for enterprise
  IF v_tier = 'enterprise' THEN
    RETURN TRUE;
  END IF;
  
  -- Check if enough credits
  IF v_remaining < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct credits
  UPDATE profiles
  SET credits_remaining = credits_remaining - p_amount
  WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

---

## 10. Frontend Deployment

### Option A: Vercel (Recommended)

**Pros:**
- Best-in-class React/Vite support
- Edge Functions for API routes
- Automatic CI/CD from Git
- Free tier generous

**Configuration:**

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

**Environment Variables:**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Option B: AWS CloudFront + S3

**Pros:**
- Maximum control
- Global edge network
- Integrates with other AWS services

**Architecture:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CloudFront    │────▶│       S3        │     │   Route 53      │
│   (CDN, HTTPS)  │     │  (Static files) │     │    (DNS)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Terraform Configuration:**

```hcl
# S3 Bucket for static files
resource "aws_s3_bucket" "frontend" {
  bucket = "utter-frontend-${var.environment}"
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html" # SPA fallback
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.frontend.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  aliases = ["utter.app", "www.utter.app"]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
  }

  # SPA routing: return index.html for 404s
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  viewer_certificate {
    acm_certificate_arn = var.acm_certificate_arn
    ssl_support_method  = "sni-only"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
```

### Comparison

| Aspect | Vercel | CloudFront + S3 |
|--------|--------|-----------------|
| Setup time | 5 minutes | 1-2 hours |
| Cost (low traffic) | Free | ~$1/mo |
| Cost (high traffic) | $20/mo | $10-50/mo |
| CI/CD | Built-in | Need GitHub Actions |
| Edge Functions | Yes | Need Lambda@Edge |
| Custom domains | Easy | Manual SSL setup |

**Recommendation**: Start with Vercel, migrate to CloudFront if cost becomes an issue at scale.

---

## 11. API Architecture

### Current Utter API Endpoints (from [features.md](../features.md))

| Route | Method | Purpose | Auth | Long-Running |
|-------|--------|---------|------|--------------|
| `/api/clone` | POST | Create voice from audio upload | Future | No |
| `/api/voices` | GET | List all user's voices | Future | No |
| `/api/voices/{id}` | DELETE | Delete voice + reference file | Future | No |
| `/api/voices/{id}/preview` | GET | Stream reference audio | Future | No |
| `/api/voices/design/preview` | POST | Generate design preview | Future | **Yes** (15-45s) |
| `/api/voices/design` | POST | Save designed voice | Future | No |
| `/api/generate` | POST | Start speech generation | Future | **Yes** (30-120s) |
| `/api/tasks/{id}` | GET | Poll task status | Future | No |
| `/api/tasks/{id}` | DELETE | Cancel/delete task | Future | No |
| `/api/generations` | GET | List past generations | Future | No |
| `/api/generations/{id}` | DELETE | Delete generation + audio | Future | No |
| `/api/languages` | GET | List supported languages | No | No |

### Supabase Edge Function Mapping

All endpoints can be implemented as Edge Functions. Long-running operations use `waitUntil()`.

```
supabase/functions/
├── clone/index.ts           # POST /api/clone
├── voices/index.ts          # GET, DELETE /api/voices/*
├── voice-preview/index.ts   # GET /api/voices/{id}/preview
├── design-preview/index.ts  # POST /api/voices/design/preview (async)
├── design-save/index.ts     # POST /api/voices/design
├── generate/index.ts        # POST /api/generate (async)
├── tasks/index.ts           # GET, DELETE /api/tasks/*
├── generations/index.ts     # GET, DELETE /api/generations/*
├── languages/index.ts       # GET /api/languages
├── billing/index.ts         # POST checkout, portal
└── webhooks/stripe/index.ts # POST Stripe webhooks
```

### API Routes Summary

| Route | Method | Handler | Auth | Purpose |
|-------|--------|---------|------|---------|
| `/api/auth/*` | * | Supabase | No | Authentication |
| `/api/voices` | GET | Edge Function | Yes | List user's voices |
| `/api/voices` | POST | Edge Function → FastAPI | Yes | Clone/design voice |
| `/api/voices/:id` | DELETE | Edge Function | Yes | Delete voice |
| `/api/voices/:id/preview` | GET | Edge Function | Yes | Get voice preview URL |
| `/api/generate` | POST | Edge Function → FastAPI | Yes | Start generation |
| `/api/tasks/:id` | GET | Edge Function | Yes | Poll task status |
| `/api/tasks/:id` | DELETE | Edge Function | Yes | Cancel task |
| `/api/generations` | GET | Edge Function | Yes | List generations |
| `/api/generations/:id` | DELETE | Edge Function | Yes | Delete generation |
| `/api/billing/checkout` | POST | Edge Function | Yes | Create Stripe checkout |
| `/api/billing/portal` | POST | Edge Function | Yes | Create billing portal |
| `/webhooks/stripe` | POST | FastAPI | No* | Handle Stripe events |

*Stripe webhooks use signature verification

### FastAPI Internal Endpoints

```python
# backend/main.py (deployed to Railway/Fly.io)

@app.post("/internal/generate")
async def internal_generate(
    task_id: str,
    user_id: str,
    voice_id: str,
    text: str,
    language: str,
    x_service_key: str = Header(...),
):
    """Process generation task (called by Supabase Edge Function)."""
    # Verify service key
    if x_service_key != os.environ["SERVICE_KEY"]:
        raise HTTPException(status_code=401)
    
    # ... process generation, update Supabase task ...

@app.post("/internal/clone")
async def internal_clone(
    task_id: str,
    user_id: str,
    audio_path: str,
    name: str,
    transcript: str,
    language: str,
    x_service_key: str = Header(...),
):
    """Process voice cloning task."""
    # ... process clone, update Supabase ...

@app.post("/internal/design")
async def internal_design(
    task_id: str,
    user_id: str,
    text: str,
    language: str,
    instruct: str,
    x_service_key: str = Header(...),
):
    """Process voice design task."""
    # ... process design, update Supabase ...
```

---

## 12. Database Schema Evolution

### Current Schema (SQLite - from [features.md](../features.md))

```python
# Current Voice model
class Voice:
    id: str              # UUID
    name: str            # 1-100 chars
    reference_path: str  # Local file path
    reference_transcript: str  # Optional
    language: str        # Default "Auto"
    source: str          # "uploaded" | "designed"
    description: str     # Voice design instruct
    created_at: datetime

# Current Generation model
class Generation:
    id: str              # UUID
    voice_id: str        # FK → voices.id (CASCADE)
    text: str            # Input text
    audio_path: str      # Local file path
    duration_seconds: float
    language: str        # Default "Auto"
    created_at: datetime
```

### Production Schema (Supabase PostgreSQL)

**Key Changes**:
1. Add `user_id` to all tables for multi-tenancy
2. Add `profiles` table for user data
3. Add `tasks` table for persistent task tracking
4. Change file paths to Storage bucket paths
5. Add credit tracking fields

```sql
-- Migration script: 20260202000000_init.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  stripe_customer_id TEXT,
  credits_remaining INTEGER DEFAULT 100,
  total_generations INTEGER DEFAULT 0,
  total_clones INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voices table
CREATE TABLE IF NOT EXISTS public.voices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'uploaded',
  language TEXT NOT NULL DEFAULT 'Auto',
  description TEXT,
  reference_path TEXT NOT NULL,
  reference_transcript TEXT,
  duration_seconds FLOAT,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generations table
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voice_id UUID NOT NULL REFERENCES public.voices(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'Auto',
  audio_path TEXT NOT NULL,
  duration_seconds FLOAT,
  file_size_bytes INTEGER,
  character_count INTEGER,
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voices_user_id ON public.voices(user_id);
CREATE INDEX IF NOT EXISTS idx_voices_created_at ON public.voices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_voice_id ON public.generations(voice_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_tasks_expires_at ON public.tasks(expires_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.voices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Data Migration Script

```python
# scripts/migrate_sqlite_to_supabase.py
import asyncio
import sqlite3
from supabase import create_async_client

async def migrate():
    # Connect to SQLite
    sqlite_conn = sqlite3.connect("utter.db")
    sqlite_conn.row_factory = sqlite3.Row
    
    # Connect to Supabase
    supabase = await create_async_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"]
    )
    
    # Create a default user for existing data
    DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000"
    
    # Migrate voices
    voices = sqlite_conn.execute("SELECT * FROM voices").fetchall()
    for voice in voices:
        await supabase.from_("voices").insert({
            "id": voice["id"],
            "user_id": DEFAULT_USER_ID,
            "name": voice["name"],
            "source": voice["source"],
            "language": voice["language"],
            "description": voice["description"],
            "reference_path": voice["reference_path"],
            "reference_transcript": voice["reference_transcript"],
            "created_at": voice["created_at"],
        }).execute()
    
    # Migrate generations
    generations = sqlite_conn.execute("SELECT * FROM generations").fetchall()
    for gen in generations:
        await supabase.from_("generations").insert({
            "id": gen["id"],
            "user_id": DEFAULT_USER_ID,
            "voice_id": gen["voice_id"],
            "text": gen["text"],
            "language": gen["language"],
            "audio_path": gen["audio_path"],
            "duration_seconds": gen["duration_seconds"],
            "created_at": gen["created_at"],
        }).execute()
    
    print(f"Migrated {len(voices)} voices and {len(generations)} generations")

if __name__ == "__main__":
    asyncio.run(migrate())
```

---

## 13. Cost Analysis

### Monthly Cost Estimates (Supabase-Only Architecture)

#### Low Traffic (100 users, 1000 generations/mo)

| Service | Tier | Cost |
|---------|------|------|
| Supabase | Free | $0 |
| Modal.com | Pay-as-you-go | ~$50 |
| Vercel | Free | $0 |
| Stripe | 2.9% + $0.30 | ~$5 |
| **Total** | | **~$55/mo** |

#### Medium Traffic (1000 users, 10K generations/mo)

| Service | Tier | Cost |
|---------|------|------|
| Supabase | Pro ($25) | $25 |
| Modal.com | Pay-as-you-go | ~$500 |
| Vercel | Pro ($20) | $20 |
| Stripe | 2.9% + $0.30 | ~$50 |
| **Total** | | **~$595/mo** |

⚠️ **Note**: No Railway/Render needed! Supabase handles everything.

#### High Traffic (10K users, 100K generations/mo)

| Service | Tier | Cost |
|---------|------|------|
| Supabase | Pro + addons | $100 |
| Modal.com | Pay-as-you-go | ~$5,000 |
| CloudFront + S3 | Usage | ~$50 |
| Stripe | 2.9% + $0.30 | ~$500 |
| **Total** | | **~$5,650/mo** |

### Cost Comparison: Supabase-Only vs Hybrid

| Traffic Level | Supabase-Only | Hybrid (+Railway) | Savings |
|--------------|---------------|-------------------|---------|
| Low (100 users) | $55/mo | $75/mo | **$20/mo** |
| Medium (1K users) | $595/mo | $665/mo | **$70/mo** |
| High (10K users) | $5,650/mo | $5,750/mo | **$100/mo** |

The savings come from eliminating the Railway/Render compute layer ($20-100/mo depending on scale).

### Modal.com Cost Breakdown

| Resource | Rate | Per Generation (60s audio) |
|----------|------|---------------------------|
| A10G GPU | $0.000463/sec | ~$0.028 |
| Container runtime | $0.000032/sec | ~$0.003 |
| Cold start (amortized) | ~30s | ~$0.015 |
| **Total per generation** | | **~$0.05** |

### Break-Even Analysis

Assuming $19/mo Pro tier with 1000 credits:

- Cost per generation: ~$0.05 (Modal) + $0.01 (infra) = $0.06
- Revenue per generation: $19 / 1000 = $0.019
- **Need to optimize Modal costs or increase pricing**

**Recommendations:**
1. Batch cold starts (keep containers warm during peak hours)
2. Use spot instances for non-critical generations
3. Consider higher pricing ($29/mo) or lower credit allocation (500)

---

## 14. Migration Strategy

### Phase 1: Database Migration (Week 1)

1. **Set up Supabase project**
   - Create project
   - Run migrations
   - Configure RLS policies

2. **Migrate existing data**
   - Export SQLite data
   - Transform to PostgreSQL format
   - Import to Supabase
   - Migrate audio files to Supabase Storage

3. **Update FastAPI to use Supabase**
   - Replace SQLAlchemy with Supabase client
   - Update file storage to Supabase Storage
   - Keep running locally for testing

### Phase 2: Auth Integration (Week 2)

1. **Add Supabase Auth**
   - Configure OAuth providers
   - Add profile trigger
   - Test auth flow locally

2. **Update frontend**
   - Add AuthContext
   - Protect routes
   - Add login/signup pages

3. **Update API**
   - Add JWT verification
   - Update RLS policies
   - Test multi-user scenarios

### Phase 3: API Migration (Week 3)

1. **Deploy Edge Functions**
   - Task polling
   - Voice/Generation CRUD
   - Billing endpoints

2. **Deploy FastAPI to Railway**
   - Internal endpoints only
   - Connect to Supabase
   - Test end-to-end

3. **Update frontend API calls**
   - Point to Supabase
   - Test all flows

### Phase 4: Production Deployment (Week 4)

1. **Deploy frontend**
   - Set up Vercel
   - Configure domains
   - Test production build

2. **DNS & SSL**
   - Point domain to Vercel
   - Verify SSL

3. **Monitoring setup**
   - Error tracking (Sentry)
   - Analytics (Plausible)
   - Logging (Supabase logs)

4. **Launch checklist**
   - [ ] All tests passing
   - [ ] Production env vars set
   - [ ] Stripe webhooks configured
   - [ ] Backup strategy in place
   - [ ] Monitoring alerts configured

---

## 15. Security Considerations

### API Security

```typescript
// Edge Function middleware
export const withAuth = (handler: Handler): Handler => {
  return async (req, context) => {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
      });
    }
    
    context.user = user;
    return handler(req, context);
  };
};
```

### Rate Limiting

```sql
-- Rate limiting function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;
  
  IF v_count >= p_limit THEN
    RETURN FALSE;
  END IF;
  
  INSERT INTO rate_limits (user_id, action) VALUES (p_user_id, p_action);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

### Input Validation

```typescript
// Zod schemas for API validation
import { z } from "zod";

export const generateSchema = z.object({
  voice_id: z.string().uuid(),
  text: z.string().min(1).max(5000),
  language: z.enum([
    "Auto", "English", "Chinese", "Japanese", "Korean",
    "German", "French", "Russian", "Portuguese", "Spanish", "Italian"
  ]).default("Auto"),
});

export const cloneSchema = z.object({
  name: z.string().min(1).max(100),
  transcript: z.string().min(10).max(5000),
  language: z.enum([...]).default("Auto"),
});
```

### Secrets Management

```
# .env.production (never commit)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG... # Server-side only
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
MODAL_TOKEN_ID=...
MODAL_TOKEN_SECRET=...
SERVICE_KEY=... # Internal API key
```

---

## 16. Monitoring & Observability

### Error Tracking (Sentry)

```typescript
// Frontend: src/lib/sentry.ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});

// Backend: backend/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.environ["SENTRY_DSN"],
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,
)
```

### Logging

```python
# backend/logging_config.py
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "user_id": getattr(record, "user_id", None),
            "task_id": getattr(record, "task_id", None),
        })

# Usage
logger.info("Generation completed", extra={
    "user_id": user_id,
    "task_id": task_id,
    "duration_ms": elapsed_ms,
})
```

### Health Checks

```python
# backend/routes/health.py
@app.get("/health")
async def health_check():
    checks = {
        "database": await check_supabase(),
        "modal": await check_modal_endpoint(),
        "storage": await check_storage(),
    }
    
    all_healthy = all(checks.values())
    status_code = 200 if all_healthy else 503
    
    return JSONResponse(
        content={"status": "healthy" if all_healthy else "unhealthy", "checks": checks},
        status_code=status_code,
    )
```

### Metrics Dashboard

Key metrics to track:

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Generation latency (p95) | Logs | > 120s |
| Task queue depth | DB | > 100 pending |
| Error rate | Sentry | > 5% |
| Modal cold starts | Modal dashboard | > 50% |
| Storage usage | Supabase | > 80% quota |
| Active users (DAU) | Analytics | < previous week |

---

## Summary: Recommended Stack

### ✅ Supabase-Only Architecture (RECOMMENDED)

| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | Vercel + React 19 | Best DX, free tier, global CDN |
| **Auth** | Supabase Auth | Integrated, OAuth, RLS |
| **Database** | Supabase PostgreSQL | Managed, real-time, RLS |
| **Storage** | Supabase Storage | S3-compatible, signed URLs |
| **Backend API** | Supabase Edge Functions | 400s timeout, `waitUntil()` for async |
| **AI Models** | Modal.com | Already deployed, auto-scale |
| **Payments** | Stripe | Industry standard |
| **Monitoring** | Sentry + Supabase logs | Error tracking + structured logs |

**No Railway/Render/Fly.io needed!** Supabase Edge Functions handle everything.

### Why This Works for Utter

1. **TTS calls (30-120s)** fit within 400s wall-clock limit
2. **`EdgeRuntime.waitUntil()`** enables fire-and-forget background tasks
3. **Modal.com handles heavy lifting** (GPU, audio processing)
4. **Edge Functions just orchestrate** - no heavy compute needed
5. **Real-time subscriptions** can replace polling for instant updates

### Total Estimated Monthly Cost (Supabase-Only)

| Traffic Level | Users | Generations | Cost |
|--------------|-------|-------------|------|
| MVP/Launch | 100 | 1,000 | ~$55 |
| Growth | 1,000 | 10,000 | ~$595 |
| Scale | 10,000 | 100,000 | ~$5,650 |

### Migration Path

1. **Week 1**: Set up Supabase (DB, Auth, Storage)
2. **Week 2**: Migrate to Edge Functions (rewrite FastAPI → Deno)
3. **Week 3**: Deploy React frontend to Vercel
4. **Week 4**: Add Stripe billing, monitoring, launch

### When You MIGHT Need Hybrid Architecture

Only consider adding Railway/Render if you need:

- ❌ Heavy server-side audio processing (ffmpeg, librosa)
- ❌ Python-specific libraries with no Deno equivalent
- ❌ Very long-running jobs (>400s consistently)
- ❌ Complex task queues with retries, delays, priorities

For Utter's current feature set, **Supabase-only is the way to go**.

---

*Document prepared: 2026-02-02*  
*Last updated: 2026-02-02*  
*Recommendation: ✅ Go Supabase-Only*
