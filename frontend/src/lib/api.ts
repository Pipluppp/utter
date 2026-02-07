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

  if (import.meta.env.DEV) {
    const debugUserId = (
      import.meta.env.VITE_DEBUG_USER_ID as string | undefined
    )
      ?.trim()
      .toLowerCase()
    const userId = debugUserId || session?.user?.id
    if (userId) headers['x-utter-user-id'] = userId
  }

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

  return (await res.json()) as T
}
