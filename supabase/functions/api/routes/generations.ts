import { Hono } from "npm:hono@4"

import { requireUser } from "../../_shared/auth.ts"
import { createAdminClient, createUserClient } from "../../_shared/supabase.ts"

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number(value ?? "")
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.floor(n)
}

export const generationsRoutes = new Hono()

generationsRoutes.get("/generations", async (c) => {
  let supabase: ReturnType<typeof createUserClient>
  try {
    ;({ supabase } = await requireUser(c.req.raw))
  } catch (e) {
    if (e instanceof Response) return e
    return jsonDetail("Unauthorized", 401)
  }

  const page = parsePositiveInt(c.req.query("page") ?? null, 1)
  const perPage = Math.min(100, parsePositiveInt(c.req.query("per_page") ?? null, 20))
  const search = (c.req.query("search") ?? "").trim()
  const status = (c.req.query("status") ?? "").trim()
  const statusFilter = status && status !== "all" ? status : null

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let q = supabase
    .from("generations")
    .select(
      "id, voice_id, text, duration_seconds, language, status, generation_time_seconds, error_message, created_at, voices(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to)

  if (search) q = q.ilike("text", `%${search}%`)
  if (statusFilter) q = q.eq("status", statusFilter)

  const { data, error, count } = await q
  if (error) return jsonDetail("Failed to load generations.", 500)

  const generations = (data ?? []).map((row) => {
    const voices = (row as unknown as { voices?: { name?: string } | null }).voices
    return {
      id: (row as { id: string }).id,
      voice_id: (row as { voice_id: string }).voice_id,
      voice_name: voices?.name ?? null,
      text: (row as { text: string }).text,
      audio_path: `/api/generations/${(row as { id: string }).id}/audio`,
      duration_seconds: (row as { duration_seconds: number | null }).duration_seconds,
      language: (row as { language: string }).language,
      status: (row as { status: string }).status,
      generation_time_seconds:
        (row as { generation_time_seconds: number | null }).generation_time_seconds,
      error_message: (row as { error_message: string | null }).error_message,
      created_at: (row as { created_at: string | null }).created_at,
    }
  })

  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / perPage))

  return c.json({
    generations,
    pagination: { page, per_page: perPage, total, pages },
  })
})

generationsRoutes.get("/generations/:id/audio", async (c) => {
  let supabase: ReturnType<typeof createUserClient>
  try {
    ;({ supabase } = await requireUser(c.req.raw))
  } catch (e) {
    if (e instanceof Response) return e
    return jsonDetail("Unauthorized", 401)
  }

  const generationId = c.req.param("id")
  const { data: gen, error } = await supabase
    .from("generations")
    .select("id, audio_object_key")
    .eq("id", generationId)
    .maybeSingle()

  if (error) return jsonDetail("Failed to load generation.", 500)
  if (!gen) return jsonDetail("Generation not found.", 404)
  const key = (gen as { audio_object_key: string | null }).audio_object_key
  if (!key) return jsonDetail("Generation audio not available.", 404)

  const admin = createAdminClient()
  const { data: signed, error: signedError } = await admin.storage
    .from("generations")
    .createSignedUrl(key, 3600)

  if (signedError || !signed?.signedUrl) {
    return jsonDetail("Failed to create signed URL.", 500)
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
  const url = new URL(signed.signedUrl)
  const publicUrl = `${origin}${url.pathname}${url.search}`
  return c.redirect(publicUrl, 302)
})

generationsRoutes.delete("/generations/:id", async (c) => {
  let userId: string
  let supabase: ReturnType<typeof createUserClient>
  try {
    const { user, supabase: userClient } = await requireUser(c.req.raw)
    userId = user.id
    supabase = userClient
  } catch (e) {
    if (e instanceof Response) return e
    return jsonDetail("Unauthorized", 401)
  }

  const generationId = c.req.param("id")
  const { data: gen, error } = await supabase
    .from("generations")
    .select("id, audio_object_key")
    .eq("id", generationId)
    .maybeSingle()

  if (error) return jsonDetail("Failed to load generation.", 500)
  if (!gen) return jsonDetail("Generation not found.", 404)

  const key = (gen as { audio_object_key: string | null }).audio_object_key
  const admin = createAdminClient()
  if (key) {
    await admin.storage.from("generations").remove([key])
  }

  const { error: deleteError } = await admin
    .from("generations")
    .delete()
    .eq("id", generationId)
    .eq("user_id", userId)

  if (deleteError) return jsonDetail("Failed to delete generation.", 500)
  return c.json({ ok: true })
})

generationsRoutes.post("/generations/:id/regenerate", async (c) => {
  let supabase: ReturnType<typeof createUserClient>
  try {
    ;({ supabase } = await requireUser(c.req.raw))
  } catch (e) {
    if (e instanceof Response) return e
    return jsonDetail("Unauthorized", 401)
  }

  const generationId = c.req.param("id")
  const { data: gen, error } = await supabase
    .from("generations")
    .select("id, voice_id, text, language")
    .eq("id", generationId)
    .maybeSingle()

  if (error) return jsonDetail("Failed to load generation.", 500)
  if (!gen) return jsonDetail("Generation not found", 404)

  const voiceId = (gen as { voice_id: string | null }).voice_id
  if (!voiceId) return jsonDetail("Generation has no voice_id.", 400)

  const text = (gen as { text: string }).text
  const language = (gen as { language: string }).language

  const redirectUrl = `/generate?voice=${voiceId}&text=${encodeURIComponent(text)}&language=${encodeURIComponent(language)}`

  return c.json({
    voice_id: voiceId,
    text,
    language,
    redirect_url: redirectUrl,
  })
})
