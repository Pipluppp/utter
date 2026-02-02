# History Enhancements Plan

## Context

The History page (`/history`) displays past speech generations. Currently it shows:
- Voice name
- Text (truncated)
- Audio duration
- Created date
- Play/Download/Delete actions

### Current Limitations

1. **No generation metadata**: Time elapsed during generation is not tracked
2. **No status tracking**: Can't distinguish success vs cancelled vs failed
3. **No pagination/search**: Fixed 50-item limit, no way to find old generations
4. **No regeneration**: Can't easily re-run a generation with same parameters
5. **In-progress visibility**: Generations only appear after completion

## Goals

1. Track and display generation time elapsed
2. Store and display status (success, cancelled, failed)
3. Add search and pagination
4. Enable one-click regeneration
5. Show in-progress generations in history

## Technical Approach

### 1. Database Schema Changes

Extend the `Generation` model in [models.py](../../backend/models.py):

```python
class Generation(Base):
    # ... existing fields ...
    
    # New fields
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="completed"
    )  # "pending", "processing", "completed", "failed", "cancelled"
    generation_time_seconds: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )  # Time elapsed during generation
    error_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # Error details if failed
```

**Migration Strategy:**
- Add columns with defaults
- Existing records get `status="completed"` and `generation_time_seconds=NULL`

### 2. Backend API Changes

#### 2.1 Create Generation Record on Start

In `_process_generation()` ([main.py](../../backend/main.py)):

```python
async def _process_generation(...):
    start_time = time.time()
    
    # Create generation record immediately with "processing" status
    async with async_session_factory() as session:
        generation = Generation(
            voice_id=voice_id,
            text=text,
            audio_path="",  # Empty until complete
            status="processing",
            language=language,
        )
        session.add(generation)
        await session.commit()
        generation_id = generation.id
    
    # Store generation_id in task metadata for updates
    task_store._tasks[task_id]["metadata"]["generation_id"] = generation_id
    
    try:
        # ... existing generation logic ...
        
        elapsed = time.time() - start_time
        
        # Update record on success
        async with async_session_factory() as session:
            gen = await session.get(Generation, generation_id)
            gen.status = "completed"
            gen.audio_path = output_path
            gen.generation_time_seconds = elapsed
            gen.duration_seconds = duration
            await session.commit()
            
    except ValueError as e:
        # Update record on cancellation/failure
        async with async_session_factory() as session:
            gen = await session.get(Generation, generation_id)
            gen.status = "cancelled" if "cancelled" in str(e).lower() else "failed"
            gen.error_message = str(e)
            gen.generation_time_seconds = time.time() - start_time
            await session.commit()
```

#### 2.2 Enhanced Generations API

Add pagination and filtering to `/api/generations`:

```python
@app.get("/api/generations")
async def api_generations(
    page: int = 1,
    per_page: int = 20,
    search: Optional[str] = None,
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    query = select(Generation).options(joinedload(Generation.voice))
    
    # Apply filters
    if search:
        query = query.where(Generation.text.ilike(f"%{search}%"))
    if status:
        query = query.where(Generation.status == status)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar()
    
    # Apply pagination
    query = query.order_by(Generation.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    result = await session.execute(query)
    generations = result.scalars().all()
    
    return {
        "generations": [gen.to_dict() for gen in generations],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page,
        }
    }
```

#### 2.3 Regenerate Endpoint

Add regeneration endpoint:

```python
@app.post("/api/generations/{generation_id}/regenerate")
async def api_regenerate(
    generation_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get parameters to regenerate a generation."""
    gen = await session.get(Generation, generation_id)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    return {
        "voice_id": gen.voice_id,
        "text": gen.text,
        "language": gen.language,
        "redirect_url": f"/generate?voice={gen.voice_id}&text={quote(gen.text)}&language={gen.language}"
    }
```

### 3. Frontend Changes

#### 3.1 Enhanced History Card

Update [history.html](../../backend/templates/history.html) to show new fields:

```html
<div class="history-card ${gen.status}" data-id="${gen.id}">
    <div class="history-card-header">
        <span class="history-card-voice">${gen.voice_name || 'Unknown Voice'}</span>
        <span class="history-card-status status-${gen.status}">
            ${formatStatus(gen.status)}
        </span>
        <span class="history-card-date">${formatDate(gen.created_at)}</span>
    </div>
    <p class="history-card-text">${truncateText(gen.text, 100)}</p>
    <div class="history-card-meta">
        ${gen.duration_seconds ? `<span class="history-card-duration">${formatDuration(gen.duration_seconds)}</span>` : ''}
        ${gen.generation_time_seconds ? `<span class="history-card-gen-time">Generated in ${formatDuration(gen.generation_time_seconds)}</span>` : ''}
    </div>
    <div class="history-card-actions">
        ${gen.status === 'completed' ? `
            <button class="btn btn-secondary play-btn" data-id="${gen.id}">Play</button>
            <a href="..." class="btn btn-secondary" download>Download</a>
        ` : ''}
        ${gen.status === 'processing' ? `
            <span class="processing-indicator">Generating...</span>
        ` : ''}
        <button class="btn btn-secondary regenerate-btn" data-id="${gen.id}">
            Regenerate
        </button>
        <button class="btn btn-secondary delete-btn" data-id="${gen.id}">Delete</button>
    </div>
</div>
```

#### 3.2 Search and Pagination

Add search bar and pagination controls:

```html
<div class="history-controls">
    <input type="text" id="history-search" placeholder="Search generations..." />
    <select id="history-filter">
        <option value="">All status</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
        <option value="cancelled">Cancelled</option>
        <option value="processing">Processing</option>
    </select>
</div>

<div class="history-pagination" id="pagination">
    <button id="prev-page" disabled>← Previous</button>
    <span id="page-info">Page 1 of 1</span>
    <button id="next-page">Next →</button>
</div>
```

#### 3.3 Regenerate Handler

```javascript
document.addEventListener('click', async (e) => {
    const regenBtn = e.target.closest('.regenerate-btn');
    if (!regenBtn) return;
    
    const genId = regenBtn.dataset.id;
    const response = await fetch(`/api/generations/${genId}/regenerate`, { method: 'POST' });
    const data = await response.json();
    
    // Redirect to generate page with pre-filled params
    window.location.href = data.redirect_url;
});
```

#### 3.4 Auto-Refresh for Processing Items

Poll for updates when there are processing items:

```javascript
let refreshInterval = null;

function startAutoRefresh() {
    if (refreshInterval) return;
    refreshInterval = setInterval(loadHistory, 5000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// In loadHistory:
const hasProcessing = data.generations.some(g => g.status === 'processing');
if (hasProcessing) {
    startAutoRefresh();
} else {
    stopAutoRefresh();
}
```

## Implementation Order

1. **Database migration** - Add new columns to Generation model
2. **Backend API changes** - Update _process_generation to create record early
3. **Pagination API** - Add search/filter/pagination to /api/generations
4. **Frontend history cards** - Display new fields
5. **Search/pagination UI** - Add controls
6. **Regenerate feature** - API endpoint and button handler
7. **Auto-refresh** - Poll for processing items

## Dependencies

- Must coordinate with [multi-task-manager-plan.md](./multi-task-manager-plan.md) for in-progress tracking

## Testing

1. Start generation → verify record appears with "processing" status
2. Complete generation → verify status updates to "completed" with time
3. Cancel generation → verify status is "cancelled"
4. Search → verify text filtering works
5. Pagination → verify page navigation
6. Regenerate → verify redirects with correct params
