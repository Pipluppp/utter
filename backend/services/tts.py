"""
TTS service router.

Dispatches to the configured TTS provider (Echo-TTS or Qwen3-TTS).
"""

import os
import uuid
import time
import logging
from pathlib import Path

from services.storage import get_reference_path
from config import GENERATED_DIR, TTS_PROVIDER


# Configure logger for performance tracking
logger = logging.getLogger("tts.perf")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s | %(levelname)s | %(message)s", datefmt="%H:%M:%S"
        )
    )
    logger.addHandler(handler)


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
    Generate speech using the configured TTS provider.

    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech
        ref_text: Transcript of reference audio (required for Qwen)
        language: Language code (used by Qwen, ignored by Echo)
        model: Model size ("0.6B" default, "1.7B" available but stopped)

    Returns:
        Path to the generated audio file
    """
    if USE_MOCK:
        import shutil

        reference_path = get_reference_path(voice_id)
        if reference_path is None:
            raise ValueError(f"Voice reference not found: {voice_id}")
        generation_id = str(uuid.uuid4())
        mock_output = GENERATED_DIR / f"{generation_id}.wav"
        shutil.copy2(reference_path, mock_output)
        return str(mock_output)

    if TTS_PROVIDER == "qwen":
        from services.tts_qwen import generate_speech_qwen

        if not ref_text:
            raise ValueError("Reference transcript is required for Qwen3-TTS")
        return await generate_speech_qwen(voice_id, text, ref_text, language, model)

    # Default: Echo-TTS
    return await _generate_speech_echo(voice_id, text)


async def _generate_speech_echo(voice_id: str, text: str) -> str:
    """
    Generate speech using Echo-TTS on Modal.com.

    Supports long text via chunking and stitching.
    """
    import modal
    from services.text import preprocess_text, split_text_into_chunks
    from services.audio_stitch import stitch_audio_files

    reference_path = get_reference_path(voice_id)
    if reference_path is None:
        raise ValueError(f"Voice reference not found: {voice_id}")

    with open(reference_path, "rb") as f:
        reference_bytes = f.read()

    generation_id = str(uuid.uuid4())

    chunks = split_text_into_chunks(text)
    num_chunks = len(chunks)
    text_len = len(text)

    EchoTTS = modal.Cls.from_name("utter-tts", "EchoTTS")
    tts = EchoTTS()

    logger.info(f"Starting Echo generation: {text_len} chars, {num_chunks} chunk(s)")
    total_start = time.time()

    if len(chunks) == 1:
        output_path = GENERATED_DIR / f"{generation_id}.mp3"

        chunk_start = time.time()
        audio_bytes = tts.generate.remote(
            text=chunks[0], reference_audio_bytes=reference_bytes
        )
        chunk_elapsed = time.time() - chunk_start

        with open(output_path, "wb") as f:
            f.write(audio_bytes)

        total_elapsed = time.time() - total_start
        logger.info(
            f"Generated in {total_elapsed:.2f}s ({len(audio_bytes)} bytes) | {text_len} chars"
        )
        return str(output_path)

    # Long text: generate each chunk and stitch
    chunk_paths = []
    chunk_times = []

    for i, chunk_text in enumerate(chunks):
        chunk_start = time.time()
        chunk_id = f"{generation_id}_chunk{i}"
        chunk_output = GENERATED_DIR / f"{chunk_id}.mp3"

        audio_bytes = tts.generate.remote(
            text=chunk_text, reference_audio_bytes=reference_bytes
        )

        with open(chunk_output, "wb") as f:
            f.write(audio_bytes)

        chunk_elapsed = time.time() - chunk_start
        chunk_times.append(chunk_elapsed)
        chunk_paths.append(str(chunk_output))
        logger.info(
            f"  Chunk {i+1}/{num_chunks}: {chunk_elapsed:.2f}s ({len(chunk_text)} chars)"
        )

    # Stitch all chunks together
    final_output_path = str(GENERATED_DIR / f"{generation_id}.mp3")
    stitch_audio_files(chunk_paths, final_output_path)

    # Cleanup individual chunk files
    for path in chunk_paths:
        try:
            os.unlink(path)
        except OSError:
            pass

    total_elapsed = time.time() - total_start
    avg_chunk = sum(chunk_times) / len(chunk_times)
    logger.info(
        f"Generated {num_chunks} chunks in {total_elapsed:.2f}s (avg {avg_chunk:.2f}s/chunk) | {text_len} chars"
    )

    return final_output_path
