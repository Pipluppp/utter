export type ModalSubmitPayload = {
  text: string
  language: string
  ref_audio_base64: string
  ref_text: string
  max_new_tokens?: number
}

export type ModalSubmitResponse = {
  job_id: string
}

export type ModalStatusResponse = {
  job_id?: string
  status?: string
  result_ready?: boolean
  elapsed_seconds?: number
  error?: string
}

export type ModalVoiceDesignPayload = {
  text: string
  language: string
  instruct: string
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function optionalEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim()
  return value ? value : null
}

function jsonHeaders(extra: Record<string, string> = {}) {
  return { "Content-Type": "application/json", ...extra }
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

export async function submitJob(
  payload: ModalSubmitPayload,
): Promise<ModalSubmitResponse> {
  const endpoint = requireEnv("MODAL_JOB_SUBMIT")
  const res = await fetch(endpoint, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(
      `Modal submit failed (${res.status}): ${detail.slice(0, 300)}`,
    )
  }

  const data = (await res.json().catch(() => null)) as ModalSubmitResponse | null
  if (!data?.job_id) throw new Error("Modal submit returned no job_id")
  return data
}

export async function checkJobStatus(jobId: string): Promise<ModalStatusResponse> {
  const endpoint = requireEnv("MODAL_JOB_STATUS")
  const url = new URL(endpoint)
  url.searchParams.set("job_id", jobId)
  const res = await fetch(url)

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(
      `Modal status failed (${res.status}): ${detail.slice(0, 300)}`,
    )
  }

  return (await res.json()) as ModalStatusResponse
}

export async function getJobResultBytes(jobId: string): Promise<ArrayBuffer> {
  const endpoint = requireEnv("MODAL_JOB_RESULT")
  const url = new URL(endpoint)
  url.searchParams.set("job_id", jobId)
  const res = await fetch(url)

  if (res.status === 202) {
    throw new Error("Job still processing")
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(
      `Modal result failed (${res.status}): ${detail.slice(0, 300)}`,
    )
  }

  return await res.arrayBuffer()
}

export async function cancelJob(jobId: string): Promise<void> {
  const endpoint = optionalEnv("MODAL_JOB_CANCEL")
  if (!endpoint) return
  await fetch(endpoint, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ job_id: jobId }),
  }).catch(() => {})
}

export async function designVoicePreviewBytes(
  payload: ModalVoiceDesignPayload,
): Promise<ArrayBuffer> {
  const endpoint = requireEnv("MODAL_ENDPOINT_VOICE_DESIGN")

  const start = Date.now()
  const timeoutMs = 180_000

  const res = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
      redirect: "manual",
    },
    timeoutMs,
  )

  if (res.ok) return await res.arrayBuffer()

  const redirectStatuses = new Set([301, 302, 303, 307, 308])
  if (!redirectStatuses.has(res.status)) {
    const detail = await res.text().catch(() => "")
    throw new Error(
      `Modal voice design failed (${res.status}): ${detail.slice(0, 300)}`,
    )
  }

  const location = res.headers.get("location")
  if (!location) throw new Error("Modal voice design redirect missing location")
  let pollUrl = new URL(location, endpoint).toString()

  let sleepMs = 1000
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, sleepMs))
    sleepMs = Math.min(10_000, Math.floor(sleepMs * 1.5))

    const pollRes = await fetchWithTimeout(pollUrl, { method: "GET" }, 60_000)

    if (pollRes.ok) return await pollRes.arrayBuffer()

    if (redirectStatuses.has(pollRes.status)) {
      const next = pollRes.headers.get("location")
      if (next) pollUrl = new URL(next, pollUrl).toString()
      continue
    }

    if (pollRes.status === 202) continue

    const detail = await pollRes.text().catch(() => "")
    throw new Error(
      `Modal voice design poll failed (${pollRes.status}): ${detail.slice(0, 300)}`,
    )
  }

  throw new Error("Modal voice design timed out")
}
