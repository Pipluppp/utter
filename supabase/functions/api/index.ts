// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { Hono } from "npm:hono@4"

import { corsHeaders } from "../_shared/cors.ts"
import {
  resolveRateLimitActor,
  resolveRateLimitIdentity,
  resolveRateLimitTier,
  type RateLimitTier,
} from "../_shared/rate_limit.ts"
import { createAdminClient } from "../_shared/supabase.ts"

import { generationsRoutes } from "./routes/generations.ts"
import { cloneRoutes } from "./routes/clone.ts"
import { creditsRoutes } from "./routes/credits.ts"
import { designRoutes } from "./routes/design.ts"
import { generateRoutes } from "./routes/generate.ts"
import { languagesRoutes } from "./routes/languages.ts"
import { meRoutes } from "./routes/me.ts"
import { tasksRoutes } from "./routes/tasks.ts"
import { transcriptionsRoutes } from "./routes/transcriptions.ts"
import { voicesRoutes } from "./routes/voices.ts"

const app = new Hono().basePath("/api")
const admin = createAdminClient()

type RateLimitRpcRow = {
  allowed?: boolean
  current_count?: number
  limit_value?: number
  retry_after_seconds?: number
}

function asRateLimitRow(data: unknown): RateLimitRpcRow | null {
  if (Array.isArray(data)) return (data[0] ?? null) as RateLimitRpcRow | null
  if (data && typeof data === "object") return data as RateLimitRpcRow
  return null
}

function logSecurityEvent(payload: {
  request_id: string
  method: string
  path: string
  user_id: string | null
  ip_hash: string
  tier: RateLimitTier | null
  decision: string
  status_code: number
}) {
  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...payload,
  }))
}

app.options("*", (c) => {
  const origin = c.req.raw.headers.get("Origin")
  return c.body(null, 204, corsHeaders(origin))
})

app.use("*", async (c, next) => {
  await next()
  const origin = c.req.raw.headers.get("Origin")
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    c.header(key, value)
  }
})

app.use("*", async (c, next) => {
  const requestId = c.req.raw.headers.get("x-request-id")?.trim() || crypto.randomUUID()
  c.header("x-request-id", requestId)

  const method = c.req.method.toUpperCase()
  const path = c.req.path
  const tier = resolveRateLimitTier(method, path)

  if (!tier) {
    await next()
    return
  }

  const { userId, ipHash } = await resolveRateLimitIdentity(c.req.raw)
  const actor = resolveRateLimitActor(tier, userId, ipHash)

  const { data, error } = await admin.rpc("rate_limit_check_and_increment", {
    p_actor_type: actor.actorType,
    p_actor_key: actor.actorKey,
    p_tier: tier,
    p_limit: actor.limit,
    p_window_seconds: actor.windowSeconds,
  })

  if (error) {
    if (tier === "tier1") {
      const statusCode = 503
      logSecurityEvent({
        request_id: requestId,
        method,
        path,
        user_id: userId,
        ip_hash: ipHash,
        tier,
        decision: "error_deny",
        status_code: statusCode,
      })
      return c.json({ detail: "Rate limiter unavailable. Retry shortly." }, statusCode)
    }

    await next()
    logSecurityEvent({
      request_id: requestId,
      method,
      path,
      user_id: userId,
      ip_hash: ipHash,
      tier,
      decision: "error_allow",
      status_code: c.res.status,
    })
    return
  }

  const row = asRateLimitRow(data)
  if (!row || typeof row.allowed !== "boolean") {
    if (tier === "tier1") {
      const statusCode = 503
      logSecurityEvent({
        request_id: requestId,
        method,
        path,
        user_id: userId,
        ip_hash: ipHash,
        tier,
        decision: "error_deny",
        status_code: statusCode,
      })
      return c.json({ detail: "Rate limiter unavailable. Retry shortly." }, statusCode)
    }

    await next()
    logSecurityEvent({
      request_id: requestId,
      method,
      path,
      user_id: userId,
      ip_hash: ipHash,
      tier,
      decision: "error_allow",
      status_code: c.res.status,
    })
    return
  }

  const allowed = row.allowed
  const retryAfter = Math.max(
    1,
    Number.isFinite(row?.retry_after_seconds)
      ? Number(row?.retry_after_seconds)
      : actor.windowSeconds,
  )

  if (!allowed) {
    const statusCode = 429
    logSecurityEvent({
      request_id: requestId,
      method,
      path,
      user_id: userId,
      ip_hash: ipHash,
      tier,
      decision: "deny",
      status_code: statusCode,
    })
    return c.json({
      detail: "Rate limit exceeded. Please retry later.",
      retry_after_seconds: retryAfter,
    }, statusCode)
  }

  await next()

  logSecurityEvent({
    request_id: requestId,
    method,
    path,
    user_id: userId,
    ip_hash: ipHash,
    tier,
    decision: "allow",
    status_code: c.res.status,
  })
})

app.get("/health", (c) => c.json({ ok: true }))

app.route("/", languagesRoutes)
app.route("/", meRoutes)
app.route("/", cloneRoutes)
app.route("/", creditsRoutes)
app.route("/", voicesRoutes)
app.route("/", generateRoutes)
app.route("/", designRoutes)
app.route("/", transcriptionsRoutes)
app.route("/", generationsRoutes)
app.route("/", tasksRoutes)

Deno.serve(app.fetch)
