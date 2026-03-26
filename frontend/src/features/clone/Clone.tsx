import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DropZone,
  FileTrigger,
  Form,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Text,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../components/atoms/Button";
import { AppLink } from "../../components/atoms/Link";
import { Message } from "../../components/atoms/Message";
import { ProgressBar } from "../../components/atoms/ProgressBar";
import {
  AutocompleteSelect,
  type AutocompleteSelectItem,
} from "../../components/molecules/AutocompleteSelect";
import { GridArtSurface } from "../../components/molecules/GridArt";
import { InfoTip } from "../../components/molecules/InfoTip";
import { WaveformPlayer } from "../../components/organisms/WaveformPlayer";
import { getUtterDemo } from "../../content/utterDemo";
import { CLONE_TIPS } from "../../data/tips";
import { apiForm, apiJson } from "../../lib/api";
import {
  concatFloat32Chunks,
  createWavHeaderPcm16Mono,
  float32ToPcm16leBytes,
  getAudioDurationSeconds,
  getTargetRecordingSampleRate,
  resampleFloat32Linear,
  rmsLevel,
} from "../../lib/audio";
import { cn } from "../../lib/cn";
import { fetchTextUtf8 } from "../../lib/fetchTextUtf8";
import { input } from "../../lib/recipes/input";
import { toggleButton } from "../../lib/recipes/toggle-button";
import { formatElapsed } from "../../lib/time";
import type { CloneResponse } from "../../lib/types";
import { useLanguages } from "../shared/hooks";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REFERENCE_SECONDS = 60;
const RECOMMENDED_REFERENCE_SECONDS = "10-20";
const ALLOWED_EXTS = new Set([".wav", ".mp3", ".m4a"]);

function extOf(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function contentTypeForFile(file: File): string {
  const byType = file.type?.trim();
  if (byType) return byType;

  const ext = extOf(file.name);
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".m4a") return "audio/mp4";
  return "application/octet-stream";
}

export function ClonePage() {
  const [params] = useSearchParams();
  const { languages, defaultLanguage, transcription } = useLanguages();
  const languageItems: AutocompleteSelectItem[] = useMemo(
    () => languages.map((l) => ({ id: l, label: l })),
    [languages],
  );

  const loadedDemoRef = useRef<string | null>(null);
  const recordingActiveRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [audioMode, setAudioMode] = useState<"upload" | "record">("upload");

  const transcriptionEnabled = transcription?.enabled ?? false;
  const [transcribing, setTranscribing] = useState(false);

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
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);

  const [submitting, setSubmitting] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedLabel, setElapsedLabel] = useState("0:00");
  const [sweepNonce, setSweepNonce] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CloneResponse | null>(null);

  useEffect(() => setLanguage(defaultLanguage), [defaultLanguage]);

  useEffect(() => {
    if (transcriptionEnabled) return;
    if (audioMode === "record") setAudioMode("upload");
  }, [audioMode, transcriptionEnabled]);

  useEffect(() => {
    if (!submitting || !startedAt) return;
    const t = window.setInterval(() => setElapsedLabel(formatElapsed(startedAt)), 1000);
    return () => window.clearInterval(t);
  }, [startedAt, submitting]);

  const transcriptRequired = true;

  const fileInfo = useMemo(() => {
    if (!file) return null;
    return `${file.name} - ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  }, [file]);

  const recordTimeLabel = useMemo(() => {
    const mins = Math.floor(recordSeconds / 60);
    const secs = recordSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [recordSeconds]);

  useEffect(() => {
    if (audioMode !== "record" || !file) {
      setRecordedPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setRecordedPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioMode, file]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }

      const processor = processorRef.current;
      processorRef.current = null;
      if (processor) {
        try {
          processor.disconnect();
        } catch {}
        processor.onaudioprocess = null;
      }

      const audioCtx = audioCtxRef.current;
      audioCtxRef.current = null;
      if (audioCtx) {
        void audioCtx.close().catch(() => {});
      }

      const stream = streamRef.current;
      streamRef.current = null;
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
    };
  }, []);

  const validateAndSetFile = useCallback(async (next: File | null) => {
    setFileError(null);
    setFile(null);
    if (!next) return false;

    const ext = extOf(next.name);
    if (!ALLOWED_EXTS.has(ext)) {
      setFileError("File must be WAV, MP3, or M4A.");
      return false;
    }
    if (next.size > MAX_FILE_BYTES) {
      setFileError("Reference audio must be 10MB or smaller.");
      return false;
    }

    const duration = await getAudioDurationSeconds(next).catch(() => null);
    if (duration !== null && duration > MAX_REFERENCE_SECONDS + 0.25) {
      setFileError("Reference audio must be 60 seconds or shorter.");
      return false;
    }

    setFile(next);
    return true;
  }, []);

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

    if (!transcriptionEnabled) {
      const msg = "Transcription is not enabled on this server.";
      if (errorTarget === "record") setRecordingError(msg);
      else setError(msg);
      return;
    }
    if (!nextFile) {
      const msg = "Please select an audio file to transcribe.";
      if (errorTarget === "record") setRecordingError(msg);
      else setError(msg);
      return;
    }

    setTranscribing(true);
    try {
      const form = new FormData();
      form.set("audio", nextFile);
      form.set("language", language);
      const res = await apiForm<{
        text: string;
        model: string;
        language: string | null;
      }>("/api/transcriptions", form, { method: "POST" });
      setTranscript(res.text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to transcribe audio.";
      if (errorTarget === "record") setRecordingError(msg);
      else setError(msg);
    } finally {
      setTranscribing(false);
    }
  }

  function stopRecordingTimer() {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  async function cleanupRecording() {
    stopRecordingTimer();
    setMicLevel(0);

    const worklet = workletRef.current;
    workletRef.current = null;
    if (worklet) {
      try {
        worklet.disconnect();
      } catch {}
      try {
        worklet.port.onmessage = null;
      } catch {}
    }

    const processor = processorRef.current;
    processorRef.current = null;
    if (processor) {
      try {
        processor.disconnect();
      } catch {}
      processor.onaudioprocess = null;
    }

    const audioCtx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (audioCtx) {
      try {
        await audioCtx.close();
      } catch {}
    }

    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
  }

  async function startRecording() {
    setError(null);
    setRecordingError(null);
    setFileError(null);

    if (recordingActiveRef.current) return;

    setRecordSeconds(0);
    pcmChunksRef.current = [];
    pcmSamplesRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      captureSampleRateRef.current = audioCtx.sampleRate;
      try {
        await audioCtx.resume();
      } catch {}

      const source = audioCtx.createMediaStreamSource(stream);
      const zeroGain = audioCtx.createGain();
      zeroGain.gain.value = 0;

      const processChunk = (input: Float32Array) => {
        if (!input || input.length === 0) return;

        setMicLevel(rmsLevel(input));

        const copy = new Float32Array(input.length);
        copy.set(input);
        pcmChunksRef.current.push(copy);
        pcmSamplesRef.current += copy.length;
      };

      let captureNode: AudioNode | null = null;

      if (audioCtx.audioWorklet && typeof AudioWorkletNode !== "undefined") {
        try {
          await audioCtx.audioWorklet.addModule(
            new URL("../lib/pcmCapture.worklet.js", import.meta.url),
          );

          const worklet = new AudioWorkletNode(audioCtx, "utter-pcm-capture", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: 1,
          });
          workletRef.current = worklet;
          worklet.port.onmessage = (ev) => {
            const data = ev.data as unknown;
            if (!data || typeof data !== "object") return;
            if ((data as { type?: unknown }).type !== "chunk") return;
            const buffer = (data as { buffer?: unknown }).buffer;
            if (!(buffer instanceof ArrayBuffer)) return;
            processChunk(new Float32Array(buffer));
          };
          captureNode = worklet;
        } catch {
          captureNode = null;
        }
      }

      if (!captureNode) {
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (e) => {
          processChunk(e.inputBuffer.getChannelData(0));
        };
        captureNode = processor;
      }

      source.connect(captureNode);
      captureNode.connect(zeroGain);
      zeroGain.connect(audioCtx.destination);

      recordingActiveRef.current = true;
      setRecording(true);
      stopRecordingTimer();
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((seconds) => {
          const next = Math.min(MAX_REFERENCE_SECONDS, seconds + 1);
          if (next >= MAX_REFERENCE_SECONDS && recordingActiveRef.current) {
            window.setTimeout(() => {
              void stopRecording();
            }, 0);
          }
          return next;
        });
      }, 1000);
    } catch (e) {
      await cleanupRecording();
      setRecordingError(e instanceof Error ? e.message : "Failed to access microphone.");
      recordingActiveRef.current = false;
      setRecording(false);
    }
  }

  async function stopRecording() {
    if (!recordingActiveRef.current) return;

    recordingActiveRef.current = false;
    setRecording(false);
    stopRecordingTimer();
    await cleanupRecording();

    const pcmSampleLength = pcmSamplesRef.current;
    if (pcmSampleLength <= 0) {
      setRecordingError("No audio captured.");
      return;
    }

    const mergedPcm = concatFloat32Chunks(pcmChunksRef.current, pcmSampleLength);
    const targetSampleRate = getTargetRecordingSampleRate(captureSampleRateRef.current);
    const normalizedPcm = resampleFloat32Linear(
      mergedPcm,
      captureSampleRateRef.current,
      targetSampleRate,
    );
    const pcmBytes = float32ToPcm16leBytes(normalizedPcm);
    const header = createWavHeaderPcm16Mono(pcmBytes.byteLength, targetSampleRate);
    const blob = new Blob([header, pcmBytes], {
      type: "audio/wav",
    });
    const nextFile = new File([blob], `recording-${Date.now()}.wav`, {
      type: "audio/wav",
    });

    if (nextFile.size > MAX_FILE_BYTES) {
      setRecordingError("Recorded audio exceeded the 10MB limit. Try a shorter clip.");
      return;
    }

    const accepted = await validateAndSetFile(nextFile);
    if (!accepted) return;
    await onTranscribeAudio(nextFile, { errorTarget: "record" });
  }

  async function onTryExample() {
    setError(null);
    setFileError(null);
    try {
      const [textRes, audioRes] = await Promise.all([
        fetch("/static/examples/audio_text.txt"),
        fetch("/static/examples/audio.wav"),
      ]);
      if (!textRes.ok || !audioRes.ok) {
        throw new Error("Failed to load example.");
      }
      const exampleText = await textRes.text();
      const audioBlob = await audioRes.blob();
      const exampleFile = new File([audioBlob], "audio.wav", {
        type: "audio/wav",
      });
      setName("ASMR");
      setTranscript(exampleText.trim());
      await validateAndSetFile(exampleFile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load example.");
    }
  }

  useEffect(() => {
    const demoId = params.get("demo");
    if (!demoId) return;
    if (loadedDemoRef.current === demoId) return;
    loadedDemoRef.current = demoId;

    const demo = getUtterDemo(demoId);
    const audioUrl = demo?.audioUrl;
    if (!demo || !audioUrl) return;

    setError(null);
    setFileError(null);

    void (async () => {
      try {
        const [audioRes, transcriptText] = await Promise.all([
          fetch(audioUrl),
          demo.transcriptUrl ? fetchTextUtf8(demo.transcriptUrl) : Promise.resolve(""),
        ]);
        if (!audioRes.ok) throw new Error("Failed to load demo audio.");
        const audioBlob = await audioRes.blob();
        const ext = extOf(new URL(audioUrl, window.location.href).pathname);
        const fileName = `${demo.id}${ext || ".mp3"}`;
        const nextFile = new File([audioBlob], fileName, {
          type: audioBlob.type || "audio/mpeg",
        });

        setName(demo.suggestedCloneName ?? `${demo.title} (demo)`);
        setTranscript(transcriptText.trim());
        await validateAndSetFile(nextFile);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load demo.");
      }
    })();
  }, [params, validateAndSetFile]);

  async function onSubmit() {
    setError(null);
    setCreated(null);
    setFileError(null);

    if (!name.trim()) {
      setError("Please enter a voice name.");
      return;
    }
    if (!file) {
      setError("Please select an audio file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Reference audio must be 10MB or smaller.");
      return;
    }
    if (transcriptRequired && transcript.trim().length < 10) {
      setError("Please provide a transcript (at least 10 characters).");
      return;
    }

    setSubmitting(true);
    setSweepNonce((value) => value + 1);
    const t0 = Date.now();
    setStartedAt(t0);
    setElapsedLabel("0:00");

    try {
      const { voice_id, upload_url } = await apiJson<{
        voice_id: string;
        upload_url: string;
        object_key: string;
      }>("/api/clone/upload-url", {
        method: "POST",
        json: {
          name: name.trim(),
          language,
          transcript: transcript.trim(),
        },
      });

      const uploadRes = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentTypeForFile(file) },
      });
      if (!uploadRes.ok) {
        throw new Error("Failed to upload audio file.");
      }

      const res = await apiJson<CloneResponse>("/api/clone/finalize", {
        method: "POST",
        json: {
          voice_id,
          name: name.trim(),
          language,
          transcript: transcript.trim(),
        },
      });
      setCreated(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clone voice.");
    } finally {
      setSubmitting(false);
      setStartedAt(null);
    }
  }

  const reset = useCallback(() => {
    setCreated(null);
    setError(null);
    setFileError(null);
    setName("");
    setTranscript("");
    setFile(null);
  }, []);

  return (
    <GridArtSurface sweepNonce={sweepNonce} contentClassName="space-y-8">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
          Clone
        </h2>
        <InfoTip label="Clone tips" tips={CLONE_TIPS} halftoneImage="grass" />
      </div>

      {error ? <Message variant="error">{error}</Message> : null}
      {recordingError ? <Message variant="error">{recordingError}</Message> : null}

      <div className="flex items-center justify-center">
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([audioMode])}
          onSelectionChange={(keys) => {
            const next = [...keys][0] as "upload" | "record";
            if (next) setAudioMode(next);
          }}
          isDisabled={recording}
          className="inline-flex overflow-hidden border border-border bg-background shadow-elevated"
        >
          <ToggleButton id="upload" className={toggleButton({ size: "md" })}>
            Upload
          </ToggleButton>
          {transcriptionEnabled ? (
            <ToggleButton id="record" className={toggleButton({ size: "md" })}>
              Record
            </ToggleButton>
          ) : null}
        </ToggleButtonGroup>
      </div>

      {audioMode === "record" && transcriptionEnabled ? (
        <div className="space-y-4 border border-border bg-background p-6 shadow-elevated">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold uppercase tracking-wide">
              Record Reference Audio
            </div>
            <div className="text-xs text-faint">{recordTimeLabel}</div>
          </div>

          <div className="text-xs text-faint">
            Aim for {RECOMMENDED_REFERENCE_SECONDS} seconds. Recording stops automatically at{" "}
            {MAX_REFERENCE_SECONDS} seconds.
          </div>

          <div className="h-2 w-full overflow-hidden border border-border bg-muted">
            <div
              className="h-full bg-foreground transition-[width]"
              style={{ width: `${Math.min(100, micLevel * 180)}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onPress={() => void startRecording()}
              isDisabled={recording || submitting || transcribing}
            >
              {recording ? "Recording..." : "Start"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onPress={() => void stopRecording()}
              isDisabled={!recording}
            >
              Stop
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onPress={() => {
                void cleanupRecording();
                recordingActiveRef.current = false;
                setRecording(false);
                setRecordingError(null);
                setTranscript("");
                setRecordSeconds(0);
                setFile(null);
              }}
              isDisabled={recording || transcribing}
            >
              Clear
            </Button>
          </div>

          {transcribing ? (
            <div className="text-xs font-medium uppercase tracking-wide text-faint">
              Transcribing recorded audio...
            </div>
          ) : null}

          {recordedPreviewUrl ? (
            <div className="border border-border bg-background p-3">
              <WaveformPlayer audioUrl={recordedPreviewUrl} audioBlob={file ?? undefined} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative">
          <DropZone
            className={cn(
              "w-full border border-dashed border-border bg-background p-6 text-center shadow-elevated",
              "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "drop-target:border-ring drop-target:bg-subtle",
            )}
            onDrop={(e) => {
              const fileItem = e.items.find((item) => item.kind === "file");
              if (fileItem && fileItem.kind === "file") {
                void fileItem.getFile().then((f) => validateAndSetFile(f));
              }
            }}
          >
            <FileTrigger
              acceptedFileTypes={[".wav", ".mp3", ".m4a"]}
              onSelect={(files) => {
                void validateAndSetFile(files?.[0] ?? null);
              }}
            >
              <Button variant="secondary" type="button" aria-label="Select audio file">
                Browse Files
              </Button>
            </FileTrigger>
            <div className="mt-3 text-sm text-muted-foreground">
              Drag &amp; drop audio here, or click to browse.
            </div>
            <div className="mt-2 text-xs text-faint">WAV / MP3 / M4A - max 10MB - 60s max</div>
            {fileInfo ? <div className="mt-3 text-xs text-foreground">{fileInfo}</div> : null}
            {fileError ? <div className="mt-3 text-xs text-status-error">{fileError}</div> : null}
          </DropZone>

          {transcriptionEnabled && file ? (
            <Button
              className="absolute right-4 top-4 z-10"
              variant="secondary"
              size="sm"
              type="button"
              isPending={transcribing}
              isDisabled={submitting}
              onPress={() => void onTranscribeAudio()}
            >
              {transcribing ? "Transcribing..." : "Transcribe"}
            </Button>
          ) : null}
        </div>
      )}

      <Form
        className="space-y-6"
        validationBehavior="aria"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <TextField value={name} onChange={setName}>
          <Label className="mb-2 block label-style">Voice Name</Label>
          <Input
            name="name"
            autoComplete="off"
            placeholder="e.g. Duncan (calm, close-mic)..."
            className={input()}
          />
        </TextField>

        <TextField value={transcript} onChange={setTranscript}>
          <Label className="mb-2 block label-style">Transcript</Label>
          <TextArea
            name="transcript"
            placeholder="Paste the transcript of the reference audio..."
            className={input({ multiline: true })}
          />
          <Text
            slot="description"
            className="mt-2 flex items-center justify-between text-xs text-faint"
          >
            {transcript.length} chars
          </Text>
        </TextField>

        <AutocompleteSelect
          label="Language"
          items={languageItems}
          selectedKey={language}
          onSelectionChange={setLanguage}
          searchLabel="Search languages"
          searchPlaceholder="Search..."
        >
          {(item) => item.label}
        </AutocompleteSelect>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="secondary" type="button" block onPress={() => void onTryExample()}>
            Try Example Voice
          </Button>
          <Button type="submit" block isDisabled={submitting}>
            {submitting ? `Cloning... ${elapsedLabel}` : "Clone Voice"}
          </Button>
        </div>
      </Form>

      {submitting ? (
        <div className="border border-border bg-subtle p-4 shadow-elevated">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium uppercase tracking-wide">Progress</div>
              <div className="mt-1 text-sm text-muted-foreground">Cloning...</div>
            </div>
            <div className="text-xs text-faint">{elapsedLabel}</div>
          </div>
          <ProgressBar label="Cloning voice" isIndeterminate className="mt-3" />
        </div>
      ) : null}
      <ModalOverlay
        isOpen={!!created}
        onOpenChange={(isOpen) => {
          if (!isOpen) reset();
        }}
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overscroll-contain backdrop-blur-sm data-[entering]:animate-in data-[entering]:fade-in data-[exiting]:animate-out data-[exiting]:fade-out"
      >
        <Modal className="w-full max-w-md">
          <Dialog
            className="border border-border bg-background p-6 shadow-elevated outline-none"
            aria-labelledby="clone-success-title"
          >
            <h3 id="clone-success-title" className="text-sm font-semibold uppercase tracking-wide">
              Clone Success
            </h3>
            {created ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Voice <span className="text-foreground">{created.name}</span> is ready.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <AppLink
                    href={`/generate?voice=${created.id}`}
                    className="inline-flex items-center justify-center border border-foreground bg-foreground px-6 py-3 text-sm font-medium uppercase tracking-wide text-background hover:bg-foreground/80 hover:border-foreground/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Go to Generate <ArrowRight className="icon-sm" aria-hidden="true" />
                  </AppLink>
                  <Button variant="secondary" type="button" onPress={reset}>
                    Clone Another Voice
                  </Button>
                </div>
              </>
            ) : null}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </GridArtSurface>
  );
}
