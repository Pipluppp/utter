import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Form,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Text,
  TextArea,
  TextField,
} from "react-aria-components";
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
import { DESIGN_TIPS } from "../../data/tips";
import { useElapsedTick } from "../../hooks/useElapsedTick";
import { apiForm, apiJson } from "../../lib/api";
import { cn } from "../../lib/cn";
import { SUPPORTED_LANGUAGES } from "../../lib/provider-config";
import { input } from "../../lib/recipes/input";
import { formatElapsed } from "../../lib/time";
import type { DesignPreviewResponse, DesignSaveResponse, StoredTask } from "../../lib/types";

type DesignFormState = {
  name: string;
  language: string;
  text: string;
  instruct: string;
};

const EXAMPLES: Array<{ title: string; name: string; instruct: string }> = [
  {
    title: "Warm & steady",
    name: "Warm & steady",
    instruct:
      "A warm, steady voice with close-mic intimacy. Calm pacing, soft consonants, and a confident but gentle tone.",
  },
  {
    title: "Bright & fast",
    name: "Bright & fast",
    instruct:
      "A bright, energetic voice with crisp articulation. Slightly faster pacing, friendly and upbeat without sounding cartoonish.",
  },
  {
    title: "Low & cinematic",
    name: "Low & cinematic",
    instruct:
      "A low, cinematic voice with a restrained intensity. Slow pacing, rich timbre, and subtle breathiness.",
  },
];

export function DesignPage() {
  const navigate = useNavigate();
  const languageItems: AutocompleteSelectItem[] = useMemo(
    () => SUPPORTED_LANGUAGES.map((l) => ({ id: l, label: l })),
    [],
  );
  const { startTask, getLatestTask, getTasksByType, getStatusText } = useTasks();

  const designTasks = getTasksByType("design_preview");
  const latestTask = getLatestTask("design_preview");

  const hasActiveDesign = designTasks.some(
    (t) => t.status === "pending" || t.status === "processing",
  );
  const nowMs = useElapsedTick(hasActiveDesign);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("English");
  const [text, setText] = useState("");
  const [instruct, setInstruct] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmittingPreview, setIsSubmittingPreview] = useState(false);
  const [sweepNonce, setSweepNonce] = useState(0);
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [savedVoiceId, setSavedVoiceId] = useState<string | null>(null);
  const [savedVoiceName, setSavedVoiceName] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const restoredRef = useRef(false);
  const handledTaskKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      SUPPORTED_LANGUAGES.length > 0 &&
      !(SUPPORTED_LANGUAGES as readonly string[]).includes(language)
    ) {
      setLanguage(SUPPORTED_LANGUAGES[0] ?? "English");
    }
  }, [language]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedTaskId && designTasks.some((task) => task.taskId === selectedTaskId)) {
      return;
    }
    setSelectedTaskId(designTasks[0]?.taskId ?? null);
  }, [designTasks, selectedTaskId]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const storedTask = latestTask as StoredTask | null;
    if (storedTask?.formState && typeof storedTask.formState === "object") {
      const fs = storedTask.formState as Partial<DesignFormState>;
      if (typeof fs.name === "string") setName(fs.name);
      if (typeof fs.language === "string") setLanguage(fs.language);
      if (typeof fs.text === "string") setText(fs.text);
      if (typeof fs.instruct === "string") setInstruct(fs.instruct);
    }
  }, [latestTask]);

  const selectedTask = useMemo(
    () => designTasks.find((task) => task.taskId === selectedTaskId) ?? null,
    [designTasks, selectedTaskId],
  );

  useEffect(() => {
    if (!selectedTask) {
      handledTaskKeyRef.current = null;
      setPreviewUrl(null);
      previewBlobRef.current = null;
      setSavedVoiceId(null);
      setSavedVoiceName(null);
      setSuccess(null);
      return;
    }

    setSavedVoiceId(null);
    setSavedVoiceName(null);
    setSuccess(null);

    if (selectedTask.status === "pending" || selectedTask.status === "processing") {
      handledTaskKeyRef.current = null;
      setPreviewUrl(null);
      previewBlobRef.current = null;
      return;
    }

    const terminalKey = `${selectedTask.taskId}:${selectedTask.status}`;
    if (handledTaskKeyRef.current === terminalKey) return;
    handledTaskKeyRef.current = terminalKey;

    if (selectedTask.status === "completed") {
      const result = selectedTask.result as { audio_url?: string } | undefined;
      const audioUrl = result?.audio_url?.trim();

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
      previewBlobRef.current = null;

      if (!audioUrl) {
        setPreviewUrl(null);
        setError("Failed to load preview audio.");
        return;
      }

      void (async () => {
        try {
          const res = await fetch(audioUrl);
          if (!res.ok) throw new Error("Failed to load preview audio.");
          const blob = await res.blob();
          previewBlobRef.current = blob;
          const objectUrl = URL.createObjectURL(blob);
          objectUrlRef.current = objectUrl;
          setPreviewUrl(objectUrl);
          setError(null);
        } catch (e) {
          setPreviewUrl(null);
          setError(e instanceof Error ? e.message : "Failed to load preview.");
        }
      })();
      return;
    }

    setPreviewUrl(null);
    previewBlobRef.current = null;

    if (selectedTask.status === "failed") {
      setError(selectedTask.error ?? "Failed to generate preview.");
      return;
    }

    setError("Preview cancelled.");
  }, [selectedTask]);

  const saveDesignedVoice = useCallback(
    async (blob: Blob, snapshot: DesignFormState, taskId: string) => {
      setIsSavingVoice(true);
      setSavedVoiceId(null);
      setSavedVoiceName(null);
      setSuccess(null);

      try {
        const form = new FormData();
        form.set("name", snapshot.name.trim());
        form.set("text", snapshot.text.trim());
        form.set("language", snapshot.language);
        form.set("instruct", snapshot.instruct.trim());
        form.set("task_id", taskId);
        form.set(
          "audio",
          new File([blob], "preview.wav", {
            type: "audio/wav",
          }),
        );

        const saved = await apiForm<DesignSaveResponse>("/api/voices/design", form, {
          method: "POST",
        });
        setSavedVoiceId(saved.id);
        setSavedVoiceName(saved.name);
        setError(null);
        setSuccess(`Voice "${saved.name}" saved and ready to use.`);
      } catch (e) {
        setSavedVoiceId(null);
        setSavedVoiceName(null);
        setSuccess(null);
        const detail = e instanceof Error ? e.message : "Failed to save this preview.";
        setError(`Preview ready, but save failed. ${detail}`);
      } finally {
        setIsSavingVoice(false);
      }
    },
    [],
  );

  async function onPreview() {
    setError(null);
    setSuccess(null);
    setSavedVoiceId(null);
    setSavedVoiceName(null);

    if (!name.trim()) {
      setError("Voice name is required.");
      return;
    }
    if (!text.trim()) {
      setError("Preview text is required.");
      return;
    }
    if (text.length > 500) {
      setError("Preview text must be 500 characters or less.");
      return;
    }
    if (!instruct.trim()) {
      setError("Voice description is required.");
      return;
    }
    if (instruct.length > 500) {
      setError("Voice description must be 500 characters or less.");
      return;
    }

    setIsSubmittingPreview(true);
    setSweepNonce((value) => value + 1);

    try {
      const snapshot: DesignFormState = { name, language, text, instruct };
      const res = await apiJson<DesignPreviewResponse>("/api/voices/design/preview", {
        method: "POST",
        json: { text, language, instruct, name },
      });
      startTask(
        res.task_id,
        "design_preview",
        "/design",
        `Design preview: ${name.trim()}`,
        snapshot,
      );
      setSelectedTaskId(res.task_id);
      setPreviewUrl(null);
      previewBlobRef.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start preview.");
    } finally {
      setIsSubmittingPreview(false);
    }
  }

  async function onSaveSelectedPreview() {
    if (!selectedTask?.taskId || selectedTask.status !== "completed") return;
    if (!previewBlobRef.current) {
      setError("Preview audio is not ready yet.");
      return;
    }

    const taskState =
      selectedTask.formState && typeof selectedTask.formState === "object"
        ? (selectedTask.formState as Partial<DesignFormState>)
        : null;

    const snapshot: DesignFormState = {
      name: typeof taskState?.name === "string" ? taskState.name : name,
      language: typeof taskState?.language === "string" ? taskState.language : language,
      text: typeof taskState?.text === "string" ? taskState.text : text,
      instruct: typeof taskState?.instruct === "string" ? taskState.instruct : instruct,
    };

    await saveDesignedVoice(previewBlobRef.current, snapshot, selectedTask.taskId);
  }

  const selectedStatusText = selectedTask
    ? getStatusText(
        selectedTask.status,
        selectedTask.modalStatus ?? null,
        selectedTask.providerStatus ?? null,
      )
    : null;
  const activeDesignCount = designTasks.filter(
    (task) => task.status === "pending" || task.status === "processing",
  ).length;

  return (
    <GridArtSurface sweepNonce={sweepNonce} contentClassName="space-y-8">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
          Design
        </h2>
        <InfoTip label="Design tips" tips={DESIGN_TIPS} halftoneImage="fire" />
      </div>

      {error ? <Message variant="error">{error}</Message> : null}
      {success ? <Message variant="success">{success}</Message> : null}

      <Form
        className="space-y-6"
        validationBehavior="aria"
        onSubmit={(e) => {
          e.preventDefault();
          void onPreview();
        }}
      >
        <TextField value={name} onChange={setName}>
          <Label className="mb-2 block label-style">Voice Name</Label>
          <Input name="name" autoComplete="off" className={input()} />
        </TextField>

        <TextField value={instruct} onChange={setInstruct}>
          <Label className="mb-2 block label-style">Voice Description</Label>
          <TextArea
            name="instruct"
            placeholder="Describe the voice (tone, pacing, timbre, vibe)..."
            className={input({ multiline: true })}
          />
          <Text
            slot="description"
            className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-faint"
          >
            <span>{instruct.length}/500</span>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.title}
                  type="button"
                  className="cursor-default press-scale border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => {
                    setName(ex.name);
                    setInstruct(ex.instruct);
                  }}
                >
                  {ex.title}
                </button>
              ))}
            </div>
          </Text>
        </TextField>

        <TextField value={text} onChange={setText}>
          <Label className="mb-2 block label-style">Preview Text</Label>
          <TextArea
            name="text"
            placeholder="A short line to preview the voice..."
            className={input({ multiline: true })}
          />
          <Text slot="description" className="mt-2 text-xs text-faint">
            {text.length}/500
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
          <Button type="submit" block isDisabled={isSubmittingPreview}>
            {isSubmittingPreview ? "Starting preview..." : "Generate Preview"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            block
            onPress={() => {
              if (!savedVoiceId) return;
              void navigate({ to: "/generate", search: { voice: savedVoiceId } });
            }}
            isDisabled={!savedVoiceId || isSavingVoice}
          >
            Use Voice
          </Button>
        </div>
      </Form>

      {selectedTask ? (
        <div className="space-y-4 border border-border bg-subtle p-4 shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium uppercase tracking-wide">Selected Preview</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {selectedStatusText ?? "Processing..."}
              </div>
            </div>
            <div className="text-xs text-faint">
              {selectedTask.status === "pending" || selectedTask.status === "processing"
                ? formatElapsed(selectedTask.startedAt, nowMs)
                : selectedTask.status === "completed"
                  ? "Ready to save"
                  : "Not usable"}
            </div>
          </div>
          {selectedTask.subtitle ? (
            <div className="text-xs text-faint">{selectedTask.subtitle}</div>
          ) : null}
          {activeDesignCount > 1 ? (
            <div className="text-xs text-faint">
              {activeDesignCount} design previews currently running.
            </div>
          ) : null}
        </div>
      ) : null}

      {designTasks.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium uppercase tracking-wide">Tracked Previews</div>
          <ListBox
            aria-label="Tracked Previews"
            selectionMode="single"
            selectedKeys={selectedTaskId ? new Set([selectedTaskId]) : new Set<string>()}
            onSelectionChange={(keys) => {
              const selected = [...keys][0];
              if (typeof selected === "string") setSelectedTaskId(selected);
            }}
            className="space-y-2"
          >
            {designTasks.map((task) => (
              <ListBoxItem
                key={task.taskId}
                id={task.taskId}
                textValue={task.description}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border border-border bg-background px-3 py-3 text-left press-scale-sm-y hover:bg-surface-hover",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "selected:bg-surface-selected",
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

      {previewUrl ? (
        <div className="space-y-4 border border-border bg-background p-4 shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium uppercase tracking-wide">Preview</div>
              {savedVoiceName ? (
                <div className="mt-1 text-xs text-faint">{savedVoiceName}</div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              onPress={() => void onSaveSelectedPreview()}
              isDisabled={
                !selectedTask ||
                selectedTask.status !== "completed" ||
                !previewBlobRef.current ||
                isSavingVoice
              }
            >
              {isSavingVoice ? "Saving voice..." : "Save This Preview"}
            </Button>
          </div>
          <WaveformPlayer audioUrl={previewUrl} audioBlob={previewBlobRef.current ?? undefined} />
        </div>
      ) : null}
    </GridArtSurface>
  );
}
