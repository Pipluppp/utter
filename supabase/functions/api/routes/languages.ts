import { Hono } from "npm:hono@4"
import { getTranscriptionConfig } from "../../_shared/mistral.ts"

export const languagesRoutes = new Hono()

languagesRoutes.get("/languages", (c) => {
  const transcription = getTranscriptionConfig()

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
    provider: "qwen",
    transcription: {
      enabled: transcription.enabled,
      provider: transcription.provider,
      model: transcription.model,
    },
  })
})
