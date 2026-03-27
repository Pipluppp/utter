import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../../../lib/api";
import { formatElapsed } from "../../../lib/time";
import type { CloneResponse } from "../../../lib/types";

function contentTypeForFile(file: File): string {
  const byType = file.type?.trim();
  if (byType) return byType;

  const ext = extOf(file.name);
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".m4a") return "audio/mp4";
  return "application/octet-stream";
}

function extOf(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export type CloneSubmitParams = {
  name: string;
  file: File;
  language: string;
  transcript: string;
};

export type CloneSubmitResult = {
  submitting: boolean;
  elapsedLabel: string;
  sweepNonce: number;
  created: CloneResponse | null;
  error: string | null;
  submit: (params: CloneSubmitParams) => Promise<void>;
  reset: () => void;
};

export function useCloneSubmit(): CloneSubmitResult {
  const [submitting, setSubmitting] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedLabel, setElapsedLabel] = useState("0:00");
  const [sweepNonce, setSweepNonce] = useState(0);
  const [created, setCreated] = useState<CloneResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submitting || !startedAt) return;
    const t = window.setInterval(() => setElapsedLabel(formatElapsed(startedAt)), 1000);
    return () => window.clearInterval(t);
  }, [startedAt, submitting]);

  const submit = useCallback(async ({ name, file, language, transcript }: CloneSubmitParams) => {
    setError(null);
    setCreated(null);

    setSubmitting(true);
    setSweepNonce((v) => v + 1);
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
  }, []);

  const reset = useCallback(() => {
    setCreated(null);
    setError(null);
  }, []);

  return {
    submitting,
    elapsedLabel,
    sweepNonce,
    created,
    error,
    submit,
    reset,
  };
}
