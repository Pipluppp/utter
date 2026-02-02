"""
Utter Voice Clone - FastAPI Application

A voice cloning app inspired by ElevenLabs, powered by Qwen3-TTS.
"""

import uuid
import asyncio
import time
from pathlib import Path
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional
from enum import Enum
from urllib.parse import quote

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
from sqlalchemy import select, func
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
    CANCELLED = "cancelled"


class TaskStore:
    """In-memory store for tracking async tasks.

    Supports both short and long-running tasks with different TTLs.
    Long-running tasks (using Modal jobs) have extended timeouts.
    """

    def __init__(self):
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._cleanup_interval = 600  # 10 minutes
        self._task_ttl_short = 600  # 10 minutes for short tasks
        self._task_ttl_long = 3600  # 1 hour for long tasks

    def create_task(
        self,
        task_type: str,
        metadata: Optional[Dict] = None,
        is_long_running: bool = False,
    ) -> str:
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
            # Modal-specific tracking
            "modal_status": None,
            "modal_elapsed_seconds": 0,
            "modal_poll_count": 0,
            # Job-based tracking (for long-running tasks)
            "is_long_running": is_long_running,
            "modal_job_id": None,
            "estimated_duration_minutes": None,
            "cancellation_requested": False,
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

    def update_modal_status(
        self,
        task_id: str,
        modal_status: str,
        elapsed_seconds: float = 0,
        poll_count: int = 0,
    ):
        """Update Modal-specific status info for real-time tracking."""
        if task_id in self._tasks:
            self._tasks[task_id]["modal_status"] = modal_status
            self._tasks[task_id]["modal_elapsed_seconds"] = round(elapsed_seconds, 1)
            self._tasks[task_id]["modal_poll_count"] = poll_count
            self._tasks[task_id]["updated_at"] = datetime.utcnow().isoformat()

    def set_modal_job_id(self, task_id: str, job_id: str):
        """Set the Modal job ID for job-based tasks."""
        if task_id in self._tasks:
            self._tasks[task_id]["modal_job_id"] = job_id
            self._tasks[task_id]["updated_at"] = datetime.utcnow().isoformat()

    def request_cancellation(self, task_id: str) -> bool:
        """Request cancellation of a task. Returns True if task exists."""
        if task_id in self._tasks:
            self._tasks[task_id]["cancellation_requested"] = True
            self._tasks[task_id]["updated_at"] = datetime.utcnow().isoformat()
            return True
        return False

    def is_cancellation_requested(self, task_id: str) -> bool:
        """Check if cancellation was requested for a task."""
        task = self._tasks.get(task_id)
        return task.get("cancellation_requested", False) if task else False

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task by ID."""
        return self._tasks.get(task_id)

    def delete_task(self, task_id: str):
        """Delete a task."""
        self._tasks.pop(task_id, None)

    def cleanup_old_tasks(self):
        """Remove tasks older than their respective TTL."""
        now = datetime.utcnow()
        expired = []
        for task_id, task in self._tasks.items():
            created = datetime.fromisoformat(task["created_at"])
            age_seconds = (now - created).total_seconds()

            # Use longer TTL for long-running tasks
            ttl = (
                self._task_ttl_long
                if task.get("is_long_running")
                else self._task_ttl_short
            )

            # Don't expire tasks that are still processing
            if task["status"] in (TaskStatus.PENDING, TaskStatus.PROCESSING):
                continue

            if age_seconds > ttl:
                expired.append(task_id)

        for task_id in expired:
            del self._tasks[task_id]


# Global task store
task_store = TaskStore()


def _modal_status_callback(request_id: str, state):
    """
    Callback to receive Modal API status updates.

    Updates the task store with real-time status from Modal requests.
    This allows the frontend to see detailed progress (queued, processing, polling).
    """
    task_store.update_modal_status(
        task_id=request_id,
        modal_status=state.status.value,
        elapsed_seconds=state.elapsed_seconds,
        poll_count=state.poll_count,
    )


async def periodic_cleanup():
    """Background task to periodically clean up old tasks."""
    while True:
        await asyncio.sleep(300)  # Every 5 minutes
        task_store.cleanup_old_tasks()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - create tables on startup, start cleanup task."""
    await create_tables()

    # Wire up Modal status tracking
    from services.tts_qwen import set_status_callback

    set_status_callback(_modal_status_callback)

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

    # Estimate generation time
    from services.tts_qwen import estimate_generation_time

    estimated_minutes = estimate_generation_time(text)

    # Create generation record immediately so it appears in history while processing
    generation = Generation(
        voice_id=voice_id,
        text=text,
        audio_path="",
        duration_seconds=None,
        language=language,
        status="processing",
    )
    session.add(generation)
    await session.commit()
    await session.refresh(generation)
    generation_id = generation.id

    # Create task (all generations use job-based approach for cancellation support)
    task_id = task_store.create_task(
        task_type="generate",
        metadata={
            "voice_id": voice_id,
            "voice_name": voice.name,
            "text_length": len(text),
            "text_preview": text[:50] + "..." if len(text) > 50 else text,
            "language": language,
            "estimated_duration_minutes": estimated_minutes,
            "generation_id": generation_id,
        },
        is_long_running=True,  # All tasks use job-based approach
    )

    # Start background generation
    asyncio.create_task(
        _process_generation(task_id, generation_id, voice_id, text, ref_text, language)
    )

    # Return task_id immediately
    return {
        "task_id": task_id,
        "status": TaskStatus.PENDING,
        "is_long_running": True,
        "estimated_duration_minutes": estimated_minutes,
        "generation_id": generation_id,
    }


async def _process_generation(
    task_id: str,
    generation_id: str,
    voice_id: str,
    text: str,
    ref_text: str,
    language: str,
):
    """Background task to process speech generation using job-based approach."""
    from database import async_session_factory
    from services.tts import generate_speech

    start_time = time.time()
    task_store.update_task(task_id, TaskStatus.PROCESSING)

    try:
        # All generations use job-based approach for cancellation support
        output_path, job_id = await generate_speech(
            voice_id=voice_id,
            text=text,
            ref_text=ref_text,
            language=language,
            task_id=task_id,
            cancellation_checker=task_store.is_cancellation_requested,
        )
        # Store job_id for potential cancellation
        task_store.set_modal_job_id(task_id, job_id)

        # Get audio duration
        duration = get_audio_duration(output_path)

        elapsed = time.time() - start_time

        # Save generation record using a new session
        async with async_session_factory() as session:
            generation = await session.get(Generation, generation_id)
            if generation:
                # If cancellation was requested after completion, respect cancelled state
                task = task_store.get_task(task_id)
                if task and task.get("status") == TaskStatus.CANCELLED:
                    generation.status = "cancelled"
                    generation.error_message = "Cancelled by user"
                else:
                    generation.status = "completed"
                    generation.audio_path = output_path
                    generation.duration_seconds = duration
                generation.generation_time_seconds = elapsed
                await session.commit()

        # Convert to URL path
        output_filename = Path(output_path).name
        audio_url = f"/uploads/generated/{output_filename}"

        task = task_store.get_task(task_id)
        if task and task.get("status") == TaskStatus.CANCELLED:
            return

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
        error_msg = str(e)
        elapsed = time.time() - start_time
        if "cancelled" in error_msg.lower():
            task_store.update_task(task_id, TaskStatus.CANCELLED, error=error_msg)
            async with async_session_factory() as session:
                generation = await session.get(Generation, generation_id)
                if generation:
                    generation.status = "cancelled"
                    generation.error_message = error_msg
                    generation.generation_time_seconds = elapsed
                    await session.commit()
        else:
            task_store.update_task(task_id, TaskStatus.FAILED, error=error_msg)
            async with async_session_factory() as session:
                generation = await session.get(Generation, generation_id)
                if generation:
                    generation.status = "failed"
                    generation.error_message = error_msg
                    generation.generation_time_seconds = elapsed
                    await session.commit()
    except Exception as e:
        import traceback

        traceback.print_exc()
        elapsed = time.time() - start_time
        task_store.update_task(
            task_id,
            TaskStatus.FAILED,
            error="Failed to generate speech. Please try again.",
        )
        async with async_session_factory() as session:
            generation = await session.get(Generation, generation_id)
            if generation:
                generation.status = "failed"
                generation.error_message = "Failed to generate speech. Please try again."
                generation.generation_time_seconds = elapsed
                await session.commit()


@app.post("/api/tasks/{task_id}/cancel")
async def api_cancel_task(task_id: str):
    """
    Cancel a running task.

    For job-based tasks, this will attempt to cancel the Modal job.
    For direct tasks, it will mark cancellation requested (best effort).
    """
    task = task_store.get_task(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["status"] not in (TaskStatus.PENDING, TaskStatus.PROCESSING):
        raise HTTPException(
            status_code=400, detail=f"Cannot cancel task with status: {task['status']}"
        )

    # Request cancellation
    task_store.request_cancellation(task_id)

    # If it's a job-based task with a job_id, try to cancel on Modal
    job_id = task.get("modal_job_id")
    if job_id:
        try:
            from services.tts_qwen import cancel_job

            await cancel_job(job_id)
        except Exception as e:
            # Log but don't fail - cancellation is best effort
            import logging

            logging.warning(f"Failed to cancel Modal job {job_id}: {e}")

    # Mark as cancelled
    task_store.update_task(task_id, TaskStatus.CANCELLED, error="Cancelled by user")

    # Update generation record if available
    generation_id = task.get("metadata", {}).get("generation_id")
    if generation_id:
        from database import async_session_factory

        async with async_session_factory() as session:
            generation = await session.get(Generation, generation_id)
            if generation and generation.status not in ("completed", "failed", "cancelled"):
                try:
                    created_at = datetime.fromisoformat(task["created_at"])
                    elapsed = (datetime.utcnow() - created_at).total_seconds()
                except Exception:
                    elapsed = None
                generation.status = "cancelled"
                generation.error_message = "Cancelled by user"
                if elapsed is not None:
                    generation.generation_time_seconds = elapsed
                await session.commit()

    return {"cancelled": True, "task_id": task_id}


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
async def api_generations(
    page: int = 1,
    per_page: int = 20,
    search: Optional[str] = None,
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    """List generations with pagination and optional filtering."""
    page = max(page, 1)
    per_page = min(max(per_page, 1), 100)

    query = select(Generation).options(joinedload(Generation.voice))

    if search:
        search = search.strip()
        if search:
            query = query.where(Generation.text.ilike(f"%{search}%"))
    if status:
        query = query.where(Generation.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0

    query = (
        query.order_by(Generation.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await session.execute(query)
    generations = result.scalars().all()

    pages = max(1, (total + per_page - 1) // per_page)

    return {
        "generations": [gen.to_dict() for gen in generations],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": pages,
        },
    }


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

    # Delete audio file (if present)
    if generation.audio_path:
        audio_path = Path(generation.audio_path)
        if audio_path.exists() and audio_path.is_file():
            audio_path.unlink()

    # Delete from database
    await session.delete(generation)
    await session.commit()

    return {"success": True, "message": "Generation deleted"}


@app.post("/api/generations/{generation_id}/regenerate")
async def api_regenerate_generation(
    generation_id: str, session: AsyncSession = Depends(get_session)
):
    """Return parameters needed to regenerate a past generation."""
    generation = await session.get(Generation, generation_id)

    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")

    return {
        "voice_id": generation.voice_id,
        "text": generation.text,
        "language": generation.language,
        "redirect_url": (
            f"/generate?voice={generation.voice_id}"
            f"&text={quote(generation.text)}"
            f"&language={generation.language}"
        ),
    }


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
