# Audio Recording Cleanup

`frontend/src/features/clone/Clone.tsx` — recording state machine extraction and simplification.

## Qwen API audio requirements

From the [Qwen TTS voice cloning API docs](https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-cloning):

| Item        | Requirement                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format      | WAV (16-bit), MP3, M4A                                                                                                                                |
| Duration    | 10-20 seconds recommended, 60 max                                                                                                                     |
| File size   | Less than 10 MB                                                                                                                                       |
| Sample rate | 24 kHz or higher                                                                                                                                      |
| Channels    | Mono                                                                                                                                                  |
| Content     | At least 3 seconds of continuous, clear speech. Short pauses (≤2s) acceptable. No background music, noise, or overlapping voices. Normal speech only. |

The Qwen API accepts WAV (16-bit), MP3, and M4A. The `audio.data` field takes either a base64 data URL (`data:audio/wav;base64,...`) or a publicly accessible URL, with mediatype `audio/wav`, `audio/mpeg`, or `audio/mp4`.

## What the current pipeline does

The recording flow in Clone.tsx captures raw PCM via AudioWorklet, then manually assembles a WAV file:

```
getUserMedia → AudioContext → AudioWorkletNode (ScriptProcessor fallback)
  → accumulate Float32 PCM chunks in refs
  → on stop: merge chunks → resample to 24-48kHz → Float32→PCM16LE → WAV header → File
```

This exists because `MediaRecorder` (the standard browser API) outputs compressed formats (webm/opus in Chrome, mp4/aac in Safari), not raw PCM or WAV. The pipeline ensures the output is a clean mono WAV at a controlled sample rate.

## Can we simplify by using MediaRecorder instead?

The Qwen API accepts MP3. `MediaRecorder` in Chrome outputs webm/opus, and in Safari outputs mp4/aac. Neither is directly MP3, but the API also accepts M4A (which Safari's output is).

However, there are problems:

1. Chrome's `MediaRecorder` outputs webm/opus, which is not in the accepted format list (WAV, MP3, M4A). We'd need to convert webm→mp3 client-side, which requires FFmpeg WASM or similar — heavier than the current pipeline.
2. Safari's `MediaRecorder` outputs mp4/aac (M4A), which the API accepts. But we can't control the sample rate — it uses whatever the mic provides (typically 44.1kHz or 48kHz), and we can't guarantee mono.
3. `MediaRecorder` doesn't expose real-time PCM data, so we'd still need a parallel AudioWorklet tap for the mic level meter.
4. `extendable-media-recorder` + `extendable-media-recorder-wav-encoder` can produce WAV from `MediaRecorder`, but requires cross-origin isolation headers (`COEP: require-corp`, `COOP: same-origin`) which can break Turnstile captcha and third-party scripts.

Verdict: the current approach of capturing raw PCM and assembling WAV is the right architecture for this use case. The simplification is structural (extract to a hook), not a library swap.

## Simplifications available

### 1. Drop the ScriptProcessor fallback

`AudioWorklet` is supported in all modern browsers:

- Chrome 66+ (2018)
- Firefox 76+ (2020)
- Safari 14.1+ (2021)

The `ScriptProcessorNode` fallback adds ~30 lines and runs on the main thread (deprecated API). Removing it is both a simplification and a quality improvement. If a browser doesn't support AudioWorklet, we can show an error message instead of silently falling back to a deprecated API.

### 2. Use `AnalyserNode` for the mic level meter

The current code computes RMS inside the AudioWorklet's `processChunk` callback using a custom `rmsLevel()` function on every PCM chunk. The Web Audio API has a built-in `AnalyserNode` that does this natively:

```ts
// Current: custom RMS in the worklet message handler
const processChunk = (input: Float32Array) => {
  setMicLevel(rmsLevel(input)); // manual RMS calculation
  // ... accumulate PCM
};
```

```ts
// Simplified: AnalyserNode for the meter, worklet only for PCM capture
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
source.connect(analyser);

// Poll RMS from the analyser on a requestAnimationFrame loop
const buffer = new Float32Array(analyser.fftSize);
function updateMeter() {
  if (!recording) return;
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  setMicLevel(Math.sqrt(sum / buffer.length));
  requestAnimationFrame(updateMeter);
}
```

This decouples the meter from the PCM capture path. The worklet only accumulates audio data; the meter reads from the AnalyserNode independently. If the worklet message delivery is delayed, the meter still updates smoothly.

Minor improvement — the current approach works fine. Worth doing during the hook extraction but not a priority on its own.

### 3. Use `AudioContext({ sampleRate })` to eliminate manual resampling

The `AudioContext` constructor accepts a `sampleRate` option ([MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext)). If we create the context at the target sample rate, the browser handles resampling from the mic's native rate internally:

```ts
// Current: capture at mic native rate, then resample manually in stopRecording
const audioCtx = new AudioContext(); // uses device default (44100 or 48000)
// ... later in stopRecording:
const targetSampleRate = getTargetRecordingSampleRate(captureSampleRateRef.current);
const normalizedPcm = resampleFloat32Linear(
  mergedPcm,
  captureSampleRateRef.current,
  targetSampleRate,
);
```

```ts
// Simplified: let the browser resample for us
const TARGET_SAMPLE_RATE = 24000;
const audioCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
// PCM chunks from the worklet are already at 24kHz — no manual resampling needed
```

This eliminates `resampleFloat32Linear()`, `getTargetRecordingSampleRate()`, and `captureSampleRateRef` entirely. The browser's built-in resampler uses sinc interpolation, which is higher quality than our linear interpolation.

Browser support for the `sampleRate` constructor option: Chrome 74+, Firefox 61+, Safari 14.1+. Same baseline as AudioWorklet.

Caveat: some browsers may not support all sample rates. 24000 Hz is within the required range (8000-96000) and is widely supported. If a browser rejects it, the constructor throws `NotSupportedError`, which we can catch and fall back to the default rate + manual resampling.

### 4. Consolidate WAV assembly into one utility

Currently `stopRecording` orchestrates five separate calls inline:

```ts
const mergedPcm = concatFloat32Chunks(pcmChunksRef.current, pcmSampleLength);
const targetSampleRate = getTargetRecordingSampleRate(captureSampleRateRef.current);
const normalizedPcm = resampleFloat32Linear(
  mergedPcm,
  captureSampleRateRef.current,
  targetSampleRate,
);
const pcmBytes = float32ToPcm16leBytes(normalizedPcm);
const header = createWavHeaderPcm16Mono(pcmBytes.byteLength, targetSampleRate);
const blob = new Blob([header, pcmBytes], { type: "audio/wav" });
const nextFile = new File([blob], `recording-${Date.now()}.wav`, { type: "audio/wav" });
```

This should be a single function in `audio.ts`:

```ts
function buildWavFile(
  chunks: Float32Array[],
  sampleCount: number,
  captureSampleRate: number,
): File {
  const targetRate = getTargetRecordingSampleRate(captureSampleRate);
  const merged = concatFloat32Chunks(chunks, sampleCount);
  const resampled = resampleFloat32Linear(merged, captureSampleRate, targetRate);
  const pcmBytes = float32ToPcm16leBytes(resampled);
  const header = createWavHeaderPcm16Mono(pcmBytes.byteLength, targetRate);
  const blob = new Blob([header, pcmBytes], { type: "audio/wav" });
  return new File([blob], `recording-${Date.now()}.wav`, { type: "audio/wav" });
}
```

### 5. Extract `useAudioRecorder` hook

Move all recording state, refs, and logic into a self-contained hook:

```ts
// hooks/useAudioRecorder.ts

type UseAudioRecorderOptions = {
  maxSeconds: number;
};

type AudioRecorderResult = {
  recording: boolean;
  micLevel: number; // 0-1 RMS for the meter UI
  recordSeconds: number; // elapsed seconds
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<File | null>; // returns the WAV file
  clear: () => void;
};

export function useAudioRecorder(options: UseAudioRecorderOptions): AudioRecorderResult {
  const { maxSeconds } = options;

  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // All refs stay internal to the hook
  const activeRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const pcmSamplesRef = useRef(0);
  const captureSampleRateRef = useRef(24000);
  const timerRef = useRef<number | null>(null);

  // cleanup, start, stop, clear — all encapsulated
  // ...

  return { recording, micLevel, recordSeconds, error, start, stop, clear };
}
```

The component becomes:

```ts
const recorder = useAudioRecorder({ maxSeconds: MAX_REFERENCE_SECONDS });

// Start button
<Button onPress={() => void recorder.start()} isDisabled={recorder.recording}>
  {recorder.recording ? "Recording..." : "Start"}
</Button>

// Stop button — gets the File back
<Button onPress={async () => {
  const wavFile = await recorder.stop();
  if (wavFile) {
    await validateAndSetFile(wavFile);
    transcribe.mutate(wavFile);
  }
}}>
  Stop
</Button>

// Mic meter
<div style={{ width: `${Math.min(100, recorder.micLevel * 180)}%` }} />

// Timer display
<div>{formatRecordTime(recorder.recordSeconds)}</div>

// Error
{recorder.error ? <Message variant="error">{recorder.error}</Message> : null}
```

### 6. Remove `recordedPreviewUrl` state

Currently a `useState` + `useEffect` that creates/revokes an object URL from the file:

```ts
const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);

useEffect(() => {
  if (audioMode !== "record" || !file) {
    setRecordedPreviewUrl(null);
    return;
  }
  const url = URL.createObjectURL(file);
  setRecordedPreviewUrl(url);
  return () => URL.revokeObjectURL(url);
}, [audioMode, file]);
```

This can be a `useMemo` with cleanup, or just derived inline since `WaveformPlayer` can accept a `Blob` directly via its `audioBlob` prop (which it already does in the current code).

## File structure

### Current layout

All audio recording code lives in three places, none co-located with Clone:

```
frontend/src/
  lib/
    audio.ts                    ← PCM/WAV utilities (only imported by Clone.tsx)
    pcmCapture.worklet.js       ← AudioWorklet processor (only referenced by Clone.tsx)
  features/
    clone/
      Clone.tsx                 ← 200 lines of recording logic inline
```

### Proposed layout

Co-locate the hook with Clone. Group audio utilities into their own `lib/audio/` subdirectory:

```
frontend/src/
  lib/
    audio/
      audio.ts                  ← moved from lib/audio.ts (same exports + new buildWavFile)
      pcmCapture.worklet.js     ← moved from lib/pcmCapture.worklet.js
  features/
    clone/
      Clone.tsx                 ← imports useAudioRecorder from ./hooks/
      hooks/
        useAudioRecorder.ts     ← new, co-located with its only consumer
```

### Why this layout

`lib/audio.ts` and `lib/pcmCapture.worklet.js` have zero imports outside of Clone.tsx (verified by search). They are pure audio utilities with no React dependency, so `lib/audio/` is the right home — it groups related non-React code together and keeps `lib/` from accumulating unrelated top-level files.

`useAudioRecorder` is a React hook that is only used by Clone. Co-locating it at `features/clone/hooks/` follows the colocation principle: keep code close to where it's used. If another feature ever needs mic recording, the hook can be promoted to the top-level `hooks/` directory at that point.

### Import paths after the move

```ts
// features/clone/hooks/useAudioRecorder.ts
import { buildWavFile, rmsLevel } from "../../../lib/audio/audio";
// worklet reference:
new URL("../../../lib/audio/pcmCapture.worklet.js", import.meta.url);

// features/clone/Clone.tsx
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { getAudioDurationSeconds } from "../../lib/audio/audio";
// getAudioDurationSeconds stays imported by Clone for file validation (validateAndSetFile)
```

## Impact summary

| Metric                                     | Before                                                                            | After                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Recording-related `useState` in Clone.tsx  | 5                                                                                 | 0 (in hook)                                               |
| Recording-related `useRef` in Clone.tsx    | 9                                                                                 | 0 (in hook)                                               |
| Recording-related `useEffect` in Clone.tsx | 2                                                                                 | 0 (in hook)                                               |
| ScriptProcessor fallback                   | ~30 lines                                                                         | Removed                                                   |
| Manual resampling code                     | `resampleFloat32Linear` + `getTargetRecordingSampleRate` + `captureSampleRateRef` | Removed (`AudioContext({ sampleRate: 24000 })`)           |
| RMS mic level calculation                  | Coupled to worklet message handler                                                | Decoupled via `AnalyserNode` (optional)                   |
| WAV assembly inline                        | ~7 lines per call                                                                 | 1 function call                                           |
| New files                                  | 0                                                                                 | `features/clone/hooks/useAudioRecorder.ts` (~100 lines)   |
| Moved files                                | `lib/audio.ts`, `lib/pcmCapture.worklet.js`                                       | → `lib/audio/audio.ts`, `lib/audio/pcmCapture.worklet.js` |
| Clone.tsx net reduction                    | ~200 lines removed                                                                | Replaced by ~5 lines of hook usage                        |

## Relationship to TanStack Query migration

This extraction is independent of TanStack Query. It can happen before, during, or after the Query rollout. However, doing it alongside the Query migration for Clone.tsx's two mutations (transcription + clone submission) produces the cleanest result — the component drops from 751 lines to ~400 lines in one pass.

## Libraries considered and rejected

| Library                                   | Why not                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react-audio-voice-recorder`              | Uses `MediaRecorder` → outputs webm/opus, not WAV. No real-time PCM access for mic meter.                                                        |
| `react-media-recorder`                    | Same `MediaRecorder` limitation. No sample rate control.                                                                                         |
| `extendable-media-recorder` + wav encoder | Requires cross-origin isolation headers (COEP/COOP) which break Turnstile captcha. Still no real-time mic level without a parallel AudioWorklet. |
| `recorder-audio-worklet`                  | Only provides the worklet processor, not the full pipeline. We already have a custom worklet that does the same thing.                           |

The current approach (AudioWorklet → PCM → WAV) is the right architecture. The fix is extraction, not replacement.

## `audio.ts` function-by-function assessment

After applying simplifications #2 and #3 (`AnalyserNode` + `AudioContext({ sampleRate })`), the exports in `lib/audio/audio.ts` change:

| Function                       | Current role                                                  | After simplifications                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `resampleFloat32Linear`        | Resamples PCM from mic rate to target rate                    | Dead code (browser resamples via `AudioContext({ sampleRate })`). Keep as fallback for rare `NotSupportedError`.                        |
| `getTargetRecordingSampleRate` | Clamps sample rate to 24000-48000                             | Dead code (fixed at 24000 via constructor). Remove.                                                                                     |
| `rmsLevel`                     | Computes RMS for mic meter                                    | No longer exported (meter uses `AnalyserNode` internally in the hook). Can stay as a private helper or be inlined.                      |
| `concatFloat32Chunks`          | Merges Float32Array chunks into one                           | Stays. Called by `buildWavFile`. Trivial (8 lines), no library simplifies this.                                                         |
| `float32ToPcm16leBytes`        | Converts Float32 [-1,1] to 16-bit signed LE PCM               | Stays. No browser API does this conversion. Correct and minimal.                                                                        |
| `createWavHeaderPcm16Mono`     | Writes 44-byte RIFF/WAV header                                | Stays. No browser API generates WAV headers. Correct and minimal.                                                                       |
| `getAudioDurationSeconds`      | Reads duration from a File via temporary Audio element        | Stays. Used by Clone's `validateAndSetFile`. `decodeAudioData` could do it but would decode the entire file into memory — much heavier. |
| `buildWavFile` (new)           | Consolidates chunk merge → PCM conversion → WAV header → File | New. Calls `concatFloat32Chunks`, `float32ToPcm16leBytes`, `createWavHeaderPcm16Mono` internally.                                       |

After cleanup, `audio.ts` exports shrink from 7 to 4: `buildWavFile`, `getAudioDurationSeconds`, `concatFloat32Chunks` (used by `buildWavFile` but may also be useful standalone), and the WAV primitives as internal helpers.

## `pcmCapture.worklet.js` assessment

The worklet is a 50-line `AudioWorkletProcessor` that buffers incoming audio frames into 4096-sample chunks and posts them to the main thread via `postMessage` with transferable `ArrayBuffer`. It uses a manual queue with `shift()` and `subarray()` for chunk assembly.

No changes needed. `AudioWorklet` is the correct API for off-main-thread audio capture. The `recorder-audio-worklet` npm package provides a similar processor but is essentially the same code with more abstraction — not worth a dependency for 50 lines. The worklet stays as-is and moves to `lib/audio/pcmCapture.worklet.js`.
