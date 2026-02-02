"""
Qwen3-TTS Voice Cloning API on Modal.com (0.6B Model)

0.6B parameter model on A10G GPU for benchmarking comparison.
Same API as the 1.7B app.

Sources:
- Modal Chatterbox example: https://modal.com/docs/examples/chatterbox_tts
- Qwen3-TTS GitHub: https://github.com/QwenLM/Qwen3-TTS
- Qwen3-TTS HuggingFace: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base
"""

import io
import os
from typing import Optional

import modal

# =============================================================================
# Configuration
# =============================================================================

# Model selection - 0.6B variant
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
MODEL_NAME = MODEL_ID.split("/")[-1]  # "Qwen3-TTS-12Hz-0.6B-Base"

# Volume configuration
MODELS_DIR = "/vol/models"
HF_CACHE_DIR = f"{MODELS_DIR}/huggingface"

# GPU selection - A10G for 0.6B model (benchmarking on same GPU as 1.7B)
GPU_TYPE = "A10G"

# Container settings
CONTAINER_IDLE_TIMEOUT = 300  # 5 minutes
MAX_CONCURRENT_INPUTS = 10

# Long-running task settings
# For 10-minute audio at 2.5x real-time, we need ~25 minutes max
MAX_GENERATION_TIMEOUT = 1800  # 30 minutes

# Supported languages
SUPPORTED_LANGUAGES = [
    "Auto",
    "Chinese",
    "English",
    "Japanese",
    "Korean",
    "German",
    "French",
    "Russian",
    "Portuguese",
    "Spanish",
    "Italian",
]

# =============================================================================
# Image Definition
# =============================================================================


def create_image() -> modal.Image:
    """
    Build Modal container image for Qwen3-TTS.

    Same image as 1.7B - the model weights are the only difference.
    """
    image = modal.Image.debian_slim(python_version="3.12")

    image = image.apt_install(
        "sox",
        "libsox-fmt-all",
        "libsndfile1",
        "ffmpeg",
    )

    image = image.env(
        {
            "HF_HOME": HF_CACHE_DIR,
            "TRANSFORMERS_CACHE": HF_CACHE_DIR,
            "HF_HUB_CACHE": HF_CACHE_DIR,
            "TOKENIZERS_PARALLELISM": "false",
        }
    )

    image = image.pip_install(
        "qwen-tts",
        "fastapi[standard]",
        "soundfile",
        "torchaudio",
        "numpy<2.0",
    )

    return image


image = create_image()

# =============================================================================
# Modal App & Volume
# =============================================================================

app = modal.App("qwen3-tts-voice-clone-06b", image=image)

models_volume = modal.Volume.from_name("qwen3-tts-models", create_if_missing=True)

# =============================================================================
# Service Class
# =============================================================================


@app.cls(
    gpu=GPU_TYPE,
    scaledown_window=CONTAINER_IDLE_TIMEOUT,
    volumes={MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=MAX_GENERATION_TIMEOUT,  # 30 minutes for long text generation
)
@modal.concurrent(max_inputs=MAX_CONCURRENT_INPUTS)
class Qwen3TTSService:
    """
    Voice cloning service using Qwen3-TTS 0.6B model.

    Same API as the 1.7B service but faster and cheaper.
    """

    @modal.enter()
    def load_model(self):
        """Load model when container starts."""
        import torch
        from qwen_tts import Qwen3TTSModel

        print("=" * 60)
        print(f"Loading Qwen3-TTS Model: {MODEL_NAME}")
        print("=" * 60)

        print(f"CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"GPU: {torch.cuda.get_device_name(0)}")
            gpu_mem = torch.cuda.get_device_properties(0).total_memory / 1e9
            print(f"GPU Memory: {gpu_mem:.1f} GB")

        self.attn_impl = self._get_attention_implementation()
        print(f"Attention implementation: {self.attn_impl}")

        local_model_path = f"{MODELS_DIR}/{MODEL_NAME}"
        if os.path.exists(local_model_path) and os.listdir(local_model_path):
            print(f"Loading from volume: {local_model_path}")
            load_path = local_model_path
        else:
            print(f"Loading from HuggingFace Hub: {MODEL_ID}")
            print("WARNING: This will be slow. Run download_models.py first!")
            load_path = MODEL_ID

        self.model = Qwen3TTSModel.from_pretrained(
            load_path,
            device_map="cuda:0",
            dtype=torch.bfloat16,
            attn_implementation=self.attn_impl,
        )

        print("Model loaded successfully!")
        print("=" * 60)

    def _get_attention_implementation(self) -> str:
        """Determine the best available attention implementation."""
        import importlib.util

        if importlib.util.find_spec("flash_attn") is not None:
            try:
                import flash_attn

                print(f"Flash Attention found: v{flash_attn.__version__}")
                return "flash_attention_2"
            except ImportError:
                pass

        import torch

        if hasattr(torch.nn.functional, "scaled_dot_product_attention"):
            print("Using PyTorch native SDPA")
            return "sdpa"

        print("Using eager attention (fallback)")
        return "eager"

    # =========================================================================
    # Core Methods
    # =========================================================================

    def _resolve_ref_audio(self, ref_audio: str) -> str:
        """Resolve reference audio to a path or URL that qwen-tts can use."""
        import base64
        import tempfile

        if ref_audio.startswith(("http://", "https://")):
            print("  Reference: URL")
            return ref_audio

        print("  Reference: base64 encoded")
        try:
            audio_bytes = base64.b64decode(ref_audio)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                temp_path = f.name
            print(f"  Saved to temp: {temp_path} ({len(audio_bytes)} bytes)")
            return temp_path
        except Exception as e:
            print(f"  Failed to decode base64: {e}")
            raise ValueError(f"Invalid reference audio: could not decode base64: {e}")

    @modal.method()
    def generate_voice_clone(
        self,
        text: str,
        language: str,
        ref_audio: str,
        ref_text: str,
        max_new_tokens: int = 2048,
    ) -> bytes:
        """Generate cloned voice audio from text."""
        import soundfile as sf

        print(f"Generating voice clone:")
        print(f"  Text: '{text[:50]}{'...' if len(text) > 50 else ''}'")
        print(f"  Language: {language}")
        print(f"  Ref text: '{ref_text[:50]}{'...' if len(ref_text) > 50 else ''}'")

        resolved_ref_audio = self._resolve_ref_audio(ref_audio)
        temp_file_created = resolved_ref_audio != ref_audio

        try:
            wavs, sr = self.model.generate_voice_clone(
                text=text,
                language=language,
                ref_audio=resolved_ref_audio,
                ref_text=ref_text,
                max_new_tokens=max_new_tokens,
            )

            print(f"  Generated: {len(wavs[0])} samples at {sr} Hz")

            buffer = io.BytesIO()
            sf.write(buffer, wavs[0], sr, format="WAV", subtype="PCM_16")
            buffer.seek(0)

            audio_bytes = buffer.read()
            print(f"  Output size: {len(audio_bytes)} bytes")

            return audio_bytes
        finally:
            if temp_file_created:
                try:
                    os.unlink(resolved_ref_audio)
                    print(f"  Cleaned up temp file")
                except Exception:
                    pass

    @modal.method()
    def get_model_info(self) -> dict:
        """Get information about the loaded model."""
        import torch

        return {
            "model_id": MODEL_ID,
            "model_name": MODEL_NAME,
            "attention_implementation": self.attn_impl,
            "gpu": (
                torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none"
            ),
            "gpu_memory_gb": (
                torch.cuda.get_device_properties(0).total_memory / 1e9
                if torch.cuda.is_available()
                else 0
            ),
            "supported_languages": SUPPORTED_LANGUAGES,
        }

    # =========================================================================
    # FastAPI Endpoints
    # =========================================================================

    @modal.fastapi_endpoint(docs=True, method="POST")
    def clone(self, request: dict) -> "StreamingResponse":
        """Clone a voice and synthesize text. Returns audio/wav."""
        from fastapi import HTTPException
        from fastapi.responses import StreamingResponse

        text = request.get("text", "")
        language = request.get("language", "Auto")
        ref_audio_url = request.get("ref_audio_url")
        ref_audio_base64 = request.get("ref_audio_base64")
        ref_text = request.get("ref_text", "")
        max_new_tokens = request.get("max_new_tokens", 2048)

        if not text:
            raise HTTPException(status_code=400, detail="'text' is required")
        if not ref_text:
            raise HTTPException(status_code=400, detail="'ref_text' is required")

        if language not in SUPPORTED_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language: {language}. "
                f"Supported: {', '.join(SUPPORTED_LANGUAGES)}",
            )

        if ref_audio_url:
            ref_audio = ref_audio_url
        elif ref_audio_base64:
            ref_audio = ref_audio_base64
        else:
            raise HTTPException(
                status_code=400,
                detail="Either 'ref_audio_url' or 'ref_audio_base64' is required",
            )

        try:
            audio_bytes = self.generate_voice_clone.local(
                text=text,
                language=language,
                ref_audio=ref_audio,
                ref_text=ref_text,
                max_new_tokens=max_new_tokens,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=output.wav",
                "Content-Length": str(len(audio_bytes)),
            },
        )

    @modal.fastapi_endpoint(docs=True, method="GET")
    def health(self) -> dict:
        """Health check endpoint."""
        info = self.get_model_info.local()

        return {
            "status": "healthy",
            "model": info["model_name"],
            "gpu": info["gpu"],
            "attention_implementation": info["attention_implementation"],
            "supported_languages": info["supported_languages"],
        }

# =============================================================================
# Standalone Generation Function (for spawn/async pattern)
# =============================================================================


@app.function(
    gpu=GPU_TYPE,
    volumes={MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=MAX_GENERATION_TIMEOUT,
    scaledown_window=CONTAINER_IDLE_TIMEOUT,
)
def generate_voice_clone_job(
    text: str,
    language: str,
    ref_audio_base64: str,
    ref_text: str,
    max_new_tokens: int = 2048,
) -> bytes:
    """
    Standalone function for async job-based generation.

    This function is designed for the spawn/poll pattern for long-running tasks.
    Called via Function.spawn() which returns immediately with a job_id.

    Source: https://modal.com/docs/guide/job-queue

    Returns:
        WAV audio bytes
    """
    import base64
    import tempfile
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel

    print(f"[JOB] Starting voice clone generation")
    print(f"[JOB] Text length: {len(text)} chars")
    print(f"[JOB] Language: {language}")

    # Load model
    local_model_path = f"{MODELS_DIR}/{MODEL_NAME}"
    if os.path.exists(local_model_path) and os.listdir(local_model_path):
        load_path = local_model_path
    else:
        load_path = MODEL_ID

    # Determine attention implementation
    import importlib.util

    if importlib.util.find_spec("flash_attn") is not None:
        attn_impl = "flash_attention_2"
    elif hasattr(torch.nn.functional, "scaled_dot_product_attention"):
        attn_impl = "sdpa"
    else:
        attn_impl = "eager"

    print(f"[JOB] Loading model from: {load_path}")
    model = Qwen3TTSModel.from_pretrained(
        load_path,
        device_map="cuda:0",
        dtype=torch.bfloat16,
        attn_implementation=attn_impl,
    )
    print(f"[JOB] Model loaded")

    # Decode reference audio from base64 to temp file
    audio_data = base64.b64decode(ref_audio_base64)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_data)
        ref_audio_path = tmp.name

    try:
        print(f"[JOB] Generating audio...")
        wavs, sr = model.generate_voice_clone(
            text=text,
            language=language,
            ref_audio=ref_audio_path,
            ref_text=ref_text,
            max_new_tokens=max_new_tokens,
        )

        print(f"[JOB] Generated: {len(wavs[0])} samples at {sr} Hz")

        buffer = io.BytesIO()
        sf.write(buffer, wavs[0], sr, format="WAV", subtype="PCM_16")
        buffer.seek(0)

        audio_bytes = buffer.read()
        print(f"[JOB] Output size: {len(audio_bytes)} bytes")

        return audio_bytes

    finally:
        try:
            os.unlink(ref_audio_path)
        except Exception:
            pass


# =============================================================================
# Job Management Web Endpoints
# =============================================================================


@app.function()
@modal.fastapi_endpoint(docs=True, method="POST")
def submit_job(request: dict) -> dict:
    """
    Submit a voice generation job for async processing.

    POST /submit-job

    Uses Modal's spawn/poll pattern for long-running tasks.
    Returns immediately with a job_id for polling.

    Source: https://modal.com/docs/guide/job-queue
    """
    from fastapi import HTTPException

    text = request.get("text", "")
    language = request.get("language", "Auto")
    ref_audio_base64 = request.get("ref_audio_base64")
    ref_text = request.get("ref_text", "")
    max_new_tokens = request.get("max_new_tokens", 2048)

    if not text:
        raise HTTPException(status_code=400, detail="'text' is required")
    if not ref_audio_base64:
        raise HTTPException(status_code=400, detail="'ref_audio_base64' is required")
    if not ref_text:
        raise HTTPException(status_code=400, detail="'ref_text' is required")

    # Spawn the generation job (returns immediately)
    function_call = generate_voice_clone_job.spawn(
        text=text,
        language=language,
        ref_audio_base64=ref_audio_base64,
        ref_text=ref_text,
        max_new_tokens=max_new_tokens,
    )

    return {
        "job_id": function_call.object_id,
        "status": "submitted",
        "text_length": len(text),
    }


@app.function()
@modal.fastapi_endpoint(docs=True, method="GET")
def job_status(job_id: str) -> dict:
    """
    Check the status of a submitted job.

    GET /job-status?job_id=fc-xxx

    Source: https://modal.com/docs/reference/modal.FunctionCall
    """
    from fastapi import HTTPException

    if not job_id:
        raise HTTPException(status_code=400, detail="'job_id' is required")

    try:
        function_call = modal.FunctionCall.from_id(job_id)

        try:
            function_call.get(timeout=0)
            return {
                "job_id": job_id,
                "status": "completed",
                "result_ready": True,
            }
        except TimeoutError:
            return {
                "job_id": job_id,
                "status": "running",
                "result_ready": False,
            }
    except Exception as e:
        return {
            "job_id": job_id,
            "status": "failed",
            "result_ready": False,
            "error": str(e),
        }


@app.function()
@modal.fastapi_endpoint(docs=True, method="GET")
def job_result(job_id: str) -> "Response":
    """
    Get the result of a completed job.

    GET /job-result?job_id=fc-xxx

    Returns audio/wav if complete, 202 if still processing.

    Source: https://modal.com/docs/guide/job-queue
    """
    from fastapi import HTTPException
    from fastapi.responses import Response

    if not job_id:
        raise HTTPException(status_code=400, detail="'job_id' is required")

    try:
        function_call = modal.FunctionCall.from_id(job_id)

        try:
            audio_bytes = function_call.get(timeout=5)
            return Response(
                content=audio_bytes,
                media_type="audio/wav",
                headers={
                    "Content-Disposition": "attachment; filename=output.wav",
                    "Content-Length": str(len(audio_bytes)),
                },
            )
        except TimeoutError:
            raise HTTPException(status_code=202, detail="Job still processing")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get result: {str(e)}")


# =============================================================================
# Local Entrypoint (for testing)
# =============================================================================


@app.local_entrypoint()
def main():
    """
    Test the 0.6B service locally.

    Usage:
        modal run app_06b.py
    """
    print("Testing Qwen3-TTS 0.6B Service")
    print("=" * 60)

    ref_audio = (
        "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen3-TTS-Repo/clone.wav"
    )
    ref_text = (
        "Okay. Yeah. I resent you. I love you. I respect you. "
        "But you know what? You blew it! And thanks to you."
    )

    test_text = (
        "Hello, this is a test of the Qwen3 text to speech voice cloning system."
    )

    service = Qwen3TTSService()

    print("\n1. Testing model info...")
    info = service.get_model_info.remote()
    print(f"   Model: {info['model_name']}")
    print(f"   Attention: {info['attention_implementation']}")
    print(f"   GPU: {info['gpu']}")

    print("\n2. Testing voice clone generation...")
    audio_bytes = service.generate_voice_clone.remote(
        text=test_text,
        language="English",
        ref_audio=ref_audio,
        ref_text=ref_text,
    )

    output_path = "test_output_06b.wav"
    with open(output_path, "wb") as f:
        f.write(audio_bytes)

    print(f"   Saved: {output_path} ({len(audio_bytes)} bytes)")
    print("\nTest complete!")
