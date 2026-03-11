import { Hono } from "hono";
import { getTranscriptionConfig } from "../_shared/transcription/provider.ts";
import {
  getTtsCapabilities,
  getTtsProviderMode,
} from "../_shared/tts/provider.ts";

export const languagesRoutes = new Hono();

const QWEN_SUPPORTED_LANGUAGES = [
  "Auto",
  "English",
  "Chinese",
  "Japanese",
  "Korean",
  "French",
  "German",
  "Spanish",
  "Italian",
  "Portuguese",
  "Russian",
] as const;

languagesRoutes.get("/languages", (c) => {
  const transcription = getTranscriptionConfig();

  try {
    const provider = getTtsProviderMode();
    const capabilities = getTtsCapabilities();

    return c.json({
      languages: [...QWEN_SUPPORTED_LANGUAGES],
      default: "Auto",
      provider,
      capabilities,
      transcription: {
        enabled: transcription.enabled,
        provider: transcription.provider,
        model: transcription.model,
      },
    });
  } catch (error) {
    const detail = error instanceof Error
      ? error.message
      : "Provider configuration error";

    return c.json({ detail }, 500);
  }
});
