const configuredOrigins = (Deno.env.get("CORS_ALLOWED_ORIGIN") ?? "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

const allowsAllOrigins = configuredOrigins.includes("*") || configuredOrigins.length === 0

function resolveAllowedOrigin(requestOrigin: string | null): string {
  if (allowsAllOrigins) return "*"
  if (!requestOrigin) return configuredOrigins[0]
  return configuredOrigins.includes(requestOrigin) ? requestOrigin : configuredOrigins[0]
}

export function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(requestOrigin),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Max-Age": "86400",
  }

  if (!allowsAllOrigins) {
    headers.Vary = "Origin"
  }

  return headers
}

