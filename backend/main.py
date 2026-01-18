"""
Utter Voice Clone - FastAPI Application

A voice cloning app inspired by ElevenLabs, powered by Echo-TTS.
"""

import uuid
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import create_tables, get_session
from models import Voice
from services import storage
from services.tts import generate_speech
from services.audio import validate_reference_audio
from services.text import validate_text
from config import ALLOWED_AUDIO_EXTENSIONS, MAX_TEXT_LENGTH


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

@app.get("/", response_class=RedirectResponse)
async def root():
    """Redirect to clone page."""
    return RedirectResponse(url="/clone")


@app.get("/clone", response_class=HTMLResponse)
async def clone_page(request: Request):
    """Voice cloning page."""
    return templates.TemplateResponse("clone.html", {"request": request})


@app.get("/generate", response_class=HTMLResponse)
async def generate_page(request: Request):
    """Speech generation page."""
    return templates.TemplateResponse("generate.html", {"request": request})


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
    
    # Generate speech (mock for now)
    try:
        output_path = await generate_speech(voice_id, text)
        
        # Convert to URL path - extract just the filename and build URL
        output_filename = Path(output_path).name
        audio_url = f"/uploads/generated/{output_filename}"
        
        return {"audio_url": audio_url}
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate speech. Please try again.")
