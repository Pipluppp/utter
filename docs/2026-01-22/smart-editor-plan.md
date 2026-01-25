# Smart Editor & Chunk Regeneration Plan (2026-01-22)

# Smart Editor Implementation Plan
> [!NOTE]
> **Update (2026-01-26)**: Implementation details and API changes are documented in [Smart Editor API Changes](../2026-01-26/smart-editor-api-changes.md).

## 1. Goal
Create a "Smart Editor" that enhances the text input experience by:s/paragraphs) to enable granular audio regeneration.

## Core Features

### 1. The "Alive" Editor
- **Technology**: `contenteditable` div or lightweight rich text editor (e.g., TipTap).
- **Behavior**:
  - **Implicit Chunking**: Text is automatically parsed into chunks based on sentence boundaries (`.`, `?`, `!`, `\n`).
  - **Visual Feedback**: Hovering over text highlights the corresponding "chunk" (sentence).
  - **Interactive**: Clicking a sentence focuses it as the active generation target.

### 2. Contextual Actions
- **Right-Click / Hover Menu**:
  - **"Regenerate selection"**: The primary action. Re-generates only the selected sentence.
  - **"Split here"**: Force a chunk boundary at the cursor position.
- **Selection State**: If users highlight a phrase, snap selection to the nearest word or sentence boundary to ensure clean audio stitching.

## 4. Chunk Regeneration & Versioning (User Requirements)
- **Random Seed**:
  - The backend `echo_tts.py` currently uses a hardcoded `rng_seed=0`.
  - We must expose `seed` as a parameter. By default, regeneration uses a random seed to ensure variation.
  - Store the used seed with the chunk metadata so we can reproduce it if needed (or just store the audio).
- **Version History (Undo/Redo)**:
  - Each chunk maintains a history of generated audio clips.
  - UI allows instantaneous switching between versions (A/B testing).
  - "Revert" button to go back to the previous best version.

## 5. Chunking Strategy (Refinement)
- **Problem**: Splitting purely on every period (`.`) might create tiny, unnatural chunks (e.g., "Mr. Smith").
- **Smart Strategy**:
  - **Minimum Length**: Avoid splitting if a chunk is < 15 characters, unless it's a newline.
  - **Lookahead**: Don't split on abbreviations (e.g., U.S.A., Dr., etc.).
  - **Soft Bounds**: If a sentence is super long (> 200 chars), find a comma `.` to split, but prefer full stops.
  - **User Control**: The "Split here" context menu allows users to override bad auto-chunking.

## Implementation Steps

1.  **Frontend**:
    -   Create `SmartEditor` component.
    -   Implement "Smart Chunking" logic (regex with exceptions).
    -   Implement "Highlight on Hover" logic.
    -   Implement "Version Switcher" UI for chunks.
2.  **Backend**:
    -   Modify `echo_tts.py` to accept `seed`.
    -   Update `/api/generate` to pass `seed`.
    -   Ensure `/api/generate` handles short/single-sentence requests efficiently (fast path).
    -   Implement FFmpeg stitching logic to replace a segment in a longer timeline.
