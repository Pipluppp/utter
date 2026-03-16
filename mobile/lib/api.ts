import { getAccessToken, refreshAccessToken } from './supabase';
import { API_BASE_URL } from './constants';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ApiErrorShape = { detail?: string; message?: string };

async function parseErrorMessage(res: Response): Promise<string> {
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const data = (await res.json().catch(() => null)) as ApiErrorShape | null;
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
  }
  const text = await res.text().catch(() => '');
  return text || `${res.status} ${res.statusText}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function withToken(
  headers: Record<string, string>,
  token: string | null,
): Record<string, string> {
  if (!token) return headers;
  return { ...headers, Authorization: `Bearer ${token}` };
}

/**
 * JSON API call with bearer token + 401 retry.
 * Paths should start with /api/ (same as web frontend).
 */
export async function apiJson<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers: extraHeaders, ...rest } = init;
  const auth = await authHeaders();

  const buildHeaders = (base: Record<string, string>) => ({
    ...base,
    ...(json ? { 'content-type': 'application/json' } : {}),
    ...(extraHeaders as Record<string, string>),
  });

  const doFetch = (h: Record<string, string>) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: buildHeaders(h),
      body: json ? JSON.stringify(json) : rest.body,
    });

  let res = await doFetch(auth);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch(withToken(auth, refreshed));
    }
  }

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new ApiError('Server returned non-JSON response', res.status);
  }

  return (await res.json()) as T;
}

/**
 * Fetch a URL that may redirect (e.g., signed audio URL).
 * Returns the final resolved URL string.
 */
export async function apiRedirectUrl(path: string): Promise<string> {
  const auth = await authHeaders();

  const doFetch = (h: Record<string, string>) =>
    fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      redirect: 'follow',
      headers: h,
    });

  let res = await doFetch(auth);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch(withToken(auth, refreshed));
    }
  }

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  return res.url || `${API_BASE_URL}${path}`;
}

/**
 * FormData upload with bearer token + 401 retry.
 */
export async function apiForm<T>(
  path: string,
  body: FormData,
  init: RequestInit = {},
): Promise<T> {
  const { headers: extraHeaders, ...rest } = init;
  const auth = await authHeaders();

  const buildHeaders = (base: Record<string, string>) => ({
    ...base,
    ...(extraHeaders as Record<string, string>),
  });

  const doFetch = (h: Record<string, string>) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: buildHeaders(h),
      body,
    });

  let res = await doFetch(auth);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch(withToken(auth, refreshed));
    }
  }

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  return (await res.json()) as T;
}
