"""
Pure generation latency comparison: SDPA vs Flash Attention 2.

This test isolates the GENERATION step by:
1. First call: Creates voice prompt + generates (cold/warm combined)
2. Subsequent calls: Reuses same endpoint but measures generation-dominated time

Since the Modal endpoints don't expose voice prompt caching across requests,
we measure by doing multiple sequential requests where the reference audio
processing overhead becomes amortized.

Usage:
    cd test
    uv run --with requests python compare_generation_only.py
    uv run --with requests python compare_generation_only.py --runs 5
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
    print("Error: requests library not installed.")
    print("Install with: uv run --with requests python compare_generation_only.py")
    sys.exit(1)


# Endpoints for 1.7B variants
VARIANTS = {
    "SDPA": {
        "name": "1.7B SDPA",
        "clone": "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run",
        "health": "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run",
    },
    "FA2": {
        "name": "1.7B Flash Attention 2",
        "clone": "https://duncab013--qwen3-tts-voice-clone-fa2-qwen3ttsservice-clone.modal.run",
        "health": "https://duncab013--qwen3-tts-voice-clone-fa2-qwen3ttsservice-health.modal.run",
    },
}

# Default test reference files
DEFAULT_REF_AUDIO = Path(__file__).parent / "reference" / "audio.wav"
DEFAULT_REF_TEXT = Path(__file__).parent / "reference" / "audio_text.txt"

# Test texts of varying lengths for generation
# These are what we're generating, NOT the reference text
GENERATION_TEXTS = [
    ("tiny", "Hello world."),
    ("short", "The quick brown fox jumps over the lazy dog."),
    ("medium", "In a world where technology continues to advance at an unprecedented pace, the importance of understanding artificial intelligence and its implications for society has never been greater."),
    ("long", "The development of large language models has revolutionized the field of natural language processing, enabling machines to understand and generate human-like text with remarkable accuracy. These models, trained on vast amounts of data, can perform a wide variety of tasks including translation, summarization, question answering, and creative writing. However, with great power comes great responsibility, and researchers must carefully consider the ethical implications of deploying such powerful systems."),
]


def load_reference(ref_audio_path: Path, ref_text_path: Path) -> tuple[str, str]:
    """Load and encode reference audio and text."""
    with open(ref_audio_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")
    with open(ref_text_path, "r", encoding="utf-8") as f:
        ref_text = f.read().strip()
    return audio_b64, ref_text


def check_health(variant: str) -> dict | None:
    """Check health and return model info."""
    endpoints = VARIANTS[variant]
    try:
        response = requests.get(endpoints["health"], timeout=180)
        if response.ok:
            return response.json()
    except Exception as e:
        print(f"  Health check failed: {e}")
    return None


def measure_generation(
    variant: str,
    text: str,
    audio_b64: str,
    ref_text: str,
    language: str = "English",
    timeout: int = 300,
) -> tuple[float, int | None, str | None]:
    """
    Make a clone request and measure time.

    Returns: (elapsed_seconds, audio_bytes_len, error_message)
    """
    endpoints = VARIANTS[variant]
    payload = {
        "text": text,
        "language": language,
        "ref_audio_base64": audio_b64,
        "ref_text": ref_text,
        "max_new_tokens": 4096,  # Allow longer generation
    }

    start = time.time()
    try:
        response = requests.post(endpoints["clone"], json=payload, timeout=timeout)
        elapsed = time.time() - start

        if response.ok:
            return elapsed, len(response.content), None
        else:
            try:
                error = response.json().get("detail", response.text)
            except:
                error = response.text[:200]
            return elapsed, None, error
    except requests.exceptions.Timeout:
        return time.time() - start, None, "Timeout"
    except Exception as e:
        return time.time() - start, None, str(e)


def run_generation_benchmark(
    ref_audio_path: Path,
    ref_text_path: Path,
    output_dir: Path,
    num_runs: int = 3,
) -> dict:
    """
    Run generation benchmark focusing on text-to-speech performance.
    """
    results = {
        "timestamp": datetime.now().isoformat(),
        "test_type": "generation_focused",
        "num_runs": num_runs,
        "variants": {},
    }

    # Load reference data
    print("Loading reference audio and text...")
    audio_b64, ref_text = load_reference(ref_audio_path, ref_text_path)
    print(f"  Audio: {len(audio_b64):,} chars (base64)")
    print(f"  Reference text: {len(ref_text)} chars")
    print()

    for variant_key, endpoints in VARIANTS.items():
        print("=" * 70)
        print(f"Testing: {endpoints['name']}")
        print("=" * 70)

        variant_results = {
            "name": endpoints["name"],
            "health": None,
            "warmup": None,
            "generations": [],
        }

        # Health check
        print("\n1. Health check...")
        health = check_health(variant_key)
        if health:
            variant_results["health"] = health
            print(f"   Status: healthy")
            print(f"   GPU: {health.get('gpu')}")
            print(f"   Attention: {health.get('attention_implementation')}")
        else:
            print("   Status: FAILED - skipping this variant")
            results["variants"][variant_key] = variant_results
            continue

        # Warmup request (ensure container is hot)
        print("\n2. Warmup request...")
        warmup_text = "This is a warmup request to ensure the model is loaded."
        elapsed, size, error = measure_generation(
            variant_key, warmup_text, audio_b64, ref_text, timeout=300
        )
        if error:
            print(f"   FAILED: {error}")
            variant_results["warmup"] = {"error": error, "time": elapsed}
        else:
            print(f"   Time: {elapsed:.2f}s, Output: {size:,} bytes")
            variant_results["warmup"] = {"time": elapsed, "audio_size": size}

        # Generation tests - multiple runs per text length
        print(f"\n3. Generation benchmark ({num_runs} runs per text length)...")

        for length_name, text in GENERATION_TEXTS:
            text_len = len(text)
            print(f"\n   [{length_name.upper()}] {text_len} chars: '{text[:50]}...'")

            run_results = []
            for i in range(num_runs):
                elapsed, size, error = measure_generation(
                    variant_key, text, audio_b64, ref_text, timeout=300
                )

                if error:
                    print(f"      Run {i+1}: FAILED - {error}")
                    run_results.append({"error": error, "time": elapsed})
                else:
                    # Calculate approximate chars/second throughput
                    chars_per_sec = text_len / elapsed if elapsed > 0 else 0
                    print(f"      Run {i+1}: {elapsed:.2f}s ({size:,} bytes, {chars_per_sec:.1f} chars/s)")
                    run_results.append({
                        "time": elapsed,
                        "audio_size": size,
                        "chars_per_sec": chars_per_sec,
                    })

            # Calculate stats
            successful = [r for r in run_results if "error" not in r]
            if successful:
                times = [r["time"] for r in successful]
                avg_time = sum(times) / len(times)
                avg_throughput = text_len / avg_time
                print(f"      Stats: avg={avg_time:.2f}s, throughput={avg_throughput:.1f} chars/s")

            variant_results["generations"].append({
                "length": length_name,
                "text": text,
                "text_chars": text_len,
                "runs": run_results,
            })

        results["variants"][variant_key] = variant_results
        print()

    return results


def print_summary(results: dict):
    """Print comparison summary focusing on generation throughput."""
    print("\n" + "=" * 70)
    print("GENERATION PERFORMANCE SUMMARY")
    print("=" * 70)

    sdpa = results["variants"].get("SDPA", {})
    fa2 = results["variants"].get("FA2", {})

    # Header
    print(f"\n{'Text Length':<20} {'SDPA (chars/s)':<18} {'FA2 (chars/s)':<18} {'FA2 Speedup':<12}")
    print("-" * 70)

    overall_sdpa = []
    overall_fa2 = []

    for length in ["tiny", "short", "medium", "long"]:
        sdpa_gen = next((g for g in sdpa.get("generations", []) if g["length"] == length), None)
        fa2_gen = next((g for g in fa2.get("generations", []) if g["length"] == length), None)

        if sdpa_gen and fa2_gen:
            sdpa_runs = [r for r in sdpa_gen["runs"] if "error" not in r]
            fa2_runs = [r for r in fa2_gen["runs"] if "error" not in r]

            if sdpa_runs and fa2_runs:
                text_len = sdpa_gen["text_chars"]

                sdpa_avg_time = sum(r["time"] for r in sdpa_runs) / len(sdpa_runs)
                fa2_avg_time = sum(r["time"] for r in fa2_runs) / len(fa2_runs)

                sdpa_throughput = text_len / sdpa_avg_time
                fa2_throughput = text_len / fa2_avg_time

                speedup = fa2_throughput / sdpa_throughput if sdpa_throughput > 0 else 0

                overall_sdpa.append(sdpa_avg_time)
                overall_fa2.append(fa2_avg_time)

                speedup_str = f"{speedup:.2f}x" if speedup >= 1 else f"{1/speedup:.2f}x slower"
                print(f"{length:<20} {sdpa_throughput:>15.1f}   {fa2_throughput:>15.1f}   {speedup_str}")

    print("-" * 70)

    # Overall
    if overall_sdpa and overall_fa2:
        sdpa_total = sum(overall_sdpa)
        fa2_total = sum(overall_fa2)
        speedup = sdpa_total / fa2_total if fa2_total > 0 else 0

        if speedup > 1:
            print(f"\n>>> FA2 is {speedup:.2f}x FASTER overall")
        elif speedup < 1:
            print(f"\n>>> SDPA is {1/speedup:.2f}x FASTER overall")
        else:
            print(f"\n>>> Both variants have similar performance")

    # Analysis
    print("\n" + "=" * 70)
    print("ANALYSIS")
    print("=" * 70)
    print("""
The generation time includes:
1. Reference audio processing (creates voice embedding) - ~constant overhead
2. Text tokenization - negligible
3. Autoregressive generation with attention - where FA2 should help

For short texts, the reference processing overhead dominates.
For longer texts, the generation (attention) portion becomes more significant.

If FA2 shows better speedup on longer texts, it confirms the attention
optimization is working but is overshadowed by other operations for short texts.
""")


def main():
    parser = argparse.ArgumentParser(
        description="Generation-focused latency comparison: SDPA vs FA2"
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=3,
        help="Number of runs per text length (default: 3)",
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
        "--output-dir",
        type=Path,
        default=Path(__file__).parent / "outputs",
        help="Directory for output files",
    )
    parser.add_argument(
        "--json",
        type=Path,
        default=None,
        help="Save detailed results to JSON file",
    )

    args = parser.parse_args()

    # Validate inputs
    if not args.ref_audio.exists():
        print(f"Error: Reference audio not found: {args.ref_audio}")
        return 1
    if not args.ref_text.exists():
        print(f"Error: Reference text not found: {args.ref_text}")
        return 1

    print("=" * 70)
    print("Qwen3-TTS Generation Benchmark: SDPA vs Flash Attention 2")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Runs per text length: {args.runs}")
    print()
    print("This test measures TEXT-TO-SPEECH GENERATION performance.")
    print("Each request includes voice cloning overhead (reference processing).")
    print("Longer texts should show more FA2 benefit if attention is the bottleneck.")
    print()

    # Run benchmark
    results = run_generation_benchmark(
        ref_audio_path=args.ref_audio,
        ref_text_path=args.ref_text,
        output_dir=args.output_dir,
        num_runs=args.runs,
    )

    # Print summary
    print_summary(results)

    # Save JSON results
    json_path = args.json or (args.output_dir / "generation_benchmark_results.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed results saved to: {json_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
