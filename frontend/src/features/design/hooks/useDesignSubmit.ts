import { useCallback, useEffect, useRef, useState } from "react";
import { useTasks } from "../../../app/TaskProvider";
import { apiForm, apiJson } from "../../../lib/api";
import type { DesignPreviewResponse, DesignSaveResponse } from "../../../lib/types";

export type DesignFormState = {
  name: string;
  language: string;
  text: string;
  instruct: string;
};

export type SelectedTaskInfo = {
  taskId: string;
  status: string;
  result?: unknown;
  error?: string | null;
};

export type UseDesignSubmitResult = {
  isSubmittingPreview: boolean;
  isSavingVoice: boolean;
  sweepNonce: number;
  previewUrl: string | null;
  savedVoiceId: string | null;
  savedVoiceName: string | null;
  error: string | null;
  success: string | null;
  submitPreview: (params: DesignFormState) => Promise<string | null>;
  savePreview: (taskId: string, formSnapshot: DesignFormState) => Promise<void>;
  previewBlobRef: React.RefObject<Blob | null>;
  setPreviewFromTask: (task: SelectedTaskInfo | null) => void;
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
  resetSaveState: () => void;
};

export function useDesignSubmit(): UseDesignSubmitResult {
  const { startTask } = useTasks();

  const [isSubmittingPreview, setIsSubmittingPreview] = useState(false);
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [sweepNonce, setSweepNonce] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savedVoiceId, setSavedVoiceId] = useState<string | null>(null);
  const [savedVoiceName, setSavedVoiceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const previewBlobRef = useRef<Blob | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const handledTaskKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const resetSaveState = useCallback(() => {
    setSavedVoiceId(null);
    setSavedVoiceName(null);
    setSuccess(null);
  }, []);

  const setPreviewFromTask = useCallback(
    (task: SelectedTaskInfo | null) => {
      if (!task) {
        handledTaskKeyRef.current = null;
        setPreviewUrl(null);
        previewBlobRef.current = null;
        resetSaveState();
        return;
      }

      resetSaveState();

      if (task.status === "pending" || task.status === "processing") {
        handledTaskKeyRef.current = null;
        setPreviewUrl(null);
        previewBlobRef.current = null;
        return;
      }

      const terminalKey = `${task.taskId}:${task.status}`;
      if (handledTaskKeyRef.current === terminalKey) return;
      handledTaskKeyRef.current = terminalKey;

      if (task.status === "completed") {
        const result = task.result as { audio_url?: string } | undefined;
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

      if (task.status === "failed") {
        setError(task.error ?? "Failed to generate preview.");
        return;
      }

      setError("Preview cancelled.");
    },
    [resetSaveState],
  );

  const submitPreview = useCallback(
    async (params: DesignFormState): Promise<string | null> => {
      setError(null);
      setSuccess(null);
      setSavedVoiceId(null);
      setSavedVoiceName(null);

      if (!params.name.trim()) {
        setError("Voice name is required.");
        return null;
      }
      if (!params.text.trim()) {
        setError("Preview text is required.");
        return null;
      }
      if (params.text.length > 500) {
        setError("Preview text must be 500 characters or less.");
        return null;
      }
      if (!params.instruct.trim()) {
        setError("Voice description is required.");
        return null;
      }
      if (params.instruct.length > 500) {
        setError("Voice description must be 500 characters or less.");
        return null;
      }

      setIsSubmittingPreview(true);
      setSweepNonce((v) => v + 1);

      try {
        const res = await apiJson<DesignPreviewResponse>("/api/voices/design/preview", {
          method: "POST",
          json: {
            text: params.text,
            language: params.language,
            instruct: params.instruct,
            name: params.name,
          },
        });
        startTask(
          res.task_id,
          "design_preview",
          "/design",
          `Design preview: ${params.name.trim()}`,
          params,
        );
        setPreviewUrl(null);
        previewBlobRef.current = null;
        return res.task_id;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start preview.");
        return null;
      } finally {
        setIsSubmittingPreview(false);
      }
    },
    [startTask],
  );

  const savePreview = useCallback(
    async (taskId: string, formSnapshot: DesignFormState): Promise<void> => {
      if (!previewBlobRef.current) {
        setError("Preview audio is not ready yet.");
        return;
      }

      setIsSavingVoice(true);
      setSavedVoiceId(null);
      setSavedVoiceName(null);
      setSuccess(null);

      try {
        const form = new FormData();
        form.set("name", formSnapshot.name.trim());
        form.set("text", formSnapshot.text.trim());
        form.set("language", formSnapshot.language);
        form.set("instruct", formSnapshot.instruct.trim());
        form.set("task_id", taskId);
        form.set("audio", new File([previewBlobRef.current], "preview.wav", { type: "audio/wav" }));

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

  return {
    isSubmittingPreview,
    isSavingVoice,
    sweepNonce,
    previewUrl,
    savedVoiceId,
    savedVoiceName,
    error,
    success,
    submitPreview,
    savePreview,
    previewBlobRef,
    setPreviewFromTask,
    setError,
    setSuccess,
    resetSaveState,
  };
}
