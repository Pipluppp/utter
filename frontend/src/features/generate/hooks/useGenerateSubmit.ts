import { useCallback, useRef, useState } from "react";
import { useTasks } from "../../../app/TaskProvider";
import { apiJson } from "../../../lib/api";
import type { GenerateResponse } from "../../../lib/types";

export type GenerateFormState = {
  voiceId: string;
  language: string;
  text: string;
};

export type GenerateSubmitParams = {
  voiceId: string;
  text: string;
  language: string;
  formState: GenerateFormState;
};

export type UseGenerateSubmitResult = {
  submitting: boolean;
  sweepNonce: number;
  error: string | null;
  submit: (params: GenerateSubmitParams) => Promise<string | null>;
};

export function useGenerateSubmit(): UseGenerateSubmitResult {
  const { startTask } = useTasks();
  const [submitting, setSubmitting] = useState(false);
  const [sweepNonce, setSweepNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const submitInFlightRef = useRef(false);

  const submit = useCallback(
    async ({
      voiceId,
      text,
      language,
      formState,
    }: GenerateSubmitParams): Promise<string | null> => {
      if (submitInFlightRef.current) return null;

      setError(null);
      submitInFlightRef.current = true;
      setSubmitting(true);
      setSweepNonce((v) => v + 1);

      try {
        const res = await apiJson<GenerateResponse>("/api/generate", {
          method: "POST",
          json: { voice_id: voiceId, text, language, model: "0.6B" },
        });
        const description = `Generate: ${text.slice(0, 50)}${text.length > 50 ? "..." : ""}`;
        startTask(res.task_id, "generate", "/generate", description, formState);
        return res.task_id;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start generation.");
        return null;
      } finally {
        setSubmitting(false);
        submitInFlightRef.current = false;
      }
    },
    [startTask],
  );

  return { submitting, sweepNonce, error, submit };
}
