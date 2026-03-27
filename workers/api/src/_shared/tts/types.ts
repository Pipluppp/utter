export type TtsProviderName = "qwen";

export type ProviderErrorCategory =
  | "validation"
  | "provider_unavailable"
  | "provider_rejected"
  | "timeout"
  | "cancelled"
  | "unknown";

export type QwenConfig = {
  apiKey: string;
  baseUrl: string;
  region: "intl" | "cn";
  vcTargetModel: string;
  vdTargetModel: string;
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
