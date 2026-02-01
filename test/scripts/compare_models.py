#!/usr/bin/env python3
"""
Compare 1.7B vs 0.6B Qwen3-TTS models on voice cloning performance.

Tests both models on short and medium text inputs, measuring:
- Generation time
- Audio output size
- Output quality (saved for manual comparison)

Usage:
    cd test/scripts
    python compare_models.py
"""

import base64
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

# =============================================================================
# Configuration
# =============================================================================

# Model endpoints
ENDPOINTS = {
    "1.7B": {
        "name": "Qwen3-TTS-12Hz-1.7B-Base (A10G, SDPA)",
        "output_folder": "1.7B-A10G-SDPA",
        "clone": "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run",
        "health": "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run",
    },
    "0.6B": {
        "name": "Qwen3-TTS-12Hz-0.6B-Base (T4, SDPA)",
        "output_folder": "0.6B-T4-SDPA",
        "clone": "https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run",
        "health": "https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-health.modal.run",
    },
}

# Paths (relative to script location)
SCRIPT_DIR = Path(__file__).parent
TEST_DIR = SCRIPT_DIR.parent
INPUTS_DIR = TEST_DIR / "inputs"
OUTPUTS_DIR = TEST_DIR / "outputs"
RESULTS_DIR = TEST_DIR / "results"

# Test configuration
NUM_WARM_RUNS = 3  # Number of runs after warmup for averaging
REQUEST_TIMEOUT = 600  # 10 minutes max per request


def load_reference_audio() -> tuple[str, str]:
    """Load reference audio and text for voice cloning."""
    audio_path = INPUTS_DIR / "reference" / "audio.wav"
    text_path = INPUTS_DIR / "reference" / "audio_text.txt"

    if not audio_path.exists():
        raise FileNotFoundError(f"Reference audio not found: {audio_path}")
    if not text_path.exists():
        raise FileNotFoundError(f"Reference text not found: {text_path}")

    with open(audio_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode()
    with open(text_path, "r", encoding="utf-8") as f:
        ref_text = f.read().strip()

    print(f"Loaded reference audio: {audio_path.name} ({len(audio_b64)} bytes b64)")
    print(f"Reference text: {ref_text[:50]}...")
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
        else:
            print(f"Warning: {text_path} not found, skipping")
    return texts


def check_health(model: str) -> dict:
    """Check model health and return info."""
    endpoint = ENDPOINTS[model]["health"]
    print(f"Checking health: {model}...")
    try:
        resp = requests.get(endpoint, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"  Health check failed: {e}")
        return {"status": "error", "error": str(e)}


def clone_voice(
    model: str,
    text: str,
    ref_audio_b64: str,
    ref_text: str,
    language: str = "English",
) -> tuple[float, bytes | None, str | None]:
    """
    Call the clone endpoint and return (time_seconds, audio_bytes, error).
    """
    endpoint = ENDPOINTS[model]["clone"]
    payload = {
        "text": text,
        "language": language,
        "ref_audio_base64": ref_audio_b64,
        "ref_text": ref_text,
    }

    start = time.time()
    try:
        resp = requests.post(endpoint, json=payload, timeout=REQUEST_TIMEOUT)
        elapsed = time.time() - start

        if resp.status_code == 200:
            return elapsed, resp.content, None
        else:
            return elapsed, None, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except requests.exceptions.Timeout:
        elapsed = time.time() - start
        return elapsed, None, "Request timeout"
    except Exception as e:
        elapsed = time.time() - start
        return elapsed, None, str(e)


def save_audio(audio_bytes: bytes, model: str, text_name: str, run_num: int = 0):
    """Save audio output to appropriate folder."""
    # Use the descriptive output folder name
    output_folder = ENDPOINTS[model].get("output_folder", model)
    output_dir = OUTPUTS_DIR / output_folder
    output_dir.mkdir(parents=True, exist_ok=True)

    if run_num > 0:
        filename = f"{text_name}_run{run_num}.wav"
    else:
        filename = f"{text_name}.wav"

    output_path = output_dir / filename
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    return output_path


def run_comparison():
    """Run the full comparison between 1.7B and 0.6B models."""
    print("=" * 70)
    print("Qwen3-TTS Model Comparison: 1.7B vs 0.6B")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()

    # Load inputs
    ref_audio_b64, ref_text = load_reference_audio()
    test_texts = load_test_texts()

    if not test_texts:
        print("ERROR: No test texts found!")
        return

    # Results structure
    results = {
        "timestamp": datetime.now().isoformat(),
        "num_runs": NUM_WARM_RUNS,
        "models": {},
    }

    # Check health of both models
    print("\n" + "-" * 70)
    print("Health Checks")
    print("-" * 70)
    for model in ENDPOINTS:
        health = check_health(model)
        results["models"][model] = {
            "name": ENDPOINTS[model]["name"],
            "health": health,
            "tests": {},
        }
        if health.get("status") == "healthy":
            print(f"  {model}: ✓ {health.get('model')} on {health.get('gpu')}")
        else:
            print(f"  {model}: ✗ {health.get('error', 'Unknown error')}")

    # Warm up both models with a quick request
    print("\n" + "-" * 70)
    print("Warmup (Cold Start)")
    print("-" * 70)
    warmup_text = "Hello, this is a warmup request."

    for model in ENDPOINTS:
        print(f"\n{model} cold start...")
        elapsed, audio, error = clone_voice(model, warmup_text, ref_audio_b64, ref_text)

        if error:
            print(f"  ERROR: {error}")
            results["models"][model]["cold_start"] = {
                "time": elapsed,
                "error": error,
            }
        else:
            print(f"  Time: {elapsed:.2f}s")
            print(f"  Audio: {len(audio)} bytes")
            results["models"][model]["cold_start"] = {
                "time": elapsed,
                "audio_size": len(audio),
            }
            # Save warmup audio
            save_audio(audio, model, "warmup")

    # Run tests on short and medium texts
    for text_name, text in test_texts.items():
        print("\n" + "-" * 70)
        print(f"Testing: {text_name} ({len(text)} chars)")
        print("-" * 70)
        print(f"Text: {text[:100]}...")

        for model in ENDPOINTS:
            print(f"\n  {model}:")
            runs = []

            for run in range(1, NUM_WARM_RUNS + 1):
                elapsed, audio, error = clone_voice(
                    model, text, ref_audio_b64, ref_text
                )

                if error:
                    print(f"    Run {run}: ERROR - {error}")
                    runs.append({"time": elapsed, "error": error})
                else:
                    print(f"    Run {run}: {elapsed:.2f}s ({len(audio)} bytes)")
                    runs.append({"time": elapsed, "audio_size": len(audio)})

                    # Save only the last successful run
                    if run == NUM_WARM_RUNS:
                        output_path = save_audio(audio, model, text_name)
                        print(
                            f"           Saved to: {output_path.relative_to(TEST_DIR)}"
                        )

            # Calculate stats
            successful_runs = [r for r in runs if "error" not in r]
            if successful_runs:
                times = [r["time"] for r in successful_runs]
                avg_time = sum(times) / len(times)
                min_time = min(times)
                max_time = max(times)
                print(
                    f"    Avg: {avg_time:.2f}s (min: {min_time:.2f}s, max: {max_time:.2f}s)"
                )

            results["models"][model]["tests"][text_name] = {
                "text_length": len(text),
                "runs": runs,
            }

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    summary_data = []
    for text_name in test_texts:
        row = {"text": text_name, "chars": len(test_texts[text_name])}
        for model in ENDPOINTS:
            runs = results["models"][model]["tests"].get(text_name, {}).get("runs", [])
            successful = [r for r in runs if "error" not in r]
            if successful:
                avg_time = sum(r["time"] for r in successful) / len(successful)
                row[f"{model}_time"] = avg_time
                row[f"{model}_size"] = successful[-1].get("audio_size", 0)
            else:
                row[f"{model}_time"] = None
                row[f"{model}_size"] = None
        summary_data.append(row)

    # Print summary table
    print(
        f"\n{'Text':<10} {'Chars':>6} │ {'1.7B Time':>10} {'Size':>10} │ {'0.6B Time':>10} {'Size':>10} │ {'Faster':>8}"
    )
    print("-" * 80)

    for row in summary_data:
        t17 = row.get("1.7B_time")
        t06 = row.get("0.6B_time")
        s17 = row.get("1.7B_size")
        s06 = row.get("0.6B_size")

        t17_str = f"{t17:.2f}s" if t17 else "ERROR"
        t06_str = f"{t06:.2f}s" if t06 else "ERROR"
        s17_str = f"{s17/1000:.1f}KB" if s17 else "-"
        s06_str = f"{s06/1000:.1f}KB" if s06 else "-"

        if t17 and t06:
            if t17 < t06:
                faster = f"1.7B +{((t06/t17)-1)*100:.0f}%"
            else:
                faster = f"0.6B +{((t17/t06)-1)*100:.0f}%"
        else:
            faster = "-"

        print(
            f"{row['text']:<10} {row['chars']:>6} │ {t17_str:>10} {s17_str:>10} │ {t06_str:>10} {s06_str:>10} │ {faster:>8}"
        )

    # Cold start comparison
    print("\nCold Start:")
    cs17 = results["models"]["1.7B"].get("cold_start", {}).get("time")
    cs06 = results["models"]["0.6B"].get("cold_start", {}).get("time")
    if cs17 and cs06:
        print(f"  1.7B: {cs17:.2f}s")
        print(f"  0.6B: {cs06:.2f}s")
        if cs17 < cs06:
            print(f"  Winner: 1.7B ({((cs06/cs17)-1)*100:.0f}% faster)")
        else:
            print(f"  Winner: 0.6B ({((cs17/cs06)-1)*100:.0f}% faster)")

    # Save results
    results["summary"] = summary_data
    results_path = (
        RESULTS_DIR
        / f"model_comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {results_path.relative_to(TEST_DIR)}")

    # Output file locations
    print("\nOutput audio files:")
    for model in ENDPOINTS:
        output_folder = ENDPOINTS[model].get("output_folder", model)
        output_dir = OUTPUTS_DIR / output_folder
        if output_dir.exists():
            files = list(output_dir.glob("*.wav"))
            print(f"  {model}: {len(files)} files in outputs/{output_folder}/")


if __name__ == "__main__":
    run_comparison()
