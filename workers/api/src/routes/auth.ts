import { Hono, type Context } from "hono";
import type { Session } from "@supabase/supabase-js";
import type { AppEnv } from "../env.ts";
import {
  applyNoStoreHeaders,
  buildAuthCallbackUrl,
  buildAuthPageUrl,
  clearAuthCookies,
  getAuthCookieSession,
  getRequestOrigin,
  getSafeReturnTo,
  isEmailOtpType,
  serializeAuthUser,
  setAuthCookies,
} from "../_shared/auth_session.ts";
import { createAuthClient } from "../_shared/supabase.ts";

type JsonRecord = Record<string, unknown>;

function authStatus(error: { status?: number } | null | undefined, fallback: number): number {
  return typeof error?.status === "number" ? error.status : fallback;
}

function jsonDetail(detail: string, status: number): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonNoStore(body: unknown, init?: ResponseInit): Response {
  const response = new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  applyNoStoreHeaders(response.headers);
  return response;
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function readJsonObject(c: Context<AppEnv>): Promise<JsonRecord | null> {
  const body = await c.req.json().catch((error: unknown) => {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return null;
    }
    throw error;
  });

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  return body as JsonRecord;
}

function withAuthCookies(response: Response, req: Request, session: Session): Response {
  setAuthCookies(response.headers, req, session);
  applyNoStoreHeaders(response.headers);
  return response;
}

function withClearedCookies(response: Response, req: Request): Response {
  clearAuthCookies(response.headers, req);
  applyNoStoreHeaders(response.headers);
  return response;
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/auth/sign-in", async (c) => {
  const body = await readJsonObject(c);
  if (!body) {
    return jsonDetail("Invalid JSON body.", 400);
  }

  const email = normalizeNonEmptyString(body.email);
  const password = normalizeNonEmptyString(body.password);
  const captchaToken = normalizeNonEmptyString(body.captcha_token);

  if (!email) {
    return jsonDetail("Email is required.", 400);
  }
  if (!password) {
    return jsonDetail("Password is required.", 400);
  }

  const supabase = createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: captchaToken ?? undefined },
  });

  if (error) {
    return jsonDetail(error.message, authStatus(error, 400));
  }
  if (!data.session || !data.user) {
    return jsonDetail("Supabase did not return a session.", 502);
  }

  return withAuthCookies(
    jsonNoStore({
      signed_in: true,
      user: serializeAuthUser(data.user),
    }),
    c.req.raw,
    data.session,
  );
});

authRoutes.post("/auth/sign-up", async (c) => {
  const body = await readJsonObject(c);
  if (!body) {
    return jsonDetail("Invalid JSON body.", 400);
  }

  const email = normalizeNonEmptyString(body.email);
  const password = normalizeNonEmptyString(body.password);
  const captchaToken = normalizeNonEmptyString(body.captcha_token);
  const returnTo = getSafeReturnTo(normalizeNonEmptyString(body.return_to));

  if (!email) {
    return jsonDetail("Email is required.", 400);
  }
  if (!password) {
    return jsonDetail("Password is required.", 400);
  }

  const supabase = createAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: captchaToken ?? undefined,
      emailRedirectTo: buildAuthCallbackUrl(c.req.raw, returnTo),
    },
  });

  if (error) {
    return jsonDetail(error.message, authStatus(error, 400));
  }

  const response = jsonNoStore({
    email_confirmation_required: !data.session,
    signed_in: Boolean(data.session && data.user),
    user: data.user ? serializeAuthUser(data.user) : null,
  });

  if (!data.session) {
    return response;
  }

  return withAuthCookies(response, c.req.raw, data.session);
});

authRoutes.post("/auth/magic-link", async (c) => {
  const body = await readJsonObject(c);
  if (!body) {
    return jsonDetail("Invalid JSON body.", 400);
  }

  const email = normalizeNonEmptyString(body.email);
  const captchaToken = normalizeNonEmptyString(body.captcha_token);
  const returnTo = getSafeReturnTo(normalizeNonEmptyString(body.return_to));

  if (!email) {
    return jsonDetail("Email is required.", 400);
  }

  const supabase = createAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      captchaToken: captchaToken ?? undefined,
      emailRedirectTo: buildAuthCallbackUrl(c.req.raw, returnTo),
    },
  });

  if (error) {
    return jsonDetail(error.message, authStatus(error, 400));
  }

  return jsonNoStore({ sent: true });
});

authRoutes.post("/auth/sign-out", async (c) => {
  const { accessToken, refreshToken } = getAuthCookieSession(c.req.raw);
  let tokenToRevoke = accessToken;

  if (!tokenToRevoke && refreshToken) {
    const { data, error } = await createAuthClient().auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (!error && data.session) {
      tokenToRevoke = data.session.access_token;
    }
  }

  if (tokenToRevoke) {
    const { error } = await createAuthClient().auth.admin.signOut(tokenToRevoke);
    if (error && authStatus(error, 400) !== 401) {
      return jsonDetail(error.message, authStatus(error, 400));
    }
  }

  return withClearedCookies(jsonNoStore({ signed_in: false, user: null }), c.req.raw);
});

authRoutes.get("/auth/session", async (c) => {
  const { accessToken, refreshToken } = getAuthCookieSession(c.req.raw);

  if (accessToken) {
    const authClient = createAuthClient();
    const {
      data: { user },
      error,
    } = await authClient.auth.getUser(accessToken);

    if (!error && user) {
      return jsonNoStore({
        signed_in: true,
        user: serializeAuthUser(user),
      });
    }
  }

  if (!refreshToken) {
    return withClearedCookies(jsonNoStore({ signed_in: false, user: null }), c.req.raw);
  }

  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session || !data.user) {
    return withClearedCookies(jsonNoStore({ signed_in: false, user: null }), c.req.raw);
  }

  return withAuthCookies(
    jsonNoStore({
      signed_in: true,
      user: serializeAuthUser(data.user),
    }),
    c.req.raw,
    data.session,
  );
});

authRoutes.post("/auth/refresh", async (c) => {
  const refreshToken = getAuthCookieSession(c.req.raw).refreshToken;
  if (!refreshToken) {
    return withClearedCookies(jsonDetail("No refresh token present.", 401), c.req.raw);
  }

  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session || !data.user) {
    return withClearedCookies(
      jsonDetail(error?.message ?? "Session refresh failed.", 401),
      c.req.raw,
    );
  }

  return withAuthCookies(
    jsonNoStore({
      signed_in: true,
      user: serializeAuthUser(data.user),
    }),
    c.req.raw,
    data.session,
  );
});

authRoutes.get("/auth/callback", async (c) => {
  const url = new URL(c.req.url);
  const returnTo = getSafeReturnTo(url.searchParams.get("returnTo"));
  const code = normalizeNonEmptyString(url.searchParams.get("code"));
  const tokenHash = normalizeNonEmptyString(url.searchParams.get("token_hash"));
  const type = normalizeNonEmptyString(url.searchParams.get("type"));

  const authClient = createAuthClient();
  const result = code
    ? await authClient.auth.exchangeCodeForSession(code)
    : tokenHash && isEmailOtpType(type)
      ? await authClient.auth.verifyOtp({ token_hash: tokenHash, type })
      : null;

  if (!result) {
    return Response.redirect(
      buildAuthPageUrl(c.req.raw, returnTo, "Invalid auth callback."),
      303,
    );
  }

  if (result.error || !result.data.session) {
    return Response.redirect(
      buildAuthPageUrl(
        c.req.raw,
        returnTo,
        result.error?.message ?? "Authentication callback failed.",
      ),
      303,
    );
  }

  const response = Response.redirect(new URL(returnTo, getRequestOrigin(c.req.raw)).toString(), 303);
  setAuthCookies(response.headers, c.req.raw, result.data.session);
  applyNoStoreHeaders(response.headers);
  return response;
});
