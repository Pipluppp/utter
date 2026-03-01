import { createClient } from "@supabase/supabase-js"
import { envRequire } from "./runtime_env.ts"

export function createUserClient(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    throw new Error("Missing Authorization header")
  }

  return createClient(
    envRequire("SUPABASE_URL"),
    envRequire("SUPABASE_ANON_KEY"),
    {
      global: {
        headers: { Authorization: authHeader },
      },
    },
  )
}

export function createAdminClient() {
  return createClient(
    envRequire("SUPABASE_URL"),
    envRequire("SUPABASE_SERVICE_ROLE_KEY"),
  )
}

