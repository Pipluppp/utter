"""
Test script for Qwen3-TTS Modal API using local reference files.

Usage:
    cd test
    python test_qwen3_tts.py

    # With custom text
    python test_qwen3_tts.py --text "Hello, world!"

    # Skip health check (faster if container is warm)
    python test_qwen3_tts.py --skip-health
"""

import argparse
import base64
import json
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Error: requests library not installed.")
    print("Install with: pip install requests")
    sys.exit(1)


# Default endpoints (1.7B model)
ENDPOINTS = {
    "clone": "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run",
    "health": "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run",
    "languages": "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-languages.modal.run",
}

# Default test reference files
DEFAULT_REF_AUDIO = Path(__file__).parent / "2026-01-26" / "audio.wav"
DEFAULT_REF_TEXT = Path(__file__).parent / "2026-01-26" / "audio_text.txt"


def test_health() -> bool:
    """Test the health endpoint."""
    print("Testing health endpoint...")
    print(f"  URL: {ENDPOINTS['health']}")

    start = time.time()
    try:
        response = requests.get(ENDPOINTS["health"], timeout=120)
        elapsed = time.time() - start

        print(f"  Status: {response.status_code}")
        print(f"  Time: {elapsed:.2f}s")

        if response.ok:
            data = response.json()
            print(f"  Model: {data['model']}")
            print(f"  GPU: {data['gpu']}")
            print(f"  Attention: {data['attention_implementation']}")
            return True
        else:
            print(f"  Error: {response.text}")
            return False
    except requests.exceptions.Timeout:
        print("  Error: Request timed out (cold start may take ~90s)")
        return False
    except Exception as e:
        print(f"  Error: {e}")
        return False


def test_clone(
    text: str,
    ref_audio_path: Path,
    ref_text_path: Path,
    output_path: Path,
    language: str = "English",
) -> bool:
    """Test the clone endpoint with local reference files."""
    print("\nTesting clone endpoint...")
    print(f"  URL: {ENDPOINTS['clone']}")
    print(f"  Text: '{text[:50]}{'...' if len(text) > 50 else ''}'")
    print(f"  Language: {language}")
    print(f"  Reference: {ref_audio_path}")

    # Read and encode reference audio
    if not ref_audio_path.exists():
        print(f"  Error: Reference audio not found: {ref_audio_path}")
        return False

    with open(ref_audio_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")
    print(f"  Audio size: {len(audio_b64)} chars (base64)")

    # Read reference transcript
    if not ref_text_path.exists():
        print(f"  Error: Reference text not found: {ref_text_path}")
        return False

    with open(ref_text_path, "r", encoding="utf-8") as f:
        ref_text = f.read().strip()
    print(f"  Transcript: {len(ref_text)} chars")

    # Build request
    payload = {
        "text": text,
        "language": language,
        "ref_audio_base64": audio_b64,
        "ref_text": ref_text,
        "max_new_tokens": 2048,
    }

    # Make request
    start = time.time()
    try:
        response = requests.post(
            ENDPOINTS["clone"],
            json=payload,
            timeout=300,  # 5 minute timeout for cold start + generation
        )
        elapsed = time.time() - start

        print(f"  Status: {response.status_code}")
        print(f"  Time: {elapsed:.2f}s")

        if response.ok:
            # Save output
            with open(output_path, "wb") as f:
                f.write(response.content)
            print(f"  Output: {output_path} ({len(response.content):,} bytes)")

            # Verify it's a valid WAV
            if response.content[:4] == b"RIFF":
                print("  Valid WAV file header detected")
                return True
            else:
                print("  Warning: Output doesn't have WAV header")
                return False
        else:
            try:
                error = response.json()
                print(f"  Error: {error.get('detail', response.text)}")
            except:
                print(f"  Error: {response.text[:200]}")
            return False

    except requests.exceptions.Timeout:
        print("  Error: Request timed out")
        return False
    except Exception as e:
        print(f"  Error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Test Qwen3-TTS Modal API")
    parser.add_argument(
        "--text",
        default="Hello, this is a test of the Qwen3 text to speech voice cloning system. The quick brown fox jumps over the lazy dog.",
        help="Text to synthesize",
    )
    parser.add_argument(
        "--ref-audio",
        type=Path,
        default=DEFAULT_REF_AUDIO,
        help="Path to reference audio file",
    )
    parser.add_argument(
        "--ref-text",
        type=Path,
        default=DEFAULT_REF_TEXT,
        help="Path to reference transcript file",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("output.wav"),
        help="Output file path",
    )
    parser.add_argument(
        "--language",
        default="English",
        help="Language for synthesis",
    )
    parser.add_argument(
        "--skip-health",
        action="store_true",
        help="Skip health check",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Qwen3-TTS Modal API Test")
    print("=" * 60)
    print()

    # Health check
    if not args.skip_health:
        if not test_health():
            print("\nHealth check failed. Container may be cold starting.")
            print("Continuing with clone test anyway...")
        print()

    # Clone test
    success = test_clone(
        text=args.text,
        ref_audio_path=args.ref_audio,
        ref_text_path=args.ref_text,
        output_path=args.output,
        language=args.language,
    )

    print()
    print("=" * 60)
    if success:
        print("Test PASSED")
        print(f"Output saved to: {args.output}")
    else:
        print("Test FAILED")
    print("=" * 60)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
