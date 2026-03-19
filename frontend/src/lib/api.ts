import { tryRefreshAuthSession } from "./auth";

export type ApiErrorShape = {
  detail?: string;
  message?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await res.json().catch(() => null)) as ApiErrorShape | null;
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
  }
  const text = await res.text().catch(() => "");
  return text || `${res.status} ${res.statusText}`;
}

async function withRefreshRetry(runRequest: () => Promise<Response>): Promise<Response> {
  let response = await runRequest();
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await tryRefreshAuthSession();
  if (!refreshed) {
    return response;
  }

  response = await runRequest();
  return response;
}

export async function apiJson<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const body = json ? JSON.stringify(json) : rest.body;
  const requestHeaders: HeadersInit = {
    ...(json ? { "content-type": "application/json" } : {}),
    ...headers,
  };

  const runRequest = () =>
    fetch(path, {
      ...rest,
      body,
      credentials: "same-origin",
      headers: requestHeaders,
    });

  const res = await withRefreshRetry(runRequest);

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new ApiError("Server returned non-JSON response", res.status);
  }

  return (await res.json()) as T;
}

export async function apiForm<T>(path: string, form: FormData, init: RequestInit = {}): Promise<T> {
  const requestHeaders: HeadersInit = {
    ...init.headers,
  };

  const runRequest = () =>
    fetch(path, {
      ...init,
      credentials: "same-origin",
      method: init.method ?? "POST",
      headers: requestHeaders,
      body: form,
    });

  const res = await withRefreshRetry(runRequest);

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new ApiError("Server returned non-JSON response", res.status);
  }

  return (await res.json()) as T;
}

export async function apiRedirectUrl(path: string): Promise<string> {
  const runRequest = () =>
    fetch(path, {
      credentials: "same-origin",
      method: "GET",
      redirect: "follow",
    });

  const res = await withRefreshRetry(runRequest);

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  await res.body?.cancel().catch(() => {});

  return res.url || path;
}
