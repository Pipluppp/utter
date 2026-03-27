import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DropZone,
  FileTrigger,
  Form,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components";
import { Button } from "../../components/atoms/Button";
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
import { apiForm } from "../../lib/api";
import { getAudioDurationSeconds } from "../../lib/audio/audio";
import { cn } from "../../lib/cn";
import { fetchTextUtf8 } from "../../lib/fetchTextUtf8";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  TRANSCRIPTION_ENABLED,
} from "../../lib/provider-config";
import { input } from "../../lib/recipes/input";
import { toggleButton } from "../../lib/recipes/toggle-button";
import { CloneSuccessModal } from "./components/CloneSuccessModal";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useCloneSubmit } from "./hooks/useCloneSubmit";

const cloneRoute = getRouteApi("/_app/clone");

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REFERENCE_SECONDS = 60;
const RECOMMENDED_REFERENCE_SECONDS = "10-20";
const ALLOWED_EXTS = new Set([".wav", ".mp3", ".m4a"]);

function extOf(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export function ClonePage() {
  const { demo: demoParam } = cloneRoute.useSearch();
  const languageItems: AutocompleteSelectItem[] = useMemo(
    () => SUPPORTED_LANGUAGES.map((l) => ({ id: l, label: l })),
    [],
  );

  const recorder = useAudioRecorder({ maxSeconds: MAX_REFERENCE_SECONDS });

  const loadedDemoRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [audioMode, setAudioMode] = useState<"upload" | "record">("upload");

  const [transcribing, setTranscribing] = useState(false);

  const [name, setName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);

  const cloneSubmit = useCloneSubmit();

  const [error, setError] = useState<string | null>(null);

  const fileInfo = file ? `${file.name} - ${(file.size / (1024 * 1024)).toFixed(1)} MB` : null;

  const recordTimeMins = Math.floor(recorder.recordSeconds / 60);
  const recordTimeSecs = recorder.recordSeconds % 60;
  const recordTimeLabel = `${recordTimeMins}:${recordTimeSecs.toString().padStart(2, "0")}`;

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

  async function onTranscribeAudio(nextFile: File | null = file) {
    setError(null);

    if (!TRANSCRIPTION_ENABLED) {
      setError("Transcription is not enabled on this server.");
      return;
    }
    if (!nextFile) {
      setError("Please select an audio file to transcribe.");
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
      setError(msg);
    } finally {
      setTranscribing(false);
    }
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
    const demoId = demoParam;
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
  }, [demoParam, validateAndSetFile]);

  async function onSubmit() {
    setError(null);
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
    if (transcript.trim().length < 10) {
      setError("Please provide a transcript (at least 10 characters).");
      return;
    }

    await cloneSubmit.submit({ name, file, language, transcript });
  }

  const reset = useCallback(() => {
    cloneSubmit.reset();
    setError(null);
    setFileError(null);
    setName("");
    setTranscript("");
    setFile(null);
  }, [cloneSubmit]);

  return (
    <GridArtSurface sweepNonce={cloneSubmit.sweepNonce} contentClassName="space-y-8">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
          Clone
        </h2>
        <InfoTip label="Clone tips" tips={CLONE_TIPS} halftoneImage="grass" />
      </div>

      {error ? <Message variant="error">{error}</Message> : null}
      {cloneSubmit.error ? <Message variant="error">{cloneSubmit.error}</Message> : null}
      {recorder.error ? <Message variant="error">{recorder.error}</Message> : null}

      <div className="flex items-center justify-center">
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([audioMode])}
          onSelectionChange={(keys) => {
            const next = [...keys][0] as "upload" | "record";
            if (next && (next !== "record" || TRANSCRIPTION_ENABLED)) setAudioMode(next);
          }}
          isDisabled={recorder.recording}
          className="inline-flex overflow-hidden border border-border bg-background shadow-elevated"
        >
          <ToggleButton id="upload" className={toggleButton({ size: "md" })}>
            Upload
          </ToggleButton>
          {TRANSCRIPTION_ENABLED ? (
            <ToggleButton id="record" className={toggleButton({ size: "md" })}>
              Record
            </ToggleButton>
          ) : null}
        </ToggleButtonGroup>
      </div>

      {audioMode === "record" && TRANSCRIPTION_ENABLED ? (
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
              style={{ width: `${Math.min(100, recorder.micLevel * 180)}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onPress={() => void recorder.start()}
              isDisabled={recorder.recording || cloneSubmit.submitting || transcribing}
            >
              {recorder.recording ? "Recording..." : "Start"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onPress={() => {
                void (async () => {
                  const wavFile = await recorder.stop();
                  if (!wavFile) return;
                  const accepted = await validateAndSetFile(wavFile);
                  if (!accepted) return;
                  await onTranscribeAudio(wavFile);
                })();
              }}
              isDisabled={!recorder.recording}
            >
              Stop
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onPress={() => {
                recorder.clear();
                setTranscript("");
                setFile(null);
              }}
              isDisabled={recorder.recording || transcribing}
            >
              Clear
            </Button>
          </div>

          {transcribing ? (
            <div className="text-xs font-medium uppercase tracking-wide text-faint">
              Transcribing recorded audio...
            </div>
          ) : null}

          {audioMode === "record" && file ? (
            <div className="border border-border bg-background p-3">
              <WaveformPlayer audioBlob={file} />
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

          {TRANSCRIPTION_ENABLED && file ? (
            <Button
              className="absolute right-4 top-4 z-10"
              variant="secondary"
              size="sm"
              type="button"
              isPending={transcribing}
              isDisabled={cloneSubmit.submitting}
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
          <Button type="submit" block isDisabled={cloneSubmit.submitting}>
            {cloneSubmit.submitting ? `Cloning... ${cloneSubmit.elapsedLabel}` : "Clone Voice"}
          </Button>
        </div>
      </Form>

      {cloneSubmit.submitting ? (
        <div className="border border-border bg-subtle p-4 shadow-elevated">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium uppercase tracking-wide">Progress</div>
              <div className="mt-1 text-sm text-muted-foreground">Cloning...</div>
            </div>
            <div className="text-xs text-faint">{cloneSubmit.elapsedLabel}</div>
          </div>
          <ProgressBar label="Cloning voice" isIndeterminate className="mt-3" />
        </div>
      ) : null}
      <CloneSuccessModal created={cloneSubmit.created} onReset={reset} />
    </GridArtSurface>
  );
}
