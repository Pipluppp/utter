export type TtsProviderName = "modal" | "qwen";

export type ProviderErrorCategory =
  | "validation"
  | "provider_unavailable"
  | "provider_rejected"
  | "timeout"
  | "cancelled"
  | "unknown";

export type GenerateMode = "task";

export type TtsCapabilities = {
  supports_generate: boolean;
  supports_generate_stream: boolean;
  default_generate_mode: GenerateMode;
  allow_generate_mode_toggle: boolean;
  max_text_chars: number;
};

export type QwenConfig = {
  apiKey: string;
  baseUrl: string;
  region: "intl" | "cn";
  vcTargetModel: string;
  vdTargetModel: string;
  maxTextChars: number;
};

export type ProviderErrorInfo = {
  category: ProviderErrorCategory;
  status?: number;
  code?: string;
  requestId?: string;
  safeMessage: string;
  details?: Record<string, unknown>;
};

export class ProviderError extends Error {
  readonly info: ProviderErrorInfo;

  constructor(info: ProviderErrorInfo) {
    super(info.safeMessage);
    this.name = "ProviderError";
    this.info = info;
  }
}
