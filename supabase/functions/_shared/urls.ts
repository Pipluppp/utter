function isLocalDev(): boolean {
  const url = Deno.env.get("SUPABASE_URL") ?? ""
  return url.includes("127.0.0.1") || url.includes("localhost") || url.includes("kong")
}

function hasLocalStorageHost(signedUrl: string): boolean {
  const hostname = new URL(signedUrl).hostname.toLowerCase()
  return hostname === "kong" ||
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "host.docker.internal"
}

function resolveLocalPublicOrigin(): string {
  const candidates = [
    Deno.env.get("SUPABASE_PUBLIC_URL"),
    Deno.env.get("SUPABASE_URL"),
    "http://127.0.0.1:54321",
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const parsed = new URL(candidate)
    const hostname = parsed.hostname.toLowerCase()
    if (hostname === "kong" || hostname === "host.docker.internal") continue
    return parsed.origin
  }

  return "http://127.0.0.1:54321"
}

export function resolveStorageUrl(req: Request, signedUrl: string): string {
  if (!isLocalDev() && !hasLocalStorageHost(signedUrl)) return signedUrl

  const url = new URL(signedUrl)
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
  const hostLower = host.toLowerCase()
  if (hostLower === "kong" || hostLower === "kong:8000") {
    return `${resolveLocalPublicOrigin()}${url.pathname}${url.search}`
  }

  const origin = `${proto}://${host}`
  return `${origin}${url.pathname}${url.search}`
}
