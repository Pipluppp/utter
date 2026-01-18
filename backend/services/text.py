"""Text processing helpers for Echo-TTS compatibility."""

import re


# Echo-TTS byte limit (from model docs)
MAX_TEXT_BYTES = 768

# Our app's character limit (user-facing)
MAX_TEXT_CHARS = 500


def preprocess_text(text: str) -> str:
    """
    Preprocess text for optimal Echo-TTS generation.
    
    - Normalizes punctuation (colons, semicolons, emdashes → commas)
    - Strips excessive punctuation
    - Ensures proper sentence endings
    - Adds [S1] speaker tag if not present
    """
    # Strip and normalize whitespace
    text = " ".join(text.split())
    
    # Normalize punctuation that Echo-TTS converts anyway
    text = text.replace(";", ",")
    text = text.replace(":", ",")
    text = text.replace("—", ",")  # emdash
    text = text.replace("--", ",")  # double dash
    
    # Reduce excessive punctuation (e.g., "!!!" → "!")
    text = re.sub(r'!+', '!', text)
    text = re.sub(r'\?+', '?', text)
    text = re.sub(r'\.+', '.', text)
    text = re.sub(r',+', ',', text)
    
    # Ensure text ends with sentence-ending punctuation
    if text and text[-1] not in ".!?":
        text += "."
    
    # Add speaker tag if not present
    if not text.startswith("[S"):
        text = f"[S1] {text}"
    
    return text


def validate_text(text: str) -> dict:
    """
    Validate text meets Echo-TTS constraints.
    
    Returns: {"valid": True, "chars": 150, "bytes": 152, "message": "OK"}
             {"valid": False, "chars": 600, "bytes": 1200, "message": "Text too long"}
    """
    # Strip for validation
    text = text.strip()
    
    if not text:
        return {
            "valid": False,
            "chars": 0,
            "bytes": 0,
            "message": "Please enter text to speak"
        }
    
    char_count = len(text)
    byte_count = len(text.encode("utf-8"))
    
    # Check character limit (user-facing)
    if char_count > MAX_TEXT_CHARS:
        return {
            "valid": False,
            "chars": char_count,
            "bytes": byte_count,
            "message": f"Text cannot exceed {MAX_TEXT_CHARS} characters"
        }
    
    # Check byte limit (Echo-TTS constraint)
    # Account for [S1] prefix we'll add (5 bytes)
    effective_bytes = byte_count + 5
    if effective_bytes > MAX_TEXT_BYTES:
        return {
            "valid": False,
            "chars": char_count,
            "bytes": byte_count,
            "message": "Text contains too many special characters. Please simplify."
        }
    
    return {
        "valid": True,
        "chars": char_count,
        "bytes": byte_count,
        "message": "OK"
    }


def estimate_duration(text: str) -> float:
    """
    Estimate speech duration for given text.
    
    Rule of thumb: ~150 words per minute, ~5 chars per word
    Returns: Estimated duration in seconds
    """
    word_count = len(text.split())
    # Average speaking rate: 150 words per minute = 2.5 words per second
    return word_count / 2.5
