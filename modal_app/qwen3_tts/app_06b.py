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
    timeout=900,  # 15 minutes - increased for long text generation
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
    def generate_voice_clone_batch(
        self,
        texts: list[str],
        languages: list[str],
        ref_audio: str,
        ref_text: str,
        max_new_tokens: int = 2048,
    ) -> list[bytes]:
        """Generate multiple voice clones in a batch."""
        import soundfile as sf

        print(f"Batch generation: {len(texts)} items")

        resolved_ref_audio = self._resolve_ref_audio(ref_audio)
        temp_file_created = resolved_ref_audio != ref_audio

        try:
            voice_prompt = self.model.create_voice_clone_prompt(
                ref_audio=resolved_ref_audio,
                ref_text=ref_text,
                x_vector_only_mode=False,
            )

            wavs, sr = self.model.generate_voice_clone(
                text=texts,
                language=languages,
                voice_clone_prompt=voice_prompt,
                max_new_tokens=max_new_tokens,
            )

            results = []
            for i, wav in enumerate(wavs):
                buffer = io.BytesIO()
                sf.write(buffer, wav, sr, format="WAV", subtype="PCM_16")
                buffer.seek(0)
                results.append(buffer.read())
                print(f"  [{i+1}/{len(texts)}] {len(results[-1])} bytes")

            return results
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

    @modal.fastapi_endpoint(docs=True, method="POST")
    def clone_batch(self, request: dict) -> dict:
        """Clone a voice and synthesize multiple texts. Returns JSON with base64 audio."""
        import base64
        from fastapi import HTTPException

        texts = request.get("texts", [])
        languages = request.get("languages", [])
        ref_audio_url = request.get("ref_audio_url")
        ref_audio_base64 = request.get("ref_audio_base64")
        ref_text = request.get("ref_text", "")
        max_new_tokens = request.get("max_new_tokens", 2048)

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
        """Health check endpoint."""
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
        """Get supported languages."""
        return {
            "languages": SUPPORTED_LANGUAGES,
            "default": "Auto",
            "note": "Use 'Auto' for automatic language detection",
        }


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
