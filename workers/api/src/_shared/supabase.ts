import { createClient } from "@supabase/supabase-js";
import { getAccessTokenCookie } from "./auth_session.ts";
import { envRequire } from "./runtime_env.ts";

function buildClient(key: string, authHeader?: string) {
  return createClient(envRequire("SUPABASE_URL"), key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    ...(authHeader
      ? {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      : {}),
  });
}

export function createAdminClient() {
  return buildClient(envRequire("SUPABASE_SERVICE_ROLE_KEY"));
}

export function createAuthClient() {
  return buildClient(envRequire("SUPABASE_ANON_KEY"));
}

export function createUserClient(accessToken: string) {
  return buildClient(envRequire("SUPABASE_ANON_KEY"), `Bearer ${accessToken}`);
}

export function resolveAccessToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() || null;
  }

  return getAccessTokenCookie(req);
}

