# Step 5: API Endpoints

> **Time Required**: ~10 minutes
> **Prerequisites**: Completed [Step 4: Core Service](./04-core-service.md)

This guide adds FastAPI REST endpoints to expose the voice cloning service.

---

## 5.1 Understanding Modal Web Endpoints

Modal provides several decorators for web endpoints:

| Decorator | Use Case |
|-----------|----------|
| `@modal.fastapi_endpoint()` | Single endpoint with FastAPI |
| `@modal.asgi_app()` | Full FastAPI/Starlette app |
| `@modal.web_server()` | Any HTTP server |

We use `@modal.fastapi_endpoint()` for simplicity.

**Source**: [Modal Web Endpoints Guide](https://modal.com/docs/guide/webhooks)

---

## 5.2 Request/Response Models

Add Pydantic models for request validation. Add this to `app.py` after the imports:

```python
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


class VoiceCloneRequest(BaseModel):
    """
    Request model for voice cloning.

    Source: Qwen3-TTS generate_voice_clone() parameters
    """
    text: str = Field(
        ...,
        description="Text to synthesize with the cloned voice",
        min_length=1,
        max_length=5000,
        examples=["Hello, this is a test of voice cloning."],
    )
    language: str = Field(
        default="Auto",
        description="Language for synthesis. Use 'Auto' for auto-detection.",
        examples=["English", "Chinese", "Auto"],
    )
    ref_audio_url: Optional[str] = Field(
        default=None,
        description="URL to reference audio file (WAV, MP3, etc.)",
        examples=["https://example.com/reference.wav"],
    )
    ref_audio_base64: Optional[str] = Field(
        default=None,
        description="Base64-encoded reference audio data",
    )
    ref_text: str = Field(
        ...,
        description="Exact transcript of what is spoken in the reference audio",
        min_length=1,
        examples=["This is what I said in the reference recording."],
    )
    max_new_tokens: int = Field(
        default=2048,
        description="Maximum tokens to generate (affects max audio length)",
        ge=256,
        le=4096,
    )


class BatchVoiceCloneRequest(BaseModel):
    """Request model for batch voice cloning."""
    texts: list[str] = Field(
        ...,
        description="List of texts to synthesize",
        min_length=1,
        max_length=10,
    )
    languages: list[str] = Field(
        ...,
        description="Languages for each text (must match texts length)",
    )
    ref_audio_url: Optional[str] = Field(default=None)
    ref_audio_base64: Optional[str] = Field(default=None)
    ref_text: str = Field(...)
    max_new_tokens: int = Field(default=2048, ge=256, le=4096)


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str = Field(description="Service status")
    model: str = Field(description="Loaded model name")
    gpu: str = Field(description="GPU device name")
    attention_implementation: str = Field(description="Attention backend in use")
    supported_languages: list[str] = Field(description="Supported languages")
```

---

## 5.3 Add Endpoints to Service Class

Add these methods inside the `Qwen3TTSService` class:

```python
@app.cls(
    gpu=GPU_TYPE,
    scaledown_window=CONTAINER_IDLE_TIMEOUT,
    volumes={MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=300,
)
@modal.concurrent(max_inputs=MAX_CONCURRENT_INPUTS)
class Qwen3TTSService:
    # ... existing @modal.enter() and @modal.method() methods ...

    # =========================================================================
    # FastAPI Endpoints
    # =========================================================================

    @modal.fastapi_endpoint(docs=True, method="POST")
    def clone(self, request: VoiceCloneRequest) -> StreamingResponse:
        """
        Clone a voice and synthesize text.

        POST /clone

        Accepts reference audio (URL or base64) and generates speech
        with the cloned voice.

        Returns: audio/wav

        Source: Modal Chatterbox example - StreamingResponse pattern
        """
        # Validate language
        if request.language not in SUPPORTED_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language: {request.language}. "
                       f"Supported: {', '.join(SUPPORTED_LANGUAGES)}"
            )

        # Determine reference audio source
        if request.ref_audio_url:
            ref_audio = request.ref_audio_url
        elif request.ref_audio_base64:
            ref_audio = request.ref_audio_base64
        else:
            raise HTTPException(
                status_code=400,
                detail="Either 'ref_audio_url' or 'ref_audio_base64' is required"
            )

        # Generate audio using the @modal.method()
        # .local() calls the method in the same container
        # Source: Modal Chatterbox example
        try:
            audio_bytes = self.generate_voice_clone.local(
                text=request.text,
                language=request.language,
                ref_audio=ref_audio,
                ref_text=request.ref_text,
                max_new_tokens=request.max_new_tokens,
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Generation failed: {str(e)}"
            )

        # Return audio as streaming response
        # Source: Modal Chatterbox example
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=output.wav",
                "Content-Length": str(len(audio_bytes)),
            }
        )

    @modal.fastapi_endpoint(docs=True, method="POST")
    def clone_batch(self, request: BatchVoiceCloneRequest) -> dict:
        """
        Clone a voice and synthesize multiple texts.

        POST /clone-batch

        More efficient than multiple /clone calls when generating
        several utterances with the same reference voice.

        Returns: JSON with base64-encoded audio files
        """
        import base64

        # Validate request
        if len(request.texts) != len(request.languages):
            raise HTTPException(
                status_code=400,
                detail="Length of 'texts' must match 'languages'"
            )

        for lang in request.languages:
            if lang not in SUPPORTED_LANGUAGES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported language: {lang}"
                )

        # Determine reference audio source
        if request.ref_audio_url:
            ref_audio = request.ref_audio_url
        elif request.ref_audio_base64:
            ref_audio = request.ref_audio_base64
        else:
            raise HTTPException(
                status_code=400,
                detail="Either 'ref_audio_url' or 'ref_audio_base64' is required"
            )

        # Generate batch
        try:
            audio_bytes_list = self.generate_voice_clone_batch.local(
                texts=request.texts,
                languages=request.languages,
                ref_audio=ref_audio,
                ref_text=request.ref_text,
                max_new_tokens=request.max_new_tokens,
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Batch generation failed: {str(e)}"
            )

        # Return as base64-encoded JSON
        return {
            "status": "success",
            "count": len(audio_bytes_list),
            "audio_files": [
                {
                    "index": i,
                    "text": request.texts[i][:50] + "..." if len(request.texts[i]) > 50 else request.texts[i],
                    "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
                    "size_bytes": len(audio_bytes),
                }
                for i, audio_bytes in enumerate(audio_bytes_list)
            ]
        }

    @modal.fastapi_endpoint(docs=True, method="GET")
    def health(self) -> HealthResponse:
        """
        Health check endpoint.

        GET /health

        Returns service status and model information.
        """
        info = self.get_model_info.local()

        return HealthResponse(
            status="healthy",
            model=info["model_name"],
            gpu=info["gpu"],
            attention_implementation=info["attention_implementation"],
            supported_languages=info["supported_languages"],
        )

    @modal.fastapi_endpoint(docs=True, method="GET")
    def languages(self) -> dict:
        """
        Get supported languages.

        GET /languages

        Returns list of supported language codes.
        """
        return {
            "languages": SUPPORTED_LANGUAGES,
            "default": "Auto",
            "note": "Use 'Auto' for automatic language detection",
        }
```

---

## 5.4 Complete app.py

Your complete `app.py` should now look like this:

```python
"""
Qwen3-TTS Voice Cloning API on Modal.com
"""

import io
import os
from typing import Optional

import modal
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# =============================================================================
# Configuration
# =============================================================================

MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
MODEL_NAME = MODEL_ID.split("/")[-1]
MODELS_DIR = "/vol/models"
HF_CACHE_DIR = f"{MODELS_DIR}/huggingface"
GPU_TYPE = "A10G" if "1.7B" in MODEL_ID else "T4"
CONTAINER_IDLE_TIMEOUT = 300
MAX_CONCURRENT_INPUTS = 10

SUPPORTED_LANGUAGES = [
    "Auto", "Chinese", "English", "Japanese", "Korean",
    "German", "French", "Russian", "Portuguese", "Spanish", "Italian"
]

# =============================================================================
# Image Definition
# =============================================================================

def create_image() -> modal.Image:
    image = modal.Image.debian_slim(python_version="3.12")
    image = image.apt_install("sox", "libsox-fmt-all", "libsndfile1", "ffmpeg")
    image = image.env({
        "HF_HOME": HF_CACHE_DIR,
        "TRANSFORMERS_CACHE": HF_CACHE_DIR,
        "HF_HUB_CACHE": HF_CACHE_DIR,
        "TOKENIZERS_PARALLELISM": "false",
    })
    image = image.pip_install(
        "qwen-tts", "fastapi[standard]", "soundfile", "torchaudio", "numpy<2.0"
    )
    return image

image = create_image()

# =============================================================================
# Modal App & Volume
# =============================================================================

app = modal.App("qwen3-tts-voice-clone", image=image)
models_volume = modal.Volume.from_name("qwen3-tts-models", create_if_missing=True)

# =============================================================================
# Request/Response Models
# =============================================================================

class VoiceCloneRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    language: str = Field(default="Auto")
    ref_audio_url: Optional[str] = Field(default=None)
    ref_audio_base64: Optional[str] = Field(default=None)
    ref_text: str = Field(..., min_length=1)
    max_new_tokens: int = Field(default=2048, ge=256, le=4096)

class BatchVoiceCloneRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=10)
    languages: list[str]
    ref_audio_url: Optional[str] = Field(default=None)
    ref_audio_base64: Optional[str] = Field(default=None)
    ref_text: str
    max_new_tokens: int = Field(default=2048, ge=256, le=4096)

class HealthResponse(BaseModel):
    status: str
    model: str
    gpu: str
    attention_implementation: str
    supported_languages: list[str]

# =============================================================================
# Service Class
# =============================================================================

@app.cls(
    gpu=GPU_TYPE,
    scaledown_window=CONTAINER_IDLE_TIMEOUT,
    volumes={MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=300,
)
@modal.concurrent(max_inputs=MAX_CONCURRENT_INPUTS)
class Qwen3TTSService:

    @modal.enter()
    def load_model(self):
        import torch
        from qwen_tts import Qwen3TTSModel

        print(f"Loading model: {MODEL_NAME}")
        self.attn_impl = self._get_attention_implementation()
        print(f"Attention: {self.attn_impl}")

        local_path = f"{MODELS_DIR}/{MODEL_NAME}"
        load_path = local_path if os.path.exists(local_path) else MODEL_ID

        self.model = Qwen3TTSModel.from_pretrained(
            load_path,
            device_map="cuda:0",
            dtype=torch.bfloat16,
            attn_implementation=self.attn_impl,
        )
        print("Model loaded!")

    def _get_attention_implementation(self) -> str:
        import importlib.util
        import torch

        if importlib.util.find_spec("flash_attn"):
            try:
                import flash_attn
                return "flash_attention_2"
            except ImportError:
                pass

        if hasattr(torch.nn.functional, "scaled_dot_product_attention"):
            return "sdpa"

        return "eager"

    @modal.method()
    def generate_voice_clone(self, text, language, ref_audio, ref_text, max_new_tokens=2048) -> bytes:
        import soundfile as sf

        wavs, sr = self.model.generate_voice_clone(
            text=text, language=language,
            ref_audio=ref_audio, ref_text=ref_text,
            max_new_tokens=max_new_tokens,
        )

        buffer = io.BytesIO()
        sf.write(buffer, wavs[0], sr, format="WAV", subtype="PCM_16")
        buffer.seek(0)
        return buffer.read()

    @modal.method()
    def generate_voice_clone_batch(self, texts, languages, ref_audio, ref_text, max_new_tokens=2048) -> list[bytes]:
        import soundfile as sf

        voice_prompt = self.model.create_voice_clone_prompt(
            ref_audio=ref_audio, ref_text=ref_text, x_vector_only_mode=False
        )

        wavs, sr = self.model.generate_voice_clone(
            text=texts, language=languages,
            voice_clone_prompt=voice_prompt,
            max_new_tokens=max_new_tokens,
        )

        results = []
        for wav in wavs:
            buffer = io.BytesIO()
            sf.write(buffer, wav, sr, format="WAV", subtype="PCM_16")
            buffer.seek(0)
            results.append(buffer.read())
        return results

    @modal.method()
    def get_model_info(self) -> dict:
        import torch
        return {
            "model_name": MODEL_NAME,
            "attention_implementation": self.attn_impl,
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none",
            "supported_languages": SUPPORTED_LANGUAGES,
        }

    # =========================================================================
    # FastAPI Endpoints
    # =========================================================================

    @modal.fastapi_endpoint(docs=True, method="POST")
    def clone(self, request: VoiceCloneRequest) -> StreamingResponse:
        if request.language not in SUPPORTED_LANGUAGES:
            raise HTTPException(400, f"Unsupported language: {request.language}")

        ref_audio = request.ref_audio_url or request.ref_audio_base64
        if not ref_audio:
            raise HTTPException(400, "ref_audio_url or ref_audio_base64 required")

        audio_bytes = self.generate_voice_clone.local(
            text=request.text, language=request.language,
            ref_audio=ref_audio, ref_text=request.ref_text,
            max_new_tokens=request.max_new_tokens,
        )

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=output.wav"}
        )

    @modal.fastapi_endpoint(docs=True, method="POST")
    def clone_batch(self, request: BatchVoiceCloneRequest) -> dict:
        import base64

        if len(request.texts) != len(request.languages):
            raise HTTPException(400, "texts and languages must have same length")

        ref_audio = request.ref_audio_url or request.ref_audio_base64
        if not ref_audio:
            raise HTTPException(400, "ref_audio_url or ref_audio_base64 required")

        audio_list = self.generate_voice_clone_batch.local(
            texts=request.texts, languages=request.languages,
            ref_audio=ref_audio, ref_text=request.ref_text,
            max_new_tokens=request.max_new_tokens,
        )

        return {
            "count": len(audio_list),
            "audio_files": [
                {"index": i, "audio_base64": base64.b64encode(a).decode(), "size_bytes": len(a)}
                for i, a in enumerate(audio_list)
            ]
        }

    @modal.fastapi_endpoint(docs=True, method="GET")
    def health(self) -> HealthResponse:
        info = self.get_model_info.local()
        return HealthResponse(
            status="healthy",
            model=info["model_name"],
            gpu=info["gpu"],
            attention_implementation=info["attention_implementation"],
            supported_languages=info["supported_languages"],
        )

    @modal.fastapi_endpoint(docs=True, method="GET")
    def languages(self) -> dict:
        return {"languages": SUPPORTED_LANGUAGES, "default": "Auto"}

# =============================================================================
# Local Entrypoint
# =============================================================================

@app.local_entrypoint()
def main():
    ref_audio = "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen3-TTS-Repo/clone.wav"
    ref_text = "Okay. Yeah. I resent you. I love you. I respect you. But you know what? You blew it! And thanks to you."
    test_text = "Hello, this is a test of voice cloning."

    service = Qwen3TTSService()
    audio = service.generate_voice_clone.remote(
        text=test_text, language="English",
        ref_audio=ref_audio, ref_text=ref_text,
    )

    with open("test_output.wav", "wb") as f:
        f.write(audio)
    print(f"Saved: test_output.wav ({len(audio)} bytes)")
```

---

## 5.5 API Documentation

When deployed, FastAPI auto-generates documentation at:
- `/docs` - Swagger UI (interactive)
- `/redoc` - ReDoc (read-only)

Access via: `https://your-endpoint.modal.run/docs`

---

## 5.6 Endpoint Summary

| Endpoint | Method | Description | Returns |
|----------|--------|-------------|---------|
| `/clone` | POST | Single voice clone | `audio/wav` |
| `/clone-batch` | POST | Batch voice clone | JSON with base64 audio |
| `/health` | GET | Service status | JSON |
| `/languages` | GET | Supported languages | JSON |

---

## Checklist

Before proceeding, confirm:

- [ ] Pydantic models added (`VoiceCloneRequest`, etc.)
- [ ] Endpoints added to service class (`clone`, `health`, etc.)
- [ ] Test run with `modal run app.py` succeeds
- [ ] Audio file generated correctly

---

## Next Step

Proceed to [Step 6: Deployment](./06-deployment.md)
