# Session Brief: 2026-01-22

**Focus**: Advanced Echo-TTS Features & Power-User Workflows.

## Main Objectives

### 1. Advanced Generation Mode ⚙️
Implement a power-user interface exposing granular Echo-TTS parameters (CFG, Rescaling, Steps) to allow fine-tuning of voice output.
- **Reference**: [Advanced Mode Plan](./advanced-mode-plan.md)
- **Model Details**: [Echo-TTS Model Reference](../echo-tts-model.md)

Similar to the actual Hugging Face demo of echo-tts: https://huggingface.co/spaces/jordand/echo-tts-preview

### 2. Smart Editor & Chunk Regeneration 🛠️
Implement interactive text blocks and granular regeneration.
- **Smart Editor**: Interactive text blocks with "Regenerate Selection".
- **Chunking**: Granular control over audio segments.
- **Reference**: [Smart Editor Plan](./smart-editor-plan.md)

## Starting Point
- **Codebase**: Start from `backend/` and `modal_app/`.
- **Documentation**: All plans are located in this directory (`docs/2026-01-22/`).
