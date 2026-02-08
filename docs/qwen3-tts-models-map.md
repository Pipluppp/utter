# Qwen3-TTS Model Landscape

> **Last Updated**: 2026-01-27
> **Source**: [Qwen Blog](https://qwen.ai/blog?id=qwen3tts-0115), [GitHub](https://github.com/QwenLM/Qwen3-TTS)

This document maps the different Qwen3-TTS model variants to help select the right model for specific features in Utter.

Related:
- `docs/qwen-api.md` (official Alibaba/DashScope Qwen TTS APIs and Supabase/Edge fit)

---

## Model Summary Table

| Model Variant | Main Feature | Input Required | Use Case | Available Sizes |
| :--- | :--- | :--- | :--- | :--- |
| **Base** | **Voice Cloning** (Zero-Shot) | Reference Audio + Text | "I want it to sound like *this audio file*." | 0.6B, 1.7B |
| **VoiceDesign** | **Voice Creation** (Text-to-Voice) | Voice Description + Text | "I want a new voice that sounds like *a deep, raspy pirate*." | 1.7B only |
| **CustomVoice** | **Style Control** & Fine-Tuning | Instruction + Text | "I want one of the premium preset voices, but *whispering*." | 0.6B, 1.7B |

---

## Detailed Model Breakdown

### 1. Base Model (`Qwen3-TTS-12Hz-X.XB-Base`)

This is the general-purpose foundation model. It is capable of high-fidelity speech synthesis and zero-shot voice cloning.

*   **Key Capability**: **Cloning**. It takes a short reference audio clip (3s+) and synthesizes new speech matching that timbre and prosody.
*   **Workflow**:
    1.  User uploads `reference.wav`.
    2.  System prompts model with `reference.wav` + `transcript`.
    3.  Model generates speech.
*   **Current Status in Utter**:
    *   **1.7B-Base**: **Deployed** (Production quality).
    *   **0.6B-Base**: **Planned** (Efficiency/Draft quality).

### 2. VoiceDesign Model (`Qwen3-TTS-12Hz-1.7B-VoiceDesign`)

A specialized instruction-following model designed to **create** new voices from scratch using natural language descriptions.

*   **Key Capability**: **Creation**. It does not need reference audio. It "hallucinates" a stable voice based on text prompts.
*   **Workflow**:
    1.  User types: *"A cheerful young woman with a slight southern accent."*
    2.  Model generates a ~5-10s audio clip.
    3.  **Integration Pattern**: This clip is then saved and used as a *reference* for the **Base** model to generate long-form content.
*   **Parameters**:
    *   `voice_description`: Natural language prompt.
    *   `text`: The content to speak in the preview.

### 3. CustomVoice Model (`Qwen3-TTS-12Hz-X.XB-CustomVoice`)

This model comes with **9 pre-trained "premium" timbres** (voices) and allows for fine-grained **style control** via instructions. It bridges the gap between a fixed TTS voice and a controllable LLM.

*   **Key Capability**: **Control**. It allows modifying the *style* of a specific speaker (e.g., "sad", "whispering", "excited") without changing the speaker's identity.
*   **Features**:
    *   **Preset Voices**: Comes with 9 high-quality built-in voices (mixed gender, age, accents).
    *   **Fine-Tuning Ready**: Designed to be fine-tuned on specific user data while retaining the ability to accept style instructions.
    *   **Single-Speaker Multilingual**: Can make a specific cloned voice speak all 10 supported languages fluently.
*   **Use Case**:
    *   If Utter wants to offer "System Voices" (e.g., "Utter Default Male", "Utter Default Female") that users can direct (e.g., "Say this sadly").

---

## Technical Comparison

| Feature | Base | VoiceDesign | CustomVoice |
| :--- | :--- | :--- | :--- |
| **Reference Audio** | **Required** | None | Optional (uses presets) |
| **Prompt Type** | Audio + Transcript | Text Description | Text Instruction |
| **Streaming** | Yes (97ms latency) | Yes | Yes |
| **Languages** | 10 (Auto-detect) | 10 | 10 |
| **Role in Utter** | **Core Engine** (Cloning) | **Feature** (Voice Creator) | **Feature** (Stock Voices) |

## Implementation Roadmap (Utter)

1.  **Phase 1 (Complete)**: Deploy **Base (1.7B)** for high-quality cloning.
2.  **Phase 2 (Ready)**: Deploy **Base (0.6B)** for faster/cheaper cloning tier.
3.  **Phase 3 (Next)**: Deploy **VoiceDesign** as a standalone "Voice Creator" tool.
    *   *User Flow*: "Create Voice" -> "Describe Voice" -> Save -> Use with Base model.
4.  **Phase 4 (Future)**: Deploy **CustomVoice** to offer "Utter Premium Voices".
    *   *User Flow*: Select "Stock Voice" -> Add style instruction ("Whisper this") -> Generate.
