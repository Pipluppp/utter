# Project Roadmap (Source of Truth)

> Mock tasks to make me actually start on the dev

---

## MVP timeline

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Setup + Clone Voice | /clone page working locally |
| 2 | GPU + Generate Speech | /generate page working with Modal |
| 3 | Deploy + Polish | Production deployment complete |

---

## Sprint 1: Setup + Clone Voice

### Day 1-2: Project Scaffold

- [ ] Create `backend/` directory structure
- [ ] Create `requirements.txt`
- [ ] Set up `main.py` with FastAPI
- [ ] Create `config.py` for settings
- [ ] Create `.env.example`
- [ ] Create `docker-compose.yml` for PostgreSQL
- [ ] Test: FastAPI runs, returns "Hello World"

### Day 3: Database

- [ ] Create `database.py` with SQLAlchemy async
- [ ] Create `models.py` with Voice model
- [ ] Create table creation script
- [ ] Test: Can connect to local PostgreSQL

### Day 4: File Storage

- [ ] Create `services/storage.py`
- [ ] Implement local filesystem storage
- [ ] Create `uploads/references/` directory
- [ ] Test: Can save and retrieve files

### Day 5: Clone API

- [ ] Create POST `/api/clone` endpoint
- [ ] Handle multipart file upload
- [ ] Validate audio format (WAV/MP3/M4A)
- [ ] Validate duration (10s-5min)
- [ ] Save file to storage
- [ ] Save voice to database
- [ ] Test: API accepts files, returns voice ID

### Day 6-7: Clone Frontend

- [ ] Create `templates/base.html`
- [ ] Create `templates/clone.html`
- [ ] Create `static/css/style.css`
- [ ] Create `static/js/app.js`
- [ ] Implement file dropzone
- [ ] Implement form submission
- [ ] Handle success/error states
- [ ] Test: Full clone flow works in browser

### Sprint 1 Checkpoint

```
Expected state:
- User visits localhost:8000/clone
- Can drag/drop audio file
- Can enter voice name
- Clicks Create → voice saved
- Can see voice in database
```

---

## Sprint 2: GPU + Generate Speech

### Day 1-2: Modal Deployment

- [ ] Create `modal_app/echo_tts.py`
- [ ] Install Modal CLI, authenticate
- [ ] Write model loading code
- [ ] Write generation method
- [ ] Deploy to Modal
- [ ] Test: Can call Modal endpoint from CLI

### Day 3: TTS Service

- [ ] Create `services/tts.py`
- [ ] Create Modal client wrapper
- [ ] Handle audio bytes conversion
- [ ] Test: Can call Modal from FastAPI

### Day 4: Generate API

- [ ] Create GET `/api/voices` endpoint
- [ ] Create POST `/api/generate` endpoint
- [ ] Fetch voice reference from storage
- [ ] Call Modal for generation
- [ ] Save output to storage
- [ ] Return audio URL
- [ ] Test: API generates audio

### Day 5-6: Generate Frontend

- [ ] Create `templates/generate.html`
- [ ] Implement voice dropdown
- [ ] Implement text input with counter
- [ ] Implement generate button
- [ ] Show loading state during generation
- [ ] Implement audio player
- [ ] Implement download button
- [ ] Test: Full generate flow works

### Day 7: Integration Testing

- [ ] Test clone → generate flow end-to-end
- [ ] Fix any bugs
- [ ] Improve error handling

### Sprint 2 Checkpoint

```
Expected state:
- Clone flow still works
- User visits localhost:8000/generate
- Can select voice from dropdown
- Can enter text
- Clicks Generate → waits 2-5s → hears audio
- Can download MP3
```

---

## Sprint 3: Deploy + Polish

### Day 1-2: Production Storage

- [ ] Create Cloudflare R2 bucket
- [ ] Get R2 credentials
- [ ] Update `services/storage.py` for R2
- [ ] Add ENV switch (local vs R2)
- [ ] Test: Files upload to R2

### Day 3: Production Database

- [ ] Create Neon project
- [ ] Get connection string
- [ ] Run migrations on Neon
- [ ] Test: App connects to Neon

### Day 4: Railway Deployment

- [ ] Create Railway project
- [ ] Connect GitHub repo
- [ ] Set environment variables
- [ ] Deploy
- [ ] Test: App accessible via Railway URL

### Day 5: End-to-End Production Test

- [ ] Clone voice on production
- [ ] Generate speech on production
- [ ] Download audio works
- [ ] Fix any production-only bugs

### Day 6-7: Polish

- [ ] Improve error messages
- [ ] Add loading states everywhere
- [ ] Mobile-friendly styling
- [ ] Update README
- [ ] Clean up code

### Sprint 3 Checkpoint (MVP Complete)

```
Expected state:
- App live at https://utter.railway.app (or similar)
- Clone flow works
- Generate flow works
- Audio playback works
- Audio download works
```

---

## Verification Checklist

### Local Development
- [ ] `docker-compose up` starts PostgreSQL
- [ ] `uvicorn main:app --reload` starts server
- [ ] /clone page loads
- [ ] Can upload audio file
- [ ] Voice appears in database
- [ ] /generate page loads
- [ ] Voice appears in dropdown
- [ ] Generate produces audio
- [ ] Audio plays in player
- [ ] Download works

### Production
- [ ] Railway deployment successful
- [ ] Neon database connected
- [ ] R2 storage connected
- [ ] Modal GPU connected
- [ ] Clone flow works
- [ ] Generate flow works
- [ ] No CORS errors
- [ ] No timeout errors

---

## Current Status

| Phase | Status |
|-------|--------|
| Research & Planning | ✅ Complete |
| Documentation | ✅ Complete |
| Sprint 1: Clone Voice | ⬜ Not Started |
| Sprint 2: Generate Speech | ⬜ Not Started |
| Sprint 3: Deploy | ⬜ Not Started |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Modal GPU slow/unavailable | Start with Modal early (Sprint 2 Day 1) |
| Echo-TTS install issues | Test in isolated Modal container |
| Audio format issues | Validate strictly on upload |
| Sync generation timeout | Set 30s timeout, show clear error |
| R2 CORS issues | Configure CORS policy on bucket |

---

## Post-MVP Backlog

After MVP is live and working:

1. Add user authentication
2. Add voice list/delete page
3. Add generation history
4. Add async generation with progress
5. Add voice settings (sliders)
6. Add longer text support (chunking)
