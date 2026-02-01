"""
VoiceDesign Deployment Verification Script

Verifies the VoiceDesign Modal deployment is working correctly and tracks performance metrics.

Run after deploying app_voice_design.py:
    cd modal_app/qwen3_tts
    uv run modal deploy app_voice_design.py

Then run this verification:
    python test/scripts/verify_voice_design_deployment.py

Outputs:
    - test/outputs/voice-design-verification/  (generated audio files)
    - test/results/voice_design_verification_YYYYMMDD_HHMMSS.json (metrics)
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

# Endpoints - update these after deployment
VOICE_DESIGN_BASE = os.getenv(
    "VOICE_DESIGN_BASE", "https://duncab013--qwen3-tts-voice-design-voicedesignservice"
)
VOICE_DESIGN_ENDPOINT = f"{VOICE_DESIGN_BASE}-design.modal.run"
VOICE_DESIGN_HEALTH = f"{VOICE_DESIGN_BASE}-health.modal.run"
VOICE_DESIGN_LANGUAGES = f"{VOICE_DESIGN_BASE}-languages.modal.run"

# Clone endpoint for integration test
CLONE_ENDPOINT = os.getenv(
    "CLONE_ENDPOINT",
    "https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run",
)

# Output directories
OUTPUT_DIR = Path("test/outputs/voice-design-verification")
RESULTS_DIR = Path("test/results")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# Test configurations
TIMEOUT_COLD_START = 180  # 3 minutes for cold start
TIMEOUT_WARM = 120  # 2 minutes for warm requests


# =============================================================================
# Test Cases
# =============================================================================

VERIFICATION_PROMPTS = [
    {
        "id": "friendly_female",
        "text": "Hello! Welcome to Utter. I'm here to help you create amazing voice content.",
        "language": "English",
        "instruct": "A warm, friendly female voice with a gentle, reassuring tone. Natural and conversational.",
        "description": "Warm friendly female",
    },
    {
        "id": "authoritative_male",
        "text": "Today we announce groundbreaking developments in artificial intelligence technology.",
        "language": "English",
        "instruct": "A deep, authoritative male voice like a professional news anchor. Clear, confident, and commanding.",
        "description": "News anchor male",
    },
    {
        "id": "energetic_young",
        "text": "Hey everyone! This is going to be so exciting. Let's dive right in!",
        "language": "English",
        "instruct": "A cheerful, energetic young voice with enthusiasm. Upbeat and engaging, like a YouTuber.",
        "description": "Energetic YouTuber",
    },
    {
        "id": "calm_meditation",
        "text": "Take a deep breath. Let your shoulders relax. Feel the tension leaving your body.",
        "language": "English",
        "instruct": "A calm, soothing voice perfect for meditation and relaxation. Slow, peaceful, and tranquil.",
        "description": "Meditation guide",
    },
    {
        "id": "british_narrator",
        "text": "In the depths of the ancient forest, a discovery was about to change everything.",
        "language": "English",
        "instruct": "A refined British male voice with gravitas, like a documentary narrator. Measured pace, rich tone.",
        "description": "British narrator",
    },
]


# =============================================================================
# Verification Functions
# =============================================================================


def verify_health() -> dict:
    """Verify health endpoint and get model info."""
    print("\n" + "=" * 60)
    print("STEP 1: Health Check")
    print("=" * 60)

    result = {
        "endpoint": "health",
        "success": False,
        "latency_ms": None,
        "response": None,
        "error": None,
    }

    try:
        start = time.time()
        response = requests.get(VOICE_DESIGN_HEALTH, timeout=TIMEOUT_COLD_START)
        latency = (time.time() - start) * 1000

        result["latency_ms"] = round(latency, 1)
        result["status_code"] = response.status_code

        if response.status_code == 200:
            data = response.json()
            result["response"] = data
            result["success"] = True

            print(f"  ✅ Status: {data.get('status')}")
            print(f"  Model: {data.get('model')}")
            print(f"  Type: {data.get('model_type')}")
            print(f"  GPU: {data.get('gpu')}")
            print(f"  Attention: {data.get('attention_implementation')}")
            print(f"  Latency: {latency:.0f}ms")
        else:
            result["error"] = response.text[:500]
            print(f"  ❌ Failed: {response.status_code}")
            print(f"  Error: {result['error']}")

    except Exception as e:
        result["error"] = str(e)
        print(f"  ❌ Error: {e}")

    return result


def verify_languages() -> dict:
    """Verify languages endpoint."""
    print("\n" + "=" * 60)
    print("STEP 2: Languages Endpoint")
    print("=" * 60)

    result = {
        "endpoint": "languages",
        "success": False,
        "latency_ms": None,
        "languages": None,
        "error": None,
    }

    try:
        start = time.time()
        response = requests.get(VOICE_DESIGN_LANGUAGES, timeout=30)
        latency = (time.time() - start) * 1000

        result["latency_ms"] = round(latency, 1)
        result["status_code"] = response.status_code

        if response.status_code == 200:
            data = response.json()
            result["languages"] = data.get("languages", [])
            result["success"] = True

            print(f"  ✅ Languages: {', '.join(result['languages'])}")
            print(f"  Default: {data.get('default')}")
            print(f"  Latency: {latency:.0f}ms")
        else:
            result["error"] = response.text[:500]
            print(f"  ❌ Failed: {response.status_code}")

    except Exception as e:
        result["error"] = str(e)
        print(f"  ❌ Error: {e}")

    return result


def verify_voice_design(prompt: dict, is_cold_start: bool = False) -> dict:
    """Generate a voice design and save output."""
    print(f"\n  Generating: {prompt['description']}")
    print(f"  Instruct: {prompt['instruct'][:60]}...")

    result = {
        "id": prompt["id"],
        "description": prompt["description"],
        "success": False,
        "latency_ms": None,
        "audio_size_bytes": None,
        "output_file": None,
        "is_cold_start": is_cold_start,
        "error": None,
    }

    payload = {
        "text": prompt["text"],
        "language": prompt["language"],
        "instruct": prompt["instruct"],
    }

    timeout = TIMEOUT_COLD_START if is_cold_start else TIMEOUT_WARM

    try:
        start = time.time()
        response = requests.post(VOICE_DESIGN_ENDPOINT, json=payload, timeout=timeout)
        latency = (time.time() - start) * 1000

        result["latency_ms"] = round(latency, 1)
        result["status_code"] = response.status_code

        if response.status_code == 200:
            audio_bytes = response.content
            result["audio_size_bytes"] = len(audio_bytes)
            result["success"] = True

            # Save audio file
            output_file = OUTPUT_DIR / f"{prompt['id']}.wav"
            with open(output_file, "wb") as f:
                f.write(audio_bytes)
            result["output_file"] = str(output_file)

            print(f"  ✅ Generated: {len(audio_bytes):,} bytes in {latency/1000:.1f}s")
            print(f"  Saved: {output_file}")
        else:
            result["error"] = response.text[:500]
            print(f"  ❌ Failed: {response.status_code} - {result['error'][:100]}")

    except requests.Timeout:
        result["error"] = f"Timeout after {timeout}s"
        print(f"  ❌ Timeout after {timeout}s")
    except Exception as e:
        result["error"] = str(e)
        print(f"  ❌ Error: {e}")

    return result


def verify_design_to_clone_workflow(design_result: dict) -> dict:
    """Test using designed voice as reference for cloning."""
    print("\n" + "=" * 60)
    print("STEP 4: Design → Clone Integration")
    print("=" * 60)

    result = {
        "endpoint": "design_to_clone",
        "success": False,
        "design_latency_ms": None,
        "clone_latency_ms": None,
        "total_latency_ms": None,
        "output_file": None,
        "error": None,
    }

    # Check if we have a successful design to use
    if not design_result.get("success") or not design_result.get("output_file"):
        result["error"] = "No successful voice design available for integration test"
        print(f"  ⚠️ Skipped: {result['error']}")
        return result

    # Load the designed audio
    design_file = design_result["output_file"]
    print(f"  Using designed voice: {design_file}")

    with open(design_file, "rb") as f:
        designed_audio = f.read()

    # The text used in the design (becomes ref_text for cloning)
    ref_text = VERIFICATION_PROMPTS[0]["text"]  # friendly_female

    # New text to generate with the cloned voice
    clone_text = (
        "This demonstrates the complete workflow. First, I designed this voice "
        "using a text description. Now, the voice cloning system can generate "
        "any content while preserving the voice characteristics."
    )

    print(f"  Clone text: {clone_text[:60]}...")

    payload = {
        "text": clone_text,
        "language": "English",
        "ref_audio_base64": base64.b64encode(designed_audio).decode("utf-8"),
        "ref_text": ref_text,
    }

    try:
        start = time.time()
        response = requests.post(CLONE_ENDPOINT, json=payload, timeout=TIMEOUT_WARM)
        latency = (time.time() - start) * 1000

        result["clone_latency_ms"] = round(latency, 1)
        result["design_latency_ms"] = design_result.get("latency_ms")
        result["total_latency_ms"] = round(
            (result["design_latency_ms"] or 0) + latency, 1
        )
        result["status_code"] = response.status_code

        if response.status_code == 200:
            cloned_audio = response.content
            result["audio_size_bytes"] = len(cloned_audio)
            result["success"] = True

            # Save cloned audio
            output_file = OUTPUT_DIR / "design_to_clone_integration.wav"
            with open(output_file, "wb") as f:
                f.write(cloned_audio)
            result["output_file"] = str(output_file)

            print(f"  ✅ Cloned: {len(cloned_audio):,} bytes in {latency/1000:.1f}s")
            print(f"  Saved: {output_file}")
            print(f"  Total workflow: {result['total_latency_ms']/1000:.1f}s")
        else:
            result["error"] = response.text[:500]
            print(f"  ❌ Clone failed: {response.status_code}")

    except Exception as e:
        result["error"] = str(e)
        print(f"  ❌ Error: {e}")

    return result


def run_verification() -> dict:
    """Run complete verification suite."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    print("\n" + "=" * 60)
    print("VOICEDESIGN DEPLOYMENT VERIFICATION")
    print("=" * 60)
    print(f"Timestamp: {timestamp}")
    print(f"Design endpoint: {VOICE_DESIGN_ENDPOINT}")
    print(f"Clone endpoint: {CLONE_ENDPOINT}")
    print(f"Output directory: {OUTPUT_DIR}")

    results = {
        "timestamp": timestamp,
        "endpoints": {
            "design": VOICE_DESIGN_ENDPOINT,
            "health": VOICE_DESIGN_HEALTH,
            "languages": VOICE_DESIGN_LANGUAGES,
            "clone": CLONE_ENDPOINT,
        },
        "health": None,
        "languages": None,
        "voice_designs": [],
        "integration": None,
        "summary": {
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "cold_start_latency_ms": None,
            "avg_warm_latency_ms": None,
            "total_audio_bytes": 0,
        },
    }

    # Step 1: Health check (also warms up container)
    results["health"] = verify_health()
    results["summary"]["total_tests"] += 1
    if results["health"]["success"]:
        results["summary"]["passed"] += 1
    else:
        results["summary"]["failed"] += 1

    # Step 2: Languages endpoint
    results["languages"] = verify_languages()
    results["summary"]["total_tests"] += 1
    if results["languages"]["success"]:
        results["summary"]["passed"] += 1
    else:
        results["summary"]["failed"] += 1

    # Step 3: Generate voice designs
    print("\n" + "=" * 60)
    print("STEP 3: Voice Design Generation")
    print("=" * 60)

    warm_latencies = []

    for i, prompt in enumerate(VERIFICATION_PROMPTS):
        is_cold_start = i == 0 and not results["health"]["success"]
        design_result = verify_voice_design(prompt, is_cold_start)
        results["voice_designs"].append(design_result)

        results["summary"]["total_tests"] += 1
        if design_result["success"]:
            results["summary"]["passed"] += 1
            results["summary"]["total_audio_bytes"] += (
                design_result["audio_size_bytes"] or 0
            )

            if is_cold_start:
                results["summary"]["cold_start_latency_ms"] = design_result[
                    "latency_ms"
                ]
            else:
                warm_latencies.append(design_result["latency_ms"])
        else:
            results["summary"]["failed"] += 1

    if warm_latencies:
        results["summary"]["avg_warm_latency_ms"] = round(
            sum(warm_latencies) / len(warm_latencies), 1
        )

    # Step 4: Integration test (design → clone)
    first_successful = next((d for d in results["voice_designs"] if d["success"]), None)
    if first_successful:
        results["integration"] = verify_design_to_clone_workflow(first_successful)
        results["summary"]["total_tests"] += 1
        if results["integration"]["success"]:
            results["summary"]["passed"] += 1
        else:
            results["summary"]["failed"] += 1

    # Summary
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)

    print(
        f"\n  Tests: {results['summary']['passed']}/{results['summary']['total_tests']} passed"
    )

    if results["summary"]["cold_start_latency_ms"]:
        print(f"  Cold start: {results['summary']['cold_start_latency_ms']/1000:.1f}s")

    if results["summary"]["avg_warm_latency_ms"]:
        print(
            f"  Avg warm latency: {results['summary']['avg_warm_latency_ms']/1000:.1f}s"
        )

    print(f"  Total audio generated: {results['summary']['total_audio_bytes']:,} bytes")

    # Performance table
    print("\n  Performance Breakdown:")
    print("  " + "-" * 50)
    print(f"  {'Voice Type':<25} {'Latency':<12} {'Size':<12} {'Status'}")
    print("  " + "-" * 50)

    for design in results["voice_designs"]:
        status = "✅" if design["success"] else "❌"
        latency = f"{design['latency_ms']/1000:.1f}s" if design["latency_ms"] else "N/A"
        size = (
            f"{design['audio_size_bytes']:,}B" if design["audio_size_bytes"] else "N/A"
        )
        print(f"  {design['description']:<25} {latency:<12} {size:<12} {status}")

    print("  " + "-" * 50)

    # Save results
    results_file = RESULTS_DIR / f"voice_design_verification_{timestamp}.json"
    with open(results_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n  Results saved: {results_file}")

    # Final verdict
    if results["summary"]["failed"] == 0:
        print("\n🎉 VERIFICATION PASSED - VoiceDesign deployment is working!")
        return results, 0
    else:
        print(
            f"\n⚠️ VERIFICATION INCOMPLETE - {results['summary']['failed']} tests failed"
        )
        return results, 1


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    results, exit_code = run_verification()
    sys.exit(exit_code)
