"""Audio processing helpers for Echo-TTS compatibility."""

from pathlib import Path

# Using mutagen for duration detection (lightweight, no ffmpeg needed)
from mutagen.mp3 import MP3
from mutagen.wave import WAVE
from mutagen.mp4 import MP4


# Echo-TTS constraints
MIN_DURATION = 10   # seconds
MAX_DURATION = 300  # 5 minutes


def get_audio_duration(file_path: str | Path) -> float:
    """
    Get duration of audio file in seconds.
    
    Supports: WAV, MP3, M4A
    Returns: Duration in seconds
    Raises: ValueError if format not supported
    """
    path = Path(file_path)
    ext = path.suffix.lower()
    
    try:
        if ext == ".wav":
            audio = WAVE(path)
        elif ext == ".mp3":
            audio = MP3(path)
        elif ext == ".m4a":
            audio = MP4(path)
        else:
            raise ValueError(f"Unsupported format: {ext}")
        
        return audio.info.length
    except Exception as e:
        raise ValueError(f"Could not read audio file: {e}")


def validate_reference_audio(file_path: str | Path) -> dict:
    """
    Validate audio file meets Echo-TTS reference requirements.
    
    Returns: {"valid": True, "duration": 45.2, "message": "OK"}
             {"valid": False, "duration": 5.0, "message": "Audio must be..."}
    """
    try:
        duration = get_audio_duration(file_path)
        
        if duration < MIN_DURATION:
            return {
                "valid": False,
                "duration": duration,
                "message": f"Audio must be at least {MIN_DURATION} seconds (got {duration:.1f}s)"
            }
        
        if duration > MAX_DURATION:
            return {
                "valid": False,
                "duration": duration,
                "message": f"Audio cannot exceed {MAX_DURATION // 60} minutes (got {duration / 60:.1f}min)"
            }
        
        return {
            "valid": True,
            "duration": duration,
            "message": "OK"
        }
        
    except ValueError as e:
        return {
            "valid": False,
            "duration": 0,
            "message": str(e)
        }
