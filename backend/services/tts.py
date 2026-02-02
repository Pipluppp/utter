"""
TTS service using Qwen3-TTS.

Generates speech from text using cloned voices via Qwen3-TTS on Modal.com.

Supports two modes:
1. Direct generation: For shorter texts (< 4000 chars), uses synchronous API
2. Job-based generation: For longer texts, uses async job submission with polling
"""

import os
import uuid
import shutil
from typing import Optional, Callable

from services.storage import get_reference_path
from config import GENERATED_DIR, LONG_TASK_THRESHOLD_CHARS


# Flag to use mock mode (for local development without Modal)
USE_MOCK = os.getenv("TTS_MOCK", "false").lower() == "true"


def is_long_text(text: str) -> bool:
    """Check if text should use job-based generation."""
    return len(text) >= LONG_TASK_THRESHOLD_CHARS


async def generate_speech(
    voice_id: str,
    text: str,
    ref_text: str | None = None,
    language: str = "Auto",
    model: str = "0.6B",
    request_id: Optional[str] = None,
) -> str:
    """
    Generate speech using Qwen3-TTS (direct mode for shorter texts).

    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech
        ref_text: Transcript of reference audio (required)
        language: Language code (e.g. "Auto", "English", "Chinese")
        model: Model size ("0.6B" default, "1.7B" available but stopped)
        request_id: Optional ID for tracking Modal request status

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
    return await generate_speech_qwen(
        voice_id, text, ref_text, language, model, request_id=request_id
    )


async def generate_speech_job(
    voice_id: str,
    text: str,
    ref_text: str,
    language: str = "Auto",
    task_id: Optional[str] = None,
    cancellation_checker: Optional[Callable[[str], bool]] = None,
) -> tuple[str, str]:
    """
    Generate speech using job-based approach for long texts.

    Submits a job to Modal, polls until completion, and saves the result.

    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech
        ref_text: Transcript of reference audio
        language: Language code
        task_id: Backend task ID for status updates and cancellation
        cancellation_checker: Callback to check if cancellation requested

    Returns:
        Tuple of (output_path, job_id)
    """
    if USE_MOCK:
        reference_path = get_reference_path(voice_id)
        if reference_path is None:
            raise ValueError(f"Voice reference not found: {voice_id}")
        generation_id = str(uuid.uuid4())
        mock_output = GENERATED_DIR / f"{generation_id}.wav"
        shutil.copy2(reference_path, mock_output)
        return str(mock_output), "mock-job-id"

    from services.tts_qwen import (
        submit_generation_job,
        poll_job_until_complete,
        estimate_generation_time,
    )

    if not ref_text:
        raise ValueError("Reference transcript is required for Qwen3-TTS")

    # Submit job
    job_result = await submit_generation_job(
        voice_id=voice_id,
        text=text,
        ref_text=ref_text,
        language=language,
    )

    job_id = job_result["job_id"]
    generation_id = str(uuid.uuid4())

    # Estimate max duration (add 50% buffer)
    estimated_minutes = estimate_generation_time(text)
    max_duration = max(estimated_minutes * 1.5 * 60, 1800)  # At least 30 min

    # Poll until complete
    output_path = await poll_job_until_complete(
        job_id=job_id,
        generation_id=generation_id,
        task_id=task_id or "unknown",
        poll_interval=5.0,
        max_duration_seconds=max_duration,
        cancellation_checker=cancellation_checker,
    )

    return output_path, job_id
