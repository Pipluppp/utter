import { Hono } from "hono";

import {
    createAdminClient,
    createUserClient,
    resolveAccessToken,
} from "../_shared/supabase.ts";

type Profile = {
  created_at: string;
  credits_remaining: number;
  id: string;
  subscription_tier: string;
  updated_at: string;
};

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const meRoutes = new Hono();

meRoutes.get("/me", async (c) => {
  const accessToken = resolveAccessToken(c.req.raw);
  if (!accessToken) {
    return c.json({ signed_in: false, user: null, profile: null });
  }

  const authClient = createUserClient(accessToken);
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) {
    return c.json({ signed_in: false, user: null, profile: null });
  }

  const user = { id: data.user.id };
  const { data: profileRow, error: profileError } = await authClient
    .from("profiles")
    .select(
      "id, subscription_tier, credits_remaining, created_at, updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return jsonDetail("Failed to load profile.", 500);
  }

  if (profileRow) {
    return c.json({ signed_in: true, user, profile: profileRow as Profile });
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin
    .from("profiles")
    .insert({ id: user.id })
    .select(
      "id, subscription_tier, credits_remaining, created_at, updated_at",
    )
    .single();

  if (createError) {
    return jsonDetail("Failed to create profile.", 500);
  }

  return c.json({ signed_in: true, user, profile: created as Profile });
});
