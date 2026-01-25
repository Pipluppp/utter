"""
TTS service using Modal.com for GPU inference.

This module connects to the deployed Echo-TTS model on Modal.com
for real voice cloning. Supports long text via chunking.
"""

import os
import uuid
import time
import logging
from pathlib import Path

import modal

from services.storage import get_reference_path
from services.text import preprocess_text, split_text_into_chunks
from services.audio_stitch import stitch_audio_files
from config import GENERATED_DIR


# Configure logger for performance tracking
logger = logging.getLogger("tts.perf")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)


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


async def generate_speech(voice_id: str, text: str, seed: int = None, return_chunks: bool = False) -> tuple[str, list[str]]:
    """
    Generate speech using Echo-TTS on Modal.com.
    
    Automatically handles long text by chunking and stitching.
    
    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech
        seed: Optional random seed (int)
        return_chunks: (Deprecated/Legacy flag) - we always return chunks now in tuple
        
    Returns:
        (final_audio_path, list_of_chunk_paths)
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
        
        if return_chunks:
            return str(mock_output), [str(mock_output)]
        return str(mock_output), [str(mock_output)]
    
    # Split text into chunks (handles short text too - returns single chunk)
    chunks = split_text_into_chunks(text)
    num_chunks = len(chunks)
    text_len = len(text)
    
    # Get Modal TTS instance
    EchoTTS = _get_modal_tts()
    tts = EchoTTS()
    
    logger.info(f"🎤 Starting generation: {text_len} chars, {num_chunks} chunk(s), seed={seed}")
    total_start = time.time()
    
    if len(chunks) == 1:
        # Short text: direct generation
        output_path = GENERATED_DIR / f"{generation_id}.mp3"
        
        chunk_start = time.time()
        audio_bytes = tts.generate.remote(
            text=chunks[0],
            reference_audio_bytes=reference_bytes,
            rng_seed=seed
        )
        chunk_elapsed = time.time() - chunk_start
        
        with open(output_path, "wb") as f:
            f.write(audio_bytes)
        
        total_elapsed = time.time() - total_start
        logger.info(f"✅ Generated in {total_elapsed:.2f}s ({len(audio_bytes)} bytes) | {text_len} chars")
        
        if return_chunks:
            return str(output_path), [str(output_path)]
        return str(output_path), [str(output_path)]
    
    # Long text: generate each chunk and stitch
    chunk_paths = []
    chunk_times = []
    
    for i, chunk_text in enumerate(chunks):
        chunk_start = time.time()
        chunk_id = f"{generation_id}_chunk{i}"
        
        # Note: If we had a way to determine seed per chunk, we'd use it here.
        # For now, if a Master Seed is provided, we might want to vary it per chunk
        # to avoid identical artifacts if text is similar, OR keep it consistent.
        # Let's derive a deterministic seed from the master seed for each chunk.
        chunk_seed = None
        if seed is not None:
             chunk_seed = seed + i
             
        # Call internal helper (we might need to inline _generate_single_chunk or update it too)
        # Actually _generate_single_chunk needs update. Let's inline it or update it.
        # Easier to just inline the call here since we changed the signature.
        
        c_output_path = GENERATED_DIR / f"{chunk_id}.mp3"
        c_audio_bytes = tts.generate.remote(
            text=chunk_text,
            reference_audio_bytes=reference_bytes,
            rng_seed=chunk_seed
        )
        with open(c_output_path, "wb") as f:
            f.write(c_audio_bytes)
        chunk_path = str(c_output_path)
        
        chunk_elapsed = time.time() - chunk_start
        chunk_times.append(chunk_elapsed)
        chunk_paths.append(chunk_path)
        logger.info(f"  Chunk {i+1}/{num_chunks}: {chunk_elapsed:.2f}s ({len(chunk_text)} chars)")
    
    if return_chunks:
        return chunk_paths
        
    # Stitch all chunks together
    final_output_path = str(GENERATED_DIR / f"{generation_id}.mp3")
    stitch_audio_files(chunk_paths, final_output_path)
    
    # Return both final path and chunk paths
    # Note: We are NOT deleting chunks here anymore if we want to return them.
    # But we should probably rely on a cleaner later? 
    # Or just return them and let them accumulate? 
    # For now, let's KEEP them so frontend can play them individually.
    
    total_elapsed = time.time() - total_start
    avg_chunk = sum(chunk_times) / len(chunk_times)
    logger.info(f"✅ Generated {num_chunks} chunks in {total_elapsed:.2f}s (avg {avg_chunk:.2f}s/chunk) | {text_len} chars")
    
    return final_output_path, chunk_paths

