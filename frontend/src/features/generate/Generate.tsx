import { useEffect, useMemo, useRef, useState } from "react";
import {
  Form,
  Label,
  ListBox,
  ListBoxItem,
  Text,
  TextArea,
  TextField,
} from "react-aria-components";
import { useSearchParams } from "react-router-dom";
import { taskLabel } from "../../app/taskKeys";
import { useTasks } from "../../app/TaskProvider";
import { Button } from "../../components/atoms/Button";
import { Message } from "../../components/atoms/Message";
import {
  AutocompleteSelect,
  type AutocompleteSelectItem,
} from "../../components/molecules/AutocompleteSelect";
import { GridArtSurface } from "../../components/molecules/GridArt";
import { InfoTip } from "../../components/molecules/InfoTip";
import { WaveformPlayer } from "../../components/organisms/WaveformPlayer";
import { getUtterDemo } from "../../content/utterDemo";
import { GENERATE_TIPS } from "../../data/tips";
import { useElapsedTick } from "../../hooks/useElapsedTick";
import { apiJson } from "../../lib/api";
import { cn } from "../../lib/cn";
import { fetchTextUtf8 } from "../../lib/fetchTextUtf8";
import { resolveProtectedMediaUrl, triggerDownload } from "../../lib/protectedMedia";
import { input } from "../../lib/recipes/input";
import { formatElapsed } from "../../lib/time";
import type { GenerateResponse, StoredTask, VoicesResponse } from "../../lib/types";
import { useLanguages } from "../shared/hooks";

type GenerateFormState = {
  voiceId: string;
  language: string;
  text: string;
};

export function GeneratePage() {
  const [params] = useSearchParams();
  const { languages, defaultLanguage, provider, capabilities } = useLanguages();
  const languageItems: AutocompleteSelectItem[] = useMemo(
    () => languages.map((l) => ({ id: l, label: l })),
    [languages],
  );

  const { startTask, getLatestTask, getTasksByType, getStatusText } = useTasks();

  const generateTasks = getTasksByType("generate");
  const latestTask = getLatestTask("generate");

  const hasActiveGenerate = generateTasks.some(
    (t) => t.status === "pending" || t.status === "processing",
  );
  const nowMs = useElapsedTick(hasActiveGenerate);

  const [voices, setVoices] = useState<VoicesResponse | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(true);

  const voiceItems = useMemo(
    () => (voices?.voices ?? []).map((v) => ({ ...v, label: v.name })),
    [voices],
  );

  const [voiceId, setVoiceId] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sweepNonce, setSweepNonce] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const restoredRef = useRef(false);
  const handledTaskKeyRef = useRef<string | null>(null);
  const loadedDemoRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);

  useEffect(() => setLanguage(defaultLanguage), [defaultLanguage]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await apiJson<VoicesResponse>("/api/voices");
        if (!active) return;
        setVoices(res);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load voices.");
      } finally {
        if (active) setLoadingVoices(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedTaskId && generateTasks.some((task) => task.taskId === selectedTaskId)) {
      return;
    }
    setSelectedTaskId(generateTasks[0]?.taskId ?? null);
  }, [generateTasks, selectedTaskId]);

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

    const voice = params.get("voice");
    const qsText = params.get("text");
    const qsLang = params.get("language");
    const demoId = params.get("demo");
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
  }, [latestTask, params]);

  const selectedTask = useMemo(
    () => generateTasks.find((task) => task.taskId === selectedTaskId) ?? null,
    [generateTasks, selectedTaskId],
  );

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

  const charCount = text.length;
  const maxTextChars = capabilities?.max_text_chars ?? 10000;
  const voicePlaceholder = loadingVoices
    ? "Loading voices..."
    : !voices
      ? "Unable to load voices"
      : voices.voices.length === 0
        ? "No voices available"
        : "Select a voice";
  const selectedVoice = voices?.voices.find((v) => v.id === voiceId) ?? null;
  const selectedVoiceProvider = selectedVoice?.tts_provider ?? "qwen";
  const selectedVoiceCompatible =
    voiceId.length === 0 ? true : Boolean(selectedVoice) && selectedVoiceProvider === provider;
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
    Boolean(voices) &&
    !loadingVoices &&
    Boolean(voiceId) &&
    selectedVoiceCompatible &&
    Boolean(text.trim()) &&
    charCount <= maxTextChars &&
    !isSubmitting;

  const formState: GenerateFormState = useMemo(
    () => ({ voiceId, language, text }),
    [language, text, voiceId],
  );

  async function onGenerate() {
    if (submitInFlightRef.current) return;

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

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setSweepNonce((value) => value + 1);

    try {
      const res = await apiJson<GenerateResponse>("/api/generate", {
        method: "POST",
        json: { voice_id: voiceId, text, language, model: "0.6B" },
      });
      const description = `Generate: ${text.slice(0, 50)}${text.length > 50 ? "..." : ""}`;
      startTask(res.task_id, "generate", "/generate", description, formState);
      setSelectedTaskId(res.task_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start generation.");
    } finally {
      setIsSubmitting(false);
      submitInFlightRef.current = false;
    }
  }

  return (
    <GridArtSurface sweepNonce={sweepNonce} contentClassName="space-y-8">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
          Generate
        </h2>
        <InfoTip label="Generate tips" tips={GENERATE_TIPS} halftoneImage="lilac" />
      </div>

      {error ? <Message variant="error">{error}</Message> : null}

      <Form
        className="space-y-6"
        validationBehavior="aria"
        onSubmit={(e) => {
          e.preventDefault();
          void onGenerate();
        }}
      >
        <AutocompleteSelect
          label="Voice"
          items={voiceItems}
          selectedKey={voiceId || null}
          onSelectionChange={(key) => setVoiceId(key)}
          isDisabled={loadingVoices || !voices || voices.voices.length === 0}
          placeholder={voicePlaceholder}
          filterKey="name"
          searchLabel="Search voices"
          searchPlaceholder="Search..."
        >
          {(v) => {
            const voiceProvider = v.tts_provider ?? "qwen";
            const incompatible = voiceProvider !== provider;
            return (
              <div className={cn("flex flex-col gap-0.5", incompatible && "opacity-50")}>
                <div className="flex items-center gap-2">
                  <span className="truncate">{v.name}</span>
                  {v.language ? (
                    <span className="shrink-0 border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {v.language}
                    </span>
                  ) : null}
                </div>
                {incompatible ? (
                  <span className="text-xs text-faint">Not available in this runtime</span>
                ) : v.description ? (
                  <span className="truncate text-xs text-faint">{v.description}</span>
                ) : null}
              </div>
            );
          }}
        </AutocompleteSelect>

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

        <TextField value={text} onChange={setText}>
          <Label className="mb-2 block label-style">Text</Label>
          <TextArea
            name="text"
            placeholder="Type what you want the voice to say..."
            className={input({ multiline: true, className: "min-h-44" })}
          />
          <Text
            slot="description"
            className="mt-2 flex items-center justify-between text-xs text-faint"
          >
            <span className={cn(charCount > maxTextChars && "text-status-error")}>
              {charCount}/{maxTextChars}
            </span>
            <span>Max {maxTextChars.toLocaleString()} characters</span>
          </Text>
        </TextField>

        <Button type="submit" block isDisabled={!canSubmit}>
          {isSubmitting ? "Starting generation..." : "Generate Speech"}
        </Button>
      </Form>

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
                  "flex w-full items-center justify-between gap-3 border border-border bg-background px-3 py-3 text-left hover:bg-muted",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "selected:bg-subtle",
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

      {audioUrl ? (
        <div className="space-y-4 border border-border bg-background p-4 shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium uppercase tracking-wide">Result</div>
            {downloadUrl ? (
              <button
                type="button"
                className="border border-border bg-background px-3 py-2 text-caption uppercase tracking-wide hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => void onDownload()}
              >
                Download
              </button>
            ) : null}
          </div>
          <WaveformPlayer audioUrl={audioUrl} />
        </div>
      ) : null}
    </GridArtSurface>
  );
}
