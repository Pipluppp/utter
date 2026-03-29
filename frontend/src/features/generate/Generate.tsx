import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListBox, ListBoxItem } from "react-aria-components";
import { taskLabel } from "../../app/taskKeys";
import { useTasks } from "../../app/TaskProvider";
import { Message } from "../../components/atoms/Message";
import type { AutocompleteSelectItem } from "../../components/molecules/AutocompleteSelect";
import { GridArtSurface } from "../../components/molecules/GridArt";
import { InfoTip } from "../../components/molecules/InfoTip";
import { getUtterDemo } from "../../content/utterDemo";
import { GENERATE_TIPS } from "../../data/tips";
import { useElapsedTick } from "../../hooks/useElapsedTick";
import { cn } from "../../lib/cn";
import { fetchTextUtf8 } from "../../lib/fetchTextUtf8";
import { resolveProtectedMediaUrl, triggerDownload } from "../../lib/protectedMedia";
import {
  DEFAULT_LANGUAGE,
  MAX_TEXT_CHARS,
  SUPPORTED_LANGUAGES,
  TTS_PROVIDER,
} from "../../lib/provider-config";
import { formatElapsed } from "../../lib/time";
import type { StoredTask } from "../../lib/types";
import { useVoiceOptions } from "../shared/hooks/useVoiceOptions";
import { GenerateForm } from "./components/GenerateForm";
import { GenerateResult } from "./components/GenerateResult";
import type { GenerateFormState } from "./hooks/useGenerateSubmit";
import { useGenerateSubmit } from "./hooks/useGenerateSubmit";

const generateRoute = getRouteApi("/_app/generate");

export function GeneratePage() {
  const {
    voice: voiceParam,
    text: textParam,
    language: languageParam,
    demo: demoParam,
  } = generateRoute.useSearch();

  const languageItems: AutocompleteSelectItem[] = useMemo(
    () => SUPPORTED_LANGUAGES.map((l) => ({ id: l, label: l })),
    [],
  );

  const { startTask: _startTask, getLatestTask, getTasksByType, getStatusText } = useTasks();
  const { voices: voiceItems, loading: loadingVoices, error: voicesError } = useVoiceOptions();
  const generateSubmit = useGenerateSubmit();

  const generateTasks = getTasksByType("generate");
  const latestTask = getLatestTask("generate");

  const hasActiveGenerate = generateTasks.some(
    (t) => t.status === "pending" || t.status === "processing",
  );
  const nowMs = useElapsedTick(hasActiveGenerate);

  const [voiceId, setVoiceId] = useState("");
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [text, setText] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const restoredRef = useRef(false);
  const handledTaskKeyRef = useRef<string | null>(null);
  const loadedDemoRef = useRef<string | null>(null);

  // Auto-select first task when list changes
  useEffect(() => {
    if (selectedTaskId && generateTasks.some((task) => task.taskId === selectedTaskId)) {
      return;
    }
    setSelectedTaskId(generateTasks[0]?.taskId ?? null);
  }, [generateTasks, selectedTaskId]);

  // Restore form state from latest task + query params
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const storedTask = latestTask as StoredTask | null;
    if (storedTask?.formState && typeof storedTask.formState === "object") {
      const fs = storedTask.formState as Partial<GenerateFormState>;
      if (typeof fs.voiceId === "string") setVoiceId(fs.voiceId);
      if (typeof fs.language === "string") setLanguage(fs.language);
      if (typeof fs.text === "string") setText(fs.text);
    }

    const voice = voiceParam;
    const qsText = textParam;
    const qsLang = languageParam;
    const demoId = demoParam;
    if (voice) setVoiceId(voice);
    if (typeof qsText === "string" && qsText.length > 0) setText(qsText);
    if (typeof qsLang === "string" && qsLang.length > 0) setLanguage(qsLang);

    if (demoId && loadedDemoRef.current !== demoId) {
      loadedDemoRef.current = demoId;
      const demo = getUtterDemo(demoId);
      if (demo?.transcriptUrl) {
        void (async () => {
          try {
            const demoText = await fetchTextUtf8(demo.transcriptUrl as string);
            setText(demoText.trim());
          } catch {
            return;
          }
        })();
      }
    }
  }, [latestTask, voiceParam, textParam, languageParam, demoParam]);

  const selectedTask = useMemo(
    () => generateTasks.find((task) => task.taskId === selectedTaskId) ?? null,
    [generateTasks, selectedTaskId],
  );

  // Handle selected task status changes → resolve audio URL
  useEffect(() => {
    if (!selectedTask) {
      handledTaskKeyRef.current = null;
      setAudioUrl(null);
      setDownloadUrl(null);
      return;
    }

    if (selectedTask.status === "pending" || selectedTask.status === "processing") {
      handledTaskKeyRef.current = null;
      setAudioUrl(null);
      setDownloadUrl(null);
      return;
    }

    const terminalKey = `${selectedTask.taskId}:${selectedTask.status}`;
    if (handledTaskKeyRef.current === terminalKey) return;
    handledTaskKeyRef.current = terminalKey;

    if (selectedTask.status === "completed") {
      const result = selectedTask.result as { audio_url?: string } | undefined;
      const generatedAudioUrl = result?.audio_url;
      if (!generatedAudioUrl) {
        setError("Failed to load generation audio.");
        return;
      }

      void (async () => {
        try {
          const resolvedUrl = await resolveProtectedMediaUrl(generatedAudioUrl);
          setAudioUrl(resolvedUrl);
          setDownloadUrl(resolvedUrl);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to load generation audio.");
        }
      })();
      return;
    }

    if (selectedTask.status === "failed") {
      setAudioUrl(null);
      setDownloadUrl(null);
      setError(selectedTask.error ?? "Generation failed. Please try again.");
      return;
    }

    setAudioUrl(null);
    setDownloadUrl(null);
    setError("Generation was cancelled.");
  }, [selectedTask]);

  async function onDownload() {
    if (!downloadUrl) return;
    try {
      const resolvedUrl = await resolveProtectedMediaUrl(downloadUrl);
      triggerDownload(resolvedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download audio.");
    }
  }

  const voicePlaceholder = loadingVoices
    ? "Loading voices..."
    : voiceItems.length === 0
      ? "No voices available"
      : "Select a voice";
  const selectedVoice = voiceItems.find((v) => v.id === voiceId) ?? null;
  const selectedVoiceProvider = selectedVoice?.tts_provider ?? "qwen";
  const selectedVoiceCompatible =
    voiceId.length === 0 ? true : Boolean(selectedVoice) && selectedVoiceProvider === TTS_PROVIDER;
  const activeGenerateCount = generateTasks.filter(
    (task) => task.status === "pending" || task.status === "processing",
  ).length;
  const statusText = selectedTask
    ? getStatusText(
        selectedTask.status,
        selectedTask.modalStatus ?? null,
        selectedTask.providerStatus ?? null,
      )
    : null;

  const canSubmit =
    voiceItems.length > 0 &&
    !loadingVoices &&
    Boolean(voiceId) &&
    selectedVoiceCompatible &&
    Boolean(text.trim()) &&
    text.length <= MAX_TEXT_CHARS &&
    !generateSubmit.submitting;

  const formState: GenerateFormState = useMemo(
    () => ({ voiceId, language, text }),
    [language, text, voiceId],
  );

  async function onGenerate() {
    setError(null);
    setAudioUrl(null);
    setDownloadUrl(null);

    if (!canSubmit) {
      if (!selectedVoiceCompatible) {
        setError("Selected voice is not compatible with the current runtime.");
        return;
      }
      setError("Please select a voice and enter some text.");
      return;
    }

    const taskId = await generateSubmit.submit({ voiceId, text, language, formState });
    if (taskId) setSelectedTaskId(taskId);
  }

  const displayError = error || voicesError || generateSubmit.error;

  return (
    <GridArtSurface sweepNonce={generateSubmit.sweepNonce} contentClassName="space-y-8">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
          Generate
        </h2>
        <InfoTip label="Generate tips" tips={GENERATE_TIPS} halftoneImage="lilac" />
      </div>

      {displayError ? <Message variant="error">{displayError}</Message> : null}

      <GenerateForm
        voiceItems={voiceItems}
        voiceId={voiceId}
        onVoiceIdChange={setVoiceId}
        languageItems={languageItems}
        language={language}
        onLanguageChange={setLanguage}
        text={text}
        onTextChange={setText}
        maxTextChars={MAX_TEXT_CHARS}
        loadingVoices={loadingVoices}
        canSubmit={canSubmit}
        isSubmitting={generateSubmit.submitting}
        onSubmit={() => void onGenerate()}
        voicePlaceholder={voicePlaceholder}
      />

      {selectedTask ? (
        <div className="space-y-4 border border-border bg-subtle p-4 shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium uppercase tracking-wide">Selected Job</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {statusText ?? "Processing..."}
              </div>
            </div>
            <div className="text-xs text-faint">
              {selectedTask.status === "pending" || selectedTask.status === "processing"
                ? formatElapsed(selectedTask.startedAt, nowMs)
                : taskLabel(selectedTask.type)}
            </div>
          </div>
          {selectedTask.subtitle ? (
            <div className="text-xs text-faint">{selectedTask.subtitle}</div>
          ) : null}
          {activeGenerateCount > 1 ? (
            <div className="text-xs text-faint">
              {activeGenerateCount} generate jobs currently running.
            </div>
          ) : null}
        </div>
      ) : null}

      {generateTasks.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium uppercase tracking-wide">Tracked Jobs</div>
          <ListBox
            aria-label="Tracked Jobs"
            selectionMode="single"
            selectedKeys={selectedTaskId ? new Set([selectedTaskId]) : new Set<string>()}
            onSelectionChange={(keys) => {
              const selected = [...keys][0];
              if (typeof selected === "string") setSelectedTaskId(selected);
            }}
            className="space-y-2"
          >
            {generateTasks.map((task) => (
              <ListBoxItem
                key={task.taskId}
                id={task.taskId}
                textValue={task.description}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border border-border bg-background px-3 py-3 text-left press-scale-sm-y data-[hovered]:bg-surface-hover data-[pressed]:bg-surface-hover",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "data-[selected]:bg-surface-selected",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium uppercase tracking-wide">
                    {task.description}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {getStatusText(
                      task.status,
                      task.modalStatus ?? null,
                      task.providerStatus ?? null,
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-faint">
                  {task.status === "pending" || task.status === "processing"
                    ? formatElapsed(task.startedAt, nowMs)
                    : task.status === "completed"
                      ? "Ready"
                      : task.status === "cancelled"
                        ? "Cancelled"
                        : "Failed"}
                </div>
              </ListBoxItem>
            ))}
          </ListBox>
        </div>
      ) : null}

      <GenerateResult
        audioUrl={audioUrl}
        downloadUrl={downloadUrl}
        onDownload={() => void onDownload()}
      />
    </GridArtSurface>
  );
}
