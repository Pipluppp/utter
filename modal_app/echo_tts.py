"""
Echo-TTS deployment on Modal.com

Provides GPU-accelerated voice cloning for the Utter app.
"""
import os
import tempfile

import modal

# Define the Modal app
app = modal.App("utter-tts")

# Define the container image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .run_commands(
        # Clone the echo-tts repository
        "git clone https://github.com/jordandare/echo-tts.git /app/echo-tts",
        # Install pytorch first (CUDA 11.8)
        "pip install torch==2.1.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu118",
    )
    .workdir("/app/echo-tts")
    .run_commands(
        # Install echo-tts requirements
        "pip install -r requirements.txt",
    )
)


@app.cls(
    gpu="A10G",                    # 24GB VRAM
    image=image,
    scaledown_window=300,          # Keep warm for 5 min
    timeout=120,                   # 2 min max per request
)
class EchoTTS:
    """Echo-TTS voice cloning service."""
    
    @modal.enter()
    def load_model(self):
        """Load model once when container starts."""
        import sys
        sys.path.insert(0, "/app/echo-tts")
        
        from inference import (
            load_model_from_hf,
            load_fish_ae_from_hf,
            load_pca_state_from_hf,
        )
        
        print("Loading Echo-TTS models...")
        self.model = load_model_from_hf(delete_blockwise_modules=True)
        self.fish_ae = load_fish_ae_from_hf()
        self.pca_state = load_pca_state_from_hf()
        print("Models loaded!")
    
    @modal.method()
    def generate(self, text: str, reference_audio_bytes: bytes) -> bytes:
        """
        Generate speech from text using a reference voice.
        
        Args:
            text: Text to speak (already preprocessed with [S1] tag)
            reference_audio_bytes: WAV/MP3 file bytes
            
        Returns:
            Generated audio as MP3 bytes
        """
        import sys
        sys.path.insert(0, "/app/echo-tts")
        
        import subprocess
        import torch
        import torchaudio
        import tempfile
        from functools import partial
        from inference import (
            load_audio,
            sample_pipeline,
            sample_euler_cfg_independent_guidances,
        )
        
        # Save reference audio bytes to temp file (load_audio expects a path)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(reference_audio_bytes)
            temp_path = f.name
        
        try:
            # Load reference audio
            speaker_audio = load_audio(temp_path).cuda()
            
            # Configure sampler with all required parameters
            sample_fn = partial(
                sample_euler_cfg_independent_guidances,
                num_steps=30,  # was 40; blog says "30 generally works well"
                cfg_scale_text=3.0,
                cfg_scale_speaker=8.0,
                cfg_min_t=0.5,
                cfg_max_t=1.0,
                truncation_factor=None,
                rescale_k=1.0,  # explicit default per Echo-TTS docs
                rescale_sigma=3.0,  # explicit default per Echo-TTS docs
                speaker_kv_scale=None,
                speaker_kv_max_layers=None,
                speaker_kv_min_t=None,
                sequence_length=640,  # ~30 seconds max
            )
            
            # Generate
            audio_out, _ = sample_pipeline(
                model=self.model,
                fish_ae=self.fish_ae,
                pca_state=self.pca_state,
                sample_fn=sample_fn,
                text_prompt=text,
                speaker_audio=speaker_audio,
                rng_seed=0,
            )
            
            # Save WAV to temp file
            wav_temp_path = temp_path.replace(".wav", "_output.wav")
            torchaudio.save(wav_temp_path, audio_out[0].cpu(), 44100)
            
            # Convert to MP3 using ffmpeg
            mp3_temp_path = wav_temp_path.replace(".wav", ".mp3")
            subprocess.run([
                "ffmpeg", "-y", "-i", wav_temp_path,
                "-codec:a", "libmp3lame", "-qscale:a", "2",
                mp3_temp_path
            ], check=True, capture_output=True)
            
            # Read MP3 bytes
            with open(mp3_temp_path, "rb") as f:
                audio_bytes = f.read()
            
            # Cleanup temp files
            os.unlink(wav_temp_path)
            os.unlink(mp3_temp_path)
            
            return audio_bytes
        finally:
            # Cleanup input temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)


# Test function for local debugging
@app.local_entrypoint()
def test():
    """Test the TTS service."""
    import os
    
    tts = EchoTTS()
    
    # Look for a test audio file
    test_files = ["test_reference.wav", "test_reference.mp3"]
    audio_file = None
    
    for f in test_files:
        if os.path.exists(f):
            audio_file = f
            break
    
    if audio_file is None:
        print("No test audio file found. Create 'test_reference.wav' to test.")
        print("The file should be 10+ seconds of clear speech.")
        return
    
    # Read test audio file
    with open(audio_file, "rb") as f:
        audio_bytes = f.read()
    
    print(f"Using reference audio: {audio_file}")
    print("Generating speech...")
    
    result = tts.generate.remote(
        text="[S1] Hello, this is a test of the voice cloning system.",
        reference_audio_bytes=audio_bytes
    )
    
    with open("test_output.wav", "wb") as f:
        f.write(result)
    
    print("Generated test_output.wav")
