# Echo-TTS Integration Plan

**Goal**: Enhance the generation capabilities by handling long text (via chunking) and exposing advanced voice controls (via Modal parameters).

## Phase 0: Research & Constraints

### Echo-TTS Model Analysis
Based on `modal_app/echo_tts.py` and repository knowledge:
- **Repo**: `jordandare/echo-tts`
- **Max Sequence**: Configured to `sequence_length=640` tokens (approx 30s of audio).
    - *Implication*: We **must** chunk text longer than ~30s.
- **Parameters**:
    - `cfg_scale_text`: Guidance scale for text (Default: 3.0). Higher = follows text more closely.
    - `cfg_scale_speaker`: Guidance scale for speaker identity (Default: 8.0). Higher = closer to reference voice.
    - `num_steps`: Diffusion steps (Default: 40). Higher = better quality, slower.
    - `rng_seed`: Random seed (Currently fixed to 0).

### Key Findings
1.  **Blocking Generation**: The current setup blocks for the entire generation. Long text (multiple chunks) will take longer.
2.  **Audio Stitching**: We need to concatenate the output chunks on the backend (using `ffmpeg` or `pydub`) before returning to the frontend, OR return a list of audio URLs. *Decision: Stitch on backend for MVP simplicity.*

---

## Phase 1: Text Chunking (Long Audio)

### 1. Backend Logic (`services/tts.py` or new `services/chunking.py`)
- [ ] **Sentence Splitting**: Implement a robust splitter (e.g., `spacy` or simple regex) to split text into < 30s chunks (approx 200-300 chars or by sentence).
- [ ] **Batch Processing**:
    - Iterate through chunks.
    - Call `EchoTTS.generate` for each chunk.
    - *Optimization*: Call in parallel using `asyncio` if Modal allows concurrent execution (Yes, `allow_concurrent_inputs` or just multiple calls).
- [ ] **Audio Stitching**:
    - Use `ffmpeg` to merge the resulting MP3 bytes/files.
    - Handle crossfades if possible to avoid clicks (optional for MVP).

### 2. Frontend Updates (`app.js`)
- [ ] **Timeout**: Increase client-side timeout for `/api/generate` since long generations will take > 30s.
- [ ] **Progress**: Ideally show "Generating chunk 1/5..." (requires streaming response or polling, maybe defer for "Async Generation" phase, but simple updates are good).

---

## Phase 2: Voice Settings

### 1. Modal App Updates (`modal_app/echo_tts.py`)
- [ ] Update `generate` method signature to accept:
    - `cfg_text: float`
    - `cfg_speaker: float`
    - `seed: int`
- [ ] Pass these values to `sample_euler_cfg_independent_guidances`.

### 2. Backend Updates (`main.py`)
- [ ] Update `GenerateRequest` model to include optional settings.
- [ ] Pass settings to the TTS service.

### 3. Frontend Updates (`generate.html`, `app.js`)
- [ ] **Advanced Settings UI**:
    - Collapsible "Advanced Settings" section.
    - **Sliders**:
        - Text Guidance (1.0 - 10.0)
        - Speaker Match (1.0 - 10.0)
    - **Input**:
        - Seed (Randomize / Fixed)
- [ ] Send these values in the JSON payload.

---

## Task Breakdown

### Step 1: Voice Settings (Quick Win)
- [ ] Modify `EchoTTS.generate` to accept params.
- [ ] Add backend Pydantic models.
- [ ] Add Frontend UI knobs.

### Step 2: Text Chunking (Core Feature)
- [ ] Implement `split_text_into_chunks` helper.
- [ ] Implement `stitch_audio` helper.
- [ ] Update `/api/generate` to handle the loop.
- [ ] Test with a paragraph of text.

### Step 3: Polish
- [ ] Add valid ranges/tooltips for settings.
- [ ] Ensure concatenation doesn't sound robotic (silence gaps).
