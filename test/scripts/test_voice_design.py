"""
Test script for Qwen3-TTS VoiceDesign endpoint.

Tests the voice design functionality including:
- Basic voice design generation
- Input validation
- Different languages
- Integration with clone workflow

Usage:
    python test/scripts/test_voice_design.py
"""

import base64
import json
import os
import sys
import time
from pathlib import Path

import requests

# Configuration - update after deployment
VOICE_DESIGN_ENDPOINT = os.getenv(
    "VOICE_DESIGN_ENDPOINT",
    "https://duncab013--qwen3-tts-voice-design-voicedesignservice-design.modal.run",
)
VOICE_DESIGN_HEALTH = os.getenv(
    "VOICE_DESIGN_HEALTH",
    "https://duncab013--qwen3-tts-voice-design-voicedesignservice-health.modal.run",
)
CLONE_ENDPOINT = os.getenv(
    "CLONE_ENDPOINT",
    "https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run",
)

OUTPUT_DIR = Path("test/outputs/voice-design")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def test_health():
    """Test health endpoint."""
    print("\n" + "=" * 60)
    print("TEST: Health Check")
    print("=" * 60)

    start = time.time()
    response = requests.get(VOICE_DESIGN_HEALTH, timeout=120)
    elapsed = time.time() - start

    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.1f}s")

    if response.status_code == 200:
        data = response.json()
        print(f"Model: {data.get('model')}")
        print(f"Type: {data.get('model_type')}")
        print(f"GPU: {data.get('gpu')}")
        print(f"Attention: {data.get('attention_implementation')}")
        print("✅ PASSED")
        return True
    else:
        print(f"❌ FAILED: {response.text}")
        return False


def test_basic_design():
    """Test basic voice design generation."""
    print("\n" + "=" * 60)
    print("TEST: Basic Voice Design")
    print("=" * 60)

    payload = {
        "text": "Hello! I'm so glad you're here. Let me help you with anything you need today.",
        "language": "English",
        "instruct": "A warm, friendly female voice with a slight southern accent and a gentle, reassuring tone.",
    }

    print(f"Text: {payload['text'][:50]}...")
    print(f"Instruct: {payload['instruct'][:50]}...")

    start = time.time()
    response = requests.post(VOICE_DESIGN_ENDPOINT, json=payload, timeout=120)
    elapsed = time.time() - start

    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.1f}s")

    if response.status_code == 200:
        audio_bytes = response.content
        print(f"Audio size: {len(audio_bytes)} bytes")

        output_path = OUTPUT_DIR / "basic_design.wav"
        with open(output_path, "wb") as f:
            f.write(audio_bytes)
        print(f"Saved: {output_path}")
        print("✅ PASSED")
        return True, audio_bytes
    else:
        print(f"❌ FAILED: {response.text}")
        return False, None


def test_validation_missing_instruct():
    """Test validation - missing instruct field."""
    print("\n" + "=" * 60)
    print("TEST: Validation - Missing Instruct")
    print("=" * 60)

    payload = {
        "text": "Hello world",
        "language": "English",
        # Missing instruct
    }

    response = requests.post(VOICE_DESIGN_ENDPOINT, json=payload, timeout=30)

    print(f"Status: {response.status_code}")

    if response.status_code == 400:
        print(f"Error: {response.text}")
        print("✅ PASSED (correctly rejected)")
        return True
    else:
        print("❌ FAILED (should have returned 400)")
        return False


def test_validation_missing_text():
    """Test validation - missing text field."""
    print("\n" + "=" * 60)
    print("TEST: Validation - Missing Text")
    print("=" * 60)

    payload = {
        "language": "English",
        "instruct": "A friendly voice",
        # Missing text
    }

    response = requests.post(VOICE_DESIGN_ENDPOINT, json=payload, timeout=30)

    print(f"Status: {response.status_code}")

    if response.status_code == 400:
        print(f"Error: {response.text}")
        print("✅ PASSED (correctly rejected)")
        return True
    else:
        print("❌ FAILED (should have returned 400)")
        return False


def test_validation_invalid_language():
    """Test validation - invalid language."""
    print("\n" + "=" * 60)
    print("TEST: Validation - Invalid Language")
    print("=" * 60)

    payload = {
        "text": "Hello world",
        "language": "Klingon",  # Invalid
        "instruct": "A friendly voice",
    }

    response = requests.post(VOICE_DESIGN_ENDPOINT, json=payload, timeout=30)

    print(f"Status: {response.status_code}")

    if response.status_code == 400:
        print(f"Error: {response.text}")
        print("✅ PASSED (correctly rejected)")
        return True
    else:
        print("❌ FAILED (should have returned 400)")
        return False


def test_different_voices():
    """Test generating different voice types."""
    print("\n" + "=" * 60)
    print("TEST: Different Voice Types")
    print("=" * 60)

    test_cases = [
        {
            "name": "news_anchor",
            "text": "Breaking news from the capital. The president announced new economic policies today.",
            "instruct": "A deep, authoritative male voice like a professional news anchor. Clear, neutral, and commanding.",
        },
        {
            "name": "cheerful_young",
            "text": "Hey everyone! Thanks for joining me today. This is going to be so much fun!",
            "instruct": "A cheerful young woman with enthusiasm and energy. Slightly higher pitched with a smile in the voice.",
        },
        {
            "name": "elderly_wise",
            "text": "In my many years, I have learned that patience is the greatest virtue.",
            "instruct": "An elderly, wise-sounding male voice with gravitas and warmth. Slow, measured pace.",
        },
    ]

    all_passed = True

    for test in test_cases:
        print(f"\n  Testing: {test['name']}")
        print(f"  Instruct: {test['instruct'][:50]}...")

        payload = {
            "text": test["text"],
            "language": "English",
            "instruct": test["instruct"],
        }

        start = time.time()
        response = requests.post(VOICE_DESIGN_ENDPOINT, json=payload, timeout=120)
        elapsed = time.time() - start

        if response.status_code == 200:
            audio_bytes = response.content
            output_path = OUTPUT_DIR / f"{test['name']}.wav"
            with open(output_path, "wb") as f:
                f.write(audio_bytes)
            print(f"  ✅ {test['name']}: {len(audio_bytes)} bytes in {elapsed:.1f}s")
        else:
            print(
                f"  ❌ {test['name']}: {response.status_code} - {response.text[:100]}"
            )
            all_passed = False

    if all_passed:
        print("\n✅ ALL VOICE TYPES PASSED")
    else:
        print("\n❌ SOME VOICE TYPES FAILED")

    return all_passed


def test_different_languages():
    """Test voice design in different languages."""
    print("\n" + "=" * 60)
    print("TEST: Different Languages")
    print("=" * 60)

    test_cases = [
        {
            "lang": "English",
            "text": "Hello, this is a test of the voice design system.",
        },
        {
            "lang": "Chinese",
            "text": "你好，这是语音设计系统的测试。",
        },
        {
            "lang": "Japanese",
            "text": "こんにちは、これは音声デザインシステムのテストです。",
        },
        {
            "lang": "French",
            "text": "Bonjour, ceci est un test du système de conception vocale.",
        },
    ]

    all_passed = True

    for test in test_cases:
        print(f"\n  Testing: {test['lang']}")

        payload = {
            "text": test["text"],
            "language": test["lang"],
            "instruct": "A neutral, clear voice suitable for demonstrations.",
        }

        start = time.time()
        response = requests.post(VOICE_DESIGN_ENDPOINT, json=payload, timeout=120)
        elapsed = time.time() - start

        if response.status_code == 200:
            audio_bytes = response.content
            output_path = OUTPUT_DIR / f"lang_{test['lang'].lower()}.wav"
            with open(output_path, "wb") as f:
                f.write(audio_bytes)
            print(f"  ✅ {test['lang']}: {len(audio_bytes)} bytes in {elapsed:.1f}s")
        else:
            print(f"  ❌ {test['lang']}: {response.status_code}")
            all_passed = False

    if all_passed:
        print("\n✅ ALL LANGUAGES PASSED")
    else:
        print("\n❌ SOME LANGUAGES FAILED")

    return all_passed


def test_design_to_clone_workflow(designed_audio: bytes):
    """Test the complete workflow: design a voice, then use it for cloning."""
    print("\n" + "=" * 60)
    print("TEST: Design → Clone Workflow")
    print("=" * 60)

    if designed_audio is None:
        print("⚠️ SKIPPED: No designed audio available")
        return False

    # The designed audio text (used as ref_text for cloning)
    ref_text = (
        "Hello! I'm so glad you're here. Let me help you with anything you need today."
    )

    # New text to generate with the cloned voice
    clone_text = "Now I can say anything with this designed voice. The voice cloning system preserves the characteristics I described."

    print(f"Reference text: {ref_text[:50]}...")
    print(f"Clone text: {clone_text[:50]}...")

    # Encode designed audio as base64
    audio_b64 = base64.b64encode(designed_audio).decode("utf-8")

    payload = {
        "text": clone_text,
        "language": "English",
        "ref_audio_base64": audio_b64,
        "ref_text": ref_text,
    }

    start = time.time()
    response = requests.post(CLONE_ENDPOINT, json=payload, timeout=180)
    elapsed = time.time() - start

    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.1f}s")

    if response.status_code == 200:
        cloned_audio = response.content
        print(f"Cloned audio size: {len(cloned_audio)} bytes")

        output_path = OUTPUT_DIR / "design_to_clone.wav"
        with open(output_path, "wb") as f:
            f.write(cloned_audio)
        print(f"Saved: {output_path}")
        print("✅ PASSED")
        return True
    else:
        print(f"❌ FAILED: {response.text[:200]}")
        return False


def run_all_tests():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("QWEN3-TTS VOICE DESIGN TEST SUITE")
    print("=" * 60)
    print(f"Design endpoint: {VOICE_DESIGN_ENDPOINT}")
    print(f"Clone endpoint: {CLONE_ENDPOINT}")
    print(f"Output directory: {OUTPUT_DIR}")

    results = {}

    # Health check (also warms up the container)
    results["health"] = test_health()

    # Basic design
    passed, audio = test_basic_design()
    results["basic_design"] = passed

    # Validation tests
    results["validation_missing_instruct"] = test_validation_missing_instruct()
    results["validation_missing_text"] = test_validation_missing_text()
    results["validation_invalid_language"] = test_validation_invalid_language()

    # Different voices
    results["different_voices"] = test_different_voices()

    # Different languages
    results["different_languages"] = test_different_languages()

    # Design to clone workflow
    results["design_to_clone"] = test_design_to_clone_workflow(audio)

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("\n⚠️ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
