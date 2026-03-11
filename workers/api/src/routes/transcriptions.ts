import { Hono } from "hono";

import { requireUser } from "../_shared/auth.ts";
import {
  getTranscriptionConfig,
  TranscriptionUnavailableError,
  TranscriptionUpstreamError,
  transcribeAudioFile,
} from "../_shared/transcription/provider.ts";

const ALLOWED_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".m4a"]);
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function extOf(filename: string): string {
  const idx = filename.lastIndexOf(".")
  return idx >= 0 ? filename.slice(idx).toLowerCase() : ""
}

function messageFromUnknown(value: unknown, fallback: string): string {
  if (value instanceof Error) return value.message
  return typeof value === "string" ? value : fallback
}

export const transcriptionsRoutes = new Hono()

transcriptionsRoutes.post("/transcriptions", async (c) => {
  try {
    await requireUser(c.req.raw)
  } catch (e) {
    if (e instanceof Response) return e
    return jsonDetail("Unauthorized", 401)
  }

  if (!getTranscriptionConfig().enabled) {
    return jsonDetail("Transcription is not configured on this server.", 503);
  }

  const form = await c.req.formData().catch(() => null);
  if (!form) return jsonDetail("Invalid form data.", 400);

  const audio = form.get("audio");
  if (!(audio instanceof File)) return jsonDetail("Audio file is required", 400);
  if (!audio.size) return jsonDetail("Audio file is required", 400);
  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonDetail("File too large (max 10MB)", 400);
  }

  const ext = extOf(audio.name || "audio.wav")
  if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
    return jsonDetail(`File must be WAV, MP3, or M4A (got ${ext || "unknown"})`, 400)
  }

  const language = normalizeString(form.get("language"))

  try {
    const result = await transcribeAudioFile(audio, language)
    return c.json({
      text: result.text,
      model: result.model,
      language: result.language,
    })
  } catch (e) {
    if (e instanceof TranscriptionUnavailableError) {
      return jsonDetail(e.message, 503)
    }
    if (e instanceof TranscriptionUpstreamError) {
      return jsonDetail(`Transcription request failed: ${e.message}`, 502)
    }
    return jsonDetail(
      `Transcription request failed: ${messageFromUnknown(e, "Unknown error")}`,
      502,
    )
  }
})
