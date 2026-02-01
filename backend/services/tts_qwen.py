"""
TTS service using Qwen3-TTS on Modal.com.

Calls the deployed Qwen3-TTS voice cloning endpoint.
No chunking needed — Qwen3-TTS handles long text natively.
"""

import base64
import logging
import time
import uuid

import httpx

from services.storage import get_reference_path
from config import (
    GENERATED_DIR,
    REFERENCES_DIR,
    QWEN_MODAL_ENDPOINT,
    QWEN_MODAL_ENDPOINT_1_7B,
    QWEN_MODAL_ENDPOINT_0_6B,
    QWEN_MODAL_ENDPOINT_VOICE_DESIGN,
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


async def generate_speech_qwen(
    voice_id: str,
    text: str,
    ref_text: str,
    language: str = "Auto",
    model: str = "0.6B",
) -> str:
    """
    Generate speech using Qwen3-TTS on Modal.com.

    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech
        ref_text: Transcript of the reference audio
        language: Language code (e.g. "English", "Auto")
        model: Model size ("0.6B" default, "1.7B" available but stopped)

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
    start = time.time()

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(endpoint, json=payload)

    elapsed = time.time() - start

    if response.status_code != 200:
        detail = response.text[:300]
        logger.error(f"Qwen3-TTS error ({response.status_code}): {detail}")
        raise ValueError(f"Qwen3-TTS generation failed: {detail}")

    # Save WAV response
    output_path = GENERATED_DIR / f"{generation_id}.wav"
    with open(output_path, "wb") as f:
        f.write(response.content)

    logger.info(
        f"Generated in {elapsed:.1f}s: {len(response.content)} bytes -> {output_path.name}"
    )

    return str(output_path)


async def design_voice(
    text: str,
    language: str,
    instruct: str,
) -> tuple[bytes, str]:
    """
    Design a new voice from a text description using VoiceDesign model.

    Args:
        text: Preview text to speak
        language: Target language (e.g. "English")
        instruct: Natural language voice description
                  (e.g. "A warm, friendly female voice")

    Returns:
        Tuple of (audio_bytes, voice_id) - the generated preview and new voice ID
    """
    endpoint = QWEN_MODAL_ENDPOINT_VOICE_DESIGN
    if not endpoint:
        raise ValueError("QWEN_MODAL_ENDPOINT_VOICE_DESIGN not configured")

    payload = {
        "text": text,
        "language": language,
        "instruct": instruct,
    }

    logger.info(f"Designing voice: {instruct[:50]}...")
    start = time.time()

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(endpoint, json=payload)

    elapsed = time.time() - start

    if response.status_code != 200:
        detail = response.text[:300]
        logger.error(f"VoiceDesign error ({response.status_code}): {detail}")
        raise ValueError(f"Voice design failed: {detail}")

    audio_bytes = response.content
    logger.info(f"Voice designed in {elapsed:.1f}s: {len(audio_bytes)} bytes")

    return audio_bytes
