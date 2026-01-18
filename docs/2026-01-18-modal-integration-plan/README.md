# Modal Integration Documentation

This directory contains documentation for the Echo-TTS + Modal.com integration.

## Files

| File | Purpose |
|------|---------|
| [2026-01-18-modal-integration-plan.md](./2026-01-18-modal-integration-plan.md) | Original plan with Echo-TTS specs and helper code |
| [session-summary.md](./session-summary.md) | What was built, commands, performance notes |
| [pain-points.md](./pain-points.md) | **Read first** - Gotchas and debugging tips |

## Quick Start

```bash
# Deploy
cd backend
python -m modal deploy ../modal_app/echo_tts.py

# Run
uvicorn main:app --reload

# Test
# 1. Go to http://127.0.0.1:8000/clone
# 2. Upload 10+ sec audio
# 3. Go to /generate, enter text, generate
```

## If Something Breaks

→ Read [pain-points.md](./pain-points.md) first.
