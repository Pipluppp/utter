"""
Latency comparison script: SDPA vs Flash Attention 2 for Qwen3-TTS 1.7B.

Measures both cold start and warm inference times across both attention implementations.

Usage:
    cd test
    uv run --with requests python compare_fa2_sdpa.py
    uv run --with requests python compare_fa2_sdpa.py --runs 5
    uv run --with requests python compare_fa2_sdpa.py --skip-cold-start
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
    print("Install with: uv run --with requests python compare_fa2_sdpa.py")
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

# Test sentences of varying lengths
TEST_SENTENCES = [
    ("short", "Hello, this is a test of voice cloning."),
    ("medium", "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet."),
    ("long", "Prosecutors have opened a massive investigation into allegations of fixing games and illegal betting. Different telescope designs perform differently and have different strengths and weaknesses. We can continue to strengthen the education of good lawyers."),
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


def measure_request(
    variant: str,
    text: str,
    audio_b64: str,
    ref_text: str,
    language: str = "English",
    timeout: int = 300,
) -> tuple[float, bytes | None, str | None]:
    """
    Make a clone request and measure time.

    Returns: (elapsed_seconds, audio_bytes, error_message)
    """
    endpoints = VARIANTS[variant]
    payload = {
        "text": text,
        "language": language,
        "ref_audio_base64": audio_b64,
        "ref_text": ref_text,
        "max_new_tokens": 2048,
    }

    start = time.time()
    try:
        response = requests.post(endpoints["clone"], json=payload, timeout=timeout)
        elapsed = time.time() - start

        if response.ok:
            return elapsed, response.content, None
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


def run_comparison(
    ref_audio_path: Path,
    ref_text_path: Path,
    output_dir: Path,
    num_runs: int = 3,
    skip_cold_start: bool = False,
) -> dict:
    """
    Run full comparison between SDPA and FA2.

    Returns results dict with all timing data.
    """
    results = {
        "timestamp": datetime.now().isoformat(),
        "num_runs": num_runs,
        "variants": {},
    }

    # Load reference data
    print("Loading reference audio and text...")
    audio_b64, ref_text = load_reference(ref_audio_path, ref_text_path)
    print(f"  Audio: {len(audio_b64):,} chars (base64)")
    print(f"  Text: {len(ref_text)} chars")
    print()

    for variant_key, endpoints in VARIANTS.items():
        print("=" * 70)
        print(f"Testing: {endpoints['name']}")
        print("=" * 70)

        variant_results = {
            "name": endpoints["name"],
            "health": None,
            "cold_start": None,
            "warm_runs": [],
            "outputs": [],
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

        # Cold start measurement (first request after potential idle)
        if not skip_cold_start:
            print("\n2. Cold start measurement (first request)...")
            cold_text = TEST_SENTENCES[0][1]  # Use short sentence
            elapsed, audio, error = measure_request(
                variant_key, cold_text, audio_b64, ref_text, timeout=300
            )

            if error:
                print(f"   FAILED: {error}")
                variant_results["cold_start"] = {"error": error, "time": elapsed}
            else:
                variant_results["cold_start"] = {
                    "time": elapsed,
                    "text_length": len(cold_text),
                    "audio_size": len(audio) if audio else 0,
                }
                print(f"   Time: {elapsed:.2f}s")
                print(f"   Output: {len(audio):,} bytes")

                # Save cold start output
                cold_output = output_dir / variant_key / "cold_start.wav"
                cold_output.parent.mkdir(parents=True, exist_ok=True)
                with open(cold_output, "wb") as f:
                    f.write(audio)
                variant_results["outputs"].append(str(cold_output))

        # Warm inference runs
        print(f"\n3. Warm inference ({num_runs} runs per sentence length)...")

        for length_name, text in TEST_SENTENCES:
            print(f"\n   [{length_name.upper()}] '{text[:40]}...'")

            run_times = []
            for i in range(num_runs):
                elapsed, audio, error = measure_request(
                    variant_key, text, audio_b64, ref_text, timeout=180
                )

                if error:
                    print(f"      Run {i+1}: FAILED - {error}")
                    run_times.append({"error": error, "time": elapsed})
                else:
                    print(f"      Run {i+1}: {elapsed:.2f}s ({len(audio):,} bytes)")
                    run_times.append({
                        "time": elapsed,
                        "audio_size": len(audio),
                    })

                    # Save first successful run output
                    if i == 0:
                        out_path = output_dir / variant_key / f"{length_name}.wav"
                        out_path.parent.mkdir(parents=True, exist_ok=True)
                        with open(out_path, "wb") as f:
                            f.write(audio)
                        variant_results["outputs"].append(str(out_path))

            # Calculate stats for this sentence length
            successful_times = [r["time"] for r in run_times if "error" not in r]
            if successful_times:
                avg = sum(successful_times) / len(successful_times)
                min_t = min(successful_times)
                max_t = max(successful_times)
                print(f"      Stats: avg={avg:.2f}s, min={min_t:.2f}s, max={max_t:.2f}s")

            variant_results["warm_runs"].append({
                "length": length_name,
                "text": text,
                "text_chars": len(text),
                "runs": run_times,
            })

        results["variants"][variant_key] = variant_results
        print()

    return results


def print_summary(results: dict):
    """Print comparison summary table."""
    print("\n" + "=" * 70)
    print("COMPARISON SUMMARY")
    print("=" * 70)

    # Header
    print(f"\n{'Metric':<30} {'SDPA':<20} {'FA2':<20} {'Diff':<10}")
    print("-" * 80)

    sdpa = results["variants"].get("SDPA", {})
    fa2 = results["variants"].get("FA2", {})

    # Cold start
    sdpa_cold = sdpa.get("cold_start", {}).get("time")
    fa2_cold = fa2.get("cold_start", {}).get("time")
    if sdpa_cold and fa2_cold:
        diff = fa2_cold - sdpa_cold
        diff_pct = (diff / sdpa_cold) * 100 if sdpa_cold else 0
        print(f"{'Cold Start':<30} {sdpa_cold:>17.2f}s {fa2_cold:>17.2f}s {diff_pct:>+8.1f}%")

    # Warm runs by sentence length
    for length in ["short", "medium", "long"]:
        sdpa_runs = next((r for r in sdpa.get("warm_runs", []) if r["length"] == length), None)
        fa2_runs = next((r for r in fa2.get("warm_runs", []) if r["length"] == length), None)

        if sdpa_runs and fa2_runs:
            sdpa_times = [r["time"] for r in sdpa_runs["runs"] if "error" not in r]
            fa2_times = [r["time"] for r in fa2_runs["runs"] if "error" not in r]

            if sdpa_times and fa2_times:
                sdpa_avg = sum(sdpa_times) / len(sdpa_times)
                fa2_avg = sum(fa2_times) / len(fa2_times)
                diff = fa2_avg - sdpa_avg
                diff_pct = (diff / sdpa_avg) * 100 if sdpa_avg else 0
                speedup = sdpa_avg / fa2_avg if fa2_avg else 0

                print(f"{'Warm (' + length + ')':<30} {sdpa_avg:>17.2f}s {fa2_avg:>17.2f}s {diff_pct:>+8.1f}%")

    print("-" * 80)

    # Overall average
    sdpa_all = []
    fa2_all = []
    for runs in sdpa.get("warm_runs", []):
        sdpa_all.extend([r["time"] for r in runs["runs"] if "error" not in r])
    for runs in fa2.get("warm_runs", []):
        fa2_all.extend([r["time"] for r in runs["runs"] if "error" not in r])

    if sdpa_all and fa2_all:
        sdpa_avg = sum(sdpa_all) / len(sdpa_all)
        fa2_avg = sum(fa2_all) / len(fa2_all)
        diff_pct = ((fa2_avg - sdpa_avg) / sdpa_avg) * 100 if sdpa_avg else 0
        speedup = sdpa_avg / fa2_avg if fa2_avg else 0

        print(f"{'OVERALL AVERAGE':<30} {sdpa_avg:>17.2f}s {fa2_avg:>17.2f}s {diff_pct:>+8.1f}%")

        if speedup > 1:
            print(f"\n>>> FA2 is {speedup:.2f}x FASTER than SDPA")
        elif speedup < 1:
            print(f"\n>>> SDPA is {1/speedup:.2f}x FASTER than FA2")
        else:
            print(f"\n>>> Both variants have similar performance")

    print()


def main():
    parser = argparse.ArgumentParser(
        description="Compare SDPA vs Flash Attention 2 latency for Qwen3-TTS 1.7B"
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=3,
        help="Number of warm inference runs per sentence (default: 3)",
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
        "--skip-cold-start",
        action="store_true",
        help="Skip cold start measurement (assume containers are warm)",
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
    print("Qwen3-TTS 1.7B: SDPA vs Flash Attention 2 Comparison")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Runs per sentence: {args.runs}")
    print(f"Output directory: {args.output_dir}")
    print()

    # Run comparison
    results = run_comparison(
        ref_audio_path=args.ref_audio,
        ref_text_path=args.ref_text,
        output_dir=args.output_dir,
        num_runs=args.runs,
        skip_cold_start=args.skip_cold_start,
    )

    # Print summary
    print_summary(results)

    # Save JSON results
    json_path = args.json or (args.output_dir / "comparison_results.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Detailed results saved to: {json_path}")

    # List output files
    print("\nOutput audio files:")
    for variant in results["variants"].values():
        for output in variant.get("outputs", []):
            print(f"  {output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
