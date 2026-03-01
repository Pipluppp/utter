import { createUserClient } from "./supabase.ts"

export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    throw new Response(JSON.stringify({ detail: "Missing authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const supabase = createUserClient(req)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Response(JSON.stringify({ detail: "Invalid or expired token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  return { user, supabase }
}

