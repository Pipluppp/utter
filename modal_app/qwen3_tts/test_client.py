"""
Test client for Qwen3-TTS Modal API.

Usage:
    python test_client.py --endpoint https://your-endpoint.modal.run

Examples:
    # Test with URL reference (uses Qwen sample audio)
    python test_client.py --endpoint https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run

    # Test with local reference audio
    python test_client.py \
        --endpoint https://your-endpoint.modal.run \
        --ref-audio my_voice.wav \
        --ref-text "This is what I said in the recording."
"""

import argparse
import base64
import json
import time
from pathlib import Path

import requests


def test_health(base_url: str) -> dict:
    """Test the health endpoint."""
    # Extract the health URL from the clone URL
    health_url = base_url.replace("-clone.", "-health.").replace("-clone-batch.", "-health.")

    print(f"Testing: GET {health_url}")
    start = time.time()

    try:
        response = requests.get(health_url, timeout=120)  # Longer timeout for cold start
        elapsed = time.time() - start

        print(f"  Status: {response.status_code}")
        print(f"  Time: {elapsed:.2f}s")

        if response.ok:
            data = response.json()
            print(f"  Model: {data['model']}")
            print(f"  GPU: {data['gpu']}")
            print(f"  Attention: {data['attention_implementation']}")
            return data
        else:
            print(f"  Error: {response.text}")
            return {}
    except requests.exceptions.Timeout:
        print("  Error: Request timed out (cold start may take longer)")
        return {}
    except requests.exceptions.RequestException as e:
        print(f"  Error: {e}")
        return {}


def test_languages(base_url: str) -> dict:
    """Test the languages endpoint."""
    languages_url = base_url.replace("-clone.", "-languages.").replace("-clone-batch.", "-languages.")

    print(f"Testing: GET {languages_url}")
    start = time.time()

    try:
        response = requests.get(languages_url, timeout=60)
        elapsed = time.time() - start

        print(f"  Status: {response.status_code}")
        print(f"  Time: {elapsed:.2f}s")

        if response.ok:
            data = response.json()
            print(f"  Languages: {', '.join(data['languages'][:5])}...")
            print(f"  Default: {data['default']}")
            return data
        else:
            print(f"  Error: {response.text}")
            return {}
    except requests.exceptions.RequestException as e:
        print(f"  Error: {e}")
        return {}


def test_clone_url(base_url: str, output_path: str = "output_url.wav") -> float:
    """Test voice cloning with URL reference."""
    url = base_url.rstrip("/")

    payload = {
        "text": "The quick brown fox jumps over the lazy dog. "
                "This is a test of the Qwen3 text to speech voice cloning system.",
        "language": "English",
        "ref_audio_url": "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen3-TTS-Repo/clone.wav",
        "ref_text": "Okay. Yeah. I resent you. I love you. I respect you. "
                    "But you know what? You blew it! And thanks to you.",
        "max_new_tokens": 2048,
    }

    print(f"Testing: POST {url}")
    print(f"  Text: '{payload['text'][:50]}...'")

    start = time.time()
    try:
        response = requests.post(url, json=payload, timeout=300)
        elapsed = time.time() - start

        print(f"  Status: {response.status_code}")
        print(f"  Time: {elapsed:.2f}s")

        if response.ok:
            with open(output_path, "wb") as f:
                f.write(response.content)
            print(f"  Saved: {output_path} ({len(response.content):,} bytes)")
            return elapsed
        else:
            print(f"  Error: {response.text}")
            return -1
    except requests.exceptions.Timeout:
        print("  Error: Request timed out")
        return -1
    except requests.exceptions.RequestException as e:
        print(f"  Error: {e}")
        return -1


def test_clone_base64(
    base_url: str,
    audio_path: str,
    transcript: str,
    output_path: str = "output_base64.wav"
) -> float:
    """Test voice cloning with base64-encoded reference."""
    url = base_url.rstrip("/")

    # Read and encode reference audio
    with open(audio_path, "rb") as f:
        audio_base64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "text": "This is a test using a local reference audio file for voice cloning.",
        "language": "English",
        "ref_audio_base64": audio_base64,
        "ref_text": transcript,
        "max_new_tokens": 2048,
    }

    print(f"Testing: POST {url} (base64 reference)")
    print(f"  Reference: {audio_path}")

    start = time.time()
    try:
        response = requests.post(url, json=payload, timeout=300)
        elapsed = time.time() - start

        print(f"  Status: {response.status_code}")
        print(f"  Time: {elapsed:.2f}s")

        if response.ok:
            with open(output_path, "wb") as f:
                f.write(response.content)
            print(f"  Saved: {output_path} ({len(response.content):,} bytes)")
            return elapsed
        else:
            print(f"  Error: {response.text}")
            return -1
    except requests.exceptions.Timeout:
        print("  Error: Request timed out")
        return -1
    except requests.exceptions.RequestException as e:
        print(f"  Error: {e}")
        return -1


def test_batch(base_url: str, output_dir: str = ".") -> float:
    """Test batch voice cloning."""
    url = base_url.replace("-clone.", "-clone-batch.")
    if not url.endswith("-batch.modal.run") and "-clone-batch" not in url:
        url = url.replace("-clone.modal.run", "-clone-batch.modal.run")

    payload = {
        "texts": [
            "This is the first sentence.",
            "This is the second sentence.",
            "And this is the third sentence.",
        ],
        "languages": ["English", "English", "English"],
        "ref_audio_url": "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen3-TTS-Repo/clone.wav",
        "ref_text": "Okay. Yeah. I resent you. I love you. I respect you. "
                    "But you know what? You blew it! And thanks to you.",
    }

    print(f"Testing: POST {url} (batch)")
    print(f"  Items: {len(payload['texts'])}")

    start = time.time()
    try:
        response = requests.post(url, json=payload, timeout=300)
        elapsed = time.time() - start

        print(f"  Status: {response.status_code}")
        print(f"  Time: {elapsed:.2f}s")

        if response.ok:
            data = response.json()
            print(f"  Generated: {data['count']} files")

            # Save each audio file
            for item in data["audio_files"]:
                audio_bytes = base64.b64decode(item["audio_base64"])
                filepath = Path(output_dir) / f"batch_{item['index']}.wav"
                with open(filepath, "wb") as f:
                    f.write(audio_bytes)
                print(f"    [{item['index']}] {filepath} ({item['size_bytes']:,} bytes)")

            return elapsed
        else:
            print(f"  Error: {response.text}")
            return -1
    except requests.exceptions.Timeout:
        print("  Error: Request timed out")
        return -1
    except requests.exceptions.RequestException as e:
        print(f"  Error: {e}")
        return -1


def main():
    parser = argparse.ArgumentParser(description="Test Qwen3-TTS Modal API")
    parser.add_argument(
        "--endpoint",
        required=True,
        help="Clone endpoint URL (e.g., https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run)"
    )
    parser.add_argument(
        "--ref-audio",
        help="Local reference audio file for base64 test"
    )
    parser.add_argument(
        "--ref-text",
        help="Transcript of reference audio"
    )
    parser.add_argument(
        "--skip-batch",
        action="store_true",
        help="Skip batch test"
    )
    parser.add_argument(
        "--skip-health",
        action="store_true",
        help="Skip health check (useful if you know the service is warm)"
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Directory to save output files"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Qwen3-TTS Modal API Test")
    print("=" * 60)
    print()

    # Test health
    if not args.skip_health:
        print("[1/5] Health Check")
        print("-" * 40)
        test_health(args.endpoint)
        print()

        print("[2/5] Languages Check")
        print("-" * 40)
        test_languages(args.endpoint)
        print()
    else:
        print("[1/5] Health Check - SKIPPED")
        print("[2/5] Languages Check - SKIPPED")
        print()

    # Test voice clone with URL
    print("[3/5] Voice Clone (URL reference)")
    print("-" * 40)
    output_url = str(Path(args.output_dir) / "output_url.wav")
    test_clone_url(args.endpoint, output_url)
    print()

    # Test voice clone with base64
    if args.ref_audio and args.ref_text:
        print("[4/5] Voice Clone (Base64 reference)")
        print("-" * 40)
        output_b64 = str(Path(args.output_dir) / "output_base64.wav")
        test_clone_base64(args.endpoint, args.ref_audio, args.ref_text, output_b64)
        print()
    else:
        print("[4/5] Voice Clone (Base64) - SKIPPED")
        print("  Provide --ref-audio and --ref-text to enable")
        print()

    # Test batch
    if not args.skip_batch:
        print("[5/5] Batch Voice Clone")
        print("-" * 40)
        test_batch(args.endpoint, args.output_dir)
        print()
    else:
        print("[5/5] Batch Voice Clone - SKIPPED")
        print()

    print("=" * 60)
    print("Tests Complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
