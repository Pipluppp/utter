import type { Session, User } from "@supabase/supabase-js";
import { getAllowedOrigins, type WorkerEnv } from "../env.ts";

const ACCESS_COOKIE_NAME = "utter_sb_access_token";
const REFRESH_COOKIE_NAME = "utter_sb_refresh_token";
const PKCE_COOKIE_NAME = "utter_pkce_verifier";
const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PKCE_COOKIE_MAX_AGE_SECONDS = 600;

type CookieOptions = {
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "Lax" | "None" | "Strict";
  secure?: boolean;
};

export type BrowserAuthUser = {
  email: string | null;
  id: string;
};

function jsonResponse(detail: string, status: number): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseCookies(req: Request): Map<string, string> {
  const cookieHeader = req.headers.get("cookie");
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  for (const entry of cookieHeader.split(";")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!name) continue;

    cookies.set(name, decodeURIComponent(value));
  }

  return cookies;
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) segments.push(`Max-Age=${options.maxAge}`);
  if (options.expires) segments.push(`Expires=${options.expires.toUTCString()}`);
  if (options.path) segments.push(`Path=${options.path}`);
  if (options.httpOnly) segments.push("HttpOnly");
  if (options.secure) segments.push("Secure");
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`);

  return segments.join("; ");
}

function appendSetCookie(headers: Headers, cookie: string) {
  headers.append("Set-Cookie", cookie);
}

function requestProtocol(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return new URL(req.url).protocol.replace(":", "");
}

function requestHost(req: Request): string {
  return req.headers.get("x-forwarded-host") ?? new URL(req.url).host;
}

function resolveAllowedOrigin(allowedOrigins: string[], requestOrigin: string | null): string {
  if (allowedOrigins.includes("*")) return "*";
  if (!requestOrigin) return allowedOrigins[0] ?? "*";
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : (allowedOrigins[0] ?? "*");
}

function accessCookieMaxAge(session: Session): number {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt =
    typeof session.expires_at === "number"
      ? session.expires_at
      : now + (typeof session.expires_in === "number" ? session.expires_in : 3600);
  return Math.max(1, expiresAt - now);
}

export function applyNoStoreHeaders(headers: Headers) {
  headers.set("Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
}

export function buildAuthCallbackUrl(req: Request, returnTo: string | null | undefined): string {
  const url = new URL("/api/auth/callback", getRequestOrigin(req));
  url.searchParams.set("returnTo", getSafeReturnTo(returnTo));
  return url.toString();
}

export function buildAuthPageUrl(
  req: Request,
  returnTo: string | null | undefined,
  error?: string,
): string {
  const url = new URL("/auth", getRequestOrigin(req));
  const safeReturnTo = getSafeReturnTo(returnTo);

  if (safeReturnTo !== "/") {
    url.searchParams.set("returnTo", safeReturnTo);
  }
  if (error) {
    url.searchParams.set("error", error);
  }

  return url.toString();
}

export function clearAuthCookies(headers: Headers, req: Request) {
  const secure = isSecureRequest(req);
  const commonOptions: CookieOptions = {
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
    secure,
  };

  appendSetCookie(headers, serializeCookie(ACCESS_COOKIE_NAME, "", commonOptions));
  appendSetCookie(headers, serializeCookie(REFRESH_COOKIE_NAME, "", commonOptions));
}

export function getAccessTokenCookie(req: Request): string | null {
  return parseCookies(req).get(ACCESS_COOKIE_NAME) ?? null;
}

export function getAuthCookieSession(req: Request): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  const cookies = parseCookies(req);
  return {
    accessToken: cookies.get(ACCESS_COOKIE_NAME) ?? null,
    refreshToken: cookies.get(REFRESH_COOKIE_NAME) ?? null,
  };
}

export function getRefreshTokenCookie(req: Request): string | null {
  return parseCookies(req).get(REFRESH_COOKIE_NAME) ?? null;
}

export function getRequestOrigin(req: Request): string {
  return `${requestProtocol(req)}://${requestHost(req)}`;
}

export function getSafeReturnTo(value: string | null | undefined): string {
  const candidate = (value ?? "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/";
  return candidate || "/";
}

export function hasAuthCookies(req: Request): boolean {
  const { accessToken, refreshToken } = getAuthCookieSession(req);
  return Boolean(accessToken || refreshToken);
}

export function isAuthRoutePath(path: string): boolean {
  return path === "/api/auth" || path.startsWith("/api/auth/");
}

export function isEmailOtpType(
  value: string | null | undefined,
): value is "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email" {
  return (
    value === "signup" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  );
}

export function isSecureRequest(req: Request): boolean {
  return requestProtocol(req) === "https";
}

export function isUnsafeMethod(method: string): boolean {
  const upper = method.toUpperCase();
  return upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE";
}

export function requireAllowedOrigin(req: Request, env: WorkerEnv) {
  const allowedOrigins = getAllowedOrigins(env);
  if (allowedOrigins.includes("*")) return;

  const origin = req.headers.get("origin");
  if (!origin) {
    throw jsonResponse("Missing Origin header.", 403);
  }

  const resolvedOrigin = resolveAllowedOrigin(allowedOrigins, origin);
  if (resolvedOrigin !== origin) {
    throw jsonResponse("Origin not allowed.", 403);
  }
}

export function serializeAuthUser(user: Pick<User, "email" | "id">): BrowserAuthUser {
  return {
    email: user.email ?? null,
    id: user.id,
  };
}

export function serializeIdentities(user: Pick<User, "identities">): Array<{ provider: string }> {
  return (user.identities ?? []).map((identity) => ({ provider: identity.provider }));
}

export function setAuthCookies(headers: Headers, req: Request, session: Session) {
  const secure = isSecureRequest(req);
  const commonOptions: CookieOptions = {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure,
  };

  appendSetCookie(
    headers,
    serializeCookie(ACCESS_COOKIE_NAME, session.access_token, {
      ...commonOptions,
      maxAge: accessCookieMaxAge(session),
    }),
  );
  appendSetCookie(
    headers,
    serializeCookie(REFRESH_COOKIE_NAME, session.refresh_token, {
      ...commonOptions,
      maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
    }),
  );
}

export function clearPkceCookie(headers: Headers, req: Request) {
  appendSetCookie(
    headers,
    serializeCookie(PKCE_COOKIE_NAME, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/api/auth",
      sameSite: "Lax",
      secure: isSecureRequest(req),
    }),
  );
}

export function getPkceCookie(req: Request): string | null {
  return parseCookies(req).get(PKCE_COOKIE_NAME) ?? null;
}

export function setPkceCookie(headers: Headers, req: Request, codeVerifier: string) {
  appendSetCookie(
    headers,
    serializeCookie(PKCE_COOKIE_NAME, codeVerifier, {
      httpOnly: true,
      maxAge: PKCE_COOKIE_MAX_AGE_SECONDS,
      path: "/api/auth",
      sameSite: "Lax",
      secure: isSecureRequest(req),
    }),
  );
}
