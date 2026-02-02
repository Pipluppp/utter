"""Text processing helpers for TTS generation."""

import re


# Legacy text limit constant (kept for estimation logic)
MAX_TEXT_BYTES = 768

# Our app's character limit (user-facing) - increased for long generations
MAX_TEXT_CHARS = 10000

# Chunking settings
# ~70 words per chunk = ~28 seconds of speech (leaving headroom under 30s limit)
MAX_WORDS_PER_CHUNK = 70


def preprocess_text(text: str) -> str:
    """
    Preprocess text for TTS generation.

    - Normalizes punctuation (colons, semicolons, emdashes → commas)
    - Strips excessive punctuation
    - Ensures proper sentence endings
    - Adds [S1] speaker tag if not present
    """
    # Strip and normalize whitespace
    text = " ".join(text.split())

    # Normalize punctuation for cleaner TTS output
    text = text.replace(";", ",")
    text = text.replace(":", ",")
    text = text.replace("—", ",")  # emdash
    text = text.replace("--", ",")  # double dash

    # Reduce excessive punctuation (e.g., "!!!" → "!")
    text = re.sub(r"!+", "!", text)
    text = re.sub(r"\?+", "?", text)
    text = re.sub(r"\.+", ".", text)
    text = re.sub(r",+", ",", text)

    # Ensure text ends with sentence-ending punctuation
    if text and text[-1] not in ".!?":
        text += "."

    # Add speaker tag if not present
    if not text.startswith("[S"):
        text = f"[S1] {text}"

    return text


def validate_text(text: str) -> dict:
    """
    Validate text meets app constraints.
    This function validates overall text limits for the app.

    Returns: {"valid": True, "chars": 150, "message": "OK"}
             {"valid": False, "chars": 6000, "message": "Text too long"}
    """
    # Strip for validation
    text = text.strip()

    if not text:
        return {"valid": False, "chars": 0, "message": "Please enter text to speak"}

    char_count = len(text)

    # Check character limit (user-facing)
    if char_count > MAX_TEXT_CHARS:
        return {
            "valid": False,
            "chars": char_count,
            "message": f"Text cannot exceed {MAX_TEXT_CHARS} characters",
        }

    # Get chunk info for long text
    word_count = len(text.split())
    estimated_chunks = (word_count // MAX_WORDS_PER_CHUNK) + 1

    if estimated_chunks > 1:
        estimated_duration = word_count / 2.5  # ~2.5 words per second
        return {
            "valid": True,
            "chars": char_count,
            "chunks": estimated_chunks,
            "estimated_duration": estimated_duration,
            "message": f"Long text: will be split into ~{estimated_chunks} chunks",
        }

    return {"valid": True, "chars": char_count, "message": "OK"}


def estimate_duration(text: str) -> float:
    """
    Estimate speech duration for given text.

    Rule of thumb: ~150 words per minute, ~5 chars per word
    Returns: Estimated duration in seconds
    """
    word_count = len(text.split())
    # Average speaking rate: 150 words per minute = 2.5 words per second
    return word_count / 2.5


def split_text_into_chunks(text: str, max_words: int = None) -> list[str]:
    """
    Split long text into chunks for estimation purposes.

    Strategy:
    1. Split by sentence boundaries (., !, ?)
    2. Accumulate sentences until approaching word limit
    3. Each chunk gets preprocessed individually

    Args:
        text: Full text to split
        max_words: Max words per chunk (default: MAX_WORDS_PER_CHUNK)

    Returns:
        List of text chunks, each preprocessed and ready for generation
    """
    if max_words is None:
        max_words = MAX_WORDS_PER_CHUNK

    # Normalize whitespace first
    text = " ".join(text.split())

    if not text:
        return []

    # Split into sentences using regex (handles ., !, ?)
    # Keep the delimiters attached to the sentences
    sentence_pattern = re.compile(r"(?<=[.!?])\s+")
    sentences = sentence_pattern.split(text)

    # Filter out empty sentences
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return [preprocess_text(text)]

    chunks = []
    current_chunk = []
    current_word_count = 0

    for sentence in sentences:
        sentence_words = len(sentence.split())

        # If adding this sentence exceeds limit, finalize current chunk
        if current_word_count + sentence_words > max_words and current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append(preprocess_text(chunk_text))
            current_chunk = []
            current_word_count = 0

        # Add sentence to current chunk
        current_chunk.append(sentence)
        current_word_count += sentence_words

    # Don't forget the last chunk
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        chunks.append(preprocess_text(chunk_text))

    return chunks


def get_chunk_info(text: str) -> dict:
    """
    Get information about how text will be chunked.

    Returns:
        {
            "chunks": 3,
            "estimated_duration": 84.5,
            "is_long": True,
            "message": "This will generate ~3 audio segments (~1 min 24 sec)"
        }
    """
    chunks = split_text_into_chunks(text)
    chunk_count = len(chunks)
    estimated_duration = estimate_duration(text)
    is_long = chunk_count > 1

    if is_long:
        minutes = int(estimated_duration // 60)
        seconds = int(estimated_duration % 60)
        if minutes > 0:
            duration_str = f"~{minutes} min {seconds} sec"
        else:
            duration_str = f"~{seconds} sec"
        message = f"Long text: {chunk_count} chunks, {duration_str}"
    else:
        message = "OK"

    return {
        "chunks": chunk_count,
        "estimated_duration": estimated_duration,
        "is_long": is_long,
        "message": message,
    }
