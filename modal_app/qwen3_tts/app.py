"""
Qwen3-TTS Voice Cloning API on Modal.com

Provides multi-language voice cloning capabilities for the Utter application.

Sources:
- Modal Chatterbox example: https://modal.com/docs/examples/chatterbox_tts
- Qwen3-TTS GitHub: https://github.com/QwenLM/Qwen3-TTS
- Qwen3-TTS HuggingFace: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base
"""

import io
import os
from typing import Optional

import modal

# =============================================================================
# Configuration
# =============================================================================

# Model selection - change this to switch between models
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
MODEL_NAME = MODEL_ID.split("/")[-1]  # "Qwen3-TTS-12Hz-1.7B-Base"

# Volume configuration
MODELS_DIR = "/vol/models"
HF_CACHE_DIR = f"{MODELS_DIR}/huggingface"

# GPU selection based on model size
# Source: Investigation report - 1.7B needs ~5-6GB VRAM
GPU_TYPE = "A10G" if "1.7B" in MODEL_ID else "T4"

# Container settings
# Source: Modal Chatterbox example
CONTAINER_IDLE_TIMEOUT = 300  # 5 minutes
MAX_CONCURRENT_INPUTS = 10

# Long-running task settings
# For 10-minute audio at 2.5x real-time, we need ~25 minutes max
MAX_GENERATION_TIMEOUT = 1800  # 30 minutes

# Supported languages
# Source: Qwen3-TTS model card
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

    This function creates an image with:
    - Python 3.12 (recommended by Qwen3-TTS)
    - System audio libraries (sox, ffmpeg)
    - qwen-tts package with pinned transformers
    - FastAPI for web endpoints

    Sources:
    - Python version: Qwen3-TTS README recommends 3.12
    - System deps: Qwen3-TTS pyproject.toml
    - Image building: https://modal.com/docs/guide/images
    """
    # Start with debian_slim base + Python 3.12
    image = modal.Image.debian_slim(python_version="3.12")

    # Install system dependencies
    # Source: Qwen3-TTS pyproject.toml lists sox, soundfile
    image = image.apt_install(
        "sox",  # Required by sox Python package
        "libsox-fmt-all",  # SOX format support (mp3, flac, etc.)
        "libsndfile1",  # Required by soundfile package
        "ffmpeg",  # Audio format conversion
    )

    # Set environment variables for HuggingFace cache
    # Source: Modal volumes guide - HF_HOME respected by huggingface_hub
    image = image.env(
        {
            "HF_HOME": HF_CACHE_DIR,
            "TRANSFORMERS_CACHE": HF_CACHE_DIR,
            "HF_HUB_CACHE": HF_CACHE_DIR,
            "TOKENIZERS_PARALLELISM": "false",  # Avoid tokenizer warnings
        }
    )

    # Install Python packages
    # Source: Qwen3-TTS pyproject.toml
    # Note: qwen-tts will install transformers==4.57.3, accelerate==1.12.0
    image = image.pip_install(
        # Core TTS package
        "qwen-tts",
        # Web framework (from Modal Chatterbox example)
        "fastapi[standard]",
        # Audio processing
        "soundfile",
        "torchaudio",
        # Ensure numpy compatibility
        "numpy<2.0",
    )

    return image


image = create_image()

# =============================================================================
# Modal App & Volume
# =============================================================================

app = modal.App("qwen3-tts-voice-clone", image=image)

models_volume = modal.Volume.from_name("qwen3-tts-models", create_if_missing=True)

# =============================================================================
# Service Class
# =============================================================================


@app.cls(
    gpu=GPU_TYPE,
    scaledown_window=CONTAINER_IDLE_TIMEOUT,
    volumes={MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=MAX_GENERATION_TIMEOUT,  # 30 minute timeout for very long generations
)
@modal.concurrent(max_inputs=MAX_CONCURRENT_INPUTS)
class Qwen3TTSService:
    """
    Voice cloning service using Qwen3-TTS.

    This class handles:
    - Model loading at container start
    - Voice clone generation
    - Reusable voice prompt creation

    Sources:
    - Modal @app.cls pattern: https://modal.com/docs/guide/lifecycle-functions
    - Qwen3-TTS API: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base
    """

    @modal.enter()
    def load_model(self):
        """
        Load model when container starts.

        This method runs once per container, not per request.
        The model stays in GPU memory for subsequent requests.

        Source: Modal docs - "@modal.enter() executes when a container starts"
        """
        import torch
        from qwen_tts import Qwen3TTSModel

        print("=" * 60)
        print(f"Loading Qwen3-TTS Model: {MODEL_NAME}")
        print("=" * 60)

        # Log GPU information
        print(f"CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"GPU: {torch.cuda.get_device_name(0)}")
            gpu_mem = torch.cuda.get_device_properties(0).total_memory / 1e9
            print(f"GPU Memory: {gpu_mem:.1f} GB")

        # Determine attention implementation
        self.attn_impl = self._get_attention_implementation()
        print(f"Attention implementation: {self.attn_impl}")

        # Check for cached model in volume
        local_model_path = f"{MODELS_DIR}/{MODEL_NAME}"
        if os.path.exists(local_model_path) and os.listdir(local_model_path):
            print(f"Loading from volume: {local_model_path}")
            load_path = local_model_path
        else:
            print(f"Loading from HuggingFace Hub: {MODEL_ID}")
            print("WARNING: This will be slow. Run download_models.py first!")
            load_path = MODEL_ID

        # Load model
        # Source: Qwen3-TTS HuggingFace model card
        self.model = Qwen3TTSModel.from_pretrained(
            load_path,
            device_map="cuda:0",
            dtype=torch.bfloat16,
            attn_implementation=self.attn_impl,
        )

        print("Model loaded successfully!")
        print("=" * 60)

    def _get_attention_implementation(self) -> str:
        """
        Determine the best available attention implementation.

        Priority:
        1. flash_attention_2 - Fastest, requires flash-attn package
        2. sdpa - PyTorch native, good performance
        3. eager - Guaranteed compatibility, slowest

        Sources:
        - Qwen3-TTS uses attn_implementation parameter
        - PyTorch SDPA: torch.nn.functional.scaled_dot_product_attention
        """
        import importlib.util

        # Priority 1: Flash Attention 2
        if importlib.util.find_spec("flash_attn") is not None:
            try:
                import flash_attn

                print(f"Flash Attention found: v{flash_attn.__version__}")
                return "flash_attention_2"
            except ImportError:
                pass

        # Priority 2: SDPA (PyTorch >= 2.0)
        import torch

        if hasattr(torch.nn.functional, "scaled_dot_product_attention"):
            print("Using PyTorch native SDPA")
            return "sdpa"

        # Priority 3: Eager (fallback)
        print("Using eager attention (fallback)")
        return "eager"

    # =========================================================================
    # Core Methods (called by endpoints)
    # =========================================================================

    def _resolve_ref_audio(self, ref_audio: str) -> str:
        """
        Resolve reference audio to a path or URL that qwen-tts can use.

        If ref_audio is base64 encoded, decode it and save to a temp file.
        If it's a URL (http/https), return as-is.

        Args:
            ref_audio: URL or base64-encoded audio data

        Returns:
            Path to audio file or URL
        """
        import base64
        import tempfile

        # Check if it's a URL
        if ref_audio.startswith(("http://", "https://")):
            print("  Reference: URL")
            return ref_audio

        # Assume it's base64 - decode and save to temp file
        print("  Reference: base64 encoded")
        try:
            audio_bytes = base64.b64decode(ref_audio)
            # Create temp file
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
        """
        Generate cloned voice audio from text.

        Args:
            text: Text to synthesize
            language: Target language (e.g., "English", "Chinese", "Auto")
            ref_audio: Reference audio (URL or base64 string)
            ref_text: Transcript of reference audio
            max_new_tokens: Maximum tokens to generate

        Returns:
            WAV audio bytes

        Source: Qwen3-TTS HuggingFace model card - generate_voice_clone()
        """
        import soundfile as sf

        print(f"Generating voice clone:")
        print(f"  Text: '{text[:50]}{'...' if len(text) > 50 else ''}'")
        print(f"  Language: {language}")
        print(f"  Ref text: '{ref_text[:50]}{'...' if len(ref_text) > 50 else ''}'")

        # Resolve reference audio (handle base64)
        resolved_ref_audio = self._resolve_ref_audio(ref_audio)
        temp_file_created = resolved_ref_audio != ref_audio

        try:
            # Generate audio
            # Source: Qwen3-TTS model card code example
            wavs, sr = self.model.generate_voice_clone(
                text=text,
                language=language,
                ref_audio=resolved_ref_audio,
                ref_text=ref_text,
                max_new_tokens=max_new_tokens,
            )

            print(f"  Generated: {len(wavs[0])} samples at {sr} Hz")

            # Convert to WAV bytes
            # Source: Modal Chatterbox example - BytesIO pattern
            buffer = io.BytesIO()
            sf.write(buffer, wavs[0], sr, format="WAV", subtype="PCM_16")
            buffer.seek(0)

            audio_bytes = buffer.read()
            print(f"  Output size: {len(audio_bytes)} bytes")

            return audio_bytes
        finally:
            # Clean up temp file if created
            if temp_file_created:
                try:
                    os.unlink(resolved_ref_audio)
                    print(f"  Cleaned up temp file")
                except Exception:
                    pass

    @modal.method()
    def generate_voice_clone_batch(
        self,
        texts: list[str],
        languages: list[str],
        ref_audio: str,
        ref_text: str,
        max_new_tokens: int = 2048,
    ) -> list[bytes]:
        """
        Generate multiple voice clones in a batch.

        More efficient than calling generate_voice_clone multiple times
        because the voice prompt is computed once.

        Args:
            texts: List of texts to synthesize
            languages: List of languages (same length as texts)
            ref_audio: Reference audio (shared for all)
            ref_text: Reference transcript (shared for all)
            max_new_tokens: Maximum tokens per generation

        Returns:
            List of WAV audio bytes

        Source: Qwen3-TTS model card - batch generation pattern
        """
        import soundfile as sf

        print(f"Batch generation: {len(texts)} items")

        # Resolve reference audio (handle base64)
        resolved_ref_audio = self._resolve_ref_audio(ref_audio)
        temp_file_created = resolved_ref_audio != ref_audio

        try:
            # Create reusable voice prompt
            # Source: Qwen3-TTS model card - create_voice_clone_prompt()
            voice_prompt = self.model.create_voice_clone_prompt(
                ref_audio=resolved_ref_audio,
                ref_text=ref_text,
                x_vector_only_mode=False,
            )

            # Generate all at once
            wavs, sr = self.model.generate_voice_clone(
                text=texts,
                language=languages,
                voice_clone_prompt=voice_prompt,
                max_new_tokens=max_new_tokens,
            )

            # Convert each to WAV bytes
            results = []
            for i, wav in enumerate(wavs):
                buffer = io.BytesIO()
                sf.write(buffer, wav, sr, format="WAV", subtype="PCM_16")
                buffer.seek(0)
                results.append(buffer.read())
                print(f"  [{i+1}/{len(texts)}] {len(results[-1])} bytes")

            return results
        finally:
            # Clean up temp file if created
            if temp_file_created:
                try:
                    os.unlink(resolved_ref_audio)
                    print(f"  Cleaned up temp file")
                except Exception:
                    pass

    @modal.method()
    def get_model_info(self) -> dict:
        """
        Get information about the loaded model.

        Returns:
            Dict with model information
        """
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
        """
        Clone a voice and synthesize text.

        POST /clone

        Accepts reference audio (URL or base64) and generates speech
        with the cloned voice.

        Returns: audio/wav

        Source: Modal Chatterbox example - StreamingResponse pattern
        """
        from fastapi import HTTPException
        from fastapi.responses import StreamingResponse

        # Extract request fields
        text = request.get("text", "")
        language = request.get("language", "Auto")
        ref_audio_url = request.get("ref_audio_url")
        ref_audio_base64 = request.get("ref_audio_base64")
        ref_text = request.get("ref_text", "")
        max_new_tokens = request.get("max_new_tokens", 2048)

        # Validate required fields
        if not text:
            raise HTTPException(status_code=400, detail="'text' is required")
        if not ref_text:
            raise HTTPException(status_code=400, detail="'ref_text' is required")

        # Validate language
        if language not in SUPPORTED_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language: {language}. "
                f"Supported: {', '.join(SUPPORTED_LANGUAGES)}",
            )

        # Determine reference audio source
        if ref_audio_url:
            ref_audio = ref_audio_url
        elif ref_audio_base64:
            ref_audio = ref_audio_base64
        else:
            raise HTTPException(
                status_code=400,
                detail="Either 'ref_audio_url' or 'ref_audio_base64' is required",
            )

        # Generate audio using the @modal.method()
        # .local() calls the method in the same container
        # Source: Modal Chatterbox example
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

        # Return audio as streaming response
        # Source: Modal Chatterbox example
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=output.wav",
                "Content-Length": str(len(audio_bytes)),
            },
        )

    @modal.fastapi_endpoint(docs=True, method="POST")
    def clone_batch(self, request: dict) -> dict:
        """
        Clone a voice and synthesize multiple texts.

        POST /clone-batch

        More efficient than multiple /clone calls when generating
        several utterances with the same reference voice.

        Returns: JSON with base64-encoded audio files
        """
        import base64
        from fastapi import HTTPException

        # Extract request fields
        texts = request.get("texts", [])
        languages = request.get("languages", [])
        ref_audio_url = request.get("ref_audio_url")
        ref_audio_base64 = request.get("ref_audio_base64")
        ref_text = request.get("ref_text", "")
        max_new_tokens = request.get("max_new_tokens", 2048)

        # Validate request
        if not texts:
            raise HTTPException(status_code=400, detail="'texts' is required")
        if not ref_text:
            raise HTTPException(status_code=400, detail="'ref_text' is required")
        if len(texts) != len(languages):
            raise HTTPException(
                status_code=400, detail="Length of 'texts' must match 'languages'"
            )

        for lang in languages:
            if lang not in SUPPORTED_LANGUAGES:
                raise HTTPException(
                    status_code=400, detail=f"Unsupported language: {lang}"
                )

        # Determine reference audio source
        if ref_audio_url:
            ref_audio = ref_audio_url
        elif ref_audio_base64:
            ref_audio = ref_audio_base64
        else:
            raise HTTPException(
                status_code=400,
                detail="Either 'ref_audio_url' or 'ref_audio_base64' is required",
            )

        # Generate batch
        try:
            audio_bytes_list = self.generate_voice_clone_batch.local(
                texts=texts,
                languages=languages,
                ref_audio=ref_audio,
                ref_text=ref_text,
                max_new_tokens=max_new_tokens,
            )
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Batch generation failed: {str(e)}"
            )

        # Return as base64-encoded JSON
        return {
            "status": "success",
            "count": len(audio_bytes_list),
            "audio_files": [
                {
                    "index": i,
                    "text": texts[i][:50] + "..." if len(texts[i]) > 50 else texts[i],
                    "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
                    "size_bytes": len(audio_bytes),
                }
                for i, audio_bytes in enumerate(audio_bytes_list)
            ],
        }

    @modal.fastapi_endpoint(docs=True, method="GET")
    def health(self) -> dict:
        """
        Health check endpoint.

        GET /health

        Returns service status and model information.
        """
        info = self.get_model_info.local()

        return {
            "status": "healthy",
            "model": info["model_name"],
            "gpu": info["gpu"],
            "attention_implementation": info["attention_implementation"],
            "supported_languages": info["supported_languages"],
        }

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


# =============================================================================
# Standalone Generation Function (for spawn/async pattern)
# =============================================================================


@app.function(
    gpu=GPU_TYPE,
    volumes={MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=MAX_GENERATION_TIMEOUT,
    # Keep container warm for 5 minutes to reuse for subsequent jobs
    # This avoids model reload overhead when jobs arrive close together
    # Source: https://modal.com/docs/guide/cold-start
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
    It can be called via Function.spawn() which returns immediately with a job_id,
    allowing proper job tracking, polling, and cancellation.

    The function is deployed as part of the 'qwen3-tts-voice-clone' app and
    should be referenced from other apps using:
        modal.Function.from_name("qwen3-tts-voice-clone", "generate_voice_clone_job")

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

    # Load model (will be cached in container for subsequent calls)
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
        # Generate audio
        print(f"[JOB] Generating audio...")
        wavs, sr = model.generate_voice_clone(
            text=text,
            language=language,
            ref_audio=ref_audio_path,
            ref_text=ref_text,
            max_new_tokens=max_new_tokens,
        )

        print(f"[JOB] Generated: {len(wavs[0])} samples at {sr} Hz")

        # Convert to WAV bytes
        buffer = io.BytesIO()
        sf.write(buffer, wavs[0], sr, format="WAV", subtype="PCM_16")
        buffer.seek(0)

        audio_bytes = buffer.read()
        print(f"[JOB] Output size: {len(audio_bytes)} bytes")

        return audio_bytes

    finally:
        # Cleanup temp file
        try:
            os.unlink(ref_audio_path)
        except Exception:
            pass


# =============================================================================
# Job Management Web Endpoints
# =============================================================================
#
# These endpoints provide a job queue interface for long-running TTS generation.
# They are deployed as a separate lightweight app that doesn't need GPU resources.
#
# Architecture (based on Modal's recommended pattern):
#   1. Client POSTs to /submit-job → spawns GPU function, returns job_id
#   2. Client polls /job-status?job_id=xxx → checks if complete
#   3. Client GETs /job-result?job_id=xxx → retrieves audio
#   4. Client POSTs to /cancel-job → cancels running job
#
# Source: https://modal.com/docs/guide/job-queue
# Source: https://modal.com/docs/guide/webhook-timeouts
# =============================================================================

# App name constants for cross-app function lookup
VOICE_CLONE_APP_NAME = "qwen3-tts-voice-clone"
GENERATION_FUNCTION_NAME = "generate_voice_clone_job"

job_management_app = modal.App("qwen3-tts-job-management", image=image)


@job_management_app.function()
@modal.fastapi_endpoint(docs=True, method="POST")
def submit_job(request: dict) -> dict:
    """
    Submit a voice generation job for async processing.

    POST /submit-job

    This endpoint uses Modal's spawn/poll pattern for long-running tasks:
    1. Looks up the generation function from the deployed voice-clone app
    2. Calls spawn() which returns immediately with a FunctionCall
    3. Returns the job_id (FunctionCall.object_id) to the client

    The job runs asynchronously on GPU infrastructure. Results are
    accessible for up to 7 days after completion.

    Source: https://modal.com/docs/guide/job-queue

    Request body:
    {
        "text": "Text to synthesize",
        "language": "English",
        "ref_audio_base64": "base64-encoded reference audio",
        "ref_text": "Transcript of reference audio",
        "max_new_tokens": 2048
    }

    Returns:
    {
        "job_id": "fc-xxx",
        "status": "submitted",
        "text_length": 12345
    }
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

    # Look up the generation function from the voice-clone app
    # Using from_name() ensures explicit cross-app reference
    # Source: https://modal.com/docs/guide/trigger-deployed-functions
    generate_fn = modal.Function.from_name(
        VOICE_CLONE_APP_NAME,
        GENERATION_FUNCTION_NAME,
    )

    # Spawn the generation job (returns immediately)
    # Source: https://modal.com/docs/reference/modal.Function
    function_call = generate_fn.spawn(
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


@job_management_app.function()
@modal.fastapi_endpoint(docs=True, method="GET")
def job_status(job_id: str) -> dict:
    """
    Check the status of a submitted job.

    GET /job-status?job_id=fc-xxx

    Uses FunctionCall.from_id() to reconstruct the job reference, then
    attempts a non-blocking get(timeout=0) to check completion status.

    Note: Modal doesn't distinguish between "queued" and "running" states.
    Both are reported as "running" here.

    Source: https://modal.com/docs/reference/modal.FunctionCall

    Returns:
    {
        "job_id": "fc-xxx",
        "status": "running" | "completed" | "failed",
        "result_ready": bool,
        "error": "..." (only if failed)
    }
    """
    from fastapi import HTTPException

    if not job_id:
        raise HTTPException(status_code=400, detail="'job_id' is required")

    try:
        # Reconstruct the FunctionCall from the saved job_id
        # Source: https://modal.com/docs/reference/modal.FunctionCall
        function_call = modal.FunctionCall.from_id(job_id)

        # Non-blocking check: timeout=0 returns immediately
        # - Returns result if complete
        # - Raises TimeoutError if still processing
        try:
            function_call.get(timeout=0)
            return {
                "job_id": job_id,
                "status": "completed",
                "result_ready": True,
            }
        except TimeoutError:
            # Still processing (queued or running - Modal doesn't distinguish)
            return {
                "job_id": job_id,
                "status": "running",
                "result_ready": False,
            }
    except Exception as e:
        # Job might have failed, been cancelled, or doesn't exist
        return {
            "job_id": job_id,
            "status": "failed",
            "result_ready": False,
            "error": str(e),
        }


@job_management_app.function()
@modal.fastapi_endpoint(docs=True, method="GET")
def job_result(job_id: str) -> "Response":
    """
    Get the result of a completed job.

    GET /job-result?job_id=fc-xxx

    Retrieves the audio output from a completed generation job.
    Results are available for up to 7 days after job completion.

    Source: https://modal.com/docs/guide/job-queue

    Returns:
        - 200 + audio/wav: Job completed, returns audio bytes
        - 202 Accepted: Job still processing
        - 500 Error: Job failed or result expired
    """
    from fastapi import HTTPException
    from fastapi.responses import Response

    if not job_id:
        raise HTTPException(status_code=400, detail="'job_id' is required")

    try:
        function_call = modal.FunctionCall.from_id(job_id)

        # Wait up to 5 seconds for result (brief wait in case just finished)
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
            # Job still processing - client should continue polling
            raise HTTPException(status_code=202, detail="Job still processing")

    except HTTPException:
        raise
    except Exception as e:
        # Could be: job failed, was cancelled, or result expired (>7 days)
        raise HTTPException(status_code=500, detail=f"Failed to get result: {str(e)}")


@job_management_app.function()
@modal.fastapi_endpoint(docs=True, method="POST")
def cancel_job(request: dict) -> dict:
    """
    Cancel a running job.

    POST /cancel-job
    {
        "job_id": "fc-xxx"
    }

    Terminates the function execution and marks inputs as terminated.
    The cancel() method stops the job but doesn't forcibly kill containers
    unless terminate_containers=True is passed.

    Source: https://modal.com/docs/reference/modal.FunctionCall

    Returns:
    {
        "job_id": "fc-xxx",
        "status": "cancelled"
    }
    """
    from fastapi import HTTPException

    job_id = request.get("job_id")
    if not job_id:
        raise HTTPException(status_code=400, detail="'job_id' is required")

    try:
        function_call = modal.FunctionCall.from_id(job_id)
        # Cancel without forcibly terminating containers
        # (allows graceful cleanup)
        function_call.cancel()

        return {
            "job_id": job_id,
            "status": "cancelled",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel: {str(e)}")


# =============================================================================
# Local Entrypoint (for testing)
# =============================================================================


@app.local_entrypoint()
def main():
    """
    Test the service locally.

    Usage:
        modal run app.py
    """
    print("Testing Qwen3-TTS Service")
    print("=" * 60)

    # Reference audio from Qwen documentation
    # Source: Qwen3-TTS HuggingFace model card examples
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

    # Create service instance
    service = Qwen3TTSService()

    # Test model info
    print("\n1. Testing model info...")
    info = service.get_model_info.remote()
    print(f"   Model: {info['model_name']}")
    print(f"   Attention: {info['attention_implementation']}")
    print(f"   GPU: {info['gpu']}")

    # Test voice cloning
    print("\n2. Testing voice clone generation...")
    audio_bytes = service.generate_voice_clone.remote(
        text=test_text,
        language="English",
        ref_audio=ref_audio,
        ref_text=ref_text,
    )

    # Save output
    output_path = "test_output.wav"
    with open(output_path, "wb") as f:
        f.write(audio_bytes)

    print(f"   Saved: {output_path} ({len(audio_bytes)} bytes)")
    print("\nTest complete!")
