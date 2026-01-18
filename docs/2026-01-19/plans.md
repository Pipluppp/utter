# UX & Feature Improvements Plan

> **Date**: 2026-01-19  
> **Prerequisite**: Modal integration complete (see [2026-01-18-modal-integration-plan](../2026-01-18-modal-integration-plan/))  
> **Goal**: Polish the MVP with better UX and add voice management features

---

## Context

The core voice cloning and generation pipeline is now working:
- Echo-TTS deployed on Modal.com (A10G GPU)
- Clone page accepts 10s-5min audio
- Generate page produces real cloned speech
- Audio playback and download functional

**Current gaps:**
- No visual feedback during long generation wait
- No way to see/manage cloned voices
- Missing polish (favicon, waveforms)
- Text limited to 30 seconds (no chunking)

---

## Goals

### 1. UX Polish
Make the app feel responsive and professional.

| Feature | Why |
|---------|-----|
| Favicon | Stops 404 spam, looks finished |
| Loading spinner | 30-60s cold start needs visual feedback |
| Error messages | "Failed to generate" isn't helpful |
| Waveform viz | Modern audio apps show waveforms |

### 2. Voice Management
Let users manage their cloned voices.

| Feature | Why |
|---------|-----|
| Voice list page | See all voices in one place |
| Delete voice | Clean up bad clones |
| Preview playback | Hear reference before generating |

### 3. Power Features
Extend capabilities beyond MVP.

| Feature | Why |
|---------|-----|
| Generation history | Re-download past generations |
| Text chunking | Support >30s output |
| Voice settings | Expose cfg_scale for control |

---

## Implementation Notes

### Favicon
- Generate simple icon (microphone or waveform)
- Save as `backend/static/favicon.ico`
- Add `<link rel="icon">` to `base.html`

### Loading Spinner
- Already have `.btn-loading` CSS class
- Need: progress indicator or estimated time
- Consider: Show Modal logs in real-time?

### Voice List Page
- New route: `/voices`
- Query all voices from DB
- Display as cards with name, created date
- Link to generate with that voice

### Delete Voice
- Add DELETE `/api/voices/{id}` endpoint
- Delete from DB
- Delete reference audio file
- Add trash icon to voice list cards

### Text Chunking
- Split text at sentence boundaries
- Generate each chunk separately
- Concatenate audio (with crossfade)
- See [echo-tts-model.md](../echo-tts-model.md) chunking example

### Voice Settings (Advanced)
Current hardcoded values in `echo_tts.py`:
```python
cfg_scale_text=3.0,      # How closely to follow text
cfg_scale_speaker=8.0,   # How closely to match voice
```

Could expose as sliders:
- "Text adherence": 1.0 - 5.0
- "Voice similarity": 5.0 - 10.0

---

## Suggested Order

1. **Favicon** (5 min) - quick win
2. **Loading spinner** (15 min) - improves UX immediately
3. **Voice list page** (1 hr) - enables Delete
4. **Delete voice** (30 min) - needs list page first
5. **Preview playback** (30 min) - add to list page
6. **Waveform viz** (2 hr) - nice to have
7. **Generation history** (2 hr) - needs DB schema
8. **Text chunking** (3 hr) - complex audio processing
9. **Voice settings** (2 hr) - needs Modal redeploy

---

## Files to Modify

| Feature | Files |
|---------|-------|
| Favicon | `base.html`, new `favicon.ico` |
| Loading | `app.js`, `style.css` |
| Voice list | new `voices.html`, `main.py` |
| Delete | `main.py`, `storage.py` |
| Preview | `voices.html`, `app.js` |
| Waveform | `app.js`, new lib (wavesurfer.js?) |
| History | `models.py`, new `history.html` |
| Chunking | `tts.py`, `text.py` |
| Settings | `echo_tts.py`, `generate.html` |

---

## See Also

- [next-steps.md](./next-steps.md) - Quick checklist version
- [pain-points.md](../2026-01-18-modal-integration-plan/pain-points.md) - Modal gotchas
- [echo-tts-model.md](../echo-tts-model.md) - Model constraints
