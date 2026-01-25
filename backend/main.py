"""
Utter Voice Clone - FastAPI Application

A voice cloning app inspired by ElevenLabs, powered by Echo-TTS.
"""

import uuid
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from database import create_tables, get_session
from models import Voice, Generation
from services import storage
from services.audio import get_audio_duration, validate_reference_audio
from services.tts import generate_speech
from services.text import validate_text
from config import ALLOWED_AUDIO_EXTENSIONS


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - create tables on startup."""
    await create_tables()
    yield


app = FastAPI(
    title="Utter Voice Clone",
    description="Clone a voice → Generate speech",
    lifespan=lifespan
)

# Mount static files
static_path = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_path), name="static")

# Mount uploads for serving generated audio
uploads_path = Path(__file__).parent / "uploads"
uploads_path.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")

# Setup templates
templates_path = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=templates_path)


# ============================================================================
# HTML Routes
# ============================================================================

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Landing page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/clone", response_class=HTMLResponse)
async def clone_page(request: Request):
    """Voice cloning page."""
    return templates.TemplateResponse("clone.html", {"request": request})


@app.get("/generate", response_class=HTMLResponse)
async def generate_page(request: Request):
    """Speech generation page."""
    return templates.TemplateResponse("generate.html", {"request": request})


@app.get("/about", response_class=HTMLResponse)
async def about_page(request: Request):
    """About page."""
    return templates.TemplateResponse("about.html", {"request": request})


@app.get("/voices", response_class=HTMLResponse)
async def voices_page(request: Request):
    """Voice management page."""
    return templates.TemplateResponse("voices.html", {"request": request})


@app.get("/history", response_class=HTMLResponse)
async def history_page(request: Request):
    """Generation history page."""
    return templates.TemplateResponse("history.html", {"request": request})


# ============================================================================
# API Routes
# ============================================================================

@app.post("/api/clone")
async def api_clone(
    name: str = Form(...),
    audio: UploadFile = File(...),
    session: AsyncSession = Depends(get_session)
):
    """
    Create a new voice clone from uploaded audio.
    
    - **name**: Name for the cloned voice (1-100 chars)
    - **audio**: Audio file (WAV, MP3, M4A)
    """
    # Validate name
    if not name or len(name.strip()) == 0:
        raise HTTPException(status_code=400, detail="Please enter a voice name")
    if len(name) > 100:
        raise HTTPException(status_code=400, detail="Voice name must be 100 characters or less")
    
    # Validate file type
    if audio.filename:
        ext = Path(audio.filename).suffix.lower()
        if ext not in ALLOWED_AUDIO_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"File must be WAV, MP3, or M4A (got {ext})"
            )
    
    # Generate voice ID
    voice_id = str(uuid.uuid4())
    
    # Save audio file
    reference_path = await storage.save_reference(voice_id, audio)
    
    # Validate audio duration (10s-5min for Echo-TTS)
    validation = validate_reference_audio(reference_path)
    if not validation["valid"]:
        # Delete the saved file
        import os
        os.remove(reference_path)
        raise HTTPException(status_code=400, detail=validation["message"])
    
    # Create voice record
    voice = Voice(
        id=voice_id,
        name=name.strip(),
        reference_path=reference_path
    )
    
    session.add(voice)
    await session.commit()
    
    return JSONResponse(
        status_code=201,
        content={"id": voice_id, "name": voice.name}
    )


@app.get("/api/voices")
async def api_voices(session: AsyncSession = Depends(get_session)):
    """List all available voices."""
    result = await session.execute(select(Voice).order_by(Voice.created_at.desc()))
    voices = result.scalars().all()
    
    return {
        "voices": [voice.to_dict() for voice in voices]
    }


@app.delete("/api/voices/{voice_id}")
async def api_delete_voice(voice_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a voice and its reference audio."""
    # Find voice
    result = await session.execute(select(Voice).where(Voice.id == voice_id))
    voice = result.scalar_one_or_none()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Delete reference audio file
    storage.delete_reference(voice_id)
    
    # Delete from database
    await session.delete(voice)
    await session.commit()
    
    return {"success": True, "message": f"Voice '{voice.name}' deleted"}


@app.get("/api/voices/{voice_id}/preview")
async def api_preview_voice(voice_id: str, session: AsyncSession = Depends(get_session)):
    """Stream reference audio for preview playback."""
    # Find voice
    result = await session.execute(select(Voice).where(Voice.id == voice_id))
    voice = result.scalar_one_or_none()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Get reference audio path
    reference_path = storage.get_reference_path(voice_id)
    if not reference_path or not reference_path.exists():
        raise HTTPException(status_code=404, detail="Reference audio not found")
    
    return FileResponse(reference_path, media_type="audio/wav")


@app.post("/api/generate")
async def api_generate(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """
    Generate speech from text using a cloned voice.
    
    This is a synchronous endpoint - it blocks until audio is ready.
    """
    data = await request.json()
    
    voice_id = data.get("voice_id")
    text = data.get("text", "").strip()
    
    # Validate voice_id
    if not voice_id:
        raise HTTPException(status_code=400, detail="Please select a voice")
    
    # Check voice exists
    result = await session.execute(select(Voice).where(Voice.id == voice_id))
    voice = result.scalar_one_or_none()
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Validate text (including byte-length for Echo-TTS)
    text_validation = validate_text(text)
    if not text_validation["valid"]:
        raise HTTPException(status_code=400, detail=text_validation["message"])
    
    # Generate speech
    try:
        # Check for stitching only (chunk mode)
        chunk_mode = data.get("chunk_mode", False)
        seed = data.get("seed")
        
        # Convert seed to int if present
        if seed is not None:
            try:
                seed = int(seed)
            except (ValueError, TypeError):
                seed = None
        
        output_result = await generate_speech(voice_id, text, seed=seed)
        
        # Unpack result
        # output_result is (final_path, chunk_paths)
        if isinstance(output_result, tuple):
            output_path, chunk_paths = output_result
        else:
            # Fallback if just string (shouldn't happen with new code)
            output_path = output_result
            chunk_paths = []
            
        # If chunk_mode was requested (only chunks needed), we could optimize?
        # But for now we give everything.
        
        # Prepare URL lists
        chunk_urls = []
        for p in chunk_paths:
             fname = Path(p).name
             chunk_urls.append(f"/uploads/generated/{fname}")
        
        # Get audio duration
        duration = get_audio_duration(output_path)
        
        # Save generation record
        generation = Generation(
            voice_id=voice_id,
            text=text,
            audio_path=output_path,
            duration_seconds=duration
        )
        session.add(generation)
        await session.commit()
        
        # Convert to URL path - extract just the filename and build URL
        output_filename = Path(output_path).name
        audio_url = f"/uploads/generated/{output_filename}"
        
        return {
            "audio_url": audio_url, 
            "generation_id": generation.id,
            "chunk_urls": chunk_urls
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate speech. Please try again.")


@app.post("/api/stitch")
async def api_stitch(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """
    Stitch multiple audio files together.
    
    Expects JSON: { "audio_urls": ["/uploads/generated/abc.mp3", ...] }
    Returns: { "audio_url": "..." }
    """
    from services.audio_stitch import stitch_audio_files
    from config import GENERATED_DIR
    
    data = await request.json()
    audio_urls = data.get("audio_urls", [])
    
    if not audio_urls:
         raise HTTPException(status_code=400, detail="No audio URLs provided")
         
    # Convert URLs back to local paths
    # URL format: /uploads/generated/xyz.mp3
    # Local format: GENERATED_DIR / xyz.mp3 (which is uploads/generated/...)
    
    try:
        input_paths = []
        for url in audio_urls:
            filename = Path(url).name
            # Security check: ensure no path traversal
            if "/" in filename or "\\" in filename or ".." in filename:
                continue
            
            local_path = GENERATED_DIR / filename
            if local_path.exists():
                input_paths.append(str(local_path))
        
        if not input_paths:
             raise HTTPException(status_code=400, detail="No valid audio files found")

        # Generate output ID
        output_id = str(uuid.uuid4())
        output_path = str(GENERATED_DIR / f"{output_id}.mp3")
        
        stitch_audio_files(input_paths, output_path)
        
        # Determine duration? Optional.
        # We don't save "Stitched" audio as a Generation record? 
        # Maybe we should so it appears in history?
        # Let's save it.
        
        duration = get_audio_duration(output_path)
        
        # Ideally we'd need a voice_id and text, but this is a composition...
        # For now, create a "Stitched" record? Or just return the file.
        # Returning file is safer for "temporary" edits. 
        # But if we want it in history... let's just return the URL for now.
        
        output_filename = Path(output_path).name
        audio_url = f"/uploads/generated/{output_filename}"
        
        return {"audio_url": audio_url, "id": output_id}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Stitching failed: {str(e)}")


@app.get("/api/generations")
async def api_generations(session: AsyncSession = Depends(get_session)):
    """List all past generations."""
    result = await session.execute(
        select(Generation)
        .options(joinedload(Generation.voice))
        .order_by(Generation.created_at.desc())
        .limit(50)
    )
    generations = result.scalars().all()
    
    return {
        "generations": [gen.to_dict() for gen in generations]
    }


@app.delete("/api/generations/{generation_id}")
async def api_delete_generation(generation_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a generation and its audio file."""
    # Find generation
    result = await session.execute(select(Generation).where(Generation.id == generation_id))
    generation = result.scalar_one_or_none()
    
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    # Delete audio file
    audio_path = Path(generation.audio_path)
    if audio_path.exists():
        audio_path.unlink()
    
    # Delete from database
    await session.delete(generation)
    await session.commit()
    
    return {"success": True, "message": "Generation deleted"}
