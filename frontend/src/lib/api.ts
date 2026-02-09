import { getSession } from './supabase'

export type ApiErrorShape = {
  detail?: string
  message?: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const data = (await res.json().catch(() => null)) as ApiErrorShape | null
    if (data?.detail) return data.detail
    if (data?.message) return data.message
  }
  const text = await res.text().catch(() => '')
  return text || `${res.status} ${res.statusText}`
}

async function getDefaultAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession()
  const accessToken = session?.access_token ?? null
  const headers: Record<string, string> = {}

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  return headers
}

export async function apiJson<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init
  const authHeaders = await getDefaultAuthHeaders()
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...authHeaders,
      ...(json ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : rest.body,
  })

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status)
  }

  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    throw new ApiError('Server returned non-JSON response', res.status)
  }

  return (await res.json()) as T
}

export async function apiForm<T>(
  path: string,
  form: FormData,
  init: RequestInit = {},
): Promise<T> {
  const authHeaders = await getDefaultAuthHeaders()
  const res = await fetch(path, {
    ...init,
    method: init.method ?? 'POST',
    headers: {
      ...authHeaders,
      ...(init.headers ?? {}),
    },
    body: form,
  })

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status)
  }

  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    throw new ApiError('Server returned non-JSON response', res.status)
  }

  return (await res.json()) as T
}

export async function apiRedirectUrl(path: string): Promise<string> {
  const authHeaders = await getDefaultAuthHeaders()
  const res = await fetch(path, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      ...authHeaders,
    },
  })

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status)
  }

  // We only need the final resolved URL (typically a signed Storage URL).
  // Cancel any body stream so this probe doesn't download audio bytes.
  await res.body?.cancel().catch(() => {})

  return res.url || path
}
