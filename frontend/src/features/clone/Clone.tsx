import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { Message } from "../../components/atoms/Message";
import { GridArtSurface } from "../../components/molecules/GridArt";
import { InfoTip } from "../../components/molecules/InfoTip";
import { CLONE_TIPS } from "../../data/tips";
import { DEFAULT_LANGUAGE, TRANSCRIPTION_ENABLED } from "../../lib/provider-config";
import { toggleButtonStyles } from "../../lib/styles/toggle-button";
import { CloneForm } from "./components/CloneForm";
import { CloneSuccessModal } from "./components/CloneSuccessModal";
import { RecordPanel } from "./components/RecordPanel";
import { UploadPanel } from "./components/UploadPanel";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useCloneFile } from "./hooks/useCloneFile";
import { useCloneSubmit } from "./hooks/useCloneSubmit";
import { useDemoLoader } from "./hooks/useDemoLoader";
import { useTranscribe } from "./hooks/useTranscribe";

const cloneRoute = getRouteApi("/_app/clone");

const MAX_REFERENCE_SECONDS = 60;
const RECOMMENDED_REFERENCE_SECONDS = "10-20";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function ClonePage() {
  const { demo: demoParam } = cloneRoute.useSearch();

  const recorder = useAudioRecorder({ maxSeconds: MAX_REFERENCE_SECONDS });
  const cloneFile = useCloneFile();
  const cloneSubmit = useCloneSubmit();
  const transcriber = useTranscribe();

  const [audioMode, setAudioMode] = useState<"upload" | "record">("upload");
  const [name, setName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [error, setError] = useState<string | null>(null);

  useDemoLoader(
    demoParam,
    async (fill) => {
      setName(fill.name);
      setTranscript(fill.transcript);
      await cloneFile.validateAndSet(fill.file);
    },
    (msg) => setError(msg),
  );

  async function onTranscribeAudio(nextFile: File | null = cloneFile.file) {
    setError(null);
    if (!nextFile) {
      setError("Please select an audio file to transcribe.");
      return;
    }
    try {
      const text = await transcriber.transcribe(nextFile, language);
      if (text) setTranscript(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to transcribe audio.");
    }
  }

  async function onTryExample() {
    setError(null);
    cloneFile.clear();
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
      const exampleFile = new File([audioBlob], "audio.wav", { type: "audio/wav" });
      setName("ASMR");
      setTranscript(exampleText.trim());
      await cloneFile.validateAndSet(exampleFile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load example.");
    }
  }

  async function onSubmit() {
    setError(null);
    cloneFile.clear();

    if (!name.trim()) {
      setError("Please enter a voice name.");
      return;
    }
    if (!cloneFile.file) {
      setError("Please select an audio file.");
      return;
    }
    if (cloneFile.file.size > MAX_FILE_BYTES) {
      setError("Reference audio must be 10MB or smaller.");
      return;
    }
    if (transcript.trim().length < 10) {
      setError("Please provide a transcript (at least 10 characters).");
      return;
    }

    await cloneSubmit.submit({ name, file: cloneFile.file, language, transcript });
  }

  const reset = useCallback(() => {
    cloneSubmit.reset();
    cloneFile.clear();
    setError(null);
    setName("");
    setTranscript("");
  }, [cloneSubmit, cloneFile]);

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
          <ToggleButton id="upload" className={toggleButtonStyles({ size: "md" })}>
            Upload
          </ToggleButton>
          {TRANSCRIPTION_ENABLED ? (
            <ToggleButton id="record" className={toggleButtonStyles({ size: "md" })}>
              Record
            </ToggleButton>
          ) : null}
        </ToggleButtonGroup>
      </div>

      {audioMode === "record" && TRANSCRIPTION_ENABLED ? (
        <RecordPanel
          recorder={recorder}
          file={cloneFile.file}
          transcribing={transcriber.transcribing}
          submitting={cloneSubmit.submitting}
          maxSeconds={MAX_REFERENCE_SECONDS}
          recommendedSeconds={RECOMMENDED_REFERENCE_SECONDS}
          onStop={() => {
            void (async () => {
              const wavFile = await recorder.stop();
              if (!wavFile) return;
              const accepted = await cloneFile.validateAndSet(wavFile);
              if (!accepted) return;
              await onTranscribeAudio(wavFile);
            })();
          }}
          onClear={() => {
            recorder.clear();
            setTranscript("");
            cloneFile.clear();
          }}
        />
      ) : (
        <UploadPanel
          file={cloneFile.file}
          fileInfo={cloneFile.fileInfo}
          fileError={cloneFile.fileError}
          transcriptionEnabled={TRANSCRIPTION_ENABLED}
          transcribing={transcriber.transcribing}
          submitting={cloneSubmit.submitting}
          onFileSelect={cloneFile.validateAndSet}
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
