"""
Utter Voice Clone - FastAPI Application

A voice cloning app inspired by ElevenLabs, powered by Qwen3-TTS.
"""

import uuid
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional
from enum import Enum

from fastapi import (
    FastAPI,
    Request,
    UploadFile,
    File,
    Form,
    HTTPException,
    Depends,
    BackgroundTasks,
)
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
from config import ALLOWED_AUDIO_EXTENSIONS, SUPPORTED_LANGUAGES, TTS_PROVIDER


# ============================================================================
# Task Management System
# ============================================================================


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskStore:
    """In-memory store for tracking async tasks."""

    def __init__(self):
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._cleanup_interval = 300  # 5 minutes
        self._task_ttl = 600  # 10 minutes

    def create_task(self, task_type: str, metadata: Optional[Dict] = None) -> str:
        """Create a new task and return its ID."""
        task_id = str(uuid.uuid4())
        self._tasks[task_id] = {
            "id": task_id,
            "type": task_type,
            "status": TaskStatus.PENDING,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "metadata": metadata or {},
            "result": None,
            "error": None,
        }
        return task_id

    def update_task(
        self, task_id: str, status: TaskStatus, result: Any = None, error: str = None
    ):
        """Update task status and result."""
        if task_id in self._tasks:
            self._tasks[task_id]["status"] = status
            self._tasks[task_id]["updated_at"] = datetime.utcnow().isoformat()
            if result is not None:
                self._tasks[task_id]["result"] = result
            if error is not None:
                self._tasks[task_id]["error"] = error

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task by ID."""
        return self._tasks.get(task_id)

    def delete_task(self, task_id: str):
        """Delete a task."""
        self._tasks.pop(task_id, None)

    def cleanup_old_tasks(self):
        """Remove tasks older than TTL."""
        now = datetime.utcnow()
        expired = []
        for task_id, task in self._tasks.items():
            created = datetime.fromisoformat(task["created_at"])
            if (now - created).total_seconds() > self._task_ttl:
                expired.append(task_id)
        for task_id in expired:
            del self._tasks[task_id]


# Global task store
task_store = TaskStore()


async def periodic_cleanup():
    """Background task to periodically clean up old tasks."""
    while True:
        await asyncio.sleep(300)  # Every 5 minutes
        task_store.cleanup_old_tasks()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - create tables on startup, start cleanup task."""
    await create_tables()
    # Start background cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())
    yield
    # Cancel cleanup task on shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Utter Voice Clone",
    description="Clone a voice → Generate speech",
    lifespan=lifespan,
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


@app.get("/design", response_class=HTMLResponse)
async def design_page(request: Request):
    """Voice design page - create voices from text descriptions."""
    return templates.TemplateResponse("design.html", {"request": request})


# ============================================================================
# API Routes
# ============================================================================


@app.post("/api/clone")
async def api_clone(
    name: str = Form(...),
    audio: UploadFile = File(...),
    transcript: str = Form(""),
    language: str = Form("Auto"),
    session: AsyncSession = Depends(get_session),
):
    """
    Create a new voice clone from uploaded audio.

    - **name**: Name for the cloned voice (1-100 chars)
    - **audio**: Audio file (WAV, MP3, M4A)
    - **transcript**: Transcript of the reference audio (required for Qwen3-TTS)
    - **language**: Language of the voice (default: Auto)
    """
    # Validate name
    if not name or len(name.strip()) == 0:
        raise HTTPException(status_code=400, detail="Please enter a voice name")
    if len(name) > 100:
        raise HTTPException(
            status_code=400, detail="Voice name must be 100 characters or less"
        )

    # Validate transcript for Qwen provider
    transcript = transcript.strip()
    if TTS_PROVIDER == "qwen" and len(transcript) < 10:
        raise HTTPException(
            status_code=400,
            detail="Please provide a transcript of the reference audio (at least 10 characters)",
        )

    # Validate language
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")

    # Validate file type
    if audio.filename:
        ext = Path(audio.filename).suffix.lower()
        if ext not in ALLOWED_AUDIO_EXTENSIONS:
            raise HTTPException(
                status_code=400, detail=f"File must be WAV, MP3, or M4A (got {ext})"
            )

    # Generate voice ID
    voice_id = str(uuid.uuid4())

    # Save audio file
    reference_path = await storage.save_reference(voice_id, audio)

    # Validate audio duration
    validation = validate_reference_audio(reference_path)
    if not validation["valid"]:
        import os

        os.remove(reference_path)
        raise HTTPException(status_code=400, detail=validation["message"])

    # Create voice record
    voice = Voice(
        id=voice_id,
        name=name.strip(),
        reference_path=reference_path,
        reference_transcript=transcript or None,
        language=language,
    )

    session.add(voice)
    await session.commit()

    return JSONResponse(status_code=201, content={"id": voice_id, "name": voice.name})


@app.get("/api/voices")
async def api_voices(session: AsyncSession = Depends(get_session)):
    """List all available voices."""
    result = await session.execute(select(Voice).order_by(Voice.created_at.desc()))
    voices = result.scalars().all()

    return {"voices": [voice.to_dict() for voice in voices]}


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
async def api_preview_voice(
    voice_id: str, session: AsyncSession = Depends(get_session)
):
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
async def api_generate(request: Request, session: AsyncSession = Depends(get_session)):
    """
    Start speech generation task.

    Returns a task_id immediately. Poll /api/tasks/{task_id} for status.
    """
    data = await request.json()

    voice_id = data.get("voice_id")
    text = data.get("text", "").strip()
    language = data.get("language", "Auto")
    model = data.get("model", "0.6B")  # Default to 0.6B (1.7B-Base is stopped)

    # Validate voice_id
    if not voice_id:
        raise HTTPException(status_code=400, detail="Please select a voice")

    # Validate language
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")

    # Check voice exists
    result = await session.execute(select(Voice).where(Voice.id == voice_id))
    voice = result.scalar_one_or_none()

    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")

    # Validate text
    text_validation = validate_text(text)
    if not text_validation["valid"]:
        raise HTTPException(status_code=400, detail=text_validation["message"])

    # For Qwen, ensure voice has a transcript
    ref_text = voice.reference_transcript
    if TTS_PROVIDER == "qwen" and not ref_text:
        raise HTTPException(
            status_code=400,
            detail="This voice has no reference transcript. Re-clone with a transcript to use Qwen3-TTS.",
        )

    # Create task
    task_id = task_store.create_task(
        task_type="generate",
        metadata={
            "voice_id": voice_id,
            "voice_name": voice.name,
            "text_preview": text[:50] + "..." if len(text) > 50 else text,
            "language": language,
        },
    )

    # Start background generation
    asyncio.create_task(
        _process_generation(task_id, voice_id, text, ref_text, language, model)
    )

    # Return task_id immediately
    return {"task_id": task_id, "status": TaskStatus.PENDING}


async def _process_generation(
    task_id: str, voice_id: str, text: str, ref_text: str, language: str, model: str
):
    """Background task to process speech generation."""
    from database import async_session_factory

    task_store.update_task(task_id, TaskStatus.PROCESSING)

    try:
        output_path = await generate_speech(
            voice_id=voice_id,
            text=text,
            ref_text=ref_text,
            language=language,
            model=model,
        )

        # Get audio duration
        duration = get_audio_duration(output_path)

        # Save generation record using a new session
        async with async_session_factory() as session:
            generation = Generation(
                voice_id=voice_id,
                text=text,
                audio_path=output_path,
                duration_seconds=duration,
                language=language,
            )
            session.add(generation)
            await session.commit()
            generation_id = generation.id

        # Convert to URL path
        output_filename = Path(output_path).name
        audio_url = f"/uploads/generated/{output_filename}"

        task_store.update_task(
            task_id,
            TaskStatus.COMPLETED,
            result={
                "audio_url": audio_url,
                "generation_id": generation_id,
                "duration": duration,
            },
        )

    except ValueError as e:
        task_store.update_task(task_id, TaskStatus.FAILED, error=str(e))
    except Exception as e:
        import traceback

        traceback.print_exc()
        task_store.update_task(
            task_id,
            TaskStatus.FAILED,
            error="Failed to generate speech. Please try again.",
        )


@app.get("/api/tasks/{task_id}")
async def api_get_task(task_id: str):
    """
    Get task status by ID.

    Poll this endpoint to check generation progress.
    Returns status: pending, processing, completed, or failed.
    """
    task = task_store.get_task(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return task


@app.delete("/api/tasks/{task_id}")
async def api_delete_task(task_id: str):
    """Delete/cancel a task."""
    task = task_store.get_task(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task_store.delete_task(task_id)
    return {"deleted": True}


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

    return {"generations": [gen.to_dict() for gen in generations]}


@app.delete("/api/generations/{generation_id}")
async def api_delete_generation(
    generation_id: str, session: AsyncSession = Depends(get_session)
):
    """Delete a generation and its audio file."""
    # Find generation
    result = await session.execute(
        select(Generation).where(Generation.id == generation_id)
    )
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


@app.get("/api/languages")
async def api_languages():
    """Return supported languages for TTS generation."""
    return {
        "languages": SUPPORTED_LANGUAGES,
        "default": "Auto",
        "provider": TTS_PROVIDER,
    }


# ============================================================================
# Voice Design API Routes
# ============================================================================


@app.post("/api/voices/design/preview")
async def api_design_preview(request: Request):
    """
    Start async preview generation task.

    Returns a task_id immediately. Poll /api/tasks/{task_id} for status.
    When complete, fetch audio from /api/tasks/{task_id}/audio.
    """
    data = await request.json()

    text = data.get("text", "").strip()
    language = data.get("language", "English")
    instruct = data.get("instruct", "").strip()

    # Validate inputs
    if not text:
        raise HTTPException(status_code=400, detail="Preview text is required")
    if len(text) > 500:
        raise HTTPException(
            status_code=400, detail="Preview text must be 500 characters or less"
        )

    if not instruct:
        raise HTTPException(status_code=400, detail="Voice description is required")
    if len(instruct) > 500:
        raise HTTPException(
            status_code=400, detail="Voice description must be 500 characters or less"
        )

    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")

    # Create task
    task_id = task_store.create_task(
        task_type="design_preview",
        metadata={
            "instruct_preview": (
                instruct[:50] + "..." if len(instruct) > 50 else instruct
            ),
            "language": language,
        },
    )

    # Start background generation
    asyncio.create_task(_process_design_preview(task_id, text, language, instruct))

    # Return task_id immediately
    return {"task_id": task_id, "status": TaskStatus.PENDING}


async def _process_design_preview(
    task_id: str, text: str, language: str, instruct: str
):
    """Background task to process voice design preview."""
    from services.tts_qwen import design_voice
    import base64

    task_store.update_task(task_id, TaskStatus.PROCESSING)

    try:
        audio_bytes = await design_voice(
            text=text,
            language=language,
            instruct=instruct,
        )

        # Save audio to temp file and store path in result
        # We'll use base64 encoding for the audio data
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

        task_store.update_task(
            task_id,
            TaskStatus.COMPLETED,
            result={
                "audio_base64": audio_base64,
                "audio_size": len(audio_bytes),
            },
        )

    except ValueError as e:
        task_store.update_task(task_id, TaskStatus.FAILED, error=str(e))
    except Exception as e:
        import traceback

        traceback.print_exc()
        task_store.update_task(
            task_id,
            TaskStatus.FAILED,
            error="Failed to design voice. Please try again.",
        )


@app.post("/api/voices/design")
async def api_design_voice(
    name: str = Form(...),
    text: str = Form(...),
    language: str = Form("English"),
    instruct: str = Form(...),
    audio: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """
    Save a designed voice with its preview audio.

    Accepts the preview audio blob directly from the frontend,
    ensuring the saved voice matches exactly what was previewed.
    The designed voice can then be used with the cloning model for long-form generation.
    """
    from config import REFERENCES_DIR

    name = name.strip()
    text = text.strip()
    instruct = instruct.strip()

    # Validate inputs
    if not name:
        raise HTTPException(status_code=400, detail="Voice name is required")
    if len(name) > 100:
        raise HTTPException(
            status_code=400, detail="Voice name must be 100 characters or less"
        )

    if not text:
        raise HTTPException(status_code=400, detail="Preview text is required")
    if len(text) > 500:
        raise HTTPException(
            status_code=400, detail="Preview text must be 500 characters or less"
        )

    if not instruct:
        raise HTTPException(status_code=400, detail="Voice description is required")
    if len(instruct) > 500:
        raise HTTPException(
            status_code=400, detail="Voice description must be 500 characters or less"
        )

    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")

    try:
        # Read the preview audio sent from frontend (no regeneration needed)
        audio_bytes = await audio.read()

        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio preview is required")

        # Create voice ID and save audio as reference
        voice_id = str(uuid.uuid4())
        reference_path = REFERENCES_DIR / f"{voice_id}.wav"

        with open(reference_path, "wb") as f:
            f.write(audio_bytes)

        # Create voice record
        voice = Voice(
            id=voice_id,
            name=name,
            reference_path=str(reference_path),
            reference_transcript=text,  # Preview text becomes the transcript
            language=language,
            source="designed",
            description=instruct,
        )

        session.add(voice)
        await session.commit()

        return JSONResponse(
            status_code=201,
            content={
                "id": voice_id,
                "name": name,
                "description": instruct,
                "language": language,
                "source": "designed",
                "preview_url": f"/api/voices/{voice_id}/preview",
            },
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail="Failed to design voice. Please try again."
        )
