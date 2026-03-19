import { createUserClient, resolveAccessToken } from "./supabase.ts";

export async function requireUser(req: Request) {
  const accessToken = resolveAccessToken(req);
  if (!accessToken) {
    throw new Response(JSON.stringify({ detail: "Authentication required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createUserClient(accessToken);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new Response(JSON.stringify({ detail: "Invalid or expired session." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return { accessToken, supabase, user };
}

