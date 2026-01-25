# Step 3: Model Caching

> **Time Required**: ~15-30 minutes (download time depends on network)
> **Prerequisites**: Completed [Step 2: Image Building](./02-image-building.md)

This guide covers pre-downloading Qwen3-TTS models to a Modal Volume to avoid cold-start delays.

---

## 3.1 Why Pre-Download?

Without pre-downloading:
1. First request triggers a ~5-10GB model download
2. Cold start takes 5-10 minutes
3. Request may timeout

With pre-downloading:
1. Models are already on the volume
2. Cold start takes ~30-60 seconds (just loading weights)
3. Consistent fast startup

---

## 3.2 Create Download Script

Create `download_models.py` with the following content:

```python
"""
Model download script for Qwen3-TTS.

Run with:
    modal run download_models.py
    modal run download_models.py --model-size 1.7B
    modal run download_models.py --model-size 0.6B

Sources:
- HuggingFace model cards: https://huggingface.co/Qwen
- Modal volumes guide: https://modal.com/docs/guide/volumes
"""

import modal

# =============================================================================
# Configuration
# =============================================================================

# Model identifiers (from HuggingFace)
MODELS = {
    "1.7B": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    "0.6B": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
}

# The tokenizer is shared across all models
TOKENIZER_ID = "Qwen/Qwen3-TTS-Tokenizer-12Hz"

# Volume configuration
MODELS_DIR = "/vol/models"
HF_CACHE_DIR = f"{MODELS_DIR}/huggingface"

# =============================================================================
# Image Definition
# =============================================================================

# Minimal image for downloading (doesn't need full qwen-tts)
download_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "huggingface_hub[cli]",
        "transformers",
    )
    .env({
        "HF_HOME": HF_CACHE_DIR,
        "TRANSFORMERS_CACHE": HF_CACHE_DIR,
        "HF_HUB_CACHE": HF_CACHE_DIR,
    })
)

# =============================================================================
# Modal App
# =============================================================================

app = modal.App("qwen3-tts-download", image=download_image)

# Create volume reference
# Source: Modal volumes guide - lazy creation pattern
models_volume = modal.Volume.from_name(
    "qwen3-tts-models",
    create_if_missing=True
)

# =============================================================================
# Download Function
# =============================================================================

@app.function(
    volumes={MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=3600,  # 1 hour for large downloads
)
def download_model(model_id: str):
    """
    Download a single model to the volume.

    Args:
        model_id: HuggingFace model ID (e.g., "Qwen/Qwen3-TTS-12Hz-1.7B-Base")

    Sources:
    - huggingface_hub.snapshot_download: https://huggingface.co/docs/huggingface_hub
    - Modal volumes: https://modal.com/docs/guide/volumes
    """
    import os
    from huggingface_hub import snapshot_download

    # Extract model name from ID for local path
    model_name = model_id.split("/")[-1]
    local_dir = f"{MODELS_DIR}/{model_name}"

    print(f"=" * 60)
    print(f"Downloading: {model_id}")
    print(f"Target: {local_dir}")
    print(f"=" * 60)

    # Check if already downloaded
    if os.path.exists(local_dir) and os.listdir(local_dir):
        print(f"Model already exists at {local_dir}")
        print("Skipping download (delete volume contents to re-download)")
        return local_dir

    # Download using huggingface_hub
    # Source: huggingface_hub documentation
    # snapshot_download respects HF_HOME environment variable
    result_path = snapshot_download(
        repo_id=model_id,
        local_dir=local_dir,
        local_dir_use_symlinks=False,  # Copy files, don't symlink
    )

    print(f"Download complete: {result_path}")

    # List downloaded files
    print("\nDownloaded files:")
    total_size = 0
    for root, dirs, files in os.walk(local_dir):
        for file in files:
            filepath = os.path.join(root, file)
            size_mb = os.path.getsize(filepath) / (1024 * 1024)
            total_size += size_mb
            rel_path = os.path.relpath(filepath, MODELS_DIR)
            print(f"  {rel_path}: {size_mb:.1f} MB")

    print(f"\nTotal size: {total_size:.1f} MB")

    # Commit volume changes
    # Source: Modal volumes guide
    # "call vol.commit() to ensure changes persist before function exit"
    models_volume.commit()
    print("Volume committed successfully")

    return local_dir


@app.function(
    volumes={MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=3600,
)
def download_all_models(model_size: str = "both"):
    """
    Download models based on size selection.

    Args:
        model_size: "1.7B", "0.6B", or "both"
    """
    import os

    models_to_download = []

    # Determine which models to download
    if model_size == "both":
        models_to_download = list(MODELS.values())
    elif model_size in MODELS:
        models_to_download = [MODELS[model_size]]
    else:
        raise ValueError(f"Invalid model_size: {model_size}. Use '1.7B', '0.6B', or 'both'")

    # Always download the tokenizer
    models_to_download.append(TOKENIZER_ID)

    print(f"Models to download: {models_to_download}")
    print()

    # Download each model
    for model_id in models_to_download:
        download_model.local(model_id)
        print()

    # Final volume commit
    models_volume.commit()

    # List all contents
    print("=" * 60)
    print("Volume contents summary:")
    print("=" * 60)

    for item in os.listdir(MODELS_DIR):
        item_path = os.path.join(MODELS_DIR, item)
        if os.path.isdir(item_path):
            # Count files and total size
            file_count = 0
            total_size = 0
            for root, dirs, files in os.walk(item_path):
                file_count += len(files)
                for f in files:
                    total_size += os.path.getsize(os.path.join(root, f))
            print(f"  {item}/: {file_count} files, {total_size / (1024**3):.2f} GB")

    print("\nDownload complete!")


@app.function(
    volumes={MODELS_DIR: models_volume},
)
def list_volume_contents():
    """List all contents of the model volume."""
    import os

    print("Volume contents at", MODELS_DIR)
    print("=" * 60)

    if not os.path.exists(MODELS_DIR):
        print("Volume mount point does not exist!")
        return

    for root, dirs, files in os.walk(MODELS_DIR):
        # Calculate depth for indentation
        depth = root.replace(MODELS_DIR, "").count(os.sep)
        indent = "  " * depth
        folder_name = os.path.basename(root) or MODELS_DIR
        print(f"{indent}{folder_name}/")

        # Print files with sizes
        sub_indent = "  " * (depth + 1)
        for file in files[:10]:  # Limit files shown per directory
            filepath = os.path.join(root, file)
            size_mb = os.path.getsize(filepath) / (1024 * 1024)
            print(f"{sub_indent}{file}: {size_mb:.1f} MB")

        if len(files) > 10:
            print(f"{sub_indent}... and {len(files) - 10} more files")


@app.function(
    volumes={MODELS_DIR: models_volume},
)
def clear_volume():
    """
    Clear all contents from the volume.

    WARNING: This deletes all downloaded models!
    """
    import os
    import shutil

    print("WARNING: Clearing all volume contents!")
    print("=" * 60)

    for item in os.listdir(MODELS_DIR):
        item_path = os.path.join(MODELS_DIR, item)
        print(f"Deleting: {item_path}")
        if os.path.isdir(item_path):
            shutil.rmtree(item_path)
        else:
            os.remove(item_path)

    models_volume.commit()
    print("Volume cleared and committed")


# =============================================================================
# CLI Entrypoint
# =============================================================================

@app.local_entrypoint()
def main(
    model_size: str = "both",
    list_only: bool = False,
    clear: bool = False,
):
    """
    Download Qwen3-TTS models to Modal volume.

    Args:
        model_size: Which model(s) to download - "1.7B", "0.6B", or "both"
        list_only: Just list volume contents without downloading
        clear: Clear all volume contents (WARNING: deletes models!)

    Usage:
        modal run download_models.py                      # Download both models
        modal run download_models.py --model-size 1.7B    # Download 1.7B only
        modal run download_models.py --model-size 0.6B    # Download 0.6B only
        modal run download_models.py --list-only          # List contents
        modal run download_models.py --clear              # Clear volume
    """
    if clear:
        confirm = input("Are you sure you want to clear the volume? (yes/no): ")
        if confirm.lower() == "yes":
            clear_volume.remote()
        else:
            print("Cancelled")
        return

    if list_only:
        list_volume_contents.remote()
        return

    # Download models
    download_all_models.remote(model_size)
```

---

## 3.3 Run the Download

### Download Both Models (Recommended)

```bash
modal run download_models.py
```

This downloads:
- `Qwen3-TTS-12Hz-1.7B-Base` (~6-7 GB)
- `Qwen3-TTS-12Hz-0.6B-Base` (~2-3 GB)
- `Qwen3-TTS-Tokenizer-12Hz` (~100 MB)

**Expected output:**

```
============================================================
Downloading: Qwen/Qwen3-TTS-12Hz-1.7B-Base
Target: /vol/models/Qwen3-TTS-12Hz-1.7B-Base
============================================================
Downloading model files...
Download complete: /vol/models/Qwen3-TTS-12Hz-1.7B-Base

Downloaded files:
  Qwen3-TTS-12Hz-1.7B-Base/config.json: 0.1 MB
  Qwen3-TTS-12Hz-1.7B-Base/model.safetensors: 6543.2 MB
  ...

Total size: 6789.5 MB
Volume committed successfully

... (repeats for other models)

Download complete!
```

### Download Specific Model

```bash
# Download only the 1.7B model
modal run download_models.py --model-size 1.7B

# Download only the 0.6B model
modal run download_models.py --model-size 0.6B
```

---

## 3.4 Verify the Download

### List Volume Contents

```bash
modal run download_models.py --list-only
```

**Expected output:**

```
Volume contents at /vol/models
============================================================
/vol/models/
  Qwen3-TTS-12Hz-1.7B-Base/
    config.json: 0.1 MB
    model.safetensors: 6543.2 MB
    ...
  Qwen3-TTS-12Hz-0.6B-Base/
    config.json: 0.1 MB
    model.safetensors: 2134.5 MB
    ...
  Qwen3-TTS-Tokenizer-12Hz/
    ...
```

### Using Modal CLI

```bash
# List volume contents
modal volume ls qwen3-tts-models

# List specific directory
modal volume ls qwen3-tts-models Qwen3-TTS-12Hz-1.7B-Base
```

---

## 3.5 Volume Path Structure

After download, the volume contains:

```
/vol/models/
├── Qwen3-TTS-12Hz-1.7B-Base/
│   ├── config.json
│   ├── model.safetensors
│   ├── generation_config.json
│   └── ...
├── Qwen3-TTS-12Hz-0.6B-Base/
│   ├── config.json
│   ├── model.safetensors
│   └── ...
├── Qwen3-TTS-Tokenizer-12Hz/
│   └── ...
└── huggingface/
    └── ... (HF cache directory)
```

The main app will load from `/vol/models/Qwen3-TTS-12Hz-1.7B-Base` directly.

---

## 3.6 Re-downloading Models

If you need to re-download (e.g., after a model update):

```bash
# Clear the volume first
modal run download_models.py --clear

# Then download again
modal run download_models.py
```

Or delete specific model directory:

```bash
# Use Modal volume commands
modal volume rm qwen3-tts-models Qwen3-TTS-12Hz-1.7B-Base

# Then re-download
modal run download_models.py --model-size 1.7B
```

---

## 3.7 Troubleshooting Downloads

### Issue: Download Timeout

**Symptom**: Function times out after 1 hour

**Solution**: Download models individually:

```bash
modal run download_models.py --model-size 1.7B
# Wait for completion
modal run download_models.py --model-size 0.6B
```

### Issue: HuggingFace Rate Limit

**Symptom**: `429 Too Many Requests`

**Solution**: Wait and retry, or use a HuggingFace Pro account

### Issue: Volume Not Persisting

**Symptom**: Models disappear after download

**Solution**: Ensure `volume.commit()` is called. The script does this automatically.

### Issue: Permission Denied

**Symptom**: `PermissionError` during download

**Solution**: Check that the secret `huggingface-secret` exists and has a valid token

---

## Checklist

Before proceeding, confirm:

- [ ] `download_models.py` created
- [ ] Models downloaded successfully (`modal run download_models.py`)
- [ ] Volume contents verified (`modal run download_models.py --list-only`)
- [ ] At least one model (1.7B or 0.6B) is present on the volume

---

## Next Step

Proceed to [Step 4: Core Service](./04-core-service.md)
