export type RateLimitTier = "tier1" | "tier2" | "tier3"
export type RateLimitActorType = "user" | "ip"

type RateLimitRule = {
  userLimit: number | null
  ipLimit: number
  windowSeconds: number
}

type EndpointRule = {
  method: string
  pattern: RegExp
  tier: RateLimitTier
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const endpointRules: EndpointRule[] = [
  { method: "POST", pattern: /^\/api\/generate$/, tier: "tier1" },
  { method: "POST", pattern: /^\/api\/clone\/upload-url$/, tier: "tier1" },
  { method: "POST", pattern: /^\/api\/clone\/finalize$/, tier: "tier1" },
  { method: "POST", pattern: /^\/api\/voices\/design\/preview$/, tier: "tier1" },
  { method: "POST", pattern: /^\/api\/voices\/design$/, tier: "tier1" },
  { method: "POST", pattern: /^\/api\/transcriptions$/, tier: "tier1" },
  { method: "GET", pattern: /^\/api\/tasks\/[^/]+$/, tier: "tier2" },
  { method: "POST", pattern: /^\/api\/tasks\/[^/]+\/cancel$/, tier: "tier2" },
  { method: "DELETE", pattern: /^\/api\/tasks\/[^/]+$/, tier: "tier2" },
]

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name)?.trim()
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

const defaultWindowSeconds = parsePositiveIntEnv("RATE_LIMIT_WINDOW_SECONDS", 300)

const tierRules: Record<RateLimitTier, RateLimitRule> = {
  tier1: {
    userLimit: parsePositiveIntEnv("RATE_LIMIT_TIER1_USER_LIMIT", 20),
    ipLimit: parsePositiveIntEnv("RATE_LIMIT_TIER1_IP_LIMIT", 120),
    windowSeconds: parsePositiveIntEnv("RATE_LIMIT_TIER1_WINDOW_SECONDS", defaultWindowSeconds),
  },
  tier2: {
    userLimit: parsePositiveIntEnv("RATE_LIMIT_TIER2_USER_LIMIT", 90),
    ipLimit: parsePositiveIntEnv("RATE_LIMIT_TIER2_IP_LIMIT", 180),
    windowSeconds: parsePositiveIntEnv("RATE_LIMIT_TIER2_WINDOW_SECONDS", defaultWindowSeconds),
  },
  tier3: {
    userLimit: null,
    ipLimit: parsePositiveIntEnv("RATE_LIMIT_TIER3_IP_LIMIT", 300),
    windowSeconds: parsePositiveIntEnv("RATE_LIMIT_TIER3_WINDOW_SECONDS", defaultWindowSeconds),
  },
}

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    return atob(padded)
  } catch {
    return null
  }
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !token) return null
  return token.trim()
}

function readClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const candidate = forwardedFor.split(",")[0]?.trim()
    if (candidate) return candidate
  }

  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-client-ip"),
  ]
  for (const candidate of candidates) {
    if (candidate?.trim()) return candidate.trim()
  }

  return "unknown"
}

export function resolveRateLimitTier(method: string, path: string): RateLimitTier | null {
  const normalizedMethod = method.toUpperCase()
  if (normalizedMethod === "OPTIONS") return null
  if (path === "/api/health") return null

  for (const rule of endpointRules) {
    if (rule.method !== normalizedMethod) continue
    if (rule.pattern.test(path)) return rule.tier
  }

  if (path.startsWith("/api/")) return "tier3"
  return null
}

export function getRateLimitRule(tier: RateLimitTier): RateLimitRule {
  return tierRules[tier]
}

export function extractJwtUserId(authHeader: string | null): string | null {
  const token = extractBearerToken(authHeader)
  if (!token) return null
  const parts = token.split(".")
  if (parts.length < 2) return null

  const decoded = decodeBase64Url(parts[1])
  if (!decoded) return null

  try {
    const payload = JSON.parse(decoded) as { sub?: unknown }
    const sub = typeof payload.sub === "string" ? payload.sub : null
    if (!sub || !UUID_REGEX.test(sub)) return null
    return sub
  } catch {
    return null
  }
}

export async function hashSha256(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function resolveRateLimitIdentity(req: Request): Promise<{
  userId: string | null
  ipHash: string
}> {
  const userId = extractJwtUserId(req.headers.get("authorization"))
  const clientIp = readClientIp(req)
  const ipHash = await hashSha256(clientIp)
  return { userId, ipHash }
}

export function resolveRateLimitActor(
  tier: RateLimitTier,
  userId: string | null,
  ipHash: string,
): {
  actorType: RateLimitActorType
  actorKey: string
  limit: number
  windowSeconds: number
} {
  const rule = getRateLimitRule(tier)
  if (userId && rule.userLimit) {
    return {
      actorType: "user",
      actorKey: userId,
      limit: rule.userLimit,
      windowSeconds: rule.windowSeconds,
    }
  }

  return {
    actorType: "ip",
    actorKey: ipHash,
    limit: rule.ipLimit,
    windowSeconds: rule.windowSeconds,
  }
}
