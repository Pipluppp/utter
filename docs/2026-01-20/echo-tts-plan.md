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

## Phase 1: Text Chunking (Long Audio) ✅ DONE

### 1. Backend Logic (`services/tts.py` or new `services/chunking.py`)
- [x] **Sentence Splitting**: Implement a robust splitter (e.g., `spacy` or simple regex) to split text into < 30s chunks (approx 200-300 chars or by sentence).
- [x] **Batch Processing**:
    - Iterate through chunks.
    - Call `EchoTTS.generate` for each chunk.
    - *Note*: Serial processing for MVP simplicity.
- [x] **Audio Stitching**:
    - Use `ffmpeg` to merge the resulting MP3 bytes/files.
    - Handle crossfades if possible to avoid clicks (optional for MVP).

### 2. Frontend Updates (`app.js`)
- [x] **Timeout**: Increase client-side timeout for `/api/generate` since long generations will take > 30s.
- [x] **Progress**: Shows chunk count and estimated duration before generation.

---

## Phase 2: Voice Settings

### 1. Modal App Updates (`modal_app/echo_tts.py`)
- [ ] Update `generate` method signature to accept:
    - `cfg_text: float` (Default 3.0)
    - `cfg_speaker: float` (Default 8.0)
    - `seed: int` (Optional)
    - `cfg_mode: str` (Enum: 'independent', 'apg', 'alternating', 'joint')
    - `speaker_kv_scale: float` (Default 1.0 or 1.5 if enabled)
    - `num_steps: int` (Default 40)
    - `audio_format: str` ('wav' or 'mp3')
- [ ] Pass these values to `sample_euler_cfg_independent_guidances`.

### 2. Backend Updates (`main.py`)
- [ ] Update `GenerateRequest` model to include optional settings.
- [ ] Pass settings to the TTS service.

### 3. Frontend Updates (`generate.html`, `app.js`)
- [ ] **Mode Toggle**: "Simple" vs "Advanced" tabs/switch.
- [ ] **Simple Mode**:
    - Just Text Prompt and Speaker Reference (existing).
- [ ] **Advanced Mode Panel**:
    - **Performance**:
        - Steps Slider: `20` - `80` (Default `40`).
    - **Guidance**:
        - Text Scale: `1.0` - `10.0` (Default `3.0`).
        - Speaker Scale: `1.0` - `10.0` (Default `8.0`).
        - Mode: Dropdown [`Independent`, `APG`, `Alternating`, `Joint`].
    - **Stability**:
        - "Force Speaker Identity" Checkbox (sets KV scale to 1.5).
        - Seed Input (Number).
    - **Format** (Optional):
        - WAV vs MP3 toggle.
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
