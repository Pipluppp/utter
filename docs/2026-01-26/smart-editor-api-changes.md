# Smart Editor API & Deployment Changes
**Date**: 2026-01-26
**Related Plan**: [Smart Editor Plan](../2026-01-22/smart-editor-plan.md)

## 1. Modal Deployment (`echo_tts.py`)
The remote Modal function `EchoTTS.generate` has been updated to support deterministic generation via a random seed.

### Function Signature
```python
def generate(
    self, 
    text: str, 
    reference_audio_bytes: bytes, 
    rng_seed: int = None  # [NEW] Optional seed
) -> bytes:
```

-   **`rng_seed` (int, optional)**: If provided, this seed is passed to `torch.manual_seed` (or equivalent) in the sampler to ensure the exact same audio is generated for the same text/reference.
-   **Default Behavior**: If `None`, a random seed is generated and used (non-deterministic).

> [!IMPORTANT]
> You must redeploy the Modal app (`modal deploy modal_app/echo_tts.py`) for this change to take effect. Old deployments will reject the `rng_seed` argument.

## 2. Backend API Changes

### `POST /api/generate`
Updated to support granular control for the Smart Editor.

**Request Body:**
```json
{
  "voice_id": "uuid-string",
  "text": "Text to speak...",
  "seed": 12345,          // [NEW] Optional integer for deterministic output
  "chunk_mode": true      // [NEW] If true, returns list of chunk URLs instead of stitched audio
}
```

**Response (Standard Mode):**
```json
{
  "audio_url": "/uploads/generated/full_audio.mp3",
  "generation_id": "uuid-string",
  "chunk_urls": [         // [NEW] List of individual chunk URLs (useful for initial state)
    "/uploads/generated/chunk1.mp3",
    "/uploads/generated/chunk2.mp3"
  ]
}
```

**Response (Chunk Mode):**
```json
{
  "chunk_urls": ["/uploads/generated/chunk_only.mp3"]
}
```

### `POST /api/stitch` [NEW]
New endpoint to stitch multiple existing audio files into a single track. Used by the Smart Editor when a single chunk is regenerated.

**Request Body:**
```json
{
  "audio_urls": [
    "/uploads/generated/old_chunk_1.mp3",
    "/uploads/generated/new_chunk_2.mp3",
    "/uploads/generated/old_chunk_3.mp3"
  ]
}
```

**Response:**
```json
{
  "audio_url": "/uploads/generated/stitched_result.mp3",
  "id": "new-uuid"
}
```

## 3. Workflow Example (Smart Editor)

1.  **Initial Gen**: User types "Sentence A. Sentence B." -> Calls `/api/generate`.
    -   Result: `full.mp3`, chunks: `[A.mp3, B.mp3]`.
2.  **Regenerate B**: User clicks "Regenerate" on Sentence B.
    -   Frontend calls `/api/generate` with `text="Sentence B"`, `chunk_mode=true`, `seed=random`.
    -   Result: `B_v2.mp3`.
3.  **Stitch**: Frontend calls `/api/stitch` with `[A.mp3, B_v2.mp3]`.
    -   Result: `full_v2.mp3`.
