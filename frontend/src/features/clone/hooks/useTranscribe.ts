import { useState } from "react";
import { apiForm } from "../../../lib/api";
import { TRANSCRIPTION_ENABLED } from "../../../lib/provider-config";

export type TranscribeResult = {
  transcribing: boolean;
  transcribe: (file: File, language: string) => Promise<string | null>;
};

export function useTranscribe(): TranscribeResult {
  const [transcribing, setTranscribing] = useState(false);

  async function transcribe(file: File, language: string): Promise<string | null> {
    if (!TRANSCRIPTION_ENABLED) {
      throw new Error("Transcription is not enabled on this server.");
    }

    setTranscribing(true);
    try {
      const form = new FormData();
      form.set("audio", file);
      form.set("language", language);
      const res = await apiForm<{
        text: string;
        model: string;
        language: string | null;
      }>("/api/transcriptions", form, { method: "POST" });
      return res.text;
    } finally {
      setTranscribing(false);
    }
  }

  return { transcribing, transcribe };
}
