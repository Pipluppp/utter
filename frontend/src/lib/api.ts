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

export async function apiJson<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init
  const res = await fetch(path, {
    ...rest,
    headers: {
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
  const res = await fetch(path, {
    ...init,
    method: init.method ?? 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status)
  }

  return (await res.json()) as T
}
