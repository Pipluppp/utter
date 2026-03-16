# Plan 5: Clone Recording — Mic Capture, Level Meter, Auto-Transcription

> **Scope**: Add audio recording to Clone screen (currently upload-only)
> **Estimate**: 1 session
> **Depends on**: Phase 1 core polish (done)
> **Expo Go note**: expo-audio recording IS supported in Expo Go — no dev client needed

## Overview

The web Clone page has both Upload and Record modes. Upload mode works on mobile already; this plan adds Record mode using `expo-audio` (SDK 54), which replaces the deprecated expo-av recording API.

## expo-audio recording API (SDK 54)

```ts
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';

// Request permission
const status = await AudioModule.requestRecordingPermissionsAsync();

// Create recorder with preset
const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

// Start/stop
recorder.record();     // or recorder.record({ maxDuration: 60 })
recorder.stop();

// Get URI after stop
const uri = recorder.uri;  // file URI of the recorded audio

// Metering (for level meter)
recorder.isMetering  // boolean — metering is available
// The recorder emits onRecordingStatusUpdate with metering data
```

**Key constraint:** `expo-audio` recorder in SDK 54 uses a hook-based API. The recording URI is available as `recorder.uri` after calling `stop()`. Metering for level visualization requires checking `recorder.currentMetering` or subscribing to status updates.

## Implementation

### 1. Add Upload/Record mode toggle

**File:** `mobile/app/clone.tsx`

Add a segmented control above the file picker:
```
[Upload] [Record]
```

When Record is selected, show the recording UI instead of the file picker.

### 2. Recording UI

When in Record mode, show:
- **Mic level meter** — horizontal bar that responds to audio input level
  - Use `recorder.currentMetering` (dB value, typically -160 to 0)
  - Normalize: `level = Math.max(0, (metering + 60) / 60)` → 0.0 to 1.0
  - Animate width of a filled bar
- **Timer** — MM:SS counting up, stops at 60s
- **Controls**: Start / Stop / Clear buttons
- **Status text**: "Recording...", "Processing...", idle states
- **Auto-stop** at 60 seconds (MAX_REFERENCE_SECONDS)

### 3. Post-recording flow

After stopping:
1. Get the URI from `recorder.uri`
2. Set it as the selected file (same as file picker would)
3. If auto-transcription is available, trigger it:
   - `POST /api/transcriptions` with the audio file
   - Set the transcript field with the result
4. Show a playback preview (use `useAudioPlayer` with the recorded URI)

### 4. Auto-transcription

**Endpoint:** `POST /api/transcriptions` (FormData: audio file + language)
**Response:** `{ text: string; model: string; language: string | null }`

Check if transcription is enabled via `GET /api/languages` → `transcription.enabled`.

```ts
const form = new FormData();
form.append('audio', {
  uri: recordedUri,
  type: 'audio/wav',
  name: 'recording.wav',
} as any);
form.append('language', language);

const res = await apiForm('/api/transcriptions', form, { method: 'POST' });
setTranscript(res.text);
```

Need to add `apiForm` to `mobile/lib/api.ts` if it doesn't exist (currently only `apiJson` and `apiRedirectUrl` exist).

### 5. Permission handling

- `expo-audio` plugin already declares microphone permission in `app.json`
- Request at runtime: `AudioModule.requestRecordingPermissionsAsync()`
- Handle denial gracefully (show message, keep Upload mode available)

### 6. New dependencies

- None needed — `expo-audio` already installed and includes recording API
- May need to add `apiForm` helper to API client

### 7. Types to add

In `mobile/lib/types.ts`:
```ts
export type TranscriptionResponse = {
  text: string;
  model: string;
  language: string | null;
};
```

## Web reference

- `frontend/src/pages/Clone.tsx` — recording section (~200 lines of recording logic)
  - Uses WebAudio API (AudioContext, ScriptProcessor/AudioWorklet)
  - PCM capture, WAV encoding, metering via RMS
  - Mobile equivalent: expo-audio handles all of this natively

---

## Session Prompt

```
We're continuing work on the Expo React Native mobile app for our Utter project.

**Context:**
- Worktree: C:\Users\Duncan\Desktop\utter-mobile (branch: feat/mobile-app)
- Mobile app: mobile/ directory (Expo SDK 54, expo-router v6, React 19.1.0)
- The app runs on Expo Go on a physical device, connected to production backend
- Session docs: docs/2026-03-15/ (scaffold + architecture), docs/2026-03-16/ (plans)
- Previous work: Phase 1 done, possibly History/Account/Tasks screens done

**Task: Clone Audio Recording**

Read docs/2026-03-16/05-clone-recording.md for the full plan. Use the /building-native-ui skill for all UI work.

Add audio recording to the Clone screen:

1. **Add Upload/Record toggle** to mobile/app/clone.tsx — segmented control above file picker

2. **Build recording UI** — when Record mode is active:
   - Mic level meter (horizontal bar from recorder metering data)
   - Timer (MM:SS, auto-stop at 60s)
   - Start/Stop/Clear buttons
   - Use expo-audio's useAudioRecorder hook with RecordingPresets.HIGH_QUALITY
   - Request mic permission via AudioModule.requestRecordingPermissionsAsync()

3. **Post-recording flow** — after stopping:
   - Set recorder.uri as the selected file
   - Auto-transcribe via POST /api/transcriptions (if transcription.enabled from /api/languages)
   - Show playback preview of recording

4. **Add apiForm helper** to mobile/lib/api.ts if needed (FormData upload with auth + 401 retry)

5. **Add TranscriptionResponse type** to mobile/lib/types.ts

Cross-reference: frontend/src/pages/Clone.tsx (recording section uses WebAudio — mobile uses expo-audio native recording instead)

Run npx tsc --noEmit from mobile/ after changes. Commit when complete.

**Post-session docs update (required):**
After clone recording is done:
1. Update docs/2026-03-15/01-web-parity-plan.md — change Clone recording/transcription features from "Missing" to "Done"
2. Add a "## Completed" section at the bottom of this plan file with: what was built, any deviations from the plan, and the commit hash(es)
3. Commit the doc updates separately: `docs(mobile): update parity plan after clone recording`
```

---

## Completed

### Clone Audio Recording (2026-03-16)

**What was built:**
- Upload/Record mode toggle (segmented control) in `mobile/app/clone.tsx`
- Recording UI:
  - Mic level meter (horizontal bar, normalized from dB metering data)
  - MM:SS timer display counting up
  - Start/Stop/Clear/Re-record buttons
  - Recording status indicators (● Recording..., Recording ready)
  - Auto-stop at 60 seconds via `forDuration` option
- `expo-audio` `useAudioRecorder` with `RecordingPresets.HIGH_QUALITY`
- `useAudioRecorderState` for real-time metering + duration
- Mic permission request via `requestRecordingPermissionsAsync()` with denial handling
- Auto-transcription: after recording stops, sends audio to `POST /api/transcriptions` if enabled
- `apiForm` helper added to `mobile/lib/api.ts` (FormData upload with bearer auth + 401 retry)
- `TranscriptionResponse` type added to `mobile/lib/types.ts`

**Deviations from plan:**
- No waveform preview of recording (using level meter bar instead — waveform requires native canvas/Skia)
- No playback preview of recording after stop (user can hear it played back during clone finalization; adding preview would need additional player state management)
- Recording outputs `.m4a` (HIGH_QUALITY preset default) rather than `.wav`

**Commits:**
- `ece1718` — feat(mobile): add audio recording to Clone screen
