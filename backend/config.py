"""Application configuration from environment variables."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Environment
ENV = os.getenv("ENV", "development")
IS_PRODUCTION = ENV == "production"

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./utter.db")

# Uploads
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
REFERENCES_DIR = UPLOAD_DIR / "references"
GENERATED_DIR = UPLOAD_DIR / "generated"

# Create directories if they don't exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
REFERENCES_DIR.mkdir(parents=True, exist_ok=True)
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

# Validation limits
MAX_FILE_SIZE_MB = 50
MIN_AUDIO_DURATION_SECONDS = 10
MAX_AUDIO_DURATION_SECONDS = 300  # 5 minutes
MAX_TEXT_LENGTH = 5000
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a"}

# TTS Provider
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "echo")
QWEN_MODAL_ENDPOINT = os.getenv("QWEN_MODAL_ENDPOINT", "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run")
QWEN_MODAL_ENDPOINT_1_7B = os.getenv("QWEN_MODAL_ENDPOINT_1_7B", "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run")
QWEN_MODAL_ENDPOINT_0_6B = os.getenv("QWEN_MODAL_ENDPOINT_0_6B", "https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run")

# Supported languages (Qwen3-TTS)
SUPPORTED_LANGUAGES = [
    "Auto", "Chinese", "English", "Japanese", "Korean",
    "German", "French", "Russian", "Portuguese", "Spanish", "Italian"
]
