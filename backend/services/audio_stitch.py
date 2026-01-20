"""Audio stitching service for combining multiple audio chunks."""

import os
import subprocess
import tempfile
from pathlib import Path


def stitch_audio_files(audio_paths: list[str], output_path: str) -> str:
    """
    Concatenate multiple MP3 files into one using ffmpeg.
    
    Uses ffmpeg's concat demuxer for efficient concatenation.
    
    Args:
        audio_paths: List of paths to MP3 files to concatenate
        output_path: Path for the output MP3 file
        
    Returns:
        Path to the stitched audio file
        
    Raises:
        ValueError: If no audio paths provided
        RuntimeError: If ffmpeg fails
    """
    if not audio_paths:
        raise ValueError("No audio files to stitch")
    
    # If only one file, just copy it
    if len(audio_paths) == 1:
        import shutil
        shutil.copy2(audio_paths[0], output_path)
        return output_path
    
    # Create a temporary file listing all inputs for ffmpeg concat
    # On Windows, we need forward slashes and proper escaping
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
        for path in audio_paths:
            # Convert to absolute path and use forward slashes for ffmpeg
            abs_path = os.path.abspath(path).replace('\\', '/')
            # Escape single quotes in paths
            escaped_path = abs_path.replace("'", "'\\''")
            f.write(f"file '{escaped_path}'\n")
        concat_list_path = f.name
    
    try:
        # Run ffmpeg concat demuxer
        # -f concat: use concat demuxer
        # -safe 0: allow absolute paths
        # -c copy: stream copy (no re-encoding, fast)
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_list_path,
                "-c", "copy",
                output_path
            ],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg concat failed: {result.stderr}")
        
        return output_path
        
    finally:
        # Cleanup the temp concat list file
        if os.path.exists(concat_list_path):
            os.unlink(concat_list_path)


def stitch_audio_with_crossfade(
    audio_paths: list[str], 
    output_path: str,
    crossfade_ms: int = 50
) -> str:
    """
    Concatenate MP3 files with a small crossfade to prevent clicks.
    
    Note: This requires re-encoding, so it's slower than simple concat.
    Use only if clicks are noticeable at boundaries.
    
    Args:
        audio_paths: List of paths to MP3 files
        output_path: Path for the output MP3 file
        crossfade_ms: Crossfade duration in milliseconds
        
    Returns:
        Path to the stitched audio file
    """
    if not audio_paths:
        raise ValueError("No audio files to stitch")
    
    if len(audio_paths) == 1:
        import shutil
        shutil.copy2(audio_paths[0], output_path)
        return output_path
    
    # For crossfade, we need to use ffmpeg's filter_complex
    # This builds a chain of acrossfade filters
    # Example for 3 files: [0][1]acrossfade=d=0.05[a01];[a01][2]acrossfade=d=0.05
    
    crossfade_sec = crossfade_ms / 1000.0
    
    # Build input arguments
    inputs = []
    for path in audio_paths:
        inputs.extend(["-i", path])
    
    # Build filter_complex
    if len(audio_paths) == 2:
        filter_complex = f"[0][1]acrossfade=d={crossfade_sec}"
    else:
        filters = []
        for i in range(len(audio_paths) - 1):
            if i == 0:
                filters.append(f"[0][1]acrossfade=d={crossfade_sec}[a{i}]")
            elif i == len(audio_paths) - 2:
                filters.append(f"[a{i-1}][{i+1}]acrossfade=d={crossfade_sec}")
            else:
                filters.append(f"[a{i-1}][{i+1}]acrossfade=d={crossfade_sec}[a{i}]")
        filter_complex = ";".join(filters)
    
    result = subprocess.run(
        ["ffmpeg", "-y"] + inputs + [
            "-filter_complex", filter_complex,
            "-codec:a", "libmp3lame", "-qscale:a", "2",
            output_path
        ],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg crossfade failed: {result.stderr}")
    
    return output_path
