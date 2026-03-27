import { envGet } from "../runtime_env.ts";
import type { QwenConfig, TtsProviderName } from "./types.ts";

/** Product-level cap on synthesis text length (characters). */
const MAX_TEXT_CHARS = 1000;
const DEFAULT_QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com";
const DEFAULT_QWEN_REGION = "intl";
const DEFAULT_QWEN_VC_TARGET_MODEL = "qwen3-tts-vc-2026-01-22";
const DEFAULT_QWEN_VD_TARGET_MODEL = "qwen3-tts-vd-2026-01-26";

function optionalEnv(name: string): string | null {
  const value = envGet(name)?.trim();
  return value ? value : null;
}

function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function isVoiceDesignEnabled(): boolean {
  const value = optionalEnv("VOICE_DESIGN_ENABLED");
  if (!value) return true;
  return value.toLowerCase() === "true";
}

export function getGenerateTextCapForMode(_mode: TtsProviderName): number {
  return MAX_TEXT_CHARS;
}

export function getQwenConfig(): QwenConfig {
  const baseUrl = optionalEnv("DASHSCOPE_BASE_URL") ?? DEFAULT_QWEN_BASE_URL;
  const regionRaw = optionalEnv("DASHSCOPE_REGION") ?? DEFAULT_QWEN_REGION;

  const region = regionRaw.toLowerCase() === "cn" ? "cn" : "intl";

  return {
    apiKey: requireEnv("DASHSCOPE_API_KEY"),
    baseUrl: baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl,
    region,
    vcTargetModel: optionalEnv("QWEN_VC_TARGET_MODEL") ?? DEFAULT_QWEN_VC_TARGET_MODEL,
    vdTargetModel: optionalEnv("QWEN_VD_TARGET_MODEL") ?? DEFAULT_QWEN_VD_TARGET_MODEL,
  };
}
