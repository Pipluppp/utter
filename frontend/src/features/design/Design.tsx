import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListBox, ListBoxItem } from "react-aria-components";
import { useTasks } from "../../app/TaskProvider";
import { Message } from "../../components/atoms/Message";
import type { AutocompleteSelectItem } from "../../components/molecules/AutocompleteSelect";
import { GridArtSurface } from "../../components/molecules/GridArt";
import { InfoTip } from "../../components/molecules/InfoTip";
import { DESIGN_TIPS } from "../../data/tips";
import { useElapsedTick } from "../../hooks/useElapsedTick";
import { cn } from "../../lib/cn";
import { SUPPORTED_LANGUAGES } from "../../lib/provider-config";
import { formatElapsed } from "../../lib/time";
import type { StoredTask } from "../../lib/types";
import { DesignForm } from "./components/DesignForm";
import { DesignResult } from "./components/DesignResult";
import type { DesignFormState } from "./hooks/useDesignSubmit";
import { useDesignSubmit } from "./hooks/useDesignSubmit";

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
  const { getLatestTask, getTasksByType, getStatusText } = useTasks();
  const designSubmit = useDesignSubmit();

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

  const restoredRef = useRef(false);

  useEffect(() => {
    if (
      SUPPORTED_LANGUAGES.length > 0 &&
      !(SUPPORTED_LANGUAGES as readonly string[]).includes(language)
    ) {
      setLanguage(SUPPORTED_LANGUAGES[0] ?? "English");
    }
  }, [language]);

  // Auto-select first task when list changes
  useEffect(() => {
    if (selectedTaskId && designTasks.some((task) => task.taskId === selectedTaskId)) {
      return;
    }
    setSelectedTaskId(designTasks[0]?.taskId ?? null);
  }, [designTasks, selectedTaskId]);

  // Restore form state from latest task
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

  // Drive preview state from selected task
  useEffect(() => {
    designSubmit.setPreviewFromTask(
      selectedTask
        ? {
            taskId: selectedTask.taskId,
            status: selectedTask.status,
            result: selectedTask.result,
            error: selectedTask.error,
          }
        : null,
    );
  }, [selectedTask, designSubmit.setPreviewFromTask]);

  async function onPreview() {
    const taskId = await designSubmit.submitPreview({ name, language, text, instruct });
    if (taskId) setSelectedTaskId(taskId);
  }

  async function onSaveSelectedPreview() {
    if (!selectedTask?.taskId || selectedTask.status !== "completed") return;

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

    await designSubmit.savePreview(selectedTask.taskId, snapshot);
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

  const displayError = designSubmit.error;

  return (
    <GridArtSurface sweepNonce={designSubmit.sweepNonce} contentClassName="space-y-8">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
          Design
        </h2>
        <InfoTip label="Design tips" tips={DESIGN_TIPS} halftoneImage="fire" />
      </div>

      {displayError ? <Message variant="error">{displayError}</Message> : null}
      {designSubmit.success ? <Message variant="success">{designSubmit.success}</Message> : null}

      <DesignForm
        name={name}
        onNameChange={setName}
        instruct={instruct}
        onInstructChange={setInstruct}
        text={text}
        onTextChange={setText}
        languageItems={languageItems}
        language={language}
        onLanguageChange={setLanguage}
        examples={EXAMPLES}
        isSubmittingPreview={designSubmit.isSubmittingPreview}
        savedVoiceId={designSubmit.savedVoiceId}
        isSavingVoice={designSubmit.isSavingVoice}
        onSubmit={() => void onPreview()}
        onUseVoice={() => {
          if (!designSubmit.savedVoiceId) return;
          void navigate({ to: "/generate", search: { voice: designSubmit.savedVoiceId } });
        }}
      />

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

      {designSubmit.previewUrl ? (
        <DesignResult
          previewUrl={designSubmit.previewUrl}
          previewBlob={designSubmit.previewBlobRef.current ?? undefined}
          savedVoiceName={designSubmit.savedVoiceName}
          isSavingVoice={designSubmit.isSavingVoice}
          canSave={
            Boolean(selectedTask) &&
            selectedTask?.status === "completed" &&
            Boolean(designSubmit.previewBlobRef.current)
          }
          onSave={() => void onSaveSelectedPreview()}
        />
      ) : null}
    </GridArtSurface>
  );
}
