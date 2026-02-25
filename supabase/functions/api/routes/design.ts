import { Hono } from "npm:hono@4";

import { requireUser } from "../../_shared/auth.ts";
import {
  applyCreditEvent,
  creditsForDesignPreview,
  formatInsufficientCreditsDetail,
  trialOrDebit,
  trialRestore,
} from "../../_shared/credits.ts";
import { createAdminClient } from "../../_shared/supabase.ts";
import { resolveStorageUrl } from "../../_shared/urls.ts";

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export const designRoutes = new Hono();

designRoutes.post("/voices/design/preview", async (c) => {
  let userId: string;
  try {
    const { user } = await requireUser(c.req.raw);
    userId = user.id;
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const body = (await c.req.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body) return jsonDetail("Invalid JSON body", 400);

  const text = normalizeString(body.text);
  const language = normalizeString(body.language);
  const instruct = normalizeString(body.instruct);

  if (!text) return jsonDetail("Preview text is required.", 400);
  if (text.length > 500) {
    return jsonDetail("Preview text must be 500 characters or less.", 400);
  }
  if (!instruct) return jsonDetail("Voice description is required.", 400);
  if (instruct.length > 500) {
    return jsonDetail("Voice description must be 500 characters or less.", 400);
  }
  if (!language) return jsonDetail("Language is required.", 400);

  const admin = createAdminClient();
  const taskId = crypto.randomUUID();
  const creditsToDebit = creditsForDesignPreview();
  const chargeIdempotencyKey = `design-preview:${taskId}:charge`;
  const charge = await trialOrDebit(admin, {
    userId,
    operation: "design_preview",
    debitAmount: creditsToDebit,
    referenceType: "task",
    referenceId: taskId,
    idempotencyKey: chargeIdempotencyKey,
    metadata: {
      reason: "design_preview_request",
      text_length: text.length,
      instruct_length: instruct.length,
    },
  });

  if (charge.error || !charge.row) {
    return jsonDetail("Failed to debit credits.", 500);
  }

  if (charge.row.insufficient) {
    return jsonDetail(
      formatInsufficientCreditsDetail(
        creditsToDebit,
        charge.row.balance_remaining,
      ),
      402,
    );
  }

  const usedTrial = charge.row.used_trial;
  const trialIdempotencyKey = usedTrial ? chargeIdempotencyKey : null;
  const creditsDebited = usedTrial ? 0 : creditsToDebit;

  const { data: task, error } = await admin
    .from("tasks")
    .insert({
      id: taskId,
      user_id: userId,
      type: "design_preview",
      status: "pending",
      metadata: {
        text,
        language,
        instruct,
        used_trial: usedTrial,
        trial_idempotency_key: trialIdempotencyKey,
        credits_debited: creditsDebited,
        credits_remaining_after_debit: charge.row.balance_remaining,
      },
    })
    .select("id")
    .single();

  if (error || !task) {
    if (usedTrial && trialIdempotencyKey) {
      await trialRestore(admin, {
        userId,
        operation: "design_preview",
        idempotencyKey: trialIdempotencyKey,
        metadata: {
          reason: "task_insert_failed",
          task_id: taskId,
        },
      });
    } else {
      await applyCreditEvent(admin, {
        userId,
        eventKind: "refund",
        operation: "design_preview",
        amount: creditsToDebit,
        referenceType: "task",
        referenceId: taskId,
        idempotencyKey: `design-preview:${taskId}:refund`,
        metadata: {
          reason: "task_insert_failed",
        },
      });
    }
    return jsonDetail("Failed to create task.", 500);
  }

  return c.json({ task_id: (task as { id: string }).id, status: "pending" });
});

designRoutes.post("/voices/design", async (c) => {
  let userId: string;
  try {
    const { user } = await requireUser(c.req.raw);
    userId = user.id;
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return jsonDetail("Invalid form data.", 400);

  const name = normalizeString(formData.get("name"));
  const text = normalizeString(formData.get("text"));
  const language = normalizeString(formData.get("language"));
  const instruct = normalizeString(formData.get("instruct"));
  const audio = formData.get("audio");

  if (!name || name.length > 100) {
    return jsonDetail("Name must be 1-100 characters.", 400);
  }
  if (!text) return jsonDetail("Preview text is required.", 400);
  if (!language) return jsonDetail("Language is required.", 400);
  if (!instruct) return jsonDetail("Voice description is required.", 400);
  if (!(audio instanceof File)) {
    return jsonDetail("Audio file is required.", 400);
  }
  if (audio.size <= 0) return jsonDetail("Audio file is empty.", 400);
  if (audio.size > 1_000_000) {
    return jsonDetail("Audio file must be under 1MB.", 400);
  }

  const voiceId = crypto.randomUUID();
  const objectKey = `${userId}/${voiceId}/reference.wav`;

  const admin = createAdminClient();
  const upload = await admin.storage.from("references").upload(
    objectKey,
    audio,
    {
      contentType: audio.type || "audio/wav",
      upsert: false,
    },
  );
  if (upload.error) return jsonDetail("Failed to upload reference audio.", 500);

  const { data: voice, error: insertError } = await admin
    .from("voices")
    .insert({
      id: voiceId,
      user_id: userId,
      name,
      language,
      source: "designed",
      description: instruct,
      reference_object_key: objectKey,
      reference_transcript: text,
    })
    .select("id, name, description, language, source")
    .single();

  if (insertError || !voice) {
    await admin.storage.from("references").remove([objectKey]).catch(() => {});
    return jsonDetail("Failed to create voice.", 500);
  }

  const { data: signed, error: signedError } = await admin.storage
    .from("references")
    .createSignedUrl(objectKey, 3600);

  if (signedError || !signed?.signedUrl) {
    return jsonDetail("Failed to create signed URL.", 500);
  }

  return c.json({
    ...(voice as Record<string, unknown>),
    preview_url: resolveStorageUrl(c.req.raw, signed.signedUrl),
  });
});
