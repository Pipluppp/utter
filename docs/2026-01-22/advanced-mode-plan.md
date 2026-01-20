# Echo-TTS Advanced Mode Plan (2026-01-22)

## Goal
Implement an "Advanced Mode" toggle in the UI that exposes granular control over Echo-TTS generation parameters, matching the official Gradio demo's flexibility.

## UI UX Strategy
- **Default (Simple)**: Minimal interface (Voice, Text) - *Current state*
- **Advanced Toggle**: Hidden by default section/modal containing technical parameters.

## Advanced Parameters Specification

Based on official Echo-TTS Gradio interface:

### 1. Generation Parameters
| Parameter | Default | Range/Options | Description |
|-----------|---------|---------------|-------------|
| **Sampler Preset** | `default` | `Independent`, `High Speaker CFG` | Quick config sets |
| **RNG Seed** | `0` | Integer | Fixed seed for reproducibility |
| **Num Steps** | `40` | 20-80 | Quality vs Speed trade-off |

### 2. CFG (Classifier Free Guidance)
| Parameter | Default | Range/Options | Description |
|-----------|---------|---------------|-------------|
| **CFG Mode** | `independent` | `independent`, `apg-independent`, `alternating`, `joint-unconditional` | Sampling strategy (NFE impacts speed) |
| **Text CFG Scale** | `3.0` | Float | Guidance strength for text adherence |
| **Speaker CFG Scale** | `8.0` | Float | Guidance strength for voice cloning accuracy |
| **CFG Min t** | `0.5` | 0.0 - 1.0 | Start time for guidance application |
| **CFG Max t** | `1.0` | 0.0 - 1.0 | End time for guidance application |

### 3. Speaker KV Scaling
*Useful when generation ignores the reference voice.*
- **Enable**: Toggle (Boolean)
- **Scale**: (Likely float, need to verify default)

### 4. Truncation & Temporal Rescaling
| Parameter | Default | Range/Options | Description |
|-----------|---------|---------------|-------------|
| **Truncation Factor** | `1.0` | Float | Multiply initial noise (<1 reduction artifacts) |
| **Rescale k** | `1.0` | Float | <1=sharpen, >1=flatten |
| **Rescale σ (Sigma)** | `3.0` | Float | Sigma parameter |

## Implementation Strategy

### Backend (`services/tts.py` & `modal_app/echo_tts.py`)
- Update `generate_speech` signature to accept a `params` dictionary.
- Pass these params through to Modal's `generate.remote`.
- Update Modal `sample_fn` partial to use dynamic values instead of hardcoded optimizations.

### Frontend
- Create `AdvancedSettings` component.
- Add fields for all above parameters.
- Store presets for "Simple" mode (our optimized defaults: `steps=30`, `k=1`, `sigma=3`).

## Tasks
- [ ] Backend: Update Modal signature to accept dynamic params.
- [ ] API: Update `/api/generate` schema to validate and pass advanced params.
- [ ] Frontend: Build collapsible "Advanced Mode" UI.
- [ ] Frontend: Connect inputs to API.
