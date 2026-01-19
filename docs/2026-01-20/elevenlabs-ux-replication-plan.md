# ElevenLabs UI/UX Replication Plan

**Goal:** Elevate the current simple text-to-audio generation workflow to a feature-rich, "premium" experience on par with ElevenLabs. This involves implementing a robust UI for voice configuration, advanced text handling (chunking, file upload), and polished feedback mechanisms.

## 1. Core Experience: The "Speech Synthesis" Tab

The primary interface should evolve from a simple form to a sophisticated dashboard.

### A. Voice Selection & Configuration
*   **Voice Selector:**
    *   Dropdown/Modal with rich preview (Avatar, Name, Tagline, "Play Preview" button).
    *   Categories: "Recently Used", "Professional", "Cloned".
*   **Voice Settings (Accordion/Pop-over):**
    *   **Stability Slider (0-100%):** Explain trade-off (More stable = less emotion; Less stable = more expressive but potential artifacts).
    *   **Similarity Boost (0-100%):** Explain trade-off (Higher = closer to original voice; Lower = smoother speech).
    *   **Style Exaggeration (Optional):** For v3-style models.

### B. Input Area
*   **Rich Text Area:**
    *   Multi-line text input with clear typography.
    *   **Character Counter:** Real-time display (e.g., `340 / 5000` chars) with visual warning as limit approaches.
    *   **Clear Text Button:** Quick reset.
*   **Input Methods:**
    *   **Direct Typing:** Standard.
    *   **File Upload:** Support `.txt`, `.md`, `.pdf` (text extraction). Drag-and-drop zone overlaying the text area.

### C. Generation & Feedback
*   **Generate Button:**
    *   Prominent, high-contrast action button.
    *   **Loading State:** Non-blocking "Generating..." spinner with estimated time if possible.
    *   **Cost/Credit Estimate:** "This will use ~350 credits" (optional, adds realism).
*   **Audio Output:**
    *   **Custom Player:** Not the default browser `<audio>` tag.
    *   **Waveform Visualization:** Dynamic bars enabling seeking.
    *   **Controls:** Play/Pause, Speed (1x, 1.25x, 1.5x), Download, Share.
    *   **History Snippet:** Small list of "Recent Generations" below the player for quick comparison.

## 2. Advanced Workflow: "Projects" (Long-Form Synthesis)

For users generating audiobooks or long content, we need a "Chunking" workflow to bypass model character limits.

### A. The Chunking Strategy
*   **Automatic Segmentation:**
    *   If text > Model Limit (e.g., 2500 chars), automatically split by:
        1.  Paragraph breaks (`\n\n`)
        2.  Sentence endings (`.`, `?`, `!`)
    *   **UI Feedback:** Show "Text too long - Auto-chunking enabled" or "Split into X parts".
*   **Manual Control (Power User):**
    *   Allow users to manually insert `<break>` tags or click to "Split Here".

### B. Project Interface
*   **Segment List:**
    *   Visual list of text chunks.
    *   **Status Indicators:** `Pending`, `Generating`, `Done`, `Failed`.
    *   **Play/Regenerate per Chunk:** If one sentence is bad, regenerate just that part.
*   **Stitching/Concatenation:**
    *   "Download All" vs "Download Merged" (combines all MP3s into one).

## 3. Helpful Features & Guides (The "On-Boarding" UX)

To help users understand limitations and features without reading docs.

*   **Empty State/Guide:**
    *   When text area is empty, show tips: "Try pasting a news article...", "Use short sentences for better stability...".
*   **Tooltips:**
    *   Info icons next to "Stability" and "Similarity".
    *   *Copy:* "Increasing stability makes the voice more consistent but can sound monotone. Lowering it makes it more expressive."
*   **Model Limitations Warning:**
    *   If text contains foreign characters not supported by the selected model: "This model works best with English. Switch to 'Multilingual' for other languages."

## 4. Technical Implementation Roadmap

### Phase 1: Visual Overhaul
*   [ ] Implement new Layout (Sidebar + Main Content Area).
*   [ ] Build `VoiceSelector` and `AudioPlayer` components.
*   [ ] Style the `TextArea` with character limits.

### Phase 2: Core Logic
*   [ ] Connect Settings sliders to backend API params.
*   [ ] Implement File Upload -> Text extraction (frontend or backend).

### Phase 3: Advanced Features
*   [ ] Implement specific logic for "Long Text" handling (frontend splitting).
*   [ ] Build "History" sidebar.

## 5. Mockup / Layout visual

```
+------------------+----------------------------------------------------+
|  Sidebar         |  Main Content                                      |
|                  |                                                    |
|  [+] New Generation|  [ Voice Selector v ]  [ Settings v ]            |
|  [=] Projects    |                                                    |
|  [H] History     |  +----------------------------------------------+  |
|  [8] Voices      |  |  Write or paste text here...                 |  |
|                  |  |                                              |  |
|                  |  |  (Drag & Drop files)                         |  |
|                  |  +----------------------------------------------+  |
|                  |  0 / 2500 chars                       [Generate]   |
|                  |                                                    |
|                  |  ------------------------------------------------  |
|                  |                                                    |
|                  |  [> Play]  ||||||||||||||||||||||||   [Download]   |
|                  |                                                    |
+------------------+----------------------------------------------------+
```
