# Research Notes: Silence & In-painting (2026-01-21)

## 1. Dead Air on Short Text
**Issue**: Short text generations often result in ~30s audio files with significant silence at the end.
**Diagnosis**: Echo-TTS uses a fixed latent sequence length (default 640 latents ≈ 30 seconds). It generates the speech and then pads the remaining latent space with "silence" (or near-silent noise).
**Solution**: Post-process the audio to trim trailing silence.
**Implementation**:
Modify the `ffmpeg` command in `modal_app/echo_tts.py` to add a silence removal filter:
```bash
ffmpeg -i input.wav -af "silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-50dB" ...
```
This removes silence from the end of the file.

## 2. In-place Regeneration (In-painting)
**Question**: Can we regenerate a specific middle segment (e.g., 00:56-00:58) seamlessly?
**Feasibility**: **Low / Complex**.
**Reasoning**:
1.  **Model Architecture**: Echo-TTS (based on Fish-Speech) defines `sample_pipeline` for generation and `inference_blockwise` for "continuation" (prompting with end of audio to generate *next* part).
2.  **No Native In-painting**: There is no public API or mask-based inference function exposed to regenerate a *middle* section while preserving the *end*.
3.  **Workaround (Regenerate from Point)**: We *can* support "Regenerate from 00:56 onwards". This would discard the end (00:58+) and regenerate it.
    *   *Pros*: Seamless connection at 00:56.
    *   *Cons*: You lose the original ending.
4.  **Recommendation**: **Smart Chunk Regeneration**.
    -   **Backend**: Reuse the standard generation pipeline but treat the selected text as a "new short generation" to splice back in (or regen the whole chunk if it's small).
    -   **Frontend UX**: Implement a "Smart Editor" (like ElevenLabs Studio) where users can highlight a specific sentence/phrase and click "Regenerate". Use `contenteditable` or a rich text editor to manage these "blocks" visually.
    -   **Granularity**: Allow selecting individual sentences. If the user selects partial words, snap to nearest word/sentence boundary for stability.
