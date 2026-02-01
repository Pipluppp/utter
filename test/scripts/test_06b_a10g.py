#!/usr/bin/env python3
"""
Test 0.6B model on A10G GPU - comparison benchmark.

Tests short and medium texts, saves outputs to 0.6B-A10G-SDPA folder.

Usage:
    cd test/scripts
    python test_06b_a10g.py
"""

import base64
import json
import time
from datetime import datetime
from pathlib import Path

import requests

# =============================================================================
# Configuration
# =============================================================================

ENDPOINT = {
    "name": "Qwen3-TTS-12Hz-0.6B-Base (A10G, SDPA)",
    "output_folder": "0.6B-A10G-SDPA",
    "clone": "https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run",
    "health": "https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-health.modal.run",
}

SCRIPT_DIR = Path(__file__).parent
TEST_DIR = SCRIPT_DIR.parent
INPUTS_DIR = TEST_DIR / "inputs"
OUTPUTS_DIR = TEST_DIR / "outputs"
RESULTS_DIR = TEST_DIR / "results"

NUM_WARM_RUNS = 3
REQUEST_TIMEOUT = 600


def load_reference_audio() -> tuple[str, str]:
    """Load reference audio and text for voice cloning."""
    audio_path = INPUTS_DIR / "reference" / "audio.wav"
    text_path = INPUTS_DIR / "reference" / "audio_text.txt"

    with open(audio_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode()
    with open(text_path, "r", encoding="utf-8") as f:
        ref_text = f.read().strip()

    print(f"Loaded reference audio: {audio_path.name}")
    return audio_b64, ref_text


def load_test_texts() -> dict[str, str]:
    """Load short and medium test texts."""
    texts = {}
    for name in ["short", "medium"]:
        text_path = INPUTS_DIR / "texts" / f"{name}.txt"
        if text_path.exists():
            with open(text_path, "r", encoding="utf-8") as f:
                texts[name] = f.read().strip()
            print(f"Loaded {name} text: {len(texts[name])} chars")
    return texts


def check_health() -> dict:
    """Check model health and return info."""
    print(f"Checking health...")
    try:
        resp = requests.get(ENDPOINT["health"], timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"  Health check failed: {e}")
        return {"status": "error", "error": str(e)}


def clone_voice(
    text: str, ref_audio_b64: str, ref_text: str
) -> tuple[float, bytes | None, str | None]:
    """Call the clone endpoint and return (time_seconds, audio_bytes, error)."""
    payload = {
        "text": text,
        "language": "English",
        "ref_audio_base64": ref_audio_b64,
        "ref_text": ref_text,
    }

    start = time.time()
    try:
        resp = requests.post(ENDPOINT["clone"], json=payload, timeout=REQUEST_TIMEOUT)
        elapsed = time.time() - start

        if resp.status_code == 200:
            return elapsed, resp.content, None
        else:
            return elapsed, None, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except requests.exceptions.Timeout:
        return time.time() - start, None, "Request timeout"
    except Exception as e:
        return time.time() - start, None, str(e)


def save_audio(audio_bytes: bytes, text_name: str):
    """Save audio output to appropriate folder."""
    output_dir = OUTPUTS_DIR / ENDPOINT["output_folder"]
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / f"{text_name}.wav"
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    return output_path


def run_test():
    """Run the 0.6B A10G benchmark."""
    print("=" * 70)
    print("Qwen3-TTS 0.6B on A10G Benchmark")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Endpoint: {ENDPOINT['name']}")
    print()

    # Load inputs
    ref_audio_b64, ref_text = load_reference_audio()
    test_texts = load_test_texts()

    # Results structure
    results = {
        "timestamp": datetime.now().isoformat(),
        "model": "Qwen3-TTS-12Hz-0.6B-Base",
        "gpu": "A10G",
        "attention": "SDPA",
        "num_runs": NUM_WARM_RUNS,
        "tests": {},
    }

    # Check health
    print("\n" + "-" * 70)
    print("Health Check")
    print("-" * 70)
    health = check_health()
    results["health"] = health
    if health.get("status") == "healthy":
        print(f"  ✓ {health.get('model')} on {health.get('gpu')}")
    else:
        print(f"  ✗ {health.get('error', 'Unknown error')}")

    # Cold start / warmup
    print("\n" + "-" * 70)
    print("Warmup (Cold Start)")
    print("-" * 70)
    warmup_text = "Hello, this is a warmup request."
    elapsed, audio, error = clone_voice(warmup_text, ref_audio_b64, ref_text)

    if error:
        print(f"  ERROR: {error}")
        results["cold_start"] = {"time": elapsed, "error": error}
    else:
        print(f"  Time: {elapsed:.2f}s")
        print(f"  Audio: {len(audio)} bytes")
        results["cold_start"] = {"time": elapsed, "audio_size": len(audio)}
        save_audio(audio, "warmup")

    # Run tests on short and medium texts
    for text_name, text in test_texts.items():
        print("\n" + "-" * 70)
        print(f"Testing: {text_name} ({len(text)} chars)")
        print("-" * 70)
        print(f"Text: {text[:80]}...")

        runs = []
        for run in range(1, NUM_WARM_RUNS + 1):
            elapsed, audio, error = clone_voice(text, ref_audio_b64, ref_text)

            if error:
                print(f"  Run {run}: ERROR - {error}")
                runs.append({"time": elapsed, "error": error})
            else:
                print(f"  Run {run}: {elapsed:.2f}s ({len(audio)} bytes)")
                runs.append({"time": elapsed, "audio_size": len(audio)})

                # Save last successful run
                if run == NUM_WARM_RUNS:
                    output_path = save_audio(audio, text_name)
                    print(f"         Saved to: {output_path.relative_to(TEST_DIR)}")

        # Calculate stats
        successful_runs = [r for r in runs if "error" not in r]
        if successful_runs:
            times = [r["time"] for r in successful_runs]
            avg_time = sum(times) / len(times)
            min_time = min(times)
            max_time = max(times)
            print(
                f"  Avg: {avg_time:.2f}s (min: {min_time:.2f}s, max: {max_time:.2f}s)"
            )

        results["tests"][text_name] = {
            "text_length": len(text),
            "runs": runs,
        }

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY: 0.6B on A10G")
    print("=" * 70)

    print(f"\n{'Text':<10} {'Chars':>6} │ {'Avg Time':>10} │ {'Min':>8} │ {'Max':>8}")
    print("-" * 55)

    for text_name in test_texts:
        runs = results["tests"].get(text_name, {}).get("runs", [])
        successful = [r for r in runs if "error" not in r]
        if successful:
            times = [r["time"] for r in successful]
            avg_time = sum(times) / len(times)
            min_time = min(times)
            max_time = max(times)
            print(
                f"{text_name:<10} {len(test_texts[text_name]):>6} │ {avg_time:>9.2f}s │ {min_time:>7.2f}s │ {max_time:>7.2f}s"
            )

    cs = results.get("cold_start", {}).get("time")
    if cs:
        print(f"\nCold Start: {cs:.2f}s")

    # Save results
    results_path = (
        RESULTS_DIR
        / f"06b_a10g_benchmark_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {results_path.relative_to(TEST_DIR)}")

    return results


if __name__ == "__main__":
    run_test()
