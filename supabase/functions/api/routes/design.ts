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
import {
  getQwenConfig,
  getTtsProviderMode,
} from "../../_shared/tts/provider.ts";
import {
  normalizeProviderError,
  providerDetailMessage,
} from "../../_shared/tts/providers/errors.ts";
import { qwenProvider } from "../../_shared/tts/providers/qwen.ts";
import { resolveStorageUrl } from "../../_shared/urls.ts";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

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

function contentTypeForPreviewFormat(format: string): string {
  const normalized = format.trim().toLowerCase();
  if (normalized === "mp3") return "audio/mpeg";
  if (normalized === "opus") return "audio/ogg";
  if (normalized === "pcm") return "audio/wav";
  return "audio/wav";
}

async function refundDesignPreviewCredits(params: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  taskId: string;
  usedTrial: boolean;
  trialIdempotencyKey: string | null;
  creditsToDebit: number;
  reason: string;
}) {
  const {
    admin,
    userId,
    taskId,
    usedTrial,
    trialIdempotencyKey,
    creditsToDebit,
    reason,
  } = params;

  if (usedTrial && trialIdempotencyKey) {
    await trialRestore(admin, {
      userId,
      operation: "design_preview",
      idempotencyKey: trialIdempotencyKey,
      metadata: {
        reason,
        task_id: taskId,
      },
    });
    return;
  }

  await applyCreditEvent(admin, {
    userId,
    eventKind: "refund",
    operation: "design_preview",
    amount: creditsToDebit,
    referenceType: "task",
    referenceId: taskId,
    idempotencyKey: `design-preview:${taskId}:refund`,
    metadata: {
      reason,
    },
  });
}

async function runQwenDesignPreviewTask(params: {
  userId: string;
  taskId: string;
  text: string;
  language: string;
  instruct: string;
  name: string;
  usedTrial: boolean;
  trialIdempotencyKey: string | null;
  creditsToDebit: number;
}) {
  const {
    userId,
    taskId,
    text,
    language,
    instruct,
    name,
    usedTrial,
    trialIdempotencyKey,
    creditsToDebit,
  } = params;

  const admin = createAdminClient();

  const started = await admin
    .from("tasks")
    .update({
      status: "processing",
      provider_status: "provider_submitting",
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (started.error || !started.data) {
    return;
  }

  try {
    const created = await qwenProvider.createQwenDesignedVoice({
      preferredName: name,
      voicePrompt: instruct,
      previewText: text,
      language,
    });

    const previewBytes = qwenProvider.decodeBase64Audio(
      created.previewAudioData,
    );
    const ext = (created.previewResponseFormat || "wav").toLowerCase();
    const objectKey = `${userId}/preview_${taskId}.${ext}`;

    const upload = await admin.storage
      .from("references")
      .upload(objectKey, previewBytes, {
        contentType: contentTypeForPreviewFormat(ext),
        upsert: true,
      });

    if (upload.error) {
      throw new Error("Failed to upload preview audio.");
    }

    const nowIso = new Date().toISOString();
    await admin
      .from("tasks")
      .update({
        status: "completed",
        provider_status: "completed",
        completed_at: nowIso,
        result: {
          object_key: objectKey,
          provider_voice_id: created.providerVoiceId,
          provider_target_model: created.targetModel,
          provider_voice_kind: "vd",
          provider_request_id: created.requestId,
          preview_response_format: created.previewResponseFormat,
          preview_sample_rate: created.previewSampleRate,
        },
        error: null,
      })
      .eq("id", taskId)
      .eq("user_id", userId);
  } catch (error) {
    const normalized = normalizeProviderError(error);
    const message = providerDetailMessage(normalized);

    await admin
      .from("tasks")
      .update({
        status: "failed",
        provider_status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    await refundDesignPreviewCredits({
      admin,
      userId,
      taskId,
      usedTrial,
      trialIdempotencyKey,
      creditsToDebit,
      reason: "qwen_design_preview_failed",
    });
  }
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
  const preferredName = normalizeString(body.name) ??
    `design_${crypto.randomUUID().slice(0, 8)}`;

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

  let providerMode: "modal" | "qwen";
  try {
    providerMode = getTtsProviderMode();
  } catch (error) {
    return jsonDetail(
      error instanceof Error ? error.message : "Provider config error",
      500,
    );
  }

  const { data: task, error } = await admin
    .from("tasks")
    .insert({
      id: taskId,
      user_id: userId,
      type: "design_preview",
      status: "pending",
      provider: providerMode,
      provider_status: providerMode === "qwen" ? "provider_queued" : null,
      metadata: {
        text,
        language,
        instruct,
        name: preferredName,
        used_trial: usedTrial,
        trial_idempotency_key: trialIdempotencyKey,
        credits_debited: creditsDebited,
        credits_remaining_after_debit: charge.row.balance_remaining,
      },
    })
    .select("id")
    .single();

  if (error || !task) {
    await refundDesignPreviewCredits({
      admin,
      userId,
      taskId,
      usedTrial,
      trialIdempotencyKey,
      creditsToDebit,
      reason: "task_insert_failed",
    });
    return jsonDetail("Failed to create task.", 500);
  }

  if (providerMode === "qwen") {
    EdgeRuntime.waitUntil(
      runQwenDesignPreviewTask({
        userId,
        taskId,
        text,
        language,
        instruct,
        name: preferredName,
        usedTrial,
        trialIdempotencyKey,
        creditsToDebit,
      }),
    );
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

  let providerMode: "modal" | "qwen";
  try {
    providerMode = getTtsProviderMode();
  } catch (error) {
    return jsonDetail(
      error instanceof Error ? error.message : "Provider config error",
      500,
    );
  }
  const formData = await c.req.formData().catch(() => null);
  if (!formData) return jsonDetail("Invalid form data.", 400);

  const name = normalizeString(formData.get("name"));
  const text = normalizeString(formData.get("text"));
  const language = normalizeString(formData.get("language"));
  const instruct = normalizeString(formData.get("instruct"));

  if (!name || name.length > 100) {
    return jsonDetail("Name must be 1-100 characters.", 400);
  }
  if (!text) return jsonDetail("Preview text is required.", 400);
  if (!language) return jsonDetail("Language is required.", 400);
  if (!instruct) return jsonDetail("Voice description is required.", 400);

  const admin = createAdminClient();

  if (providerMode === "qwen") {
    const taskId = normalizeString(formData.get("task_id"));
    if (!taskId) {
      return jsonDetail("task_id is required when provider mode is qwen.", 400);
    }

    const taskRes = await admin
      .from("tasks")
      .select("id, status, type, provider, result")
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();

    if (taskRes.error) return jsonDetail("Failed to load preview task.", 500);
    if (!taskRes.data) return jsonDetail("Preview task not found.", 404);

    const task = taskRes.data as {
      id: string;
      status: string;
      type: string;
      provider: string;
      result: unknown;
    };

    if (task.type !== "design_preview" || task.provider !== "qwen") {
      return jsonDetail("Invalid preview task for qwen design save.", 409);
    }
    if (task.status !== "completed") {
      return jsonDetail("Preview task is not completed yet.", 409);
    }

    const taskResult = (task.result && typeof task.result === "object")
      ? task.result as Record<string, unknown>
      : {};

    const existingVoiceId = typeof taskResult.saved_voice_id === "string"
      ? taskResult.saved_voice_id
      : null;

    if (existingVoiceId) {
      const existingVoiceRes = await admin
        .from("voices")
        .select("id, name, description, language, source, reference_object_key")
        .eq("id", existingVoiceId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingVoiceRes.data) {
        const key =
          (existingVoiceRes.data as { reference_object_key: string | null })
            .reference_object_key;
        if (!key) {
          return jsonDetail("Saved voice is missing preview audio.", 500);
        }

        const signed = await admin.storage.from("references").createSignedUrl(
          key,
          3600,
        );
        if (signed.error || !signed.data?.signedUrl) {
          return jsonDetail("Failed to create signed URL.", 500);
        }

        return c.json({
          ...(existingVoiceRes.data as Record<string, unknown>),
          preview_url: resolveStorageUrl(c.req.raw, signed.data.signedUrl),
        });
      }
    }

    const objectKey = typeof taskResult.object_key === "string"
      ? taskResult.object_key
      : null;
    const providerVoiceId = typeof taskResult.provider_voice_id === "string"
      ? taskResult.provider_voice_id
      : null;
    const providerTargetModel =
      typeof taskResult.provider_target_model === "string"
        ? taskResult.provider_target_model
        : null;
    const providerRequestId = typeof taskResult.provider_request_id === "string"
      ? taskResult.provider_request_id
      : null;

    if (!objectKey || !providerVoiceId || !providerTargetModel) {
      return jsonDetail(
        "Preview task is missing provider metadata. Generate preview again.",
        409,
      );
    }

    const voiceId = crypto.randomUUID();
    let config: ReturnType<typeof getQwenConfig>;
    try {
      config = getQwenConfig();
    } catch (error) {
      return jsonDetail(
        error instanceof Error ? error.message : "Provider config error",
        500,
      );
    }

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
        tts_provider: "qwen",
        provider_voice_id: providerVoiceId,
        provider_target_model: providerTargetModel,
        provider_voice_kind: "vd",
        provider_region: config.region,
        provider_request_id: providerRequestId,
        provider_metadata: {
          design_preview_task_id: taskId,
        },
      })
      .select("id, name, description, language, source")
      .single();

    if (insertError || !voice) {
      return jsonDetail("Failed to create voice.", 500);
    }

    await admin
      .from("tasks")
      .update({
        result: {
          ...taskResult,
          saved_voice_id: voiceId,
        },
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    const signed = await admin.storage.from("references").createSignedUrl(
      objectKey,
      3600,
    );

    if (signed.error || !signed.data?.signedUrl) {
      return jsonDetail("Failed to create signed URL.", 500);
    }

    return c.json({
      ...(voice as Record<string, unknown>),
      preview_url: resolveStorageUrl(c.req.raw, signed.data.signedUrl),
    });
  }

  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return jsonDetail("Audio file is required.", 400);
  }
  if (audio.size <= 0) return jsonDetail("Audio file is empty.", 400);
  if (audio.size > 1_000_000) {
    return jsonDetail("Audio file must be under 1MB.", 400);
  }

  const voiceId = crypto.randomUUID();
  const objectKey = `${userId}/${voiceId}/reference.wav`;

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
      tts_provider: "modal",
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
