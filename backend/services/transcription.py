"""Transcription helpers (Mistral Voxtral)."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Optional

from mistralai import Mistral

from config import (
    MISTRAL_API_KEY,
    MISTRAL_REALTIME_MODEL,
    MISTRAL_TRANSCRIBE_MODEL,
    TRANSCRIPTION_ENABLED,
)


class TranscriptionUnavailableError(RuntimeError):
    """Raised when transcription is not configured/enabled."""


LANGUAGE_TO_MISTRAL_CODE: dict[str, str] = {
    "Chinese": "zh",
    "English": "en",
    "Japanese": "ja",
    "Korean": "ko",
    "German": "de",
    "French": "fr",
    "Russian": "ru",
    "Portuguese": "pt",
    "Spanish": "es",
    "Italian": "it",
}


@dataclass(frozen=True)
class TranscriptionResult:
    text: str
    model: str
    language: Optional[str] = None


def is_transcription_enabled() -> bool:
    return TRANSCRIPTION_ENABLED


def get_transcription_models() -> dict[str, str]:
    return {
        "provider": "mistral",
        "model": MISTRAL_TRANSCRIBE_MODEL,
        "realtime_model": MISTRAL_REALTIME_MODEL,
    }


def normalize_language_code(language: str | None) -> str | None:
    if not language:
        return None
    lang = language.strip()
    if not lang or lang == "Auto":
        return None
    return LANGUAGE_TO_MISTRAL_CODE.get(lang)


def _require_enabled() -> None:
    if not TRANSCRIPTION_ENABLED:
        raise TranscriptionUnavailableError(
            "Transcription is not enabled. Set MISTRAL_API_KEY and TRANSCRIPTION_ENABLED=true."
        )


async def transcribe_audio_bytes(
    audio_bytes: bytes,
    *,
    filename: str,
    language: str | None = None,
    model: str | None = None,
) -> TranscriptionResult:
    """
    Transcribe an audio blob using Voxtral (batch).

    This uses a synchronous SDK call, so we run it in a thread to avoid blocking
    the FastAPI event loop.
    """
    _require_enabled()

    model_id = model or MISTRAL_TRANSCRIBE_MODEL
    language_code = normalize_language_code(language)

    def _run() -> TranscriptionResult:
        client = Mistral(api_key=MISTRAL_API_KEY)
        kwargs = {}
        if language_code:
            kwargs["language"] = language_code

        res = client.audio.transcriptions.complete(
            model=model_id,
            file={"content": audio_bytes, "file_name": filename},
            **kwargs,
        )

        return TranscriptionResult(
            text=(res.text or "").strip(),
            model=model_id,
            language=language_code,
        )

    return await asyncio.to_thread(_run)
