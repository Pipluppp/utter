import { Hono } from "npm:hono@4";
import { getTranscriptionConfig } from "../../_shared/mistral.ts";
import {
  getTtsCapabilities,
  getTtsProviderMode,
} from "../../_shared/tts/provider.ts";

export const languagesRoutes = new Hono();

languagesRoutes.get("/languages", (c) => {
  const transcription = getTranscriptionConfig();

  try {
    const provider = getTtsProviderMode();
    const capabilities = getTtsCapabilities(provider);

    return c.json({
      languages: [
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
        "Arabic",
        "Hindi",
        "Dutch",
        "Turkish",
      ],
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
