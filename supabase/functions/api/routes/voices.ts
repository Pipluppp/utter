import { Hono } from "npm:hono@4";

import { requireUser } from "../../_shared/auth.ts";
import { createAdminClient, createUserClient } from "../../_shared/supabase.ts";
import { resolveStorageUrl } from "../../_shared/urls.ts";

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number(value ?? "");
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export const voicesRoutes = new Hono();

voicesRoutes.get("/voices", async (c) => {
  let supabase: ReturnType<typeof createUserClient>;
  try {
    ({ supabase } = await requireUser(c.req.raw));
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const page = parsePositiveInt(c.req.query("page") ?? null, 1);
  const perPage = Math.min(
    100,
    parsePositiveInt(c.req.query("per_page") ?? null, 20),
  );
  const search = (c.req.query("search") ?? "").trim();
  const source = c.req.query("source");
  const sourceFilter = source === "uploaded" || source === "designed"
    ? source
    : null;

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let q = supabase
    .from("voices")
    .select(
      "id, name, reference_transcript, language, source, description, created_at, tts_provider, provider_voice_id, provider_target_model, provider_voice_kind",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) q = q.ilike("name", `%${search}%`);
  if (sourceFilter) q = q.eq("source", sourceFilter);

  const { data, error, count } = await q;
  if (error) return jsonDetail("Failed to load voices.", 500);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));

  return c.json({
    voices: data ?? [],
    pagination: { page, per_page: perPage, total, pages },
  });
});

voicesRoutes.get("/voices/:id/preview", async (c) => {
  let userId: string;
  let supabase: ReturnType<typeof createUserClient>;
  try {
    const { user, supabase: userClient } = await requireUser(c.req.raw);
    userId = user.id;
    supabase = userClient;
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const voiceId = c.req.param("id");
  const { data: voice, error } = await supabase
    .from("voices")
    .select("id, reference_object_key, deleted_at")
    .eq("id", voiceId)
    .maybeSingle();

  if (error) return jsonDetail("Failed to load voice.", 500);
  if (!voice) return jsonDetail("Voice not found.", 404);

  const row = voice as {
    reference_object_key: string | null;
    deleted_at: string | null;
  };
  if (row.deleted_at) return jsonDetail("Voice not found.", 404);

  const key = row.reference_object_key;
  if (!key) return jsonDetail("Voice has no reference audio.", 404);
  if (!key.startsWith(`${userId}/`)) {
    return jsonDetail("Invalid storage object key.", 403);
  }

  const admin = createAdminClient();
  const { data: signed, error: signedError } = await admin.storage
    .from("references")
    .createSignedUrl(key, 3600);

  if (signedError || !signed?.signedUrl) {
    return jsonDetail("Failed to create signed URL.", 500);
  }

  const publicUrl = resolveStorageUrl(c.req.raw, signed.signedUrl);
  return c.redirect(publicUrl, 302);
});

voicesRoutes.delete("/voices/:id", async (c) => {
  let userId: string;
  let supabase: ReturnType<typeof createUserClient>;
  try {
    const { user, supabase: userClient } = await requireUser(c.req.raw);
    userId = user.id;
    supabase = userClient;
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const voiceId = c.req.param("id");
  const { data: voice, error } = await supabase
    .from("voices")
    .select("id, deleted_at")
    .eq("id", voiceId)
    .maybeSingle();

  if (error) return jsonDetail("Failed to load voice.", 500);
  if (!voice) return jsonDetail("Voice not found.", 404);

  const row = voice as { deleted_at: string | null };
  if (row.deleted_at) return c.json({ ok: true });

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("voices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", voiceId)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (updateError) return jsonDetail("Failed to delete voice.", 500);

  return c.json({ ok: true });
});
