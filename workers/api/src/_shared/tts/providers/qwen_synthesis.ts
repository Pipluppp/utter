import { getQwenConfig } from "../provider.ts";
import { providerErrorFromHttp, providerTimeoutError } from "./errors.ts";

const SYNTHESIS_PATH = "/api/v1/services/aigc/multimodal-generation/generation";

type QwenSynthesisResponse = {
  status_code?: number;
  request_id?: string;
  code?: string;
  message?: string;
  output?: {
    audio?: {
      url?: string;
      id?: string;
      expires_at?: number;
    };
  };
  usage?: Record<string, unknown>;
};

function jsonHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function toLanguageType(language: string | null): string | undefined {
  if (!language) return undefined;
  const normalized = language.trim().toLowerCase();
  const map: Record<string, string> = {
    auto: "Auto",
    english: "English",
    chinese: "Chinese",
    german: "German",
    italian: "Italian",
    portuguese: "Portuguese",
    spanish: "Spanish",
    japanese: "Japanese",
    korean: "Korean",
    french: "French",
    russian: "Russian",
  };
  return map[normalized] ?? "Auto";
}

async function fetchJsonWithTimeout(
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
      throw providerTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function synthesizeQwenNonStreaming(params: {
  model: string;
  text: string;
  voice: string;
  language: string | null;
}) {
  const config = getQwenConfig();
  const url = `${config.baseUrl}${SYNTHESIS_PATH}`;

  const res = await fetchJsonWithTimeout(
    url,
    {
      method: "POST",
      headers: jsonHeaders(config.apiKey),
      body: JSON.stringify({
        model: params.model,
        input: {
          text: params.text,
          voice: params.voice,
          language_type: toLanguageType(params.language),
        },
      }),
    },
    90_000,
  );

  const body = (await res.json().catch(() => ({}))) as QwenSynthesisResponse;
  if (!res.ok) {
    throw providerErrorFromHttp({
      status: res.status,
      code: body.code,
      message: body.message,
      requestId: body.request_id,
      fallbackMessage: "Qwen synthesis request failed",
      details: { response: body },
    });
  }

  const audio = body.output?.audio;
  const audioUrl = typeof audio?.url === "string" ? audio.url : null;
  if (!audioUrl) {
    throw providerErrorFromHttp({
      status: 502,
      fallbackMessage: "Qwen synthesis response missing audio url",
      requestId: body.request_id,
      details: { response: body },
    });
  }

  return {
    requestId: body.request_id ?? null,
    audioUrl,
    audioId: typeof audio?.id === "string" ? audio.id : null,
    audioExpiresAt: typeof audio?.expires_at === "number"
      ? audio.expires_at
      : null,
    usage: body.usage ?? null,
  };
}
