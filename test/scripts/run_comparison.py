#!/usr/bin/env python3
"""
SDPA vs FA2 Comparison Test Runner

Runs voice generation tests on both SDPA and FA2 variants using input text files.
Saves outputs with clear naming showing input text and variant used.

Usage:
    cd test
    uv run --with requests python scripts/run_comparison.py                    # Run all texts
    uv run --with requests python scripts/run_comparison.py --text long        # Run specific text
    uv run --with requests python scripts/run_comparison.py --variant SDPA     # Run specific variant
    uv run --with requests python scripts/run_comparison.py --text long --variant FA2

Directory Structure:
    test/
    ├── inputs/
    │   ├── reference/          # Voice reference files
    │   │   ├── audio.wav       # Reference audio for voice cloning
    │   │   └── audio_text.txt  # Transcript of reference audio
    │   └── texts/              # Input texts for generation
    │       ├── short.txt
    │       ├── medium.txt
    │       └── long.txt
    ├── outputs/
    │   └── {variant}/          # Generated audio files
    │       └── {text_name}.wav
    ├── results/                # JSON timing data
    └── scripts/                # Test scripts
"""

import argparse
import base64
import json
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("Error: requests library required")
    print("Run: uv run --with requests python scripts/run_comparison.py")
    sys.exit(1)


# Paths
TEST_DIR = Path(__file__).parent.parent
INPUTS_DIR = TEST_DIR / "inputs"
OUTPUTS_DIR = TEST_DIR / "outputs"
RESULTS_DIR = TEST_DIR / "results"
REFERENCE_AUDIO = INPUTS_DIR / "reference" / "audio.wav"
REFERENCE_TEXT = INPUTS_DIR / "reference" / "audio_text.txt"
TEXTS_DIR = INPUTS_DIR / "texts"

# Endpoints
VARIANTS = {
    "SDPA": {
        "name": "1.7B SDPA (torch 2.10)",
        "clone": "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run",
        "health": "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run",
    },
    "FA2": {
        "name": "1.7B Flash Attention 2 (torch 2.9)",
        "clone": "https://duncab013--qwen3-tts-voice-clone-fa2-qwen3ttsservice-clone.modal.run",
        "health": "https://duncab013--qwen3-tts-voice-clone-fa2-qwen3ttsservice-health.modal.run",
    },
}


def load_reference() -> tuple[str, str]:
    """Load reference audio (base64) and transcript."""
    with open(REFERENCE_AUDIO, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")
    with open(REFERENCE_TEXT, "r", encoding="utf-8") as f:
        transcript = f.read().strip()
    return audio_b64, transcript


def load_text(name: str) -> str:
    """Load input text file."""
    text_file = TEXTS_DIR / f"{name}.txt"
    if not text_file.exists():
        raise FileNotFoundError(f"Text file not found: {text_file}")
    with open(text_file, "r", encoding="utf-8") as f:
        return f.read().strip()


def get_available_texts() -> list[str]:
    """Get list of available text files."""
    return [f.stem for f in TEXTS_DIR.glob("*.txt")]


def check_health(variant: str) -> dict | None:
    """Check endpoint health."""
    try:
        r = requests.get(VARIANTS[variant]["health"], timeout=180)
        if r.ok:
            return r.json()
    except Exception as e:
        print(f"  Health check failed: {e}")
    return None


def generate(
    variant: str,
    text: str,
    audio_b64: str,
    ref_text: str,
    timeout: int = 300,
) -> tuple[float, bytes | None, str | None]:
    """
    Call clone endpoint and measure time.
    Returns: (elapsed_seconds, audio_bytes, error_message)
    """
    payload = {
        "text": text,
        "language": "English",
        "ref_audio_base64": audio_b64,
        "ref_text": ref_text,
        "max_new_tokens": 4096,
    }

    start = time.time()
    try:
        r = requests.post(VARIANTS[variant]["clone"], json=payload, timeout=timeout)
        elapsed = time.time() - start
        if r.ok:
            return elapsed, r.content, None
        else:
            try:
                error = r.json().get("detail", r.text[:200])
            except:
                error = r.text[:200]
            return elapsed, None, error
    except requests.exceptions.Timeout:
        return time.time() - start, None, "Timeout"
    except Exception as e:
        return time.time() - start, None, str(e)


def run_test(
    text_name: str,
    variants: list[str],
    audio_b64: str,
    ref_text: str,
) -> dict:
    """Run test for a specific text on specified variants."""
    text = load_text(text_name)
    text_chars = len(text)

    print(f"\n{'='*70}")
    print(f"TEXT: {text_name}.txt ({text_chars} characters)")
    print(f"{'='*70}")
    print(f"Content: {text[:80]}{'...' if len(text) > 80 else ''}")

    results = {
        "text_name": text_name,
        "text_chars": text_chars,
        "text_preview": text[:200],
        "variants": {},
    }

    for variant in variants:
        print(f"\n[{variant}] Generating...")

        # Check health first
        health = check_health(variant)
        if not health:
            print(f"  ERROR: Endpoint not healthy, skipping")
            results["variants"][variant] = {"error": "Endpoint not healthy"}
            continue

        # Generate
        elapsed, audio, error = generate(variant, text, audio_b64, ref_text)

        if error:
            print(f"  ERROR: {error}")
            results["variants"][variant] = {"error": error, "time": elapsed}
            continue

        # Calculate metrics
        chars_per_sec = text_chars / elapsed if elapsed > 0 else 0
        audio_size = len(audio)

        print(f"  Time: {elapsed:.2f}s")
        print(f"  Throughput: {chars_per_sec:.2f} chars/s")
        print(f"  Output: {audio_size:,} bytes")

        # Save output
        output_dir = OUTPUTS_DIR / variant
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{text_name}.wav"
        with open(output_file, "wb") as f:
            f.write(audio)
        print(f"  Saved: {output_file.relative_to(TEST_DIR)}")

        results["variants"][variant] = {
            "time": elapsed,
            "chars_per_sec": chars_per_sec,
            "audio_size": audio_size,
            "output_file": str(output_file.relative_to(TEST_DIR)),
        }

    return results


def print_summary(all_results: list[dict]):
    """Print comparison summary table."""
    print(f"\n{'='*70}")
    print("COMPARISON SUMMARY")
    print(f"{'='*70}")

    print(f"\n{'Text':<15} {'Chars':<8} {'SDPA':<12} {'FA2':<12} {'Winner':<15}")
    print("-" * 70)

    for result in all_results:
        text_name = result["text_name"]
        chars = result["text_chars"]

        sdpa = result["variants"].get("SDPA", {})
        fa2 = result["variants"].get("FA2", {})

        sdpa_time = sdpa.get("time")
        fa2_time = fa2.get("time")

        if sdpa_time and fa2_time:
            sdpa_str = f"{sdpa_time:.2f}s"
            fa2_str = f"{fa2_time:.2f}s"

            if fa2_time < sdpa_time:
                speedup = ((sdpa_time - fa2_time) / sdpa_time) * 100
                winner = f"FA2 ({speedup:.0f}% faster)"
            elif sdpa_time < fa2_time:
                speedup = ((fa2_time - sdpa_time) / fa2_time) * 100
                winner = f"SDPA ({speedup:.0f}% faster)"
            else:
                winner = "Tie"
        else:
            sdpa_str = sdpa.get("error", "N/A")[:10] if not sdpa_time else f"{sdpa_time:.2f}s"
            fa2_str = fa2.get("error", "N/A")[:10] if not fa2_time else f"{fa2_time:.2f}s"
            winner = "N/A"

        print(f"{text_name:<15} {chars:<8} {sdpa_str:<12} {fa2_str:<12} {winner:<15}")

    print("-" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Run SDPA vs FA2 comparison tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scripts/run_comparison.py                    # Run all texts on both variants
    python scripts/run_comparison.py --text long        # Run only long.txt
    python scripts/run_comparison.py --variant FA2      # Run all texts on FA2 only
    python scripts/run_comparison.py --text long --variant FA2  # Specific test
        """,
    )
    parser.add_argument(
        "--text",
        choices=get_available_texts() + ["all"],
        default="all",
        help="Which text file to test (default: all)",
    )
    parser.add_argument(
        "--variant",
        choices=["SDPA", "FA2", "both"],
        default="both",
        help="Which variant to test (default: both)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=900,
        help="Request timeout in seconds (default: 900)",
    )

    args = parser.parse_args()

    # Determine texts to run
    if args.text == "all":
        texts = get_available_texts()
    else:
        texts = [args.text]

    # Determine variants to run
    if args.variant == "both":
        variants = ["SDPA", "FA2"]
    else:
        variants = [args.variant]

    print("=" * 70)
    print("SDPA vs FA2 Voice Generation Comparison")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Texts: {', '.join(texts)}")
    print(f"Variants: {', '.join(variants)}")

    # Load reference
    print("\nLoading reference audio...")
    audio_b64, ref_text = load_reference()
    print(f"  Audio: {len(audio_b64):,} chars (base64)")
    print(f"  Transcript: {len(ref_text)} chars")

    # Run tests
    all_results = []
    for text_name in texts:
        result = run_test(text_name, variants, audio_b64, ref_text)
        all_results.append(result)

    # Print summary
    if len(variants) == 2 and len(texts) > 0:
        print_summary(all_results)

    # Save results
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = RESULTS_DIR / f"comparison_{timestamp}.json"

    full_results = {
        "timestamp": datetime.now().isoformat(),
        "texts": texts,
        "variants": variants,
        "results": all_results,
    }

    with open(results_file, "w") as f:
        json.dump(full_results, f, indent=2)
    print(f"\nResults saved: {results_file.relative_to(TEST_DIR)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
