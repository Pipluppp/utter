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

    print("=" * 60)
    print(f"Downloading: {model_id}")
    print(f"Target: {local_dir}")
    print("=" * 60)

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
