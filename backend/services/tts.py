"""
TTS service using Modal.com for GPU inference.

This module connects to the deployed Echo-TTS model on Modal.com
for real voice cloning.
"""

import os
import uuid
from pathlib import Path

import modal

from services.storage import get_reference_path
from services.text import preprocess_text
from config import GENERATED_DIR


# Flag to use mock mode (for local development without Modal)
USE_MOCK = os.getenv("TTS_MOCK", "false").lower() == "true"


def _get_modal_tts():
    """Get reference to Modal TTS class (lazy load)."""
    return modal.Cls.from_name("utter-tts", "EchoTTS")


async def generate_speech(voice_id: str, text: str) -> str:
    """
    Generate speech using Echo-TTS on Modal.com
    
    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech
        
    Returns:
        Path to the generated audio file (MP3)
    """
    # Get reference audio
    reference_path = get_reference_path(voice_id)
    if reference_path is None:
        raise ValueError(f"Voice reference not found: {voice_id}")
    
    # Read reference audio bytes
    with open(reference_path, "rb") as f:
        reference_bytes = f.read()
    
    # Generate unique ID for this generation
    generation_id = str(uuid.uuid4())
    output_path = GENERATED_DIR / f"{generation_id}.mp3"
    
    if USE_MOCK:
        # Mock mode: copy reference as output (for testing without Modal)
        import shutil
        # For mock, keep as original format
        mock_output = GENERATED_DIR / f"{generation_id}.wav"
        shutil.copy2(reference_path, mock_output)
        return str(mock_output)
    else:
        # Preprocess text for Echo-TTS
        processed_text = preprocess_text(text)
        
        # Call Modal GPU endpoint
        EchoTTS = _get_modal_tts()
        tts = EchoTTS()
        audio_bytes = tts.generate.remote(
            text=processed_text,
            reference_audio_bytes=reference_bytes
        )
        
        # Save to generated directory (now MP3)
        with open(output_path, "wb") as f:
            f.write(audio_bytes)
    
    return str(output_path)

