import { getAllowedOrigins, type WorkerEnv } from "../env";

function resolveAllowedOrigin(
  allowedOrigins: string[],
  requestOrigin: string | null,
): string {
  if (allowedOrigins.includes("*")) return "*";
  if (!requestOrigin) return allowedOrigins[0] ?? "*";
  return allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : (allowedOrigins[0] ?? "*");
}

export function corsHeaders(
  env: WorkerEnv,
  requestOrigin: string | null,
): Record<string, string> {
  const allowedOrigins = getAllowedOrigins(env);
  const allowsAllOrigins = allowedOrigins.includes("*");

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(
      allowedOrigins,
      requestOrigin,
    ),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };

  if (!allowsAllOrigins) headers.Vary = "Origin";
  return headers;
}
