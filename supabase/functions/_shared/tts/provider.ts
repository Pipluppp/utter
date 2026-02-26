import type { QwenConfig, TtsCapabilities, TtsProviderName } from "./types.ts";

const DEFAULT_MODAL_MAX_TEXT_CHARS = 10000;
const DEFAULT_QWEN_MAX_TEXT_CHARS = 600;
const DEFAULT_QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com";
const DEFAULT_QWEN_REGION = "intl";
const DEFAULT_QWEN_VC_TARGET_MODEL = "qwen3-tts-vc-2026-01-22";
const DEFAULT_QWEN_VD_TARGET_MODEL = "qwen3-tts-vd-2026-01-26";

function optionalEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value ? value : null;
}

function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function getTtsProviderMode(): TtsProviderName {
  const raw = optionalEnv("TTS_PROVIDER_MODE");
  if (!raw) return "modal";

  const normalized = raw.toLowerCase();
  if (normalized === "modal" || normalized === "qwen") {
    return normalized;
  }

  throw new Error(
    `Invalid TTS_PROVIDER_MODE: ${raw}. Expected one of: modal, qwen`,
  );
}

export function getGenerateTextCapForMode(mode: TtsProviderName): number {
  if (mode === "qwen") {
    return parsePositiveInt(
      optionalEnv("QWEN_MAX_TEXT_CHARS"),
      DEFAULT_QWEN_MAX_TEXT_CHARS,
    );
  }
  return DEFAULT_MODAL_MAX_TEXT_CHARS;
}

export function getTtsCapabilities(
  mode = getTtsProviderMode(),
): TtsCapabilities {
  return {
    supports_generate: true,
    supports_generate_stream: false,
    default_generate_mode: "task",
    allow_generate_mode_toggle: false,
    max_text_chars: getGenerateTextCapForMode(mode),
  };
}

export function getQwenConfig(): QwenConfig {
  const baseUrl = optionalEnv("DASHSCOPE_BASE_URL") ?? DEFAULT_QWEN_BASE_URL;
  const regionRaw = optionalEnv("DASHSCOPE_REGION") ?? DEFAULT_QWEN_REGION;

  const region = regionRaw.toLowerCase() === "cn" ? "cn" : "intl";

  return {
    apiKey: requireEnv("DASHSCOPE_API_KEY"),
    baseUrl: baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl,
    region,
    vcTargetModel: optionalEnv("QWEN_VC_TARGET_MODEL") ??
      DEFAULT_QWEN_VC_TARGET_MODEL,
    vdTargetModel: optionalEnv("QWEN_VD_TARGET_MODEL") ??
      DEFAULT_QWEN_VD_TARGET_MODEL,
    maxTextChars: parsePositiveInt(
      optionalEnv("QWEN_MAX_TEXT_CHARS"),
      DEFAULT_QWEN_MAX_TEXT_CHARS,
    ),
  };
}
