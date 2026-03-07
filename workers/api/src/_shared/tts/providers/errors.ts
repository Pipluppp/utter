import {
  ProviderError,
  type ProviderErrorCategory,
  type ProviderErrorInfo,
} from "../types.ts";

function categoryFromStatus(status: number): ProviderErrorCategory {
  if (status === 400 || status === 404 || status === 409 || status === 422) {
    return "validation";
  }
  if (status === 401 || status === 403) return "provider_rejected";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429 || status >= 500) return "provider_unavailable";
  return "unknown";
}

export function providerErrorFromHttp(params: {
  status: number;
  code?: string;
  message?: string;
  requestId?: string;
  fallbackMessage: string;
  details?: Record<string, unknown>;
}): ProviderError {
  const safeMessage = params.message?.trim() || params.fallbackMessage;
  return new ProviderError({
    category: categoryFromStatus(params.status),
    status: params.status,
    code: params.code,
    requestId: params.requestId,
    safeMessage,
    details: params.details,
  });
}

export function providerTimeoutError(
  message = "Provider request timed out",
): ProviderError {
  return new ProviderError({
    category: "timeout",
    safeMessage: message,
  });
}

export function normalizeProviderError(error: unknown): ProviderErrorInfo {
  if (error instanceof ProviderError) return error.info;

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      category: "timeout",
      safeMessage: "Provider request timed out",
    };
  }

  if (error instanceof Error) {
    return {
      category: "unknown",
      safeMessage: error.message || "Provider request failed",
    };
  }

  return {
    category: "unknown",
    safeMessage: "Provider request failed",
  };
}

export function providerDetailMessage(info: ProviderErrorInfo): string {
  switch (info.category) {
    case "validation":
      return info.safeMessage || "Provider rejected request input";
    case "provider_rejected":
      return info.safeMessage || "Provider rejected the request";
    case "provider_unavailable":
      return "Provider is temporarily unavailable. Please try again.";
    case "timeout":
      return "Provider request timed out. Please try again.";
    case "cancelled":
      return "Cancelled by user";
    default:
      return info.safeMessage || "Provider request failed";
  }
}
