import { createClient } from "npm:@supabase/supabase-js@2"

export function createUserClient(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    throw new Error("Missing Authorization header")
  }

  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: authHeader },
      },
    },
  )
}

export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
}

