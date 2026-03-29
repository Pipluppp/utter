import { Hono } from "hono";

import { requireUser } from "../_shared/auth.ts";
import { createStorageProvider } from "../_shared/storage.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";
import { VOICES_SORT_ALLOWLIST, validateSort, validateSortDir } from "./sort";

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

async function buildGenerationCountMap(
  supabase: ReturnType<typeof createUserClient>,
  voiceIds: string[],
): Promise<Record<string, number>> {
  if (voiceIds.length === 0) return {};

  const { data: rows } = await supabase
    .from("generations")
    .select("voice_id")
    .in("voice_id", voiceIds);

  const countMap: Record<string, number> = {};
  for (const row of rows ?? []) {
    countMap[row.voice_id] = (countMap[row.voice_id] ?? 0) + 1;
  }
  return countMap;
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
  const perPage = Math.min(100, parsePositiveInt(c.req.query("per_page") ?? null, 20));
  const search = (c.req.query("search") ?? "").trim();
  const source = c.req.query("source");
  const sourceFilter = source === "uploaded" || source === "designed" ? source : null;

  const sort = validateSort(c.req.query("sort"), VOICES_SORT_ALLOWLIST, "created_at");
  const sortDir = validateSortDir(c.req.query("sort_dir"));
  const favoritesOnly = c.req.query("favorites") === "true";

  const ascending = sortDir === "asc";
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Build an OR filter across name, reference_transcript, and description so
  // highlighting on the frontend matches what the backend actually filters.
  function applySearch(q: typeof baseQuery, term: string) {
    const escaped = term.replace(/[%_]/g, (ch) => `\\${ch}`);
    return q.or(
      `name.ilike.%${escaped}%,reference_transcript.ilike.%${escaped}%,description.ilike.%${escaped}%`,
    );
  }

  // Shared base query shape for type inference and reuse.
  // Only one branch (generation_count vs standard) executes, so the builder
  // is never consumed twice.
  const baseQuery = supabase
    .from("voices")
    .select(
      "id, name, reference_transcript, language, source, description, created_at, tts_provider, is_favorite",
      { count: "exact" },
    )
    .is("deleted_at", null);

  // When sorting by generation_count, we need to fetch all matching voices,
  // compute counts, sort in-memory, then paginate.
  if (sort === "generation_count") {
    let q = baseQuery;

    if (search) q = applySearch(q, search);
    if (sourceFilter) q = q.eq("source", sourceFilter);
    if (favoritesOnly) q = q.eq("is_favorite", true);

    const { data, error, count } = await q;
    if (error) return jsonDetail("Failed to load voices.", 500);

    const allVoices = data ?? [];
    const total = count ?? 0;

    // Compute generation counts for all voices
    const voiceIds = allVoices.map((v) => v.id);
    const countMap = await buildGenerationCountMap(supabase, voiceIds);

    // Sort by generation_count
    const sorted = allVoices
      .map((v) => ({ ...v, generation_count: countMap[v.id] ?? 0 }))
      .sort((a, b) => {
        const diff = a.generation_count - b.generation_count;
        return ascending ? diff : -diff;
      });

    const pages = Math.max(1, Math.ceil(total / perPage));
    const paged = sorted.slice(from, to + 1);

    return c.json({
      voices: paged,
      pagination: { page, per_page: perPage, total, pages },
    });
  }

  // Standard DB-sorted path
  let q = baseQuery.order(sort, { ascending }).range(from, to);

  if (search) q = applySearch(q, search);
  if (sourceFilter) q = q.eq("source", sourceFilter);
  if (favoritesOnly) q = q.eq("is_favorite", true);

  const { data, error, count } = await q;
  if (error) return jsonDetail("Failed to load voices.", 500);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));

  // Compute generation counts for the current page of voices
  const voiceIds = (data ?? []).map((v) => v.id);
  const countMap = await buildGenerationCountMap(supabase, voiceIds);

  const voices = (data ?? []).map((v) => ({
    ...v,
    generation_count: countMap[v.id] ?? 0,
  }));

  return c.json({
    voices,
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
  const storage = createStorageProvider({ admin, req: c.req.raw });
  const { data: signed, error: signedError } = await storage.createSignedUrl(
    "references",
    key,
    3600,
  );

  if (signedError || !signed?.signedUrl) {
    return jsonDetail("Failed to create signed URL.", 500);
  }

  return c.redirect(signed.signedUrl, 302);
});

voicesRoutes.patch("/voices/:id/favorite", async (c) => {
  let supabase: ReturnType<typeof createUserClient>;
  try {
    ({ supabase } = await requireUser(c.req.raw));
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const voiceId = c.req.param("id");
  const { data: voice, error } = await supabase
    .from("voices")
    .select("id, is_favorite, deleted_at")
    .eq("id", voiceId)
    .maybeSingle();

  if (error) return jsonDetail("Failed to load voice.", 500);
  if (!voice) return jsonDetail("Voice not found.", 404);

  const row = voice as { is_favorite: boolean; deleted_at: string | null };
  if (row.deleted_at) return jsonDetail("Voice not found.", 404);

  const admin = createAdminClient();
  const { data: updated, error: updateError } = await admin
    .from("voices")
    .update({ is_favorite: !row.is_favorite })
    .eq("id", voiceId)
    .select()
    .maybeSingle();

  if (updateError || !updated) return jsonDetail("Failed to update voice.", 500);

  return c.json(updated);
});

voicesRoutes.patch("/voices/:id/name", async (c) => {
  let supabase: ReturnType<typeof createUserClient>;
  try {
    ({ supabase } = await requireUser(c.req.raw));
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const body = await c.req.json().catch(() => null);
  const name = body?.name;
  if (typeof name !== "string" || name.length < 1 || name.length > 100) {
    return jsonDetail("Name must be between 1 and 100 characters.", 400);
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
  if (row.deleted_at) return jsonDetail("Voice not found.", 404);

  const admin = createAdminClient();
  const { data: updated, error: updateError } = await admin
    .from("voices")
    .update({ name })
    .eq("id", voiceId)
    .select()
    .maybeSingle();

  if (updateError || !updated) return jsonDetail("Failed to update voice.", 500);

  return c.json(updated);
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
