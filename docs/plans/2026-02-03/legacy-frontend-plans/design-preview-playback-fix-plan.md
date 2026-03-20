# Design preview play button doesn’t play (Plan)

## Summary

Fix `/design` so that after generating a preview, clicking the preview **Play** button actually plays audio (consistent with the behavior on `/voices`).

---

## Current behavior (ground truth)

**Where it lives**
- Page: `backend/templates/design.html`
- Logic is implemented as an **inline `<script>`** (not in `static/js/app.js`).

**Key flow**
1. User clicks “Generate Preview”
2. Frontend starts async task `POST /api/voices/design/preview`
3. Task completes with `result.audio_base64`
4. `displayPreviewAudio(audioBlob)` renders a WaveSurfer waveform and enables playback

**Symptom**
- The preview waveform renders, but the preview play button appears to do nothing (or remains disabled).

---

## Diagnosis (likely root cause)

In `displayPreviewAudio(audioBlob)`:
- The code registers a `previewWavesurfer.on('ready', ...)` handler that enables the play button.
- Immediately after registering events, it **clones and replaces** the play button node:
  - `const newPlayBtn = playBtn.cloneNode(true);`
  - `playBtn.parentNode.replaceChild(newPlayBtn, playBtn);`

This has two side effects:
1. The `ready` handler enables the **old** `playBtn` reference (which has been removed), so the **new** button can remain disabled.
2. Other event handlers (`on('play')`, `on('pause')`) continue to reference the old element, so UI state can desync.

This pattern differs from `/voices`, where `WaveformManager` disables/enables the **same button element** and updates it on `ready`.

---

## Plan (Implementation)

### 1) Stop cloning/replacing the play button

Replace the clone-node approach with a stable event binding strategy:
- Use `playBtn.onclick = () => previewWavesurfer.playPause();` (overwrites previous handler)
  - or keep a `playHandler` reference and `removeEventListener` before adding a new one

The goal is:
- the element that gets enabled on `ready` is the same element the user clicks
- repeated preview generations don’t accumulate duplicate handlers

### 2) Ensure the enabled button is the one in the DOM

When WaveSurfer `ready` fires:
- set `playBtn.disabled = false`
- initialize the time display (duration)

### 3) Make play/pause UI updates reference the correct button

Update `previewWavesurfer.on('play'|'pause')` handlers to:
- mutate the current `playBtn` element (not a stale reference)
- avoid relying on inner text if you move to SVG/icons later

### 4) Prevent object URL leaks

If `displayPreviewAudio` creates an `audioUrl = URL.createObjectURL(blob)`:
- store the previous URL and `URL.revokeObjectURL(prevUrl)` when regenerating preview or leaving the page

### 5) Verify task restore flow still works

`/design` restores form state from `TaskManager` when returning to the page.
After the fix, verify:
- restoring a finished task still results in a playable preview

---

## Acceptance criteria

- After generating a preview, clicking the preview play button plays/pauses audio reliably.
- The button is enabled once the waveform is ready.
- Regenerating preview multiple times does not create multiple click handlers or memory leaks.
- No regression to “Save Voice” (it still saves the preview blob correctly).

---

## Codex skills (relevant)

- `frontend-design`: if we change the preview player UI (states/icons/disabled styling), keep it polished and consistent.
- `web-design-guidelines`: audit the `/design` preview controls for accessible interaction (button states, focus, labels).
- `tailwind-design-system`: when porting to React, standardize the audio player controls and states using Tailwind v4 component patterns.
- `skill-creator`: codify a “WaveSurfer integration checklist” (lifecycle, cleanup, event binding) so this class of bug doesn’t recur.

---

## Notes for the React rewrite

This bug is a good signal that the Design page should share a single “WaveSurfer wrapper” pattern with the rest of the app:
- in React, encapsulate WaveSurfer in a component/hook that owns the DOM ref and lifecycle
- avoid DOM node replacement patterns entirely
