"""Local file storage service."""

import shutil
from pathlib import Path
from fastapi import UploadFile

from config import REFERENCES_DIR, GENERATED_DIR


async def save_reference(voice_id: str, file: UploadFile) -> str:
    """
    Save a voice reference audio file.
    
    Returns the path to the saved file.
    """
    # Get file extension
    ext = Path(file.filename).suffix.lower() if file.filename else ".wav"
    
    # Create file path
    file_path = REFERENCES_DIR / f"{voice_id}{ext}"
    
    # Save file
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return str(file_path)


async def save_generated(generation_id: str, audio_bytes: bytes) -> str:
    """
    Save generated audio bytes.
    
    Returns the path to the saved file.
    """
    file_path = GENERATED_DIR / f"{generation_id}.mp3"
    
    with open(file_path, "wb") as f:
        f.write(audio_bytes)
    
    return str(file_path)


def get_reference_path(voice_id: str) -> Path | None:
    """
    Get the reference audio path for a voice.
    
    Returns None if not found.
    """
    for ext in [".wav", ".mp3", ".m4a"]:
        path = REFERENCES_DIR / f"{voice_id}{ext}"
        if path.exists():
            return path
    return None


def delete_reference(voice_id: str) -> bool:
    """
    Delete reference audio file for a voice.
    
    Returns True if file was deleted, False if not found.
    """
    path = get_reference_path(voice_id)
    if path and path.exists():
        path.unlink()
        return True
    return False


def copy_file(src: Path, dst: Path) -> None:
    """Copy a file from source to destination."""
    shutil.copy2(src, dst)
