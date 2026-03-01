import { providerErrorFromHttp, providerTimeoutError } from "./errors.ts";

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
      throw providerTimeoutError("Audio download timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadQwenAudioWithRetry(params: {
  url: string;
  retries?: number;
}) {
  const maxRetries = Math.max(0, params.retries ?? 2);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(
        params.url,
        { method: "GET" },
        60_000,
      );

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");

        if (res.status >= 500 && attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, 300 * (attempt + 1))
          );
          continue;
        }

        throw providerErrorFromHttp({
          status: res.status,
          fallbackMessage: "Failed to download provider audio",
          message: bodyText.slice(0, 300) || undefined,
        });
      }

      const bytes = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "audio/wav";
      return { bytes, contentType };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 300 * (attempt + 1))
        );
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}
