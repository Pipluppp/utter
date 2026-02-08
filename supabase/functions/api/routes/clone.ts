import { Hono } from "npm:hono@4"

import { requireUser } from "../../_shared/auth.ts"
import { createAdminClient } from "../../_shared/supabase.ts"

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export const cloneRoutes = new Hono()

cloneRoutes.post("/clone/upload-url", async (c) => {
  let userId: string
  try {
    const { user } = await requireUser(c.req.raw)
    userId = user.id
  } catch (e) {
    if (e instanceof Response) return e
    return jsonDetail("Unauthorized", 401)
  }

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return jsonDetail("Invalid JSON body", 400)

  const name = normalizeString(body.name)
  const language = normalizeString(body.language)
  const transcript = normalizeString(body.transcript)
  const description = normalizeString(body.description)

  if (!name || name.length > 100) return jsonDetail("Name must be 1-100 characters.", 400)
  if (!language) return jsonDetail("Language is required.", 400)
  if (!transcript) return jsonDetail("Transcript is required.", 400)

  const voiceId = crypto.randomUUID()
  const objectKey = `${userId}/${voiceId}/reference.wav`

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from("references")
    .createSignedUploadUrl(objectKey)

  if (error || !data?.signedUrl) {
    return jsonDetail("Failed to create signed upload URL.", 500)
  }

  const proto =
    c.req.raw.headers.get("x-forwarded-proto") ??
    new URL(c.req.url).protocol.replace(":", "")
  const forwardedHost =
    c.req.raw.headers.get("x-forwarded-host") ??
    c.req.raw.headers.get("host") ??
    new URL(c.req.url).host
  const forwardedPort = c.req.raw.headers.get("x-forwarded-port")
  const host =
    !forwardedHost.includes(":") && forwardedPort
      ? `${forwardedHost}:${forwardedPort}`
      : forwardedHost
  const origin = `${proto}://${host}`
  const url = new URL(data.signedUrl)
  const publicUploadUrl = `${origin}${url.pathname}${url.search}`

  return c.json({
    voice_id: voiceId,
    upload_url: publicUploadUrl,
    object_key: objectKey,
  })
})

cloneRoutes.post("/clone/finalize", async (c) => {
  let userId: string
  try {
    const { user } = await requireUser(c.req.raw)
    userId = user.id
  } catch (e) {
    if (e instanceof Response) return e
    return jsonDetail("Unauthorized", 401)
  }

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return jsonDetail("Invalid JSON body", 400)

  const voiceId = normalizeString(body.voice_id)
  const name = normalizeString(body.name)
  const language = normalizeString(body.language)
  const transcript = normalizeString(body.transcript)
  const description = normalizeString(body.description)

  if (!voiceId) return jsonDetail("voice_id is required.", 400)
  if (!name || name.length > 100) return jsonDetail("Name must be 1-100 characters.", 400)
  if (!language) return jsonDetail("Language is required.", 400)
  if (!transcript) return jsonDetail("Transcript is required.", 400)

  const objectKey = `${userId}/${voiceId}/reference.wav`

  const admin = createAdminClient()
  const { data: listing, error: listError } = await admin.storage
    .from("references")
    .list(`${userId}/${voiceId}`, { limit: 100 })

  if (listError) return jsonDetail("Failed to verify uploaded audio.", 500)
  const hasReference = (listing ?? []).some((o) => o.name === "reference.wav")
  if (!hasReference) return jsonDetail("Audio file not uploaded.", 400)

  const { data, error } = await admin
    .from("voices")
    .insert({
      id: voiceId,
      user_id: userId,
      name,
      language,
      source: "uploaded",
      reference_object_key: objectKey,
      reference_transcript: transcript,
      description: description ?? null,
    })
    .select("id, name")
    .single()

  if (error || !data) {
    return jsonDetail("Failed to create voice.", 500)
  }

  return c.json({ id: data.id, name: data.name })
})
