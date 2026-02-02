"""
TTS service using Qwen3-TTS on Modal.com.

Calls the deployed Qwen3-TTS voice cloning endpoint.
No chunking needed — Qwen3-TTS handles long text natively.

Robust HTTP handling:
- Follows redirects (Modal returns 303 after 150s timeout)
- Polls result URLs with exponential backoff
- Comprehensive status tracking and logging
"""

import asyncio
import base64
import logging
import time
import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Callable

import httpx

from services.storage import get_reference_path
from config import (
    GENERATED_DIR,
    REFERENCES_DIR,
    QWEN_MODAL_ENDPOINT,
    QWEN_MODAL_ENDPOINT_1_7B,
    QWEN_MODAL_ENDPOINT_0_6B,
    QWEN_MODAL_ENDPOINT_VOICE_DESIGN,
    QWEN_MODAL_JOB_SUBMIT,
    QWEN_MODAL_JOB_STATUS,
    QWEN_MODAL_JOB_RESULT,
    QWEN_MODAL_JOB_CANCEL,
    LONG_TASK_THRESHOLD_CHARS,
)

logger = logging.getLogger("tts.qwen")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s | %(levelname)s | %(message)s", datefmt="%H:%M:%S"
        )
    )
    logger.addHandler(handler)


# =============================================================================
# Modal API Status Tracking
# =============================================================================


class ModalRequestStatus(str, Enum):
    """Status of a Modal API request."""

    SENDING = "sending"  # Request being sent
    QUEUED = "queued"  # Modal received, waiting for container
    PROCESSING = "processing"  # Container is processing
    POLLING = "polling"  # Polling for result (after 303 redirect)
    COMPLETED = "completed"  # Successfully completed
    FAILED = "failed"  # Failed with error
    TIMEOUT = "timeout"  # Timed out waiting


@dataclass
class ModalRequestState:
    """Tracks the state of a Modal API request."""

    status: ModalRequestStatus
    start_time: float
    endpoint: str
    text_length: int
    elapsed_seconds: float = 0.0
    poll_count: int = 0
    redirect_url: Optional[str] = None
    error: Optional[str] = None

    def update(self, status: ModalRequestStatus, **kwargs):
        self.status = status
        self.elapsed_seconds = time.time() - self.start_time
        for key, value in kwargs.items():
            setattr(self, key, value)


# Global callback for status updates (can be set by main.py)
_status_callback: Optional[Callable[[str, ModalRequestState], None]] = None


def set_status_callback(callback: Callable[[str, ModalRequestState], None]):
    """Set a callback to receive status updates for requests."""
    global _status_callback
    _status_callback = callback


def _notify_status(request_id: str, state: ModalRequestState):
    """Notify callback of status change."""
    if _status_callback:
        try:
            _status_callback(request_id, state)
        except Exception as e:
            logger.warning(f"Status callback error: {e}")


# =============================================================================
# Robust HTTP Client with Polling
# =============================================================================


async def _make_modal_request(
    endpoint: str,
    payload: dict,
    request_id: str,
    timeout_seconds: float = 1200.0,  # 20 minute total timeout (for texts < 4000 chars)
    poll_interval_base: float = 5.0,  # Start polling every 5 seconds
    poll_interval_max: float = 10.0,  # Max 10 seconds between polls
) -> bytes:
    """
    Make a request to Modal with robust redirect/polling handling.

    Modal's HTTP behavior:
    - Returns response directly if completes within 150 seconds
    - Returns 303 redirect to result URL if exceeds 150 seconds
    - Result URL can be polled until completion

    Args:
        endpoint: Modal endpoint URL
        payload: JSON payload to send
        request_id: Unique ID for tracking
        timeout_seconds: Total timeout for the entire operation
        poll_interval_base: Initial polling interval
        poll_interval_max: Maximum polling interval

    Returns:
        Response bytes (audio data)

    Raises:
        ValueError: If request fails or times out
    """
    state = ModalRequestState(
        status=ModalRequestStatus.SENDING,
        start_time=time.time(),
        endpoint=endpoint,
        text_length=len(payload.get("text", "")),
    )
    _notify_status(request_id, state)

    # Configure client with explicit redirect handling
    # We handle redirects manually for better tracking
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(
            connect=30.0,  # Connection timeout
            read=160.0,  # Read timeout (slightly > Modal's 150s)
            write=30.0,  # Write timeout
            pool=30.0,  # Pool timeout
        ),
        follow_redirects=False,  # We handle redirects manually
    ) as client:

        try:
            # Initial POST request
            logger.info(f"[{request_id[:8]}] Sending request to Modal...")
            state.update(ModalRequestStatus.QUEUED)
            _notify_status(request_id, state)

            response = await client.post(endpoint, json=payload)

            # Check for redirect (Modal's long-running request pattern)
            if response.status_code == 303:
                redirect_url = response.headers.get("location")
                if not redirect_url:
                    raise ValueError("Received 303 redirect but no Location header")

                # Make absolute URL if relative
                if redirect_url.startswith("/"):
                    # Extract base URL from endpoint
                    from urllib.parse import urlparse

                    parsed = urlparse(endpoint)
                    redirect_url = f"{parsed.scheme}://{parsed.netloc}{redirect_url}"

                logger.info(
                    f"[{request_id[:8]}] Modal returned 303 - polling for result..."
                )
                state.update(ModalRequestStatus.POLLING, redirect_url=redirect_url)
                _notify_status(request_id, state)

                # Poll the result URL
                return await _poll_result(
                    client=client,
                    result_url=redirect_url,
                    request_id=request_id,
                    state=state,
                    timeout_seconds=timeout_seconds,
                    poll_interval_base=poll_interval_base,
                    poll_interval_max=poll_interval_max,
                )

            # Direct response (completed within 150s)
            if response.status_code == 200:
                state.update(ModalRequestStatus.COMPLETED)
                _notify_status(request_id, state)
                logger.info(
                    f"[{request_id[:8]}] Completed in {state.elapsed_seconds:.1f}s "
                    f"({len(response.content)} bytes)"
                )
                return response.content

            # Error response
            detail = response.text[:500] if response.text else "No error details"
            state.update(ModalRequestStatus.FAILED, error=detail)
            _notify_status(request_id, state)
            raise ValueError(f"Modal request failed ({response.status_code}): {detail}")

        except httpx.TimeoutException as e:
            state.update(ModalRequestStatus.TIMEOUT, error=str(e))
            _notify_status(request_id, state)
            raise ValueError(
                f"Request timed out after {state.elapsed_seconds:.1f}s: {e}"
            )

        except httpx.RequestError as e:
            state.update(ModalRequestStatus.FAILED, error=str(e))
            _notify_status(request_id, state)
            raise ValueError(f"Network error: {e}")


async def _poll_result(
    client: httpx.AsyncClient,
    result_url: str,
    request_id: str,
    state: ModalRequestState,
    timeout_seconds: float,
    poll_interval_base: float,
    poll_interval_max: float,
) -> bytes:
    """
    Poll Modal's result URL until completion.

    Uses exponential backoff for polling interval.
    """
    poll_interval = poll_interval_base

    while True:
        state.poll_count += 1
        elapsed = time.time() - state.start_time

        if elapsed > timeout_seconds:
            state.update(ModalRequestStatus.TIMEOUT, error="Total timeout exceeded")
            _notify_status(request_id, state)
            raise ValueError(
                f"Request timed out after {elapsed:.1f}s ({state.poll_count} polls)"
            )

        logger.info(
            f"[{request_id[:8]}] Polling... ({state.poll_count}, {elapsed:.1f}s elapsed)"
        )

        try:
            response = await client.get(result_url)

            # Still processing - Modal returns 303 to same URL
            if response.status_code == 303:
                state.update(ModalRequestStatus.PROCESSING)
                _notify_status(request_id, state)
                await asyncio.sleep(poll_interval)
                poll_interval = min(poll_interval * 1.5, poll_interval_max)
                continue

            # 202 Accepted - still processing
            if response.status_code == 202:
                state.update(ModalRequestStatus.PROCESSING)
                _notify_status(request_id, state)
                await asyncio.sleep(poll_interval)
                poll_interval = min(poll_interval * 1.5, poll_interval_max)
                continue

            # Success!
            if response.status_code == 200:
                state.update(ModalRequestStatus.COMPLETED)
                _notify_status(request_id, state)
                logger.info(
                    f"[{request_id[:8]}] Completed in {state.elapsed_seconds:.1f}s "
                    f"after {state.poll_count} polls ({len(response.content)} bytes)"
                )
                return response.content

            # Error
            detail = response.text[:500] if response.text else "No error details"
            state.update(ModalRequestStatus.FAILED, error=detail)
            _notify_status(request_id, state)
            raise ValueError(f"Poll failed ({response.status_code}): {detail}")

        except httpx.TimeoutException:
            # Timeout on poll is OK, just retry
            logger.warning(f"[{request_id[:8]}] Poll timeout, retrying...")
            await asyncio.sleep(poll_interval)
            continue

        except httpx.RequestError as e:
            state.update(ModalRequestStatus.FAILED, error=str(e))
            _notify_status(request_id, state)
            raise ValueError(f"Network error during poll: {e}")


# =============================================================================
# Public API Functions
# =============================================================================


async def generate_speech_qwen(
    voice_id: str,
    text: str,
    ref_text: str,
    language: str = "Auto",
    model: str = "0.6B",
    request_id: Optional[str] = None,
) -> str:
    """
    Generate speech using Qwen3-TTS on Modal.com.

    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech
        ref_text: Transcript of the reference audio
        language: Language code (e.g. "English", "Auto")
        model: Model size ("0.6B" default, "1.7B" available but stopped)
        request_id: Optional ID for tracking (generated if not provided)

    Returns:
        Path to the generated WAV file
    """
    # Select endpoint - default to 0.6B (fastest, 1.7B is stopped)
    if model == "1.7B":
        endpoint = QWEN_MODAL_ENDPOINT_1_7B
    else:
        endpoint = QWEN_MODAL_ENDPOINT_0_6B

    if not endpoint:
        raise ValueError(
            f"QWEN_MODAL_ENDPOINT_{model.replace('.', '_')} not configured"
        )

    # Get reference audio
    reference_path = get_reference_path(voice_id)
    if reference_path is None:
        raise ValueError(f"Voice reference not found: {voice_id}")

    # Read and base64-encode reference audio
    with open(reference_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")

    generation_id = str(uuid.uuid4())
    request_id = request_id or generation_id

    payload = {
        "text": text,
        "language": language,
        "ref_audio_base64": audio_b64,
        "ref_text": ref_text,
        "max_new_tokens": 2048,
    }

    logger.info(
        f"Generating via Qwen3-TTS ({model}): {len(text)} chars, lang={language}"
    )

    # Use robust request handler with polling support
    audio_bytes = await _make_modal_request(
        endpoint=endpoint,
        payload=payload,
        request_id=request_id,
        timeout_seconds=600.0,  # 10 minutes for long texts
    )

    # Save WAV response
    output_path = GENERATED_DIR / f"{generation_id}.wav"
    with open(output_path, "wb") as f:
        f.write(audio_bytes)

    logger.info(f"Saved: {output_path.name} ({len(audio_bytes)} bytes)")

    return str(output_path)


async def design_voice(
    text: str,
    language: str,
    instruct: str,
    request_id: Optional[str] = None,
) -> tuple[bytes, str]:
    """
    Design a new voice from a text description using VoiceDesign model.

    Args:
        text: Preview text to speak
        language: Target language (e.g. "English")
        instruct: Natural language voice description
                  (e.g. "A warm, friendly female voice")
        request_id: Optional ID for tracking

    Returns:
        Tuple of (audio_bytes, voice_id) - the generated preview and new voice ID
    """
    endpoint = QWEN_MODAL_ENDPOINT_VOICE_DESIGN
    if not endpoint:
        raise ValueError("QWEN_MODAL_ENDPOINT_VOICE_DESIGN not configured")

    request_id = request_id or str(uuid.uuid4())

    payload = {
        "text": text,
        "language": language,
        "instruct": instruct,
    }

    logger.info(f"Designing voice: {instruct[:50]}...")

    # Use robust request handler
    audio_bytes = await _make_modal_request(
        endpoint=endpoint,
        payload=payload,
        request_id=request_id,
        timeout_seconds=180.0,  # 3 minutes for voice design
    )

    logger.info(f"Voice designed: {len(audio_bytes)} bytes")

    return audio_bytes


# =============================================================================
# Job-Based Generation (for long-running tasks)
# =============================================================================


def is_long_running_text(text: str) -> bool:
    """Check if text should use job-based generation."""
    return len(text) >= LONG_TASK_THRESHOLD_CHARS


def estimate_generation_time(text: str) -> float:
    """
    Estimate generation time in minutes based on text length.

    Rough heuristic: ~2.5x real-time audio generation
    Average speaking rate: ~150 words/minute
    Average word length: ~5 characters
    So: text_length / 5 / 150 * 2.5 = text_length / 300 minutes
    """
    words = len(text) / 5
    audio_minutes = words / 150
    generation_minutes = audio_minutes * 2.5
    return round(generation_minutes, 1)


async def submit_generation_job(
    voice_id: str,
    text: str,
    ref_text: str,
    language: str = "Auto",
) -> dict:
    """
    Submit a long-running generation job to Modal.

    Returns a job_id that can be used to poll status and retrieve results.

    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech
        ref_text: Transcript of the reference audio
        language: Language code

    Returns:
        dict with job_id, status, and estimated_duration_minutes
    """
    if not QWEN_MODAL_JOB_SUBMIT:
        raise ValueError("QWEN_MODAL_JOB_SUBMIT endpoint not configured")

    # Get reference audio
    reference_path = get_reference_path(voice_id)
    if reference_path is None:
        raise ValueError(f"Voice reference not found: {voice_id}")

    # Read and base64-encode reference audio
    with open(reference_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "text": text,
        "language": language,
        "ref_audio_base64": audio_b64,
        "ref_text": ref_text,
        "max_new_tokens": 4096,  # Higher for long texts
    }

    estimated_minutes = estimate_generation_time(text)
    logger.info(
        f"Submitting job for {len(text)} chars, estimated time: {estimated_minutes} minutes"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(QWEN_MODAL_JOB_SUBMIT, json=payload)

        if response.status_code != 200:
            detail = response.text[:300]
            logger.error(f"Job submission failed ({response.status_code}): {detail}")
            raise ValueError(f"Failed to submit job: {detail}")

        result = response.json()
        result["estimated_duration_minutes"] = estimated_minutes

        logger.info(f"Job submitted: {result.get('job_id')}")
        return result


async def check_job_status(job_id: str) -> dict:
    """
    Check the status of a submitted job.

    Args:
        job_id: The Modal job ID

    Returns:
        dict with job_id, status, result_ready
    """
    if not QWEN_MODAL_JOB_STATUS:
        raise ValueError("QWEN_MODAL_JOB_STATUS endpoint not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(QWEN_MODAL_JOB_STATUS, params={"job_id": job_id})

        if response.status_code != 200:
            detail = response.text[:300]
            logger.error(f"Job status check failed ({response.status_code}): {detail}")
            raise ValueError(f"Failed to check job status: {detail}")

        return response.json()


async def get_job_result(job_id: str, generation_id: str) -> str:
    """
    Get the result of a completed job and save to file.

    Args:
        job_id: The Modal job ID
        generation_id: UUID for the output file

    Returns:
        Path to the generated WAV file
    """
    if not QWEN_MODAL_JOB_RESULT:
        raise ValueError("QWEN_MODAL_JOB_RESULT endpoint not configured")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(QWEN_MODAL_JOB_RESULT, params={"job_id": job_id})

        if response.status_code == 202:
            raise ValueError("Job still processing")

        if response.status_code != 200:
            detail = response.text[:300]
            logger.error(
                f"Job result retrieval failed ({response.status_code}): {detail}"
            )
            raise ValueError(f"Failed to get job result: {detail}")

        # Save WAV response
        output_path = GENERATED_DIR / f"{generation_id}.wav"
        with open(output_path, "wb") as f:
            f.write(response.content)

        logger.info(
            f"Job result saved: {output_path.name} ({len(response.content)} bytes)"
        )
        return str(output_path)


async def cancel_job(job_id: str) -> dict:
    """
    Cancel a running job.

    Args:
        job_id: The Modal job ID

    Returns:
        dict with cancellation status
    """
    if not QWEN_MODAL_JOB_CANCEL:
        raise ValueError("QWEN_MODAL_JOB_CANCEL endpoint not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(QWEN_MODAL_JOB_CANCEL, json={"job_id": job_id})

        if response.status_code != 200:
            detail = response.text[:300]
            logger.error(f"Job cancellation failed ({response.status_code}): {detail}")
            raise ValueError(f"Failed to cancel job: {detail}")

        logger.info(f"Job cancelled: {job_id}")
        return response.json()


async def poll_job_until_complete(
    job_id: str,
    generation_id: str,
    task_id: str,
    poll_interval: float = 5.0,
    max_duration_seconds: float = 1800.0,  # 30 minutes
    cancellation_checker: Optional[Callable[[str], bool]] = None,
) -> str:
    """
    Poll a job until completion and save the result.

    This is used for the background task to monitor long-running jobs.

    Args:
        job_id: Modal job ID
        generation_id: UUID for output file
        task_id: Backend task ID for status updates
        poll_interval: Seconds between status checks
        max_duration_seconds: Maximum time to wait
        cancellation_checker: Optional callback to check if cancellation requested

    Returns:
        Path to generated WAV file

    Raises:
        ValueError: If job fails, times out, or is cancelled
    """
    start_time = time.time()
    poll_count = 0

    while True:
        elapsed = time.time() - start_time
        poll_count += 1

        # Check timeout
        if elapsed > max_duration_seconds:
            logger.error(f"Job {job_id} timed out after {elapsed:.1f}s")
            raise ValueError(f"Job timed out after {elapsed/60:.1f} minutes")

        # Check cancellation
        if cancellation_checker and cancellation_checker(task_id):
            logger.info(f"Cancellation requested for job {job_id}")
            try:
                await cancel_job(job_id)
            except Exception as e:
                logger.warning(f"Failed to cancel job on Modal: {e}")
            raise ValueError("Generation cancelled by user")

        # Check status
        try:
            status = await check_job_status(job_id)

            if status.get("status") == "completed" and status.get("result_ready"):
                # Job complete - get result
                return await get_job_result(job_id, generation_id)

            if status.get("status") == "failed":
                error = status.get("error", "Unknown error")
                raise ValueError(f"Job failed: {error}")

            # Still running - update status and wait
            logger.info(
                f"[{task_id[:8]}] Job polling... "
                f"(poll #{poll_count}, {elapsed:.0f}s elapsed)"
            )

            # Notify status callback if available
            if _status_callback:
                state = ModalRequestState(
                    status=ModalRequestStatus.PROCESSING,
                    start_time=start_time,
                    endpoint=QWEN_MODAL_JOB_STATUS,
                    text_length=0,
                    elapsed_seconds=elapsed,
                    poll_count=poll_count,
                )
                _notify_status(task_id, state)

        except ValueError:
            raise
        except Exception as e:
            logger.warning(f"Job status check failed: {e}, retrying...")

        await asyncio.sleep(poll_interval)
