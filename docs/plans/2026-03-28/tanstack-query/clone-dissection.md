# Clone.tsx Dissection

> **Status**: COMPLETED. The extraction described in this document was executed on 2026-03-29. Clone.tsx is now 199 lines with co-located hooks and components under `features/clone/hooks/` and `features/clone/components/`. This document is retained as historical context for the TanStack Query migration planning.

`frontend/src/features/clone/Clone.tsx` — was 751 lines, 18 `useState`, 10 `useRef`, 5 `useEffect` (pre-extraction).

The most complex component in the frontend. It mixed six distinct responsibilities into one function. This document breaks down each responsibility, maps every piece of state, and shows before/after for the cleanup.

## The six responsibilities

### 1. Audio recording state machine (~200 lines)

A full microphone capture pipeline: Web Audio API, AudioWorklet with ScriptProcessor fallback, PCM chunk accumulation, resampling, WAV encoding, auto-stop at 60 seconds.

State owned:

```ts
// useState
const [recording, setRecording] = useState(false);
const [recordingError, setRecordingError] = useState<string | null>(null);
const [micLevel, setMicLevel] = useState(0);
const [recordSeconds, setRecordSeconds] = useState(0);
const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);

// useRef — imperative hardware handles and buffers
const streamRef = useRef<MediaStream | null>(null);
const audioCtxRef = useRef<AudioContext | null>(null);
const processorRef = useRef<ScriptProcessorNode | null>(null);
const workletRef = useRef<AudioWorkletNode | null>(null);
const pcmChunksRef = useRef<Float32Array[]>([]);
const pcmSamplesRef = useRef(0);
const captureSampleRateRef = useRef(24000);
const recordTimerRef = useRef<number | null>(null);
const recordingActiveRef = useRef(false);
```

Functions: `startRecording()`, `stopRecording()`, `cleanupRecording()`, `stopRecordingTimer()`.

`recordingActiveRef` exists because the `setInterval` callback inside `startRecording` can't reliably read the `recording` useState (stale closure), so a ref shadows the state. `pcmChunksRef` and `pcmSamplesRef` accumulate raw audio data that never renders — pure imperative buffers that only matter when `stopRecording` assembles the final WAV file.

None of this touches the server. None of it renders UI directly. It produces one output: a `File` object.

### 2. File validation and selection (~30 lines)

```ts
const [file, setFile] = useState<File | null>(null);
const [fileError, setFileError] = useState<string | null>(null);
const [audioMode, setAudioMode] = useState<"upload" | "record">("upload");
```

`validateAndSetFile` checks extension, size, and duration, then sets the file or an error. `audioMode` toggles between upload and record input surfaces. Clean and small. Shared between the upload dropzone and the recording flow.

### 3. Transcription mutation (~40 lines)

```ts
const [transcribing, setTranscribing] = useState(false);

async function onTranscribeAudio(
  nextFile: File | null = file,
  opts?: { errorTarget?: "page" | "record" },
) {
  const errorTarget = opts?.errorTarget ?? "page";
  if (errorTarget === "record") {
    setRecordingError(null);
  } else {
    setError(null);
  }
  // ...
  setTranscribing(true);
  try {
    const form = new FormData();
    form.set("audio", nextFile);
    form.set("language", language);
    const res = await apiForm<{ text: string; model: string; language: string | null }>(
      "/api/transcriptions",
      form,
      { method: "POST" },
    );
    setTranscript(res.text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to transcribe audio.";
    if (errorTarget === "record") setRecordingError(msg);
    else setError(msg);
  } finally {
    setTranscribing(false);
  }
}
```

The `errorTarget` parameter routes errors to either `setError` (page-level) or `setRecordingError` (recording panel) depending on the call site. This is a code smell — the function has two error channels because the component owns too many error states.

### 4. Clone submission flow (~60 lines)

A three-step sequential mutation:

```ts
const [submitting, setSubmitting] = useState(false);
const [startedAt, setStartedAt] = useState<number | null>(null);
const [elapsedLabel, setElapsedLabel] = useState("0:00");
const [sweepNonce, setSweepNonce] = useState(0);
const [error, setError] = useState<string | null>(null);
const [created, setCreated] = useState<CloneResponse | null>(null);

// Elapsed timer while submitting
useEffect(() => {
  if (!submitting || !startedAt) return;
  const t = window.setInterval(() => setElapsedLabel(formatElapsed(startedAt)), 1000);
  return () => window.clearInterval(t);
}, [startedAt, submitting]);

async function onSubmit() {
  // 1. Get presigned upload URL
  const { voice_id, upload_url } = await apiJson<{...}>("/api/clone/upload-url", {
    method: "POST",
    json: { name: name.trim(), language, transcript: transcript.trim() },
  });
  // 2. Upload file to R2
  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentTypeForFile(file) },
  });
  if (!uploadRes.ok) throw new Error("Failed to upload audio file.");
  // 3. Finalize clone
  const res = await apiJson<CloneResponse>("/api/clone/finalize", {
    method: "POST",
    json: { voice_id, name: name.trim(), language, transcript: transcript.trim() },
  });
  setCreated(res);
}
```

Six `useState` calls and one `useEffect` just to manage this mutation lifecycle.

### 5. Demo/example loading (~50 lines)

```ts
const loadedDemoRef = useRef<string | null>(null);

// Hardcoded example
async function onTryExample() {
  /* fetch /static/examples/audio.wav + text */
}

// Route-param demo
useEffect(() => {
  const demoId = demoParam;
  if (!demoId) return;
  if (loadedDemoRef.current === demoId) return;
  loadedDemoRef.current = demoId;
  // fetch demo audio + transcript, call validateAndSetFile, set name/transcript
}, [demoParam, validateAndSetFile]);
```

Two paths that do the same thing: fetch audio + text, validate the file, seed the form. `loadedDemoRef` prevents the demo effect from re-running. These are one-shot seed operations, not ongoing server state.

### 6. Form state and UI (~370 lines)

```ts
const [name, setName] = useState("");
const [transcript, setTranscript] = useState("");
const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
```

The actual form fields plus the entire JSX tree. This is the "real" component — everything above is infrastructure that feeds into these three values plus the `file`.

---

## State audit

### Every `useState` categorized

| State                | Category                 | Stays in component?                    |
| -------------------- | ------------------------ | -------------------------------------- |
| `file`               | File selection           | Yes                                    |
| `fileError`          | File validation          | Yes                                    |
| `audioMode`          | UI mode toggle           | Yes                                    |
| `transcribing`       | Mutation loading         | No — `useMutation.isPending`           |
| `recording`          | Recording state machine  | No — `useAudioRecorder`                |
| `recordingError`     | Recording state machine  | No — `useAudioRecorder`                |
| `micLevel`           | Recording state machine  | No — `useAudioRecorder`                |
| `recordSeconds`      | Recording state machine  | No — `useAudioRecorder`                |
| `recordedPreviewUrl` | Derived from file + mode | No — derive inline                     |
| `name`               | Form                     | Yes                                    |
| `transcript`         | Form                     | Yes                                    |
| `language`           | Form                     | Yes                                    |
| `submitting`         | Mutation loading         | No — `useMutation.isPending`           |
| `startedAt`          | Elapsed timer            | No — derive from mutation              |
| `elapsedLabel`       | Elapsed timer            | No — derive from mutation              |
| `sweepNonce`         | UI animation             | Yes                                    |
| `error`              | Page-level error         | Partially — mutations own their errors |
| `created`            | Mutation result          | No — `useMutation.data`                |

18 total → ~7-8 remain after cleanup.

### Every `useRef` categorized

| Ref                    | Category                | Stays in component?     |
| ---------------------- | ----------------------- | ----------------------- |
| `loadedDemoRef`        | Demo loading guard      | Yes                     |
| `recordingActiveRef`   | Recording state machine | No — `useAudioRecorder` |
| `streamRef`            | Recording hardware      | No — `useAudioRecorder` |
| `audioCtxRef`          | Recording hardware      | No — `useAudioRecorder` |
| `processorRef`         | Recording hardware      | No — `useAudioRecorder` |
| `workletRef`           | Recording hardware      | No — `useAudioRecorder` |
| `pcmChunksRef`         | Recording buffer        | No — `useAudioRecorder` |
| `pcmSamplesRef`        | Recording buffer        | No — `useAudioRecorder` |
| `captureSampleRateRef` | Recording config        | No — `useAudioRecorder` |
| `recordTimerRef`       | Recording timer         | No — `useAudioRecorder` |

10 total → 1 remains.

### Every `useEffect` categorized

| Effect                                   | Purpose                  | Stays in component?           |
| ---------------------------------------- | ------------------------ | ----------------------------- |
| Disable record mode if transcription off | Guard                    | Yes                           |
| Elapsed timer while submitting           | UI timer                 | No — derive from mutation     |
| Recorded preview URL lifecycle           | Object URL create/revoke | Simplifies with recorder hook |
| Recording cleanup on unmount             | Hardware cleanup         | No — `useAudioRecorder`       |
| Demo param loading                       | One-shot seed            | Yes                           |

5 total → 2 remain.

---

## Before and after

### Recording: before

```ts
// Clone.tsx — ~200 lines of recording infrastructure
const [recording, setRecording] = useState(false);
const [recordingError, setRecordingError] = useState<string | null>(null);
const [micLevel, setMicLevel] = useState(0);
const [recordSeconds, setRecordSeconds] = useState(0);

const streamRef = useRef<MediaStream | null>(null);
const audioCtxRef = useRef<AudioContext | null>(null);
const processorRef = useRef<ScriptProcessorNode | null>(null);
const workletRef = useRef<AudioWorkletNode | null>(null);
const pcmChunksRef = useRef<Float32Array[]>([]);
const pcmSamplesRef = useRef(0);
const captureSampleRateRef = useRef(24000);
const recordTimerRef = useRef<number | null>(null);
const recordingActiveRef = useRef(false);

function stopRecordingTimer() {
  /* ... */
}
async function cleanupRecording() {
  /* ... 30 lines ... */
}
async function startRecording() {
  /* ... 70 lines ... */
}
async function stopRecording() {
  /* ... 40 lines ... */
}

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (recordTimerRef.current) {
      /* ... */
    }
    const processor = processorRef.current; /* ... */
    const audioCtx = audioCtxRef.current; /* ... */
    const stream = streamRef.current; /* ... */
  };
}, []);
```

### Recording: after

```ts
// hooks/useAudioRecorder.ts — extracted hook
type AudioRecorderOptions = {
  maxSeconds: number;
  onFile: (file: File) => void;
  onError: (message: string) => void;
};

type AudioRecorderState = {
  recording: boolean;
  micLevel: number;
  recordSeconds: number;
  start: () => void;
  stop: () => void;
  clear: () => void;
};

function useAudioRecorder(options: AudioRecorderOptions): AudioRecorderState {
  // All 9 refs, 4 useState, recording logic, cleanup — encapsulated here.
  // Returns only the interface the component needs.
}

// Clone.tsx — 3 lines replace ~200
const recorder = useAudioRecorder({
  maxSeconds: MAX_REFERENCE_SECONDS,
  onFile: (nextFile) => void validateAndSetFile(nextFile),
  onError: (msg) => setError(msg),
});
```

### Transcription: before

```ts
const [transcribing, setTranscribing] = useState(false);

async function onTranscribeAudio(
  nextFile: File | null = file,
  opts?: { errorTarget?: "page" | "record" },
) {
  const errorTarget = opts?.errorTarget ?? "page";
  if (errorTarget === "record") setRecordingError(null);
  else setError(null);

  if (!transcriptionEnabled) {
    /* route error to target */ return;
  }
  if (!nextFile) {
    /* route error to target */ return;
  }

  setTranscribing(true);
  try {
    const form = new FormData();
    form.set("audio", nextFile);
    form.set("language", language);
    const res = await apiForm<{ text: string; model: string; language: string | null }>(
      "/api/transcriptions",
      form,
      { method: "POST" },
    );
    setTranscript(res.text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to transcribe audio.";
    if (errorTarget === "record") setRecordingError(msg);
    else setError(msg);
  } finally {
    setTranscribing(false);
  }
}
```

### Transcription: after

```ts
const transcribe = useMutation({
  mutationFn: (audioFile: File) => {
    const form = new FormData();
    form.set("audio", audioFile);
    form.set("language", language);
    return apiForm<{ text: string; model: string; language: string | null }>(
      "/api/transcriptions",
      form,
      { method: "POST" },
    );
  },
  onSuccess: (res) => setTranscript(res.text),
});

// Usage — no errorTarget routing, error lives on the mutation
transcribe.mutate(file);
// transcribe.isPending replaces transcribing
// transcribe.error replaces the routed error
```

### Clone submission: before

```ts
const [submitting, setSubmitting] = useState(false);
const [startedAt, setStartedAt] = useState<number | null>(null);
const [elapsedLabel, setElapsedLabel] = useState("0:00");
const [sweepNonce, setSweepNonce] = useState(0);
const [error, setError] = useState<string | null>(null);
const [created, setCreated] = useState<CloneResponse | null>(null);

useEffect(() => {
  if (!submitting || !startedAt) return;
  const t = window.setInterval(() => setElapsedLabel(formatElapsed(startedAt)), 1000);
  return () => window.clearInterval(t);
}, [startedAt, submitting]);

async function onSubmit() {
  setError(null);
  setCreated(null);
  setFileError(null);
  // ... validation ...
  setSubmitting(true);
  setSweepNonce((value) => value + 1);
  const t0 = Date.now();
  setStartedAt(t0);
  setElapsedLabel("0:00");

  try {
    const { voice_id, upload_url } = await apiJson<{...}>("/api/clone/upload-url", {
      method: "POST",
      json: { name: name.trim(), language, transcript: transcript.trim() },
    });
    const uploadRes = await fetch(upload_url, {
      method: "PUT", body: file,
      headers: { "Content-Type": contentTypeForFile(file) },
    });
    if (!uploadRes.ok) throw new Error("Failed to upload audio file.");
    const res = await apiJson<CloneResponse>("/api/clone/finalize", {
      method: "POST",
      json: { voice_id, name: name.trim(), language, transcript: transcript.trim() },
    });
    setCreated(res);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Failed to clone voice.");
  } finally {
    setSubmitting(false);
    setStartedAt(null);
  }
}
```

### Clone submission: after

```ts
const cloneVoice = useMutation({
  mutationKey: voiceQueries.all(), // invalidates voice caches on success
  mutationFn: async (params: {
    name: string;
    language: string;
    transcript: string;
    file: File;
  }) => {
    const { voice_id, upload_url } = await apiJson<{
      voice_id: string;
      upload_url: string;
      object_key: string;
    }>("/api/clone/upload-url", {
      method: "POST",
      json: { name: params.name, language: params.language, transcript: params.transcript },
    });
    const uploadRes = await fetch(upload_url, {
      method: "PUT",
      body: params.file,
      headers: { "Content-Type": contentTypeForFile(params.file) },
    });
    if (!uploadRes.ok) throw new Error("Failed to upload audio file.");
    return apiJson<CloneResponse>("/api/clone/finalize", {
      method: "POST",
      json: {
        voice_id,
        name: params.name,
        language: params.language,
        transcript: params.transcript,
      },
    });
  },
});

// Usage
function onSubmit() {
  if (!name.trim() || !file) return;
  setSweepNonce((v) => v + 1);
  cloneVoice.mutate({ name: name.trim(), language, transcript: transcript.trim(), file });
}

// cloneVoice.isPending replaces submitting
// cloneVoice.data replaces created
// cloneVoice.error replaces the submission error path
// Elapsed label derives from cloneVoice.submittedAt or a useElapsedWhile(cloneVoice.isPending) hook
```

### The component after all extractions

```ts
export function ClonePage() {
  const { demo: demoParam } = cloneRoute.useSearch();

  // --- File selection ---
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [audioMode, setAudioMode] = useState<"upload" | "record">("upload");
  const validateAndSetFile = useCallback(async (next: File | null) => { /* ... */ }, []);

  // --- Recording (extracted hook) ---
  const recorder = useAudioRecorder({
    maxSeconds: MAX_REFERENCE_SECONDS,
    onFile: (nextFile) => void validateAndSetFile(nextFile),
    onError: (msg) => setFileError(msg),
  });

  // --- Transcription (mutation) ---
  const transcribe = useMutation({ /* ... */ });

  // --- Form state ---
  const [name, setName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [sweepNonce, setSweepNonce] = useState(0);

  // --- Clone submission (mutation) ---
  const cloneVoice = useMutation({ /* ... */ });

  // --- Demo loading ---
  const loadedDemoRef = useRef<string | null>(null);
  useEffect(() => { /* load demo from route param */ }, [demoParam, validateAndSetFile]);

  // --- Derived ---
  const recordedPreviewUrl = audioMode === "record" && file
    ? URL.createObjectURL(file) : null;
  // (with cleanup via useEffect or useMemo pattern)

  const reset = useCallback(() => { /* ... */ }, []);

  return (
    <GridArtSurface sweepNonce={sweepNonce}>
      {/* ~370 lines of JSX — unchanged */}
    </GridArtSurface>
  );
}
```

7 `useState`, 1 `useRef`, 2 `useEffect`, 2 mutations, 1 extracted hook. Down from 18/10/5.

---

## What TanStack Query handles

| Current pattern                                               | Query replacement                                              |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| `transcribing` useState + try/catch/finally                   | `useMutation` — `isPending`, `error`                           |
| `submitting` + `startedAt` + `elapsedLabel` + useEffect timer | `useMutation` — `isPending`, `data` + derived elapsed          |
| `created` useState                                            | `cloneVoice.data`                                              |
| `error` for submission path                                   | `cloneVoice.error`                                             |
| `void load()` after clone (doesn't exist yet but should)      | `mutationKey: voiceQueries.all()` auto-invalidates voice lists |

## What TanStack Query does not handle

| Current pattern                            | Right tool                             |
| ------------------------------------------ | -------------------------------------- |
| Recording state machine (9 refs, 4 states) | `useAudioRecorder` custom hook         |
| File validation                            | Stays as `validateAndSetFile` callback |
| Form state (name, transcript, language)    | Plain `useState`                       |
| Demo/example loading                       | Imperative one-shot helper             |
| Audio mode toggle                          | Plain `useState`                       |
| Sweep animation nonce                      | Plain `useState`                       |
