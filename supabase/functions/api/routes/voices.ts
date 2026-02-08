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

export const voicesRoutes = new Hono()

voicesRoutes.get("/voices", async (c) => {
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
  const source = c.req.query("source")
  const sourceFilter =
    source === "uploaded" || source === "designed" ? source : null

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let q = supabase
    .from("voices")
    .select(
      "id, name, reference_transcript, language, source, description, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to)

  if (search) q = q.ilike("name", `%${search}%`)
  if (sourceFilter) q = q.eq("source", sourceFilter)

  const { data, error, count } = await q
  if (error) return jsonDetail("Failed to load voices.", 500)

  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / perPage))

  return c.json({
    voices: data ?? [],
    pagination: { page, per_page: perPage, total, pages },
  })
})

voicesRoutes.get("/voices/:id/preview", async (c) => {
  let supabase: ReturnType<typeof createUserClient>
  try {
    ;({ supabase } = await requireUser(c.req.raw))
  } catch (e) {
    if (e instanceof Response) return e
    return jsonDetail("Unauthorized", 401)
  }

  const voiceId = c.req.param("id")
  const { data: voice, error } = await supabase
    .from("voices")
    .select("id, reference_object_key")
    .eq("id", voiceId)
    .maybeSingle()

  if (error) return jsonDetail("Failed to load voice.", 500)
  if (!voice) return jsonDetail("Voice not found.", 404)
  const key = (voice as { reference_object_key: string | null }).reference_object_key
  if (!key) return jsonDetail("Voice has no reference audio.", 404)

  const admin = createAdminClient()
  const { data: signed, error: signedError } = await admin.storage
    .from("references")
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

voicesRoutes.delete("/voices/:id", async (c) => {
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

  const voiceId = c.req.param("id")
  const { data: voice, error } = await supabase
    .from("voices")
    .select("id, reference_object_key")
    .eq("id", voiceId)
    .maybeSingle()

  if (error) return jsonDetail("Failed to load voice.", 500)
  if (!voice) return jsonDetail("Voice not found.", 404)

  const refKey = (voice as { reference_object_key: string | null }).reference_object_key
  const admin = createAdminClient()

  if (refKey) {
    await admin.storage.from("references").remove([refKey])
  }

  const { error: deleteError } = await admin
    .from("voices")
    .delete()
    .eq("id", voiceId)
    .eq("user_id", userId)

  if (deleteError) return jsonDetail("Failed to delete voice.", 500)

  return c.json({ ok: true })
})
