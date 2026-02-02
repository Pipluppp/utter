# Step 6: Deployment

> **Time Required**: ~5 minutes (deploy), ~90 seconds (first cold start)
> **Prerequisites**: Completed [Step 5: API Endpoints](./05-api-endpoints.md)
> **Last Updated**: 2026-01-27

This guide covers deploying the service to Modal and testing the live endpoints.

---

## Actual Deployment (2026-01-28)

The 1.7B and 0.6B models have been deployed. Live endpoints:

### 1.7B Model (A10G)

| Endpoint | URL |
|----------|-----|
| Clone | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run` |
| Clone Batch | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone-batch.modal.run` |
| Health | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run` |
| Languages | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-languages.modal.run` |

### 0.6B Model (T4)

| Endpoint | URL |
|----------|-----|
| Clone | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run` |
| Health | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-health.modal.run` |
| Languages | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-languages.modal.run` |

---

## Important: Windows Deployment Commands

On Windows, Modal CLI outputs Unicode characters that cause encoding errors. Always pipe through `cat`:

```bash
# Instead of: modal deploy app.py
# Use:
cd modal_app/qwen3_tts
uv run modal deploy app.py 2>&1 | cat
```

This project uses `uv` for package management, so prefix all modal commands with `uv run`.

---

## 6.1 Development Mode vs Production

| Mode | Command | Use Case |
|------|---------|----------|
| Development | `modal serve app.py` | Live reload, testing |
| Production | `modal deploy app.py` | Persistent deployment |

---

## 6.2 Development Mode (Recommended First)

Start the development server with hot reload:

```bash
modal serve app.py
```

**Expected output:**

```
✓ Created objects.
├── 🔨 Created mount /path/to/app.py
├── 🔨 Created function Qwen3TTSService.*
├── 🔨 Created web endpoint Qwen3TTSService.clone (POST) => https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-clone-dev.modal.run
├── 🔨 Created web endpoint Qwen3TTSService.clone_batch (POST) => https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-clone-batch-dev.modal.run
├── 🔨 Created web endpoint Qwen3TTSService.health (GET) => https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-health-dev.modal.run
└── 🔨 Created web endpoint Qwen3TTSService.languages (GET) => https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-languages-dev.modal.run
Serving app at https://your-workspace--qwen3-tts-voice-clone-dev.modal.run
```

**Note**: Development URLs include `-dev` suffix and stop when you exit.

---

## 6.3 Test Development Endpoints

### Test Health Endpoint

```bash
curl https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-health-dev.modal.run
```

**Expected response:**

```json
{
  "status": "healthy",
  "model": "Qwen3-TTS-12Hz-1.7B-Base",
  "gpu": "NVIDIA A10G",
  "attention_implementation": "sdpa",
  "supported_languages": ["Auto", "Chinese", "English", ...]
}
```

### Test Languages Endpoint

```bash
curl https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-languages-dev.modal.run
```

### Test Voice Clone Endpoint

**Important**: The Qwen sample audio URL returns 403 Forbidden. Use base64-encoded audio instead.

**Using the test script** (recommended):
```bash
cd test
python test_qwen3_tts.py
```

**Using curl with base64** (create JSON file first):
```python
# Create test_request.json with Python:
import base64, json
with open('test/2026-01-26/audio.wav', 'rb') as f:
    audio_b64 = base64.b64encode(f.read()).decode()
with open('test/2026-01-26/audio_text.txt') as f:
    ref_text = f.read().strip()
with open('test_request.json', 'w') as f:
    json.dump({
        'text': 'Hello, this is a test.',
        'language': 'English',
        'ref_audio_base64': audio_b64,
        'ref_text': ref_text
    }, f)
```

Then:
```bash
curl -X POST https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run \
  -H "Content-Type: application/json" \
  -d @test_request.json \
  --output test_output.wav
```

**Verify the audio file:**

```bash
# Check file size (should be > 10KB)
ls -la test_output.wav

# Play the audio (macOS)
afplay test_output.wav

# Play the audio (Linux)
aplay test_output.wav

# Play the audio (Windows PowerShell)
Start-Process test_output.wav
```

---

## 6.4 Production Deployment

Once testing is complete, deploy to production:

```bash
modal deploy app.py
```

**Expected output:**

```
✓ Created objects.
├── 🔨 Created mount /path/to/app.py
├── 🔨 Created function Qwen3TTSService.*
├── 🔨 Created web endpoint Qwen3TTSService.clone (POST)
│   ⤷ https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run
├── 🔨 Created web endpoint Qwen3TTSService.clone_batch (POST)
│   ⤷ https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-clone-batch.modal.run
├── 🔨 Created web endpoint Qwen3TTSService.health (GET)
│   ⤷ https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run
└── 🔨 Created web endpoint Qwen3TTSService.languages (GET)
    ⤷ https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-languages.modal.run
✓ App deployed! 🎉
```

**Note**: Production URLs do NOT have the `-dev` suffix and persist until stopped.

---

## 6.5 Create Test Client

Create `test_client.py` for comprehensive testing:

```python
"""
Test client for Qwen3-TTS Modal API.

Usage:
    python test_client.py --endpoint https://your-endpoint.modal.run
"""

import argparse
import base64
import json
import time
from pathlib import Path

import requests


def test_health(base_url: str) -> dict:
    """Test the health endpoint."""
    url = f"{base_url.rstrip('/')}"
    # Extract the health URL from the clone URL
    health_url = url.replace("-clone.", "-health.")

    print(f"Testing: GET {health_url}")
    start = time.time()
    response = requests.get(health_url, timeout=60)
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


def test_batch(base_url: str, output_dir: str = ".") -> float:
    """Test batch voice cloning."""
    url = base_url.rstrip("/").replace("-clone.", "-clone-batch.")

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


def main():
    parser = argparse.ArgumentParser(description="Test Qwen3-TTS Modal API")
    parser.add_argument(
        "--endpoint",
        required=True,
        help="Clone endpoint URL"
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

    args = parser.parse_args()

    print("=" * 60)
    print("Qwen3-TTS Modal API Test")
    print("=" * 60)
    print()

    # Test health
    print("[1/4] Health Check")
    print("-" * 40)
    test_health(args.endpoint)
    print()

    # Test voice clone with URL
    print("[2/4] Voice Clone (URL reference)")
    print("-" * 40)
    test_clone_url(args.endpoint)
    print()

    # Test voice clone with base64
    if args.ref_audio and args.ref_text:
        print("[3/4] Voice Clone (Base64 reference)")
        print("-" * 40)
        test_clone_base64(args.endpoint, args.ref_audio, args.ref_text)
        print()
    else:
        print("[3/4] Voice Clone (Base64) - SKIPPED")
        print("  Provide --ref-audio and --ref-text to enable")
        print()

    # Test batch
    if not args.skip_batch:
        print("[4/4] Batch Voice Clone")
        print("-" * 40)
        test_batch(args.endpoint)
        print()
    else:
        print("[4/4] Batch Voice Clone - SKIPPED")
        print()

    print("=" * 60)
    print("Tests Complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
```

### Run the Test Client

```bash
# Install requests if needed
pip install requests

# Run tests
python test_client.py --endpoint https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run

# With local reference audio
python test_client.py \
  --endpoint https://your-endpoint.modal.run \
  --ref-audio my_voice.wav \
  --ref-text "This is what I said in the recording."
```

---

## 6.6 View Logs

Monitor your deployment:

```bash
# View recent logs
modal app logs qwen3-tts-voice-clone

# Follow logs in real-time
modal app logs qwen3-tts-voice-clone --follow
```

---

## 6.7 Managing Deployments

### List Running Apps

```bash
modal app list
```

### Stop Deployment

```bash
modal app stop qwen3-tts-voice-clone
```

### Update Deployment

Make changes to `app.py`, then:

```bash
modal deploy app.py
```

Modal handles rolling updates automatically.

---

## 6.8 Endpoint URLs Summary

After deployment, you'll have these endpoints:

| Endpoint | URL Pattern |
|----------|-------------|
| Clone | `https://{workspace}--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run` |
| Clone Batch | `https://{workspace}--qwen3-tts-voice-clone-qwen3ttsservice-clone-batch.modal.run` |
| Health | `https://{workspace}--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run` |
| Languages | `https://{workspace}--qwen3-tts-voice-clone-qwen3ttsservice-languages.modal.run` |
| API Docs | `https://{workspace}--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run/docs` |

---

## 6.9 Cold Start Behavior

**First Request**:
1. Modal provisions a container (~5-10s)
2. Container downloads image layers (~10-20s if not cached)
3. `@modal.enter()` loads model (~30-60s from volume)
4. Request is processed

**Subsequent Requests** (within `scaledown_window`):
1. Container is already warm
2. Model is already in GPU memory
3. Request is processed immediately (~2-5s for generation)

**Tip**: Send a health check request periodically to keep containers warm.

---

## 6.10 API Documentation Access

FastAPI auto-generates interactive documentation:

```
https://your-workspace--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run/docs
```

This provides:
- Interactive request testing
- Request/response schema
- Example payloads

---

## Checklist

Before proceeding, confirm:

- [ ] `modal serve app.py` works (development mode)
- [ ] Health endpoint returns valid response
- [ ] Clone endpoint generates audio
- [ ] `modal deploy app.py` succeeds (production)
- [ ] Production endpoints accessible
- [ ] `test_client.py` passes all tests

---

## Next Step

If you encounter issues, see [Step 7: Troubleshooting](./07-troubleshooting.md)
