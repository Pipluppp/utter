# Qwen3-TTS Implementation Plan

## Goal Description
Deploy **Qwen3-TTS** to Modal.com to provide state-of-the-art voice generation capabilities. This will function as a high-fidelity alternative to the existing Echo-TTS implementation.

Based on [Qwen3-TTS Blog](https://qwen.ai/blog?id=qwen3tts-0115) and [Simon Willison's analysis](https://simonwillison.net/2026/Jan/22/qwen3-tts/), this model family offers:
*   **Voice Cloning (Zero-Shot)**: Using the `Base` model + reference audio.
*   **Voice Design**: Generating new voices from text descriptions (requires `VoiceDesign` model).
*   **Multi-lingual Support**: 10 languages (English, Chinese, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian).
*   **Streaming**: Native support for low-latency streaming (sub-100ms).

## User Review Required
> [!IMPORTANT]
> **Model Variants**: We will deploy the **1.7B parameter** version (~4.5GB) for best quality.
> *   **Clone Model**: `Qwen/Qwen3-TTS-12Hz-1.7B-Base` (for cloning from reference audio).
> *   **Design Model**: `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign` (for prompting "a deep, gravelly voice...").
>
> **Hardware**: The A10G (24GB VRAM) on Modal is sufficient to load *both* models simultaneously (~9GB total weights) if desired, or we can use separate endpoints.
>
> **Optimizations**: We **MUST** use `flash-attn` (FlashAttention 2) and `bfloat16` precision for efficient inference, as strongly recommended in the documentation.

## Proposed Changes

### Modal App

#### [NEW] [qwen_tts.py](file:///c:/Users/Duncan/Desktop/utter/modal_app/qwen_tts.py)
Create a new Modal app file `modal_app/qwen_tts.py`.

**Refined Specifications:**
- **Image**:
    - Base: Debian Slim + Python 3.12.
    - System Deps: `git`, `ffmpeg`.
    - Python Deps: `qwen-tts` (official package), `flash-attn` (critical for speed), `torch`, `torchaudio`, `soundfile`, `numpy`.
- **Class `QwenTTS`**:
    - **GPU**: `A10G`.
    - **Container Config**: `timeout=300`, `keep_warm=300`.
    - **Models to Load**:
        1.  `Qwen/Qwen3-TTS-12Hz-1.7B-Base` (Target: Voice Cloning)
        2.  `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign` (Target: Voice Creation - *Optional but recommended*)
    - **Methods**:
        - `clone(text, ref_audio_bytes, language="English")`: Uses Base model.
        - `design(text, voice_description, language="English")`: Uses VoiceDesign model.

**Implementation Sketch:**
```python
import modal

app = modal.App("utter-qwen-tts")

# Note: flash-attn needs to be compiled or installed via pre-built wheel for the specific torch/cuda version.
# Modal's usage of standard images usually handles this, but we'll use a direct pip install command that handles the build if needed.
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git", "ffmpeg")
    .pip_install(
        "torch==2.1.2",  # Pinning version for stability with flash-attn if needed, or use latest
        "qwen-tts>=0.1.0",
        "flash-attn>=2.0.0",
        "soundfile",
        "numpy"
    )
)

@app.cls(gpu="A10G", image=image, timeout=600)
class QwenTTS:
    @modal.enter()
    def load_models(self):
        import torch
        from qwen_tts import Qwen3TTSModel
        
        # 1. Load Voice Clone Model (Base)
        print("Loading Qwen3-TTS Base (Clone)...")
        self.clone_model = Qwen3TTSModel.from_pretrained(
            "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
            device_map="cuda",
            dtype=torch.bfloat16,
            attn_implementation="flash_attention_2"
        )
        
        # 2. Load Voice Design Model (Optional: remove if OOM, but A10G should be fine)
        print("Loading Qwen3-TTS VoiceDesign...")
        self.design_model = Qwen3TTSModel.from_pretrained(
            "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
            device_map="cuda",
            dtype=torch.bfloat16,
            attn_implementation="flash_attention_2"
        )

    @modal.method()
    def clone(self, text: str, ref_audio_bytes: bytes, language: str = "English") -> bytes:
        # Save bytes to temp file -> run self.clone_model.generate_voice_clone -> return bytes
        pass

    @modal.method()
    def design(self, text: str, voice_description: str, language: str = "English") -> bytes:
        # Run self.design_model.generate_voice_design -> return bytes
        pass
```

## Verification Plan

### Manual Verification
1.  **Test Voice Cloning**:
    - Use `modal run modal_app/qwen_tts.py::test_clone`.
    - Input: A clear reference audio file.
    - Check: Does it sound like the speaker?
2.  **Test Voice Design**:
    - Use `modal run modal_app/qwen_tts.py::test_design`.
    - Input: "A deep, rasping pirate voice."
    - Check: Does the output match the description?

### Success Criteria
- [ ] Successfully generate audio using `flash-attn` (check logs for warnings).
- [ ] Audio generation time is reasonable (<10s for short clips).
- [ ] Both model variants load on a single A10G.
