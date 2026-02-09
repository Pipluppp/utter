const DEFAULT_SERVER_URL = "https://api.mistral.ai"
const DEFAULT_TRANSCRIBE_MODEL = "voxtral-mini-2602"

const LANGUAGE_TO_MISTRAL_CODE: Record<string, string> = {
  Chinese: "zh",
  English: "en",
  Japanese: "ja",
  Korean: "ko",
  German: "de",
  French: "fr",
  Russian: "ru",
  Portuguese: "pt",
  Spanish: "es",
  Italian: "it",
}

type TranscriptionConfig = {
  enabled: boolean
  provider: "mistral"
  model: string
  serverUrl: string
  apiKey: string
}

export class TranscriptionUnavailableError extends Error {
  constructor(message = "Transcription is not configured on this server.") {
    super(message)
    this.name = "TranscriptionUnavailableError"
  }
}

export class MistralUpstreamError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "MistralUpstreamError"
    this.status = status
  }
}

function normalizeEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim()
  return value ? value : null
}

function envBool(name: string, fallback: boolean): boolean {
  const value = normalizeEnv(name)
  if (!value) return fallback
  return value.toLowerCase() === "true"
}

function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, "")
}

export function normalizeLanguageCode(language: string | null | undefined): string | null {
  if (!language) return null
  const trimmed = language.trim()
  if (!trimmed || trimmed === "Auto") return null
  return LANGUAGE_TO_MISTRAL_CODE[trimmed] ?? null
}

export function getTranscriptionConfig(): TranscriptionConfig {
  const apiKey = normalizeEnv("MISTRAL_API_KEY") ?? ""
  const enabledByFlag = envBool("TRANSCRIPTION_ENABLED", true)
  const model = normalizeEnv("MISTRAL_TRANSCRIBE_MODEL") ?? DEFAULT_TRANSCRIBE_MODEL
  const serverUrl = normalizeServerUrl(
    normalizeEnv("MISTRAL_SERVER_URL") ?? DEFAULT_SERVER_URL,
  )

  return {
    enabled: enabledByFlag && apiKey.length > 0,
    provider: "mistral",
    model,
    serverUrl,
    apiKey,
  }
}

function requireEnabledConfig(): TranscriptionConfig {
  const config = getTranscriptionConfig()
  if (!config.enabled) {
    throw new TranscriptionUnavailableError(
      "Transcription is not enabled. Set MISTRAL_API_KEY and TRANSCRIPTION_ENABLED=true.",
    )
  }
  return config
}

async function parseUpstreamError(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } | string; detail?: string; message?: string }
      | null
    const fromError =
      typeof body?.error === "string"
        ? body.error
        : typeof body?.error?.message === "string"
        ? body.error.message
        : null
    if (fromError) return fromError
    if (typeof body?.detail === "string") return body.detail
    if (typeof body?.message === "string") return body.message
  }
  const text = await res.text().catch(() => "")
  return text || `${res.status} ${res.statusText}`
}

export type BatchTranscriptionResult = {
  text: string
  model: string
  language: string | null
}

export async function transcribeAudioFile(
  file: File,
  language: string | null | undefined,
): Promise<BatchTranscriptionResult> {
  const config = requireEnabledConfig()
  const form = new FormData()
  form.set("model", config.model)
  form.set("file", file, file.name || "audio.wav")
  const code = normalizeLanguageCode(language)
  if (code) form.set("language", code)

  const res = await fetch(`${config.serverUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: form,
  })

  if (!res.ok) {
    const detail = await parseUpstreamError(res)
    throw new MistralUpstreamError(
      res.status,
      `Mistral transcription failed (${res.status}): ${detail.slice(0, 300)}`,
    )
  }

  const body = (await res.json().catch(() => null)) as
    | { text?: string; model?: string; language?: string | null }
    | null
  return {
    text: typeof body?.text === "string" ? body.text.trim() : "",
    model: typeof body?.model === "string" ? body.model : config.model,
    language: typeof body?.language === "string" ? body.language : null,
  }
}
