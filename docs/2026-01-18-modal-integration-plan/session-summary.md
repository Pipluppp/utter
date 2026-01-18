# Modal Integration Session Summary

> **Date**: 2026-01-19  
> **Duration**: 4 hours  
> **Status**: ✅ Complete and working

---

## What We Built

Connected Utter web app to real Echo-TTS voice cloning via Modal.com GPU.

### New Files
```
modal_app/
└── echo_tts.py          # Modal deployment (A10G GPU)

backend/services/
├── audio.py             # Duration validation (mutagen)
└── text.py              # Text preprocessing for Echo-TTS
```

### Modified Files
- `backend/services/tts.py` - Modal client call
- `backend/main.py` - Added validation endpoints
- `backend/requirements.txt` - Added modal, mutagen
- `backend/static/js/app.js` - Success feedback
- `backend/templates/generate.html` - Fixed download

---

## Working Flow

1. User uploads 10s-5min audio → `/api/clone` validates duration → saves to DB
2. User enters text → `/api/generate` validates byte-length → calls Modal
3. Modal GPU generates 44.1kHz WAV → returns bytes → served from `/uploads/generated/`
4. Audio plays in browser, download works

---

## Key Commands

```bash
# Install deps (use uv, not pip)
uv pip install modal mutagen

# Authenticate Modal
python -m modal setup

# Deploy to Modal
python -m modal deploy modal_app/echo_tts.py

# Check containers
python -m modal container list

# Stop cached containers
python -m modal app stop utter-tts

# Run backend
cd backend && uvicorn main:app --reload
```

---

## Performance Notes

| Scenario | Time |
|----------|------|
| Cold start (first gen) | 30-60s |
| Warm container | 5-10s |
| Container stays warm | 5 min |

---

## Files Reference

See [2026-01-18-modal-integration-plan.md](./2026-01-18-modal-integration-plan.md) for original plan with Echo-TTS constraints and helper code.
