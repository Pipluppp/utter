# Next Steps (as of 2026-01-20)

## Priority 1: Waveform Visualization (Implementation)
**Goal**: Add professional audio visualization using `wavesurfer.js`.
- [ ] Add `wavesurfer.js` library (CDN).
- [ ] Update `generate.html` to replace simple progress bar.
- [ ] Update `app.js` to initialize waveform.
- [ ] Ensure minimal aesthetic (black/white).

## Priority 2: Future Research (Echo-TTS)
**Goal**: Deep dive into model capabilities before implementing advanced features.

### Text Chunking & Long Audio
- Compare sentence splitting libraries (spacy vs nltk).
- Test crossfading strategies manually.
- Investigate speaker state persistence.

### Voice Settings
- Benchmark `cfg_scale` ranges.
- Test impact on different voice types.

---
**Goal**: Add "nice-to-have" features deferred from previous sessions.

- [ ] **Waveform Visualization**: Use `wavesurfer.js` for generated audio player.
- [ ] **Delete Protection**: Add "Are you sure?" modal for deleting voices/history (currently uses native `confirm`).

---

## Known Issues/Tech Debt

1.  **Cold Start**: First generation takes ~60s. (Mitigation: Added loading info message).
2.  **Timezones**: Dates are stored as UTC but displayed in local time. (Fixed 2026-01-20).
3.  **VBR MP3s**: Audio player duration can be initially `Infinity`. (Fixed 2026-01-20).
