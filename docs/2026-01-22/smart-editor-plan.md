# Smart Editor & Chunk Regeneration Plan (2026-01-22)

## Goal
Replace the standard text input with an interactive "Smart Editor" that treats text as chunks (sentences/paragraphs) to enable granular audio regeneration.

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

### 3. Backend Integration (Chunk Regeneration)
- **Concept**: Treat the selected chunk as a short, isolated generation task.
- **Workflow**:
  1.  User selects Sentence B (in A-B-C).
  2.  Frontend sends: `text=Sentence B`.
  3.  Backend generates audio for B.
  4.  Frontend replaces Audio Segment B in the full timeline with the new file.
  5.  (Optional Advanced): Pass last 0.5s of A as "prompt" for B to smooth transition (continuation).

## Implementation Steps

1.  **Frontend**:
    -   Create `SmartEditor` component.
    -   Implement sentence boundary detection (regex or library).
    -   Implement "Highlight on Hover" logic.
2.  **Backend**:
    -   Ensure `/api/generate` handles short/single-sentence requests efficiently (fast path).
    -   Implement FFmpeg stitching logic to replace a segment in a longer timeline.
