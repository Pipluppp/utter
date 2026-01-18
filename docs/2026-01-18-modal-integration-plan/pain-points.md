# Modal Integration Pain Points

> Gotchas encountered during Modal + Echo-TTS integration. Read before next session.

---

## 1. Modal API Changes

### `modal.Cls.lookup()` → `modal.Cls.from_name()`
```python
# OLD (broken)
EchoTTS = modal.Cls.lookup("utter-tts", "EchoTTS")

# NEW (works)
EchoTTS = modal.Cls.from_name("utter-tts", "EchoTTS")
```

### `container_idle_timeout` → `scaledown_window`
```python
@app.cls(
    scaledown_window=300,  # not container_idle_timeout
)
```

---

## 2. Container Caching Issues

**Problem**: Deployed new code but old code still runs.

**Why**: Modal keeps warm containers with old mounted code.

**Fix**:
```bash
python -m modal app stop utter-tts
python -m modal deploy modal_app/echo_tts.py
```

Check no containers running:
```bash
python -m modal container list
```

---

## 3. Echo-TTS Function Signature

`sample_euler_cfg_independent_guidances()` requires ALL parameters.

```python
sample_fn = partial(
    sample_euler_cfg_independent_guidances,
    num_steps=40,
    cfg_scale_text=3.0,
    cfg_scale_speaker=8.0,
    cfg_min_t=0.5,
    cfg_max_t=1.0,
    truncation_factor=None,      # Required!
    rescale_k=None,              # Required!
    rescale_sigma=None,          # Required!
    speaker_kv_scale=None,       # Required!
    speaker_kv_max_layers=None,  # Required!
    speaker_kv_min_t=None,       # Required!
    sequence_length=640,
)
```

Error if missing: `TypeError: missing 6 required positional arguments`

---

## 4. torchaudio + torchcodec BytesIO

**Problem**: Newer torchaudio uses torchcodec which doesn't support BytesIO.
```
RuntimeError: Couldn't allocate AVFormatContext. The destination file is <BytesIO>
```

**Fix**: Save to temp file, then read bytes:
```python
# Don't do this:
buffer = io.BytesIO()
torchaudio.save(buffer, audio, 44100, format="wav")

# Do this:
torchaudio.save("/tmp/output.wav", audio, 44100)
with open("/tmp/output.wav", "rb") as f:
    audio_bytes = f.read()
```

---

## 5. Path Resolution

**Problem**: `Path.relative_to()` fails with mixed path styles.
```
ValueError: 'uploads\\generated\\xyz.wav' is not in subpath of 'C:\\...'
```

**Fix**: Just use filename directly:
```python
output_filename = Path(output_path).name
audio_url = f"/uploads/generated/{output_filename}"
```

---

## 6. Audio File Serving

Reference audio: `REFERENCES_DIR / f"{voice_id}{ext}"`  
Generated audio: `GENERATED_DIR / f"{generation_id}.wav"`

Both served via FastAPI static mount at `/uploads/`.

---

## Quick Checklist Before Debugging

1. Is Modal authenticated? → `python -m modal app list`
2. Are old containers running? → `python -m modal container list`
3. Did deploy actually update? → Check line numbers in errors
4. Is backend reloaded? → Check uvicorn logs
5. Browser cached? → Hard refresh Ctrl+F5
