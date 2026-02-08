import { Hono } from "npm:hono@4"

import { requireUser } from "../../_shared/auth.ts"
import { createAdminClient, createUserClient } from "../../_shared/supabase.ts"

type Profile = {
  id: string
  handle: string | null
  display_name: string | null
  avatar_url: string | null
  subscription_tier: string
  credits_remaining: number
  created_at: string
  updated_at: string
}

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function validateHandle(handle: string | null | undefined): string | null | undefined {
  if (handle === undefined) return undefined
  if (handle === null) return null
  if (handle.length < 3 || handle.length > 30) return undefined
  if (!/^[A-Za-z0-9_]+$/.test(handle)) return undefined
  return handle
}

function validateDisplayName(displayName: string | null | undefined) {
  if (displayName === undefined) return undefined
  if (displayName === null) return null
  if (displayName.length < 1 || displayName.length > 100) return undefined
  return displayName
}

function validateAvatarUrl(avatarUrl: string | null | undefined) {
  if (avatarUrl === undefined) return undefined
  if (avatarUrl === null) return null
  try {
    new URL(avatarUrl)
    return avatarUrl
  } catch {
    return undefined
  }
}

export const meRoutes = new Hono()

meRoutes.get("/me", async (c) => {
  const authHeader = c.req.raw.headers.get("Authorization")
  if (!authHeader) {
    return c.json({ signed_in: false, user: null, profile: null })
  }

  let user: { id: string } | null = null
  try {
    const supabase = createUserClient(c.req.raw)
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      return c.json({ signed_in: false, user: null, profile: null })
    }
    user = { id: data.user.id }
  } catch {
    return c.json({ signed_in: false, user: null, profile: null })
  }

  const supabase = createUserClient(c.req.raw)
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, handle, display_name, avatar_url, subscription_tier, credits_remaining, created_at, updated_at",
    )
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    return jsonDetail("Failed to load profile.", 500)
  }

  if (profileRow) {
    return c.json({ signed_in: true, user, profile: profileRow as Profile })
  }

  const admin = createAdminClient()
  const { data: created, error: createError } = await admin
    .from("profiles")
    .insert({ id: user.id })
    .select(
      "id, handle, display_name, avatar_url, subscription_tier, credits_remaining, created_at, updated_at",
    )
    .single()

  if (createError) {
    return jsonDetail("Failed to create profile.", 500)
  }

  return c.json({ signed_in: true, user, profile: created as Profile })
})

meRoutes.patch("/profile", async (c) => {
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

  const nextHandle = validateHandle(normalizeNullableString(body.handle))
  if (body.handle !== undefined && nextHandle === undefined) {
    return jsonDetail(
      "Handle must be 3-30 chars and use only letters, numbers, and underscores.",
      400,
    )
  }

  const nextDisplayName = validateDisplayName(
    normalizeNullableString(body.display_name),
  )
  if (body.display_name !== undefined && nextDisplayName === undefined) {
    return jsonDetail("Display name must be 1-100 characters.", 400)
  }

  const nextAvatarUrl = validateAvatarUrl(normalizeNullableString(body.avatar_url))
  if (body.avatar_url !== undefined && nextAvatarUrl === undefined) {
    return jsonDetail("Avatar URL must be a valid URL or null.", 400)
  }

  const update: Record<string, unknown> = {}
  if (nextHandle !== undefined) update.handle = nextHandle
  if (nextDisplayName !== undefined) update.display_name = nextDisplayName
  if (nextAvatarUrl !== undefined) update.avatar_url = nextAvatarUrl

  if (Object.keys(update).length === 0) {
    return jsonDetail("No valid fields to update.", 400)
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("profiles")
    .update(update)
    .eq("id", userId)
    .select(
      "id, handle, display_name, avatar_url, subscription_tier, credits_remaining, created_at, updated_at",
    )
    .single()

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return jsonDetail("Handle is already taken.", 400)
    }
    return jsonDetail("Failed to update profile.", 500)
  }

  return c.json({ profile: data as Profile })
})
