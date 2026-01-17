"""
Mock TTS service for local development.

This module provides a mock implementation that copies the reference audio
as the "generated" output. For real TTS, you would integrate Modal.com here.
"""

import uuid
from pathlib import Path

from services.storage import get_reference_path, copy_file
from config import GENERATED_DIR


async def generate_speech(voice_id: str, text: str) -> str:
    """
    Generate speech from text using a cloned voice.
    
    MOCK IMPLEMENTATION: Returns the reference audio as the output.
    For real TTS, this would call Modal.com with Echo-TTS.
    
    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech (unused in mock)
        
    Returns:
        Path to the generated audio file
    """
    # Get the reference audio for this voice
    reference_path = get_reference_path(voice_id)
    
    if reference_path is None:
        raise ValueError(f"Voice reference not found: {voice_id}")
    
    # Generate unique ID for this generation
    generation_id = str(uuid.uuid4())
    
    # Mock: Copy reference audio as the "generated" output
    # In production, this would call Modal.com with Echo-TTS
    output_ext = reference_path.suffix
    output_path = GENERATED_DIR / f"{generation_id}{output_ext}"
    
    copy_file(reference_path, output_path)
    
    return str(output_path)
