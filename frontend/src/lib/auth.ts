const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export type AuthUser = {
  email: string | null;
  id: string;
};

export type AuthSessionResponse = {
  signed_in: boolean;
  user: AuthUser | null;
};

export type SignUpResponse = AuthSessionResponse & {
  email_confirmation_required: boolean;
};

type ApiErrorShape = {
  detail?: string;
  message?: string;
};

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await res.json().catch(() => null)) as ApiErrorShape | null;
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
  }

  const text = await res.text().catch(() => "");
  return text || `${res.status} ${res.statusText}`;
}

async function authJson<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    body: json ? JSON.stringify(json) : rest.body,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      ...(json ? { "content-type": "application/json" } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    throw new AuthApiError(await parseErrorMessage(response), response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new AuthApiError("Server returned non-JSON response", response.status);
  }

  return (await response.json()) as T;
}

export function getTurnstileSiteKey(): string {
  return turnstileSiteKey ?? "";
}

export async function getAuthSession(): Promise<AuthSessionResponse> {
  return authJson<AuthSessionResponse>("/api/auth/session", { method: "GET" });
}

export function isAuthConfigured(): boolean {
  return Boolean(turnstileSiteKey);
}

export async function refreshAuthSession(): Promise<AuthSessionResponse> {
  return authJson<AuthSessionResponse>("/api/auth/refresh", {
    json: {},
    method: "POST",
  });
}

export async function sendMagicLink(params: {
  captchaToken: string | null;
  email: string;
  returnTo: string;
}): Promise<{ sent: true }> {
  return authJson<{ sent: true }>("/api/auth/magic-link", {
    json: {
      captcha_token: params.captchaToken,
      email: params.email,
      return_to: params.returnTo,
    },
    method: "POST",
  });
}

export async function signInWithPassword(params: {
  captchaToken: string | null;
  email: string;
  password: string;
}): Promise<AuthSessionResponse> {
  return authJson<AuthSessionResponse>("/api/auth/sign-in", {
    json: {
      captcha_token: params.captchaToken,
      email: params.email,
      password: params.password,
    },
    method: "POST",
  });
}

export async function signOut(): Promise<AuthSessionResponse> {
  return authJson<AuthSessionResponse>("/api/auth/sign-out", {
    json: {},
    method: "POST",
  });
}

export async function signUpWithPassword(params: {
  captchaToken: string | null;
  email: string;
  password: string;
  returnTo: string;
}): Promise<SignUpResponse> {
  return authJson<SignUpResponse>("/api/auth/sign-up", {
    json: {
      captcha_token: params.captchaToken,
      email: params.email,
      password: params.password,
      return_to: params.returnTo,
    },
    method: "POST",
  });
}

export async function tryRefreshAuthSession(): Promise<boolean> {
  try {
    const session = await refreshAuthSession();
    return session.signed_in;
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) {
      return false;
    }

    throw error;
  }
}
