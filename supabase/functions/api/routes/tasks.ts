import { Hono } from "npm:hono@4"

import { requireUser } from "../../_shared/auth.ts"
import { createAdminClient, createUserClient } from "../../_shared/supabase.ts"
import {
  cancelJob,
  checkJobStatus,
  designVoicePreviewBytes,
  getJobResultBytes,
} from "../../_shared/modal.ts"

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export const tasksRoutes = new Hono()

function isTerminal(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled"
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 1000)
}

function publicizeSignedUrl(req: Request, signedUrl: string): string {
  const proto =
    req.headers.get("x-forwarded-proto") ??
    new URL(req.url).protocol.replace(":", "")
  const forwardedHost =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    new URL(req.url).host
  const forwardedPort = req.headers.get("x-forwarded-port")
  const host =
    !forwardedHost.includes(":") && forwardedPort
      ? `${forwardedHost}:${forwardedPort}`
      : forwardedHost
  const origin = `${proto}://${host}`
  const url = new URL(signedUrl)
  return `${origin}${url.pathname}${url.search}`
}

tasksRoutes.get("/tasks/:id", async (c) => {
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

  const taskId = c.req.param("id")
  const { data: task, error } = await supabase
    .from("tasks")
    .select(
      "id, type, status, result, error, modal_poll_count, modal_job_id, generation_id, created_at, metadata",
    )
    .eq("id", taskId)
    .maybeSingle()

  if (error) return jsonDetail("Failed to load task.", 500)
  if (!task) return jsonDetail("Task not found.", 404)

  const base = {
    id: (task as { id: string }).id,
    type: (task as { type: string }).type,
    status: (task as { status: string }).status,
    result: (task as { result: unknown }).result ?? undefined,
    error: (task as { error: string | null }).error ?? null,
    modal_status: null as string | null,
    modal_elapsed_seconds: null as number | null,
    modal_poll_count: (task as { modal_poll_count: number }).modal_poll_count ?? 0,
  }

  const status = base.status
  const type = base.type
  const modalJobId = (task as { modal_job_id: string | null }).modal_job_id
  const generationId = (task as { generation_id: string | null }).generation_id

  if (!isTerminal(status) && type === "design_preview" && !modalJobId) {
    const admin = createAdminClient()
    const claimed =
      status === "pending"
        ? await admin
          .from("tasks")
          .update({ status: "processing" })
          .eq("id", taskId)
          .eq("user_id", userId)
          .eq("status", "pending")
          .select("id")
          .maybeSingle()
        : { data: { id: taskId }, error: null }

    if (claimed.error) return jsonDetail("Failed to start design preview.", 500)
    if (!claimed.data) {
      base.status = "processing"
      base.modal_status = "processing"
      return c.json(base)
    }

    const { data: pollCount, error: pollError } = await admin.rpc(
      "increment_task_modal_poll_count",
      { p_task_id: taskId, p_user_id: userId },
    )
    if (!pollError && typeof pollCount === "number") base.modal_poll_count = pollCount

    const metadata = (task as { metadata: unknown }).metadata as
      | { text?: string; language?: string; instruct?: string }
      | null

    const text = typeof metadata?.text === "string" ? metadata.text.trim() : ""
    const language = typeof metadata?.language === "string"
      ? metadata.language.trim()
      : "English"
    const instruct = typeof metadata?.instruct === "string"
      ? metadata.instruct.trim()
      : ""

    if (!text || !instruct) {
      await admin
        .from("tasks")
        .update({
          status: "failed",
          error: "Invalid design preview task metadata.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("user_id", userId)

      base.status = "failed"
      base.error = "Invalid design preview task metadata."
      return c.json(base)
    }

    base.modal_status = "processing"

    let bytes: ArrayBuffer
    try {
      bytes = await designVoicePreviewBytes({ text, language, instruct })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to design voice preview."
      const nowIso = new Date().toISOString()
      await admin
        .from("tasks")
        .update({ status: "failed", error: message, completed_at: nowIso })
        .eq("id", taskId)
        .eq("user_id", userId)
      base.status = "failed"
      base.error = message
      return c.json(base)
    }

    const objectKey = `${userId}/preview_${taskId}.wav`
    const upload = await admin.storage
      .from("references")
      .upload(objectKey, new Uint8Array(bytes), {
        contentType: "audio/wav",
        upsert: true,
      })
    if (upload.error) return jsonDetail("Failed to upload preview audio.", 500)

    const { data: signed, error: signedError } = await admin.storage
      .from("references")
      .createSignedUrl(objectKey, 3600)
    if (signedError || !signed?.signedUrl) return jsonDetail("Failed to create signed URL.", 500)

    const publicUrl = publicizeSignedUrl(c.req.raw, signed.signedUrl)
    const nowIso = new Date().toISOString()
    await admin
      .from("tasks")
      .update({
        status: "completed",
        completed_at: nowIso,
        result: { audio_url: publicUrl },
        error: null,
      })
      .eq("id", taskId)
      .eq("user_id", userId)

    base.status = "completed"
    base.result = { audio_url: publicUrl }
    base.error = null
    base.modal_status = "completed"
    return c.json(base)
  }

  if (isTerminal(status) || !modalJobId) {
    if (status === "completed" && generationId) {
      base.result = {
        ...(typeof base.result === "object" && base.result ? base.result : {}),
        audio_url: `/api/generations/${generationId}/audio`,
      }
    }
    return c.json(base)
  }

  const admin = createAdminClient()
  const { data: pollCount, error: pollError } = await admin.rpc(
    "increment_task_modal_poll_count",
    { p_task_id: taskId, p_user_id: userId },
  )
  if (!pollError && typeof pollCount === "number") base.modal_poll_count = pollCount

  let modal
  try {
    modal = await checkJobStatus(modalJobId)
  } catch (e) {
    base.modal_status = "status_error"
    base.error = e instanceof Error ? e.message : "Failed to check job status."
    return c.json(base)
  }

  base.modal_status = modal.status ?? null
  base.modal_elapsed_seconds = typeof modal.elapsed_seconds === "number"
    ? modal.elapsed_seconds
    : null

  const modalStatus = (modal.status ?? "").toLowerCase()

  if (modalStatus === "failed") {
    const message = modal.error || "Generation failed. Please try again."
    const nowIso = new Date().toISOString()
    await admin
      .from("tasks")
      .update({ status: "failed", error: message, completed_at: nowIso })
      .eq("id", taskId)
      .eq("user_id", userId)

    if (generationId) {
      await admin
        .from("generations")
        .update({ status: "failed", error_message: message, completed_at: nowIso })
        .eq("id", generationId)
        .eq("user_id", userId)
    }

    base.status = "failed"
    base.error = message
    return c.json(base)
  }

  const ready = modalStatus === "completed" && Boolean(modal.result_ready)
  if (!ready || !generationId) {
    if (status !== "processing") {
      await admin
        .from("tasks")
        .update({ status: "processing" })
        .eq("id", taskId)
        .eq("user_id", userId)
    }
    base.status = "processing"
    return c.json(base)
  }

  const { data: gen, error: genError } = await admin
    .from("generations")
    .select("id, created_at, audio_object_key")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle()

  if (genError) return jsonDetail("Failed to load generation.", 500)
  if (!gen) return jsonDetail("Generation not found.", 404)

  const existingKey = (gen as { audio_object_key: string | null }).audio_object_key
  const objectKey = existingKey || `${userId}/${generationId}.wav`
  const now = new Date()
  const nowIso = now.toISOString()

  if (!existingKey) {
    let bytes: ArrayBuffer
    try {
      bytes = await getJobResultBytes(modalJobId)
    } catch (e) {
      base.status = "processing"
      base.modal_status = "finalizing"
      base.error = e instanceof Error ? e.message : null
      return c.json(base)
    }

    const uploadRes = await admin.storage
      .from("generations")
      .upload(objectKey, new Uint8Array(bytes), {
        contentType: "audio/wav",
        upsert: true,
      })
    if (uploadRes.error) return jsonDetail("Failed to upload generation audio.", 500)

    const createdAt = parseIsoDate((gen as { created_at: string | null }).created_at)
    const generationTimeSeconds = createdAt ? secondsBetween(createdAt, now) : null

    await admin
      .from("generations")
      .update({
        audio_object_key: objectKey,
        status: "completed",
        completed_at: nowIso,
        generation_time_seconds: generationTimeSeconds,
      })
      .eq("id", generationId)
      .eq("user_id", userId)
      .is("audio_object_key", null)
  }

  await admin
    .from("tasks")
    .update({
      status: "completed",
      completed_at: nowIso,
      result: { audio_url: `/api/generations/${generationId}/audio` },
      error: null,
    })
    .eq("id", taskId)
    .eq("user_id", userId)

  base.status = "completed"
  base.result = { audio_url: `/api/generations/${generationId}/audio` }
  base.error = null
  return c.json(base)
})

tasksRoutes.delete("/tasks/:id", async (c) => {
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

  const taskId = c.req.param("id")
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .maybeSingle()

  if (error) return jsonDetail("Failed to load task.", 500)
  if (!task) return jsonDetail("Task not found.", 404)

  const admin = createAdminClient()
  const { error: deleteError } = await admin
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId)

  if (deleteError) return jsonDetail("Failed to delete task.", 500)
  return c.json({ ok: true })
})

tasksRoutes.post("/tasks/:id/cancel", async (c) => {
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

  const taskId = c.req.param("id")
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, status, modal_job_id, generation_id, created_at")
    .eq("id", taskId)
    .maybeSingle()

  if (error) return jsonDetail("Failed to load task.", 500)
  if (!task) return jsonDetail("Task not found.", 404)

  const status = (task as { status: string }).status
  if (status !== "pending" && status !== "processing") {
    return jsonDetail(`Cannot cancel task with status: ${status}`, 400)
  }

  const modalJobId = (task as { modal_job_id: string | null }).modal_job_id
  if (modalJobId) await cancelJob(modalJobId)

  const admin = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()

  await admin
    .from("tasks")
    .update({ status: "cancelled", error: "Cancelled by user", completed_at: nowIso })
    .eq("id", taskId)
    .eq("user_id", userId)

  const generationId = (task as { generation_id: string | null }).generation_id
  if (generationId) {
    const createdAt = parseIsoDate((task as { created_at: string | null }).created_at)
    const generationTimeSeconds = createdAt ? secondsBetween(createdAt, now) : null
    await admin
      .from("generations")
      .update({
        status: "cancelled",
        error_message: "Cancelled by user",
        completed_at: nowIso,
        generation_time_seconds: generationTimeSeconds,
      })
      .eq("id", generationId)
      .eq("user_id", userId)
      .not("status", "in", "(completed,failed,cancelled)")
  }

  return c.json({ cancelled: true, task_id: taskId })
})
