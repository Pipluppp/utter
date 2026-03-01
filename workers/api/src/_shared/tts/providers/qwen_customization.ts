import { getQwenConfig } from "../provider.ts";
import { providerErrorFromHttp, providerTimeoutError } from "./errors.ts";

const CUSTOMIZATION_PATH = "/api/v1/services/audio/tts/customization";

type QwenCustomizationResponse = {
  output?: Record<string, unknown>;
  usage?: Record<string, unknown>;
  request_id?: string;
  code?: string;
  message?: string;
};

function jsonHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
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

function toQwenLanguageTag(language: string | null): string | undefined {
  if (!language) return undefined;
  const normalized = language.trim().toLowerCase();
  const map: Record<string, string> = {
    auto: "en",
    english: "en",
    chinese: "zh",
    german: "de",
    italian: "it",
    portuguese: "pt",
    spanish: "es",
    japanese: "ja",
    korean: "ko",
    french: "fr",
    russian: "ru",
  };
  return map[normalized] ?? undefined;
}

function sanitizePreferredName(value: string, fallback: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 16);
  if (cleaned.length >= 3) return cleaned;
  return fallback.slice(0, 16);
}

async function callCustomization(payload: Record<string, unknown>) {
  const config = getQwenConfig();
  const url = `${config.baseUrl}${CUSTOMIZATION_PATH}`;

  const res = await fetchJsonWithTimeout(
    url,
    {
      method: "POST",
      headers: jsonHeaders(config.apiKey),
      body: JSON.stringify(payload),
    },
    90_000,
  );

  const body =
    (await res.json().catch(() => ({}))) as QwenCustomizationResponse;
  if (!res.ok) {
    throw providerErrorFromHttp({
      status: res.status,
      code: body.code,
      message: body.message,
      requestId: body.request_id,
      fallbackMessage: "Qwen customization request failed",
      details: { response: body },
    });
  }

  return body;
}

export async function createQwenCloneVoice(params: {
  preferredName: string;
  referenceAudioUrl: string;
  transcript: string | null;
  language: string | null;
}) {
  const config = getQwenConfig();
  const fallbackName = `clone_${crypto.randomUUID().slice(0, 8)}`;

  const response = await callCustomization({
    model: "qwen-voice-enrollment",
    input: {
      action: "create",
      target_model: config.vcTargetModel,
      preferred_name: sanitizePreferredName(params.preferredName, fallbackName),
      audio: { data: params.referenceAudioUrl },
      text: params.transcript ?? undefined,
      language: toQwenLanguageTag(params.language),
    },
  });

  const output = response.output ?? {};
  const providerVoiceId = typeof output.voice === "string"
    ? output.voice
    : null;
  const targetModel = typeof output.target_model === "string"
    ? output.target_model
    : null;

  if (!providerVoiceId || !targetModel) {
    throw providerErrorFromHttp({
      status: 502,
      fallbackMessage: "Qwen clone response missing voice metadata",
      requestId: response.request_id,
      details: { response },
    });
  }

  return {
    providerVoiceId,
    targetModel,
    requestId: response.request_id ?? null,
    usage: response.usage ?? null,
  };
}

export async function createQwenDesignedVoice(params: {
  preferredName: string;
  voicePrompt: string;
  previewText: string;
  language: string | null;
}) {
  const config = getQwenConfig();
  const fallbackName = `design_${crypto.randomUUID().slice(0, 8)}`;

  const response = await callCustomization({
    model: "qwen-voice-design",
    input: {
      action: "create",
      target_model: config.vdTargetModel,
      voice_prompt: params.voicePrompt,
      preview_text: params.previewText,
      preferred_name: sanitizePreferredName(params.preferredName, fallbackName),
      language: toQwenLanguageTag(params.language) ?? "en",
    },
    parameters: {
      sample_rate: 24000,
      response_format: "wav",
    },
  });

  const output = response.output ?? {};
  const providerVoiceId = typeof output.voice === "string"
    ? output.voice
    : null;
  const targetModel = typeof output.target_model === "string"
    ? output.target_model
    : null;

  const previewAudio = (typeof output.preview_audio === "object" &&
      output.preview_audio)
    ? output.preview_audio as Record<string, unknown>
    : {};

  const previewData = typeof previewAudio.data === "string"
    ? previewAudio.data
    : null;

  if (!providerVoiceId || !targetModel || !previewData) {
    throw providerErrorFromHttp({
      status: 502,
      fallbackMessage: "Qwen design response missing required fields",
      requestId: response.request_id,
      details: { response },
    });
  }

  return {
    providerVoiceId,
    targetModel,
    requestId: response.request_id ?? null,
    usage: response.usage ?? null,
    previewAudioData: previewData,
    previewSampleRate: typeof previewAudio.sample_rate === "number"
      ? previewAudio.sample_rate
      : null,
    previewResponseFormat: typeof previewAudio.response_format === "string"
      ? previewAudio.response_format
      : "wav",
  };
}

export function decodeBase64Audio(data: string): Uint8Array {
  const base64 = data.startsWith("data:") ? (data.split(",")[1] ?? "") : data;
  const normalized = base64.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
