import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { Message } from "../../components/atoms/Message";
import { GridArtSurface } from "../../components/molecules/GridArt";
import { InfoTip } from "../../components/molecules/InfoTip";
import { getUtterDemo } from "../../content/utterDemo";
import { CLONE_TIPS } from "../../data/tips";
import { apiForm } from "../../lib/api";
import { getAudioDurationSeconds } from "../../lib/audio/audio";
import { fetchTextUtf8 } from "../../lib/fetchTextUtf8";
import { DEFAULT_LANGUAGE, TRANSCRIPTION_ENABLED } from "../../lib/provider-config";
import { toggleButton } from "../../lib/recipes/toggle-button";
import { CloneForm } from "./components/CloneForm";
import { CloneSuccessModal } from "./components/CloneSuccessModal";
import { RecordPanel } from "./components/RecordPanel";
import { UploadPanel } from "./components/UploadPanel";
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
        <RecordPanel
          recorder={recorder}
          file={file}
          transcribing={transcribing}
          submitting={cloneSubmit.submitting}
          maxSeconds={MAX_REFERENCE_SECONDS}
          recommendedSeconds={RECOMMENDED_REFERENCE_SECONDS}
          onStop={() => {
            void (async () => {
              const wavFile = await recorder.stop();
              if (!wavFile) return;
              const accepted = await validateAndSetFile(wavFile);
              if (!accepted) return;
              await onTranscribeAudio(wavFile);
            })();
          }}
          onClear={() => {
            recorder.clear();
            setTranscript("");
            setFile(null);
          }}
        />
      ) : (
        <UploadPanel
          file={file}
          fileInfo={fileInfo}
          fileError={fileError}
          transcriptionEnabled={TRANSCRIPTION_ENABLED}
          transcribing={transcribing}
          submitting={cloneSubmit.submitting}
          onFileSelect={validateAndSetFile}
          onTranscribe={() => void onTranscribeAudio()}
        />
      )}

      <CloneForm
        name={name}
        onNameChange={setName}
        transcript={transcript}
        onTranscriptChange={setTranscript}
        language={language}
        onLanguageChange={setLanguage}
        submitting={cloneSubmit.submitting}
        elapsedLabel={cloneSubmit.elapsedLabel}
        onSubmit={() => void onSubmit()}
        onTryExample={() => void onTryExample()}
      />
      <CloneSuccessModal created={cloneSubmit.created} onReset={reset} />
    </GridArtSurface>
  );
}
