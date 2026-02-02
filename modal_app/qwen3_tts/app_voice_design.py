"""
Qwen3-TTS VoiceDesign API on Modal.com (1.7B Model)

Creates new voices from natural language descriptions.
No reference audio needed - describe the voice you want in text.

The generated preview can then be used as a reference for the 0.6B-Base
model to produce long-form content.

Sources:
- Modal Chatterbox example: https://modal.com/docs/examples/chatterbox_tts
- Qwen3-TTS GitHub: https://github.com/QwenLM/Qwen3-TTS
- Qwen3-TTS HuggingFace: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign
"""

import io
import os

import modal

# =============================================================================
# Configuration
# =============================================================================

# Model selection - 1.7B VoiceDesign variant (only size available)
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
MODEL_NAME = MODEL_ID.split("/")[-1]  # "Qwen3-TTS-12Hz-1.7B-VoiceDesign"

# Volume configuration
MODELS_DIR = "/vol/models"
HF_CACHE_DIR = f"{MODELS_DIR}/huggingface"

# GPU selection - A10G for 1.7B model
GPU_TYPE = "A10G"

# Container settings
CONTAINER_IDLE_TIMEOUT = 300  # 5 minutes
MAX_CONCURRENT_INPUTS = 10

# Supported languages (same as Base models)
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

# Input limits for voice design (previews only)
MAX_TEXT_LENGTH = 500
MAX_INSTRUCT_LENGTH = 500

# =============================================================================
# Image Definition
# =============================================================================


def create_image() -> modal.Image:
    """
    Build Modal container image for Qwen3-TTS VoiceDesign.

    Same dependencies as the Base model deployments.
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

app = modal.App("qwen3-tts-voice-design", image=image)

models_volume = modal.Volume.from_name("qwen3-tts-models", create_if_missing=True)

# =============================================================================
# Service Class
# =============================================================================


@app.cls(
    gpu=GPU_TYPE,
    scaledown_window=CONTAINER_IDLE_TIMEOUT,
    volumes={MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=300,  # 5 minutes - shorter than Base model (previews only)
)
@modal.concurrent(max_inputs=MAX_CONCURRENT_INPUTS)
class VoiceDesignService:
    """
    Voice design service using Qwen3-TTS 1.7B-VoiceDesign model.

    Creates new voices from natural language descriptions.
    No reference audio needed.
    """

    @modal.enter()
    def load_model(self):
        """Load model when container starts."""
        import torch
        from qwen_tts import Qwen3TTSModel

        print("=" * 60)
        print(f"Loading Qwen3-TTS VoiceDesign Model: {MODEL_NAME}")
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

    @modal.method()
    def generate_voice_design(
        self,
        text: str,
        language: str,
        instruct: str,
    ) -> bytes:
        """
        Generate speech with a designed voice from text description.

        Args:
            text: The text to speak in the preview
            language: Target language (e.g., "English", "Chinese")
            instruct: Natural language description of the desired voice
                      (e.g., "A warm, friendly female voice with slight vocal fry")

        Returns:
            WAV audio bytes of the generated preview
        """
        import soundfile as sf

        print(f"Generating voice design:")
        print(f"  Text: '{text[:50]}{'...' if len(text) > 50 else ''}'")
        print(f"  Language: {language}")
        print(f"  Instruct: '{instruct[:80]}{'...' if len(instruct) > 80 else ''}'")

        wavs, sr = self.model.generate_voice_design(
            text=text,
            language=language,
            instruct=instruct,
        )

        print(f"  Generated: {len(wavs[0])} samples at {sr} Hz")

        buffer = io.BytesIO()
        sf.write(buffer, wavs[0], sr, format="WAV", subtype="PCM_16")
        buffer.seek(0)

        audio_bytes = buffer.read()
        print(f"  Output size: {len(audio_bytes)} bytes")

        return audio_bytes

    @modal.method()
    def get_model_info(self) -> dict:
        """Get information about the loaded model."""
        import torch

        return {
            "model_id": MODEL_ID,
            "model_name": MODEL_NAME,
            "model_type": "VoiceDesign",
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
            "max_text_length": MAX_TEXT_LENGTH,
            "max_instruct_length": MAX_INSTRUCT_LENGTH,
        }

    # =========================================================================
    # FastAPI Endpoints
    # =========================================================================

    @modal.fastapi_endpoint(docs=True, method="POST")
    def design(self, request: dict) -> "StreamingResponse":
        """
        Design a voice from a natural language description.

        Request body:
        {
            "text": "Hello, this is a preview of the designed voice.",
            "language": "English",
            "instruct": "A warm, friendly female voice with slight vocal fry"
        }

        Returns: audio/wav binary stream
        """
        from fastapi import HTTPException
        from fastapi.responses import StreamingResponse

        text = request.get("text", "")
        language = request.get("language", "English")
        instruct = request.get("instruct", "")

        # Validate text
        if not text:
            raise HTTPException(status_code=400, detail="'text' is required")
        if len(text) > MAX_TEXT_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"'text' exceeds maximum length of {MAX_TEXT_LENGTH} characters",
            )

        # Validate instruct
        if not instruct:
            raise HTTPException(
                status_code=400,
                detail="'instruct' is required (voice description)",
            )
        if len(instruct) > MAX_INSTRUCT_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"'instruct' exceeds maximum length of {MAX_INSTRUCT_LENGTH} characters",
            )

        # Validate language
        if language not in SUPPORTED_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language: {language}. "
                f"Supported: {', '.join(SUPPORTED_LANGUAGES)}",
            )

        try:
            audio_bytes = self.generate_voice_design.local(
                text=text,
                language=language,
                instruct=instruct,
            )
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Voice design failed: {str(e)}"
            )

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=designed_voice.wav",
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
            "model_type": info["model_type"],
            "gpu": info["gpu"],
            "attention_implementation": info["attention_implementation"],
            "supported_languages": info["supported_languages"],
        }

# =============================================================================
# Local Entrypoint (for testing)
# =============================================================================


@app.local_entrypoint()
def main():
    """
    Test the VoiceDesign service locally.

    Usage:
        modal run app_voice_design.py
    """
    print("Testing Qwen3-TTS VoiceDesign Service")
    print("=" * 60)

    # Test voice descriptions
    test_cases = [
        {
            "text": "Hello! Welcome to the voice design system. I hope you find this useful.",
            "language": "English",
            "instruct": "A warm, friendly female voice with a gentle, reassuring tone.",
        },
        {
            "text": "Breaking news: Scientists have made a remarkable discovery.",
            "language": "English",
            "instruct": "A deep, authoritative male voice like a news anchor.",
        },
    ]

    service = VoiceDesignService()

    print("\n1. Testing model info...")
    info = service.get_model_info.remote()
    print(f"   Model: {info['model_name']}")
    print(f"   Type: {info['model_type']}")
    print(f"   Attention: {info['attention_implementation']}")
    print(f"   GPU: {info['gpu']}")

    for i, test in enumerate(test_cases, 1):
        print(f"\n{i+1}. Testing voice design: {test['instruct'][:50]}...")
        audio_bytes = service.generate_voice_design.remote(
            text=test["text"],
            language=test["language"],
            instruct=test["instruct"],
        )

        output_path = f"test_voice_design_{i}.wav"
        with open(output_path, "wb") as f:
            f.write(audio_bytes)

        print(f"   Saved: {output_path} ({len(audio_bytes)} bytes)")

    print("\nTest complete!")
