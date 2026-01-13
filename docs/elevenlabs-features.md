# Feature Scope (Source of Truth)

> **MVP**: Clone voice → Generate speech. Nothing else.

---

## Locked Decisions

| Decision | Choice |
|----------|--------|
| Auth | ❌ Skip for MVP |
| Voice library management | ❌ Skip for MVP |
| Generation history | ❌ Skip for MVP |
| Settings/sliders | ❌ Skip for MVP |

---

## MVP User Flow

```
USER JOURNEY
────────────

1. User visits /clone
   ↓
2. Uploads audio file (10s - 5min)
   ↓
3. Enters voice name
   ↓
4. Clicks "Create Voice"
   ↓
5. Redirected to /generate
   ↓
6. Selects voice from dropdown
   ↓
7. Enters text (max 500 chars)
   ↓
8. Clicks "Generate"
   ↓
9. Waits 2-5 seconds (sync)
   ↓
10. Audio plays automatically
    ↓
11. Clicks "Download" to save MP3
```

---

## Pages (2 total)

### /clone - Voice Cloning Page

```
┌─────────────────────────────────────────────────────────────────┐
│  CLONE YOUR VOICE                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │     📁 Drop audio file here or click to browse          │   │
│  │                                                         │   │
│  │     Accepted: WAV, MP3, M4A                             │   │
│  │     Duration: 10 seconds to 5 minutes                   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Selected: voice_sample.wav (45 seconds)                        │
│                                                                 │
│  Voice name: [_______________________]                          │
│                                                                 │
│  [ Create Voice Clone ]                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Drag & drop or click to select file
- Validate format (WAV/MP3/M4A)
- Validate duration (10s - 5min)
- Show file info after selection
- Submit → POST /api/clone
- On success → redirect to /generate

---

### /generate - Speech Generation Page

```
┌─────────────────────────────────────────────────────────────────┐
│  GENERATE SPEECH                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Voice: [ My Cloned Voice          ▼ ]                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Enter text to speak...                                 │   │
│  │                                                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  Characters: 0 / 500                                            │
│                                                                 │
│  💡 Tips: Use commas for pauses. End sentences with periods.    │
│                                                                 │
│  [ 🔊 Generate Speech ]                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ▶ ════════════════░░░░░░░░  0:05 / 0:12                │   │
│  │                                                         │   │
│  │  [ ⬇️ Download MP3 ]                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Dropdown populated from GET /api/voices
- Text input with live character count
- Generate button → POST /api/generate (blocks 2-5s)
- Show loading spinner during generation
- Audio player appears with result
- Download button to save MP3

---

## API Endpoints (3 total)

### 1. POST /api/clone

Create a new voice from uploaded audio.

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| name | string | ✅ | 1-100 chars |
| audio | file | ✅ | WAV/MP3/M4A, 10s-5min, <50MB |

**Success Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Voice"
}
```

**Error Response (400):**
```json
{
  "error": "Audio must be between 10 seconds and 5 minutes"
}
```

---

### 2. GET /api/voices

List all available voices.

**Response (200):**
```json
{
  "voices": [
    {"id": "uuid-1", "name": "Voice 1"},
    {"id": "uuid-2", "name": "Voice 2"}
  ]
}
```

---

### 3. POST /api/generate

Generate speech from text (synchronous).

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| voice_id | uuid | ✅ | Must exist |
| text | string | ✅ | 1-500 chars |

**Success Response (200):**
```json
{
  "audio_url": "/uploads/generated/abc123.mp3"
}
```

**Error Response (400):**
```json
{
  "error": "Text cannot exceed 500 characters"
}
```

**Timing:** Response takes 2-5 seconds (synchronous generation)

---

## Validation Rules

### Audio Upload

| Rule | Value |
|------|-------|
| Formats | WAV, MP3, M4A |
| Min duration | 10 seconds |
| Max duration | 5 minutes |
| Max file size | 50 MB |

### Text Input

| Rule | Value |
|------|-------|
| Min length | 1 character |
| Max length | 500 characters |
| Encoding | UTF-8 |

---

## UI Components Needed

### Clone Page
- [ ] File dropzone (drag & drop)
- [ ] File input (click to browse)
- [ ] File info display
- [ ] Text input (voice name)
- [ ] Submit button
- [ ] Error message display
- [ ] Loading state

### Generate Page
- [ ] Select dropdown (voices)
- [ ] Textarea (text input)
- [ ] Character counter
- [ ] Tips/help text
- [ ] Generate button
- [ ] Loading spinner
- [ ] Audio player (HTML5)
- [ ] Download button
- [ ] Error message display

---

## Text Input UX Guidelines

Show these tips to users:

```
Tips for best results:
• Use commas for natural pauses
• End sentences with periods
• Avoid excessive punctuation (!!!)
• Keep text under 500 characters (~30 seconds)
```

---

## Error States

| Error | Message | When |
|-------|---------|------|
| No file | "Please select an audio file" | Upload without file |
| Wrong format | "File must be WAV, MP3, or M4A" | Invalid format |
| Too short | "Audio must be at least 10 seconds" | < 10s duration |
| Too long | "Audio cannot exceed 5 minutes" | > 5min duration |
| Too large | "File size cannot exceed 50MB" | > 50MB |
| No name | "Please enter a voice name" | Empty name field |
| No text | "Please enter text to speak" | Empty text field |
| Text too long | "Text cannot exceed 500 characters" | > 500 chars |
| No voice | "Please select a voice" | No voice selected |
| Generation failed | "Failed to generate speech. Please try again." | Modal error |

---

## Future Features (Not in MVP)

These are explicitly out of scope until MVP is working:

### Phase 2
- [ ] User authentication (email/password)
- [ ] Voice library page (list, rename, delete)
- [ ] Generation history
- [ ] Re-download past audio

### Phase 3
- [ ] Voice settings (guidance sliders)
- [ ] Longer text (auto-chunking)
- [ ] Async generation with progress
- [ ] Usage tracking / credits

### Phase 4
- [ ] Multiple voices per user limit
- [ ] Voice preview before using
- [ ] Audio quality settings
- [ ] API access for developers

---

## Success Criteria

MVP is **done** when:

1. ✅ User can upload audio file (10s-5min)
2. ✅ User can name the voice
3. ✅ Voice is saved and appears in dropdown
4. ✅ User can type text (up to 500 chars)
5. ✅ User can click Generate and wait for result
6. ✅ Audio plays in browser
7. ✅ Audio can be downloaded as MP3
8. ✅ Works in production (Railway + Neon + R2 + Modal)
