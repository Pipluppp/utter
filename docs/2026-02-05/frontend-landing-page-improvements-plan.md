# Frontend Landing Page Improvements Plan (2026-02-05)

> **Scope**: `frontend/src/pages/Landing.tsx` + `frontend/src/pages/landing/*` + `frontend/src/content/utterDemo.ts`  
> **Goal**: Make the landing page demos self-explanatory and higher-converting by showing **(A) reference audio** and **(B) generated output audio** per character demo, refreshing the Korean demo, and improving the bottom-of-page “what next” section.

---

## Problems to solve (current state as of 2026-02-03)

1) **Demos lack “what am I hearing?” clarity**
   - The landing cards currently expose a single `audioUrl` and “Copy text”, but don’t explicitly communicate:
     - what the clip represents (reference vs generated),
     - what text was used for generation (if any),
     - why this demo is useful (what to try next).

2) **Korean demo (“Parasite”) needs replacement**
   - The current `parasite` entry has no still image and the branding/copy is not ideal.
   - We want a Korean demo that feels like a character/scene, without accidental negative connotation, and with a strong still.

3) **Bottom of landing page doesn’t finish the story**
   - After “How it works”, there isn’t a strong “choose a path” section:
     - “Try cloning”, “Try designing”, “Try generating”, plus a clear expectation of what happens next.

---

## Deliverables

### 1) Per-demo “Reference” + “Generated” audio

**Data model**
- Update `frontend/src/content/utterDemo.ts`:
  - Keep existing fields for backwards compatibility (`audioUrl` is currently used by `/clone?demo=...`).
  - Add new optional fields to represent generated output:
    - `generatedAudioUrl?: string`
    - `generatedTranscriptUrl?: string` (or `generatedText?: string` if you’d rather inline text)
    - `generatedLabel?: string` (e.g. “Generated output”)
  - Optional (nice-to-have) fields for better UX:
    - `referenceLabel?: string` (e.g. “Reference / source clip”)
    - `notes?: string` (short 1-liner: “Best for: whispery realism, low noise”)

**Assets**
- Add generated output audio files under `backend/static/utter_demo_v2/` with a consistent naming scheme, e.g.:
  - `gojo_generated.mp3`
  - `frieren_generated.mp3`
  - `chungking_generated.mp3`
  - `brutalist_generated.mp3`
  - (and the new Korean demo)
- Add generated output transcript text files:
  - `gojo_generated.txt`, etc.

**UI**
- Update `frontend/src/pages/landing/DemoClipCard.tsx` to support two clips.
  - Recommended UX: **a 2-state toggle** (“Reference” / “Generated”) that switches the player + text source.
    - Keeps the card compact; avoids two players fighting for attention.
  - Alternative UX: stacked players (“Reference” player + “Generated” player) if you want everything visible.
- When “Generated” is selected:
  - “Copy text” uses `generatedTranscriptUrl` (or `generatedText`).
  - “Download” points to `generatedAudioUrl`.
  - The seek bar/player uses `generatedAudioUrl`.
- Maintain the “pause other demos” behavior across all audio elements.
  - If using a single `<audio>` element with `src` swapping, ensure state resets on clip switch (duration, currentTime, ready).

**CTAs inside each card (optional but recommended)**
- Add a tertiary link row:
  - “Clone this” → `/clone?demo=<id>` (already supported by Clone page)
  - “Generate with this text” → `/generate?demo=<id>` (Generate page already reads `demo` to prefill text)

**Acceptance criteria**
- Every demo card clearly shows which clip is playing (Reference vs Generated).
- Every demo card has downloadable audio and copyable text for the selected clip.
- No demo card looks “broken” (no “No still available…” unless intentionally allowed).

---

### 2) Replace the Korean demo (“Parasite”)

**Content decisions**
- Replace the existing `parasite` demo with a new Korean demo that has:
  - New `id` (recommended to avoid legacy baggage), e.g. `seoul-noir` or `kdrama`
  - New `title` + `vibe`
  - `languageLabel: 'Korean'`
  - A still image (`imageUrl`)
  - Reference audio + transcript
  - Generated audio + generated transcript
- Remove the old `parasite` entry from `UTTER_DEMOS`.

**UI layout**
- Update `frontend/src/pages/landing/DemoWall.tsx`:
  - Replace `LAYOUT.parasite` with the new ID key.
  - Keep the overall collage layout balanced after the swap.

**Assets**
- Add/replace static files in `backend/static/utter_demo_v2/`:
  - `korean_demo.png` (or the chosen name)
  - `korean_demo.mp3`, `korean_demo.txt`
  - `korean_demo_generated.mp3`, `korean_demo_generated.txt`
- Optionally remove `parasite.mp3` / `parasite.txt` if no longer referenced.

**Acceptance criteria**
- Landing page has a Korean demo with a still image.
- No remaining references to `parasite` in `frontend/src/content/utterDemo.ts` or `frontend/src/pages/landing/DemoWall.tsx`.

---

### 3) Improve the bottom section (“What next”)

**Goal**
- Finish the page with a clear next step and confidence-building context (without turning it into a marketing wall).

**Recommended layout (add below “How it works”)**
- A compact “Pick a path” section with 3 cards:
  - “Clone a voice” (link `/clone`)
  - “Design a voice” (link `/design`)
  - “Generate speech” (link `/generate`)
- A final CTA strip (full width, subtle background):
  - Left: one-sentence promise (“From clip → voice → speech in minutes.”)
  - Right: buttons (“Hear demos”, “Start cloning”)

**Copy improvements**
- Tighten “How it works” descriptions to match actual constraints:
  - e.g. “Generate (up to 10k chars)” is correct; keep it consistent across the app.

**Acceptance criteria**
- Landing page ends with a clear CTA cluster.
- No dead-ends: user always has an obvious next click.

---

## Implementation checklist (suggested order)

1) Add new fields to `UtterDemo` and populate generated URLs for 1 demo.
2) Update `DemoClipCard` UI to support toggling between clips.
3) Add generated output assets for remaining demos and fill in `UTTER_DEMOS`.
4) Replace the Korean demo entry + update `DemoWall` layout mapping.
5) Add the bottom “Pick a path” + final CTA strip in `Landing.tsx`.
6) Quick a11y pass:
   - Buttons have clear labels
   - Toggle is keyboard accessible
   - No focus traps; visible focus rings remain intact

