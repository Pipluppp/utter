"""
TTS service using Qwen3-TTS.

Generates speech from text using cloned voices via Qwen3-TTS on Modal.com.
"""

import os
import uuid
import shutil

from services.storage import get_reference_path
from config import GENERATED_DIR


# Flag to use mock mode (for local development without Modal)
USE_MOCK = os.getenv("TTS_MOCK", "false").lower() == "true"


async def generate_speech(
    voice_id: str,
    text: str,
    ref_text: str | None = None,
    language: str = "Auto",
    model: str = "0.6B",
) -> str:
    """
    Generate speech using Qwen3-TTS.

    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech
        ref_text: Transcript of reference audio (required)
        language: Language code (e.g. "Auto", "English", "Chinese")
        model: Model size ("0.6B" default, "1.7B" available but stopped)

    Returns:
        Path to the generated audio file
    """
    if USE_MOCK:
        reference_path = get_reference_path(voice_id)
        if reference_path is None:
            raise ValueError(f"Voice reference not found: {voice_id}")
        generation_id = str(uuid.uuid4())
        mock_output = GENERATED_DIR / f"{generation_id}.wav"
        shutil.copy2(reference_path, mock_output)
        return str(mock_output)

    from services.tts_qwen import generate_speech_qwen

    if not ref_text:
        raise ValueError("Reference transcript is required for Qwen3-TTS")
    return await generate_speech_qwen(voice_id, text, ref_text, language, model)
