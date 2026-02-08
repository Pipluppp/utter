import { Hono } from "npm:hono@4"

export const languagesRoutes = new Hono()

languagesRoutes.get("/languages", (c) => {
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
      enabled: false,
      provider: "mistral",
      model: "mistral-large-latest",
      realtime_model: "mistral-large-latest",
    },
  })
})

