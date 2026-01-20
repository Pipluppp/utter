# Next Steps (as of 2026-01-20)

## Priority 1: Waveform Visualization (Implementation)
**Goal**: Add professional audio visualization using `wavesurfer.js`.
- [x] Add `wavesurfer.js` library (CDN).
- [x] Update `generate.html` to replace simple progress bar.
- [x] Update `app.js` to initialize waveform.
- [x] Ensure minimal aesthetic (black/white).
- [x] **Extend to Lists**: Implement waveform on `/voices` and `/history` (See [waveform-extension-plan.md](./waveform-extension-plan.md)).

## Priority 2: Echo-TTS Power Features
**Goal**: Implement advanced generation capabilities (long audio & settings).
See [echo-tts-plan.md](./echo-tts-plan.md) for details.

### Text Chunking & Long Audio
- [x] Implement backend text splitter (sentence boundary detection).
- [x] Implement audio stitching (ffmpeg).
- [x] Update frontend to handle longer timeouts/progress.

### Voice Settings
*(Deferred to 2026-01-22 - see Advanced Mode plan)*

## Priority 3: Performance & Reliability
- [x] **Optimization**: Tuned Echo-TTS parameters (`num_steps=30`) for ~1.3x speedup.
- [x] **Monitoring**: Added real-time performance logging to backend console.
- [ ] **Async Generation**: Move long generation tasks to background worker (Celery/Redis) to avoid HTTP timeouts.

---

## Known Issues/Tech Debt
1.  **Cold Start**: First generation takes ~60s. (Mitigation: Added loading info message).
2.  **Long Generation Blocking**: Synchronous HTTP request blocks for entire generation duration. (Fix: Async tasks or chunking).
