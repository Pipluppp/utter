import os
import sys
import asyncio
from pathlib import Path
from unittest.mock import MagicMock

# 1. Setup Environment
CWD = os.getcwd()
print(f"CWD: {CWD}")
BACKEND_DIR = os.path.join(CWD, "backend")
sys.path.insert(0, BACKEND_DIR)
os.environ["TTS_MOCK"] = "true"

# 2. Mock Dependencies
from unittest.mock import MagicMock
modal_mock = MagicMock()
# Configure modal to return bytes on generate
mock_instance = MagicMock()
mock_instance.generate.remote.return_value = b'\x00\x00\x00\x00' # fake audio bytes
mock_cls = MagicMock(return_value=mock_instance)
modal_mock.Cls.from_name.return_value = mock_cls

sys.modules["modal"] = modal_mock
sys.modules["sqlalchemy"] = MagicMock()
sys.modules["sqlalchemy.orm"] = MagicMock()
sys.modules["sqlalchemy.ext.asyncio"] = MagicMock()
sys.modules["database"] = MagicMock()
sys.modules["fastapi"] = MagicMock()

# Mock subprocess
import subprocess
subprocess.run = MagicMock(return_value=MagicMock(returncode=0, stderr=""))

# Mock config
sys.modules["config"] = MagicMock()
sys.modules["config"].GENERATED_DIR = Path(os.path.join(BACKEND_DIR, "uploads", "generated"))
sys.modules["config"].GENERATED_DIR.mkdir(parents=True, exist_ok=True)

# 3. Import Services (must happen after mocks)
try:
    from services.tts import generate_speech
    from services.audio_stitch import stitch_audio_files
    import services.storage
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

# 4. Setup Dummy Data
TEST_REF_FILE = Path(os.path.join(BACKEND_DIR, "test_reference.wav"))

# Monkeypatch tts module's reference to the function
services.tts.get_reference_path = lambda vid: TEST_REF_FILE

def setup_dummy_file():
    print(f"Creating dummy file at: {TEST_REF_FILE}")
    with open(TEST_REF_FILE, "wb") as f:
        # Write 1 second of silence (fake wav)
        f.write(b'\x00' * 1024)
    print(f"File exists: {TEST_REF_FILE.exists()}")

async def run_test():
    setup_dummy_file()
    
    voice_id = "test-voice"
    text = "Hello world. This is sentence two. Sentence three."
    
    print("\n--- Testing Split Logic ---")
    from services.text import split_text_into_chunks
    chunks_text = split_text_into_chunks(text)
    print(f"Split chunks: {len(chunks_text)}")
    print(chunks_text)
    if len(chunks_text) != 3:
        print("ERROR: Expected 3 text chunks")

    print("\n--- Testing Generate Speech (Mock Mode) ---")
    try:
        # 1. Generate Full
        # In Mock Mode, this returns the reference file copied, and [reference_file]
        path, chunks = await generate_speech(voice_id, text, seed=42)
        print(f"Full generation path: {path}")
        print(f"Chunks (Mock Mode): {len(chunks)}")
        
        # 2. Generate Slice
        print("\n--- Testing Single Chunk Generation ---")
        c_path, c_chunks = await generate_speech(voice_id, "Regenerated sentence.", seed=99, return_chunks=True)
        print(f"Chunk path: {c_chunks[0]}")
        
        # 3. Stitch
        print("\n--- Testing Stitching ---")
        stitch_out = os.path.join(sys.modules["config"].GENERATED_DIR, "stitched_test.mp3")
        try:
            # We construct a list of files to stitch manually since Mock Mode didn't give us 3 files
            # We can use the same dummy file 3 times
            to_stitch = [chunks[0], c_chunks[0], chunks[0]]
            
            stitch_audio_files(to_stitch, stitch_out)
            print(f"Stitched file: {stitch_out}")
            
            # Check mocks were called
            print("Subprocess calls (ffmpeg):")
            print(subprocess.run.mock_calls)
            
        except Exception as e:
            print(f"Stitching failed: {e}")

    except Exception as e:
        print(f"Test Execution Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
