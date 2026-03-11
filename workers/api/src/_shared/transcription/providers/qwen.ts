import { envGet } from "../../runtime_env.ts";
import {
  type BatchTranscriptionResult,
  type TranscriptionConfig,
  TranscriptionUnavailableError,
  TranscriptionUpstreamError,
} from "../types.ts";

const DEFAULT_QWEN_ASR_MODEL = "qwen3-asr-flash-2026-02-10";
const DEFAULT_QWEN_ASR_BASE_URL_INTL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_QWEN_ASR_BASE_URL_CN =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const REQUEST_TIMEOUT_MS = 90_000;

const LANGUAGE_TO_QWEN_CODE: Record<string, string> = {
  Chinese: "zh",
  English: "en",
  Japanese: "ja",
  Korean: "ko",
  French: "fr",
  German: "de",
  Spanish: "es",
  Italian: "it",
  Portuguese: "pt",
  Russian: "ru",
};

type QwenAsrAnnotation = {
  language?: unknown;
};

type QwenAsrMessage = {
  content?: unknown;
  annotations?: unknown;
};

type QwenAsrChoice = {
  message?: QwenAsrMessage | null;
};

type QwenAsrUsage = {
  seconds?: unknown;
};

type QwenAsrResponse = {
  model?: unknown;
  request_id?: unknown;
  id?: unknown;
  usage?: QwenAsrUsage | null;
  choices?: QwenAsrChoice[] | null;
  error?: {
    message?: unknown;
    code?: unknown;
  } | string | null;
  message?: unknown;
  code?: unknown;
};

function optionalEnv(name: string): string | null {
  const value = envGet(name)?.trim();
  return value ? value : null;
}

function envBool(name: string, fallback: boolean): boolean {
  const value = optionalEnv(name);
  if (!value) return fallback;
  return value.toLowerCase() === "true";
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function defaultBaseUrlForRegion(region: string | null): string {
  return region?.toLowerCase() === "cn"
    ? DEFAULT_QWEN_ASR_BASE_URL_CN
    : DEFAULT_QWEN_ASR_BASE_URL_INTL;
}

function textFromContentPart(part: unknown): string | null {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return null;

  const record = part as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (typeof record.transcript === "string") return record.transcript;
  if (typeof record.content === "string") return record.content;

  return null;
}

function extractTranscriptText(content: unknown): string {
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    const combined = content
      .map((part) => textFromContentPart(part))
      .filter((part): part is string => typeof part === "string")
      .join("")
      .trim();
    return combined;
  }

  const single = textFromContentPart(content);
  return typeof single === "string" ? single.trim() : "";
}

function extractDetectedLanguage(annotations: unknown): string | null {
  if (!Array.isArray(annotations)) return null;

  for (const entry of annotations) {
    if (!entry || typeof entry !== "object") continue;
    const language = (entry as QwenAsrAnnotation).language;
    if (typeof language === "string" && language.trim()) {
      return language.trim();
    }
  }

  return null;
}

function normalizeLanguageCode(language: string | null | undefined): string | null {
  if (!language) return null;
  const trimmed = language.trim();
  if (!trimmed || trimmed === "Auto") return null;
  return LANGUAGE_TO_QWEN_CODE[trimmed] ?? null;
}

function mimeTypeForAudioFile(file: File): string {
  const byType = file.type?.trim();
  if (byType) return byType;

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".wav")) return "audio/wav";
  if (lowerName.endsWith(".mp3")) return "audio/mpeg";
  if (lowerName.endsWith(".m4a")) return "audio/mp4";
  return "audio/wav";
}

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    let chunkBinary = "";
    for (const byte of chunk) {
      chunkBinary += String.fromCharCode(byte);
    }
    binary += chunkBinary;
  }
  return btoa(binary);
}

async function encodeAudioFileAsDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return `data:${mimeTypeForAudioFile(file)};base64,${toBase64(bytes)}`;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TranscriptionUpstreamError(
        504,
        "Qwen transcription request timed out.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function requestIdFromBody(body: QwenAsrResponse | null): string | null {
  if (typeof body?.request_id === "string" && body.request_id.trim()) {
    return body.request_id.trim();
  }
  if (typeof body?.id === "string" && body.id.trim()) return body.id.trim();
  return null;
}

function messageFromBody(body: QwenAsrResponse | null, fallback: string): string {
  if (!body) return fallback;

  if (typeof body.error === "string" && body.error.trim()) return body.error.trim();

  if (body.error && typeof body.error === "object") {
    if (
      typeof body.error.message === "string" &&
      body.error.message.trim()
    ) {
      return body.error.message.trim();
    }
  }

  if (typeof body.message === "string" && body.message.trim()) {
    return body.message.trim();
  }

  return fallback;
}

function usageSecondsFromBody(body: QwenAsrResponse | null): number | null {
  const seconds = body?.usage?.seconds;
  if (typeof seconds === "number" && Number.isFinite(seconds)) return seconds;
  if (typeof seconds === "string") {
    const parsed = Number(seconds);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function getQwenTranscriptionConfig(): TranscriptionConfig {
  const apiKey = optionalEnv("DASHSCOPE_API_KEY") ?? "";
  const enabledByFlag = envBool("TRANSCRIPTION_ENABLED", true);
  const region = optionalEnv("DASHSCOPE_REGION");
  const model = optionalEnv("QWEN_ASR_MODEL") ?? DEFAULT_QWEN_ASR_MODEL;
  const baseUrl = normalizeBaseUrl(
    optionalEnv("QWEN_ASR_BASE_URL") ?? defaultBaseUrlForRegion(region),
  );

  return {
    enabled: enabledByFlag && apiKey.length > 0,
    provider: "qwen",
    model,
    baseUrl,
    apiKey,
  };
}

function requireEnabledConfig(): TranscriptionConfig {
  const config = getQwenTranscriptionConfig();
  if (!config.enabled) {
    throw new TranscriptionUnavailableError(
      "Transcription is not enabled. Set DASHSCOPE_API_KEY and TRANSCRIPTION_ENABLED=true.",
    );
  }
  return config;
}

export async function transcribeAudioFileWithQwen(
  file: File,
  language: string | null | undefined,
): Promise<BatchTranscriptionResult> {
  const config = requireEnabledConfig();
  const audioDataUrl = await encodeAudioFileAsDataUrl(file);
  const languageCode = normalizeLanguageCode(language);
  const asrOptions: Record<string, unknown> = {
    enable_itn: false,
  };
  if (languageCode) asrOptions.language = languageCode;

  const payload = {
    model: config.model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: audioDataUrl,
            },
          },
        ],
      },
    ],
    stream: false,
    asr_options: asrOptions,
  };

  const response = await fetchWithTimeout(
    `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    REQUEST_TIMEOUT_MS,
  );

  const body =
    (await response.json().catch(() => null)) as QwenAsrResponse | null;

  if (!response.ok) {
    const requestId = requestIdFromBody(body);
    const detail = messageFromBody(
      body,
      `${response.status} ${response.statusText}`.trim(),
    );
    console.warn("transcription.qwen.error", {
      provider: "qwen",
      model: config.model,
      status: response.status,
      request_id: requestId,
      detail,
    });
    throw new TranscriptionUpstreamError(
      response.status,
      `Qwen transcription failed (${response.status}): ${detail.slice(0, 300)}`,
      requestId,
    );
  }

  const firstChoice = Array.isArray(body?.choices) ? body?.choices[0] : null;
  const message = firstChoice?.message ?? null;
  const detectedLanguage = extractDetectedLanguage(message?.annotations);
  const result: BatchTranscriptionResult = {
    text: extractTranscriptText(message?.content),
    model: typeof body?.model === "string" && body.model.trim()
      ? body.model
      : config.model,
    language: detectedLanguage,
  };

  console.info("transcription.qwen.success", {
    provider: "qwen",
    model: result.model,
    detected_language: result.language,
    usage_seconds: usageSecondsFromBody(body),
    request_id: requestIdFromBody(body),
  });

  return result;
}
