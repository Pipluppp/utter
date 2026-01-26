"""
Configuration constants for Qwen3-TTS Modal deployment.

Sources:
- Model IDs: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base
- Languages: Qwen3-TTS model card
"""

# =============================================================================
# Model Configuration
# =============================================================================

# Available models (from HuggingFace)
MODEL_1_7B = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
MODEL_0_6B = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"

# Select which model to deploy (change this to switch models)
DEFAULT_MODEL = MODEL_1_7B

# The tokenizer is shared across all models
TOKENIZER_ID = "Qwen/Qwen3-TTS-Tokenizer-12Hz"

# =============================================================================
# Modal Volume Configuration
# =============================================================================

# Volume mount path inside container
MODELS_DIR = "/vol/models"

# HuggingFace cache path (must be on the volume)
HF_HOME_PATH = "/vol/models/huggingface"

# =============================================================================
# Audio Configuration
# =============================================================================

# Default generation settings (from Qwen3-TTS generate_config.json)
DEFAULT_SAMPLE_RATE = 24000
MAX_NEW_TOKENS = 2048

# =============================================================================
# Supported Languages
# =============================================================================

# From Qwen3-TTS model card
SUPPORTED_LANGUAGES = [
    "Auto",      # Auto-detect language
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
# GPU Configuration
# =============================================================================

# GPU selection based on model size
# Source: Investigation report VRAM analysis
# - 0.6B needs ~2-3 GB VRAM
# - 1.7B needs ~5-6 GB VRAM
GPU_CONFIG = {
    "0.6B": "T4",      # 16GB VRAM - sufficient
    "1.7B": "A10G",    # 24GB VRAM - comfortable headroom
}

# =============================================================================
# Container Settings
# =============================================================================

# How long to keep container warm after last request
# Source: Modal Chatterbox example uses 300 (5 minutes)
CONTAINER_IDLE_TIMEOUT = 300

# Maximum concurrent requests per container
# Source: Modal Chatterbox example uses 10
MAX_CONCURRENT_INPUTS = 10

# Request timeout (for long text generation)
REQUEST_TIMEOUT = 300  # 5 minutes
