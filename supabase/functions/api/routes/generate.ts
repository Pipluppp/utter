import { Hono } from "npm:hono@4";
import { encodeBase64 } from "jsr:@std/encoding/base64";

import { requireUser } from "../../_shared/auth.ts";
import {
  applyCreditEvent,
  creditsForGenerateText,
  formatInsufficientCreditsDetail,
} from "../../_shared/credits.ts";
import { createAdminClient } from "../../_shared/supabase.ts";
import { submitJob } from "../../_shared/modal.ts";

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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(value);
}

function estimateGenerationMinutes(text: string): number {
  const minutes = Math.round((text.length / 375) * 10) / 10;
  return Math.max(0.1, minutes);
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "23505";
}

function getObjectSizeBytes(
  object: {
    size?: number | string | null;
    metadata?: {
      size?: number | string | null;
      contentLength?: number | string | null;
    };
  } | null,
): number | null {
  if (!object) return null;
  const sizeValue = object.size ?? object.metadata?.size ??
    object.metadata?.contentLength;
  if (sizeValue == null) return null;
  const parsed = Number(sizeValue);
  return Number.isFinite(parsed) ? parsed : null;
}

export const generateRoutes = new Hono();

generateRoutes.post("/generate", async (c) => {
  let userId: string;
  let userClient: ReturnType<typeof createAdminClient>;
  try {
    const { user, supabase } = await requireUser(c.req.raw);
    userId = user.id;
    userClient = supabase;
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const body = (await c.req.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body) return jsonDetail("Invalid JSON body", 400);

  const voiceId = normalizeString(body.voice_id);
  const text = normalizeString(body.text) ?? "";
  const language = normalizeString(body.language) ?? "Auto";

  if (!voiceId) return jsonDetail("Please select a voice", 400);
  if (!isUuid(voiceId)) return jsonDetail("Invalid voice_id", 400);
  if (!text) return jsonDetail("Please enter text to speak", 400);
  if (text.length > 10000) {
    return jsonDetail("Text cannot exceed 10000 characters", 400);
  }
  if (!language) return jsonDetail("Language is required.", 400);

  const { data: voice, error: voiceError } = await userClient
    .from("voices")
    .select("id, name, reference_object_key, reference_transcript")
    .eq("id", voiceId)
    .maybeSingle();

  if (voiceError) return jsonDetail("Failed to load voice.", 500);
  if (!voice) return jsonDetail("Voice not found", 404);

  const refKey =
    (voice as { reference_object_key: string | null }).reference_object_key;
  const refText =
    (voice as { reference_transcript: string | null }).reference_transcript;
  if (!refText) {
    return jsonDetail(
      "This voice has no reference transcript. Re-clone with a transcript to use Qwen3-TTS.",
      400,
    );
  }
  if (!refKey) return jsonDetail("Voice has no reference audio.", 400);

  const admin = createAdminClient();
  const refPathParts = refKey.split("/");
  const refFileName = refPathParts.pop() ?? "";
  const refFolder = refPathParts.join("/");

  const { data: refMeta, error: refMetaError } = await admin.storage
    .from("references")
    .list(refFolder, { limit: 100 });
  if (refMetaError) {
    return jsonDetail("Failed to load reference audio metadata.", 500);
  }

  const refFile = (refMeta ?? []).find((obj) => obj.name === refFileName);
  if (!refFile) return jsonDetail("Voice has no reference audio.", 400);

  const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
  const refSize = getObjectSizeBytes(refFile);
  if (refSize !== null && refSize > MAX_REFERENCE_BYTES) {
    return jsonDetail(
      "Reference audio too large for generation. Re-clone with a shorter clip.",
      400,
    );
  }

  const { data: activeTask, error: activeTaskError } = await userClient
    .from("tasks")
    .select("id")
    .eq("type", "generate")
    .in("status", ["pending", "processing"])
    .limit(1)
    .maybeSingle();

  if (activeTaskError) return jsonDetail("Failed to check active tasks.", 500);
  if (activeTask) {
    return jsonDetail(
      "A generation is already in progress. Please wait for it to finish before starting another.",
      409,
    );
  }

  const { data: audioBlob, error: downloadError } = await admin.storage
    .from("references")
    .download(refKey);
  if (downloadError || !audioBlob) {
    return jsonDetail("Failed to download reference audio.", 500);
  }

  const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
  const audioB64 = encodeBase64(audioBytes);

  const estimatedMinutes = estimateGenerationMinutes(text);
  const creditsToDebit = creditsForGenerateText(text);

  const { data: generation, error: genError } = await admin
    .from("generations")
    .insert({
      user_id: userId,
      voice_id: voiceId,
      text,
      language,
      status: "processing",
    })
    .select("id")
    .single();

  if (genError || !generation) {
    return jsonDetail("Failed to create generation.", 500);
  }
  const generationId = (generation as { id: string }).id;

  const debit = await applyCreditEvent(admin, {
    userId,
    eventKind: "debit",
    operation: "generate",
    amount: creditsToDebit,
    referenceType: "generation",
    referenceId: generationId,
    idempotencyKey: `generate:${generationId}:debit`,
    metadata: {
      reason: "generate_request",
      text_length: text.length,
      voice_id: voiceId,
    },
  });

  if (debit.error || !debit.row) {
    await admin
      .from("generations")
      .delete()
      .eq("id", generationId)
      .eq("user_id", userId);
    return jsonDetail("Failed to debit credits.", 500);
  }

  if (debit.row.insufficient) {
    await admin
      .from("generations")
      .delete()
      .eq("id", generationId)
      .eq("user_id", userId);
    return jsonDetail(
      formatInsufficientCreditsDetail(
        creditsToDebit,
        debit.row.balance_remaining,
      ),
      402,
    );
  }

  const { data: task, error: taskError } = await admin
    .from("tasks")
    .insert({
      user_id: userId,
      type: "generate",
      status: "pending",
      generation_id: generationId,
      voice_id: voiceId,
      metadata: {
        voice_id: voiceId,
        voice_name: (voice as { name: string }).name,
        text_length: text.length,
        text_preview: text.length > 50 ? `${text.slice(0, 50)}...` : text,
        language,
        estimated_duration_minutes: estimatedMinutes,
        credits_debited: creditsToDebit,
        credits_remaining_after_debit: debit.row.balance_remaining,
      },
    })
    .select("id")
    .single();

  if (taskError || !task) {
    await applyCreditEvent(admin, {
      userId,
      eventKind: "refund",
      operation: "generate",
      amount: creditsToDebit,
      referenceType: "generation",
      referenceId: generationId,
      idempotencyKey: `generate:${generationId}:refund`,
      metadata: {
        reason: "task_insert_failed",
      },
    });

    await admin
      .from("generations")
      .delete()
      .eq("id", generationId)
      .eq("user_id", userId);

    if (isUniqueViolation(taskError)) {
      return jsonDetail(
        "A generation is already in progress. Please wait for it to finish before starting another.",
        409,
      );
    }

    return jsonDetail("Failed to create task.", 500);
  }

  try {
    const { job_id } = await submitJob({
      text,
      language,
      ref_audio_base64: audioB64,
      ref_text: refText,
      max_new_tokens: 4096,
    });

    const { error: updateError } = await admin
      .from("tasks")
      .update({ modal_job_id: job_id, status: "processing" })
      .eq("id", (task as { id: string }).id)
      .eq("user_id", userId);

    if (updateError) return jsonDetail("Failed to update task.", 500);

    return c.json({
      task_id: (task as { id: string }).id,
      status: "processing",
      is_long_running: true,
      estimated_duration_minutes: estimatedMinutes,
      generation_id: generationId,
    });
  } catch (e) {
    const message = e instanceof Error
      ? e.message
      : "Failed to submit generation job.";
    await admin
      .from("tasks")
      .update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", (task as { id: string }).id)
      .eq("user_id", userId);

    await admin
      .from("generations")
      .update({
        status: "failed",
        error_message: "Failed to generate speech. Please try again.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", generationId)
      .eq("user_id", userId);

    await applyCreditEvent(admin, {
      userId,
      eventKind: "refund",
      operation: "generate",
      amount: creditsToDebit,
      referenceType: "generation",
      referenceId: generationId,
      idempotencyKey: `generate:${generationId}:refund`,
      metadata: {
        reason: "modal_submit_failed",
      },
    });

    return jsonDetail("Failed to submit generation job.", 502);
  }
});
