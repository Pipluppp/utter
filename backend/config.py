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
MIN_AUDIO_DURATION_SECONDS = 3
MAX_AUDIO_DURATION_SECONDS = 300  # 5 minutes
MAX_TEXT_LENGTH = 50000  # Allow much longer texts for long generations
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a"}

# Long-running task settings
LONG_TASK_THRESHOLD_CHARS = 4000  # Use job-based generation above this
TASK_TTL_SECONDS = 3600  # 1 hour (for long generations)
TASK_CLEANUP_INTERVAL = 600  # 10 minutes

# TTS Provider
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "qwen")
QWEN_MODAL_ENDPOINT = os.getenv(
    "QWEN_MODAL_ENDPOINT",
    "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run",
)
QWEN_MODAL_ENDPOINT_1_7B = os.getenv(
    "QWEN_MODAL_ENDPOINT_1_7B",
    "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run",
)
QWEN_MODAL_ENDPOINT_0_6B = os.getenv(
    "QWEN_MODAL_ENDPOINT_0_6B",
    "https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run",
)
QWEN_MODAL_ENDPOINT_VOICE_DESIGN = os.getenv(
    "QWEN_MODAL_ENDPOINT_VOICE_DESIGN",
    "https://duncab013--qwen3-tts-voice-design-voicedesignservice-design.modal.run",
)

# Modal Job Management Endpoints (for long-running tasks)
# These are now part of the voice-clone-06b app to save endpoint slots
QWEN_MODAL_JOB_SUBMIT = os.getenv(
    "QWEN_MODAL_JOB_SUBMIT",
    "https://duncab013--qwen3-tts-voice-clone-06b-submit-job.modal.run",
)
QWEN_MODAL_JOB_STATUS = os.getenv(
    "QWEN_MODAL_JOB_STATUS",
    "https://duncab013--qwen3-tts-voice-clone-06b-job-status.modal.run",
)
QWEN_MODAL_JOB_RESULT = os.getenv(
    "QWEN_MODAL_JOB_RESULT",
    "https://duncab013--qwen3-tts-voice-clone-06b-job-result.modal.run",
)
# Note: cancel_job removed to save endpoint slots (was nice-to-have)
QWEN_MODAL_JOB_CANCEL = os.getenv(
    "QWEN_MODAL_JOB_CANCEL",
    "",  # Disabled - not deployed to save endpoint slots
)

# Supported languages (Qwen3-TTS)
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
