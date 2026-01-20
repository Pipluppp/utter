"""
TTS service using Modal.com for GPU inference.

This module connects to the deployed Echo-TTS model on Modal.com
for real voice cloning. Supports long text via chunking.
"""

import os
import uuid
from pathlib import Path

import modal

from services.storage import get_reference_path
from services.text import preprocess_text, split_text_into_chunks
from services.audio_stitch import stitch_audio_files
from config import GENERATED_DIR


# Flag to use mock mode (for local development without Modal)
USE_MOCK = os.getenv("TTS_MOCK", "false").lower() == "true"


def _get_modal_tts():
    """Get reference to Modal TTS class (lazy load)."""
    return modal.Cls.from_name("utter-tts", "EchoTTS")


async def _generate_single_chunk(
    tts_instance,
    text: str,
    reference_bytes: bytes,
    chunk_id: str
) -> str:
    """
    Generate a single chunk of audio.
    
    Args:
        tts_instance: Modal TTS instance
        text: Preprocessed text chunk
        reference_bytes: Reference audio bytes
        chunk_id: Unique ID for this chunk
        
    Returns:
        Path to the generated chunk MP3 file
    """
    output_path = GENERATED_DIR / f"{chunk_id}.mp3"
    
    audio_bytes = tts_instance.generate.remote(
        text=text,
        reference_audio_bytes=reference_bytes
    )
    
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    
    return str(output_path)


async def generate_speech(voice_id: str, text: str) -> str:
    """
    Generate speech using Echo-TTS on Modal.com.
    
    Automatically handles long text by chunking and stitching.
    
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
    
    if USE_MOCK:
        # Mock mode: copy reference as output (for testing without Modal)
        import shutil
        mock_output = GENERATED_DIR / f"{generation_id}.wav"
        shutil.copy2(reference_path, mock_output)
        return str(mock_output)
    
    # Split text into chunks (handles short text too - returns single chunk)
    chunks = split_text_into_chunks(text)
    
    # Get Modal TTS instance
    EchoTTS = _get_modal_tts()
    tts = EchoTTS()
    
    if len(chunks) == 1:
        # Short text: direct generation
        output_path = GENERATED_DIR / f"{generation_id}.mp3"
        audio_bytes = tts.generate.remote(
            text=chunks[0],
            reference_audio_bytes=reference_bytes
        )
        with open(output_path, "wb") as f:
            f.write(audio_bytes)
        return str(output_path)
    
    # Long text: generate each chunk and stitch
    chunk_paths = []
    
    for i, chunk_text in enumerate(chunks):
        chunk_id = f"{generation_id}_chunk{i}"
        chunk_path = await _generate_single_chunk(
            tts_instance=tts,
            text=chunk_text,
            reference_bytes=reference_bytes,
            chunk_id=chunk_id
        )
        chunk_paths.append(chunk_path)
    
    # Stitch all chunks together
    final_output_path = str(GENERATED_DIR / f"{generation_id}.mp3")
    stitch_audio_files(chunk_paths, final_output_path)
    
    # Cleanup individual chunk files
    for path in chunk_paths:
        try:
            os.unlink(path)
        except OSError:
            pass  # Ignore cleanup errors
    
    return final_output_path

