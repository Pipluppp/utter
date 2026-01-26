"""
Qwen3-TTS Voice Cloning on Modal.com

This package provides multi-language voice cloning using Qwen3-TTS models
deployed on Modal's serverless GPU infrastructure.

Usage:
    # Download models to volume first
    modal run download_models.py --model-size 1.7B

    # Deploy the service
    modal deploy app.py

    # Test the service
    python test_client.py --endpoint <your-endpoint-url>

Modules:
    - app.py: Main Modal application with Qwen3TTSService class
    - config.py: Configuration constants
    - download_models.py: Script to pre-download models to Modal volume
    - test_client.py: Test client for API testing
"""

__version__ = "1.0.0"
