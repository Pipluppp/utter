import { Hono } from "npm:hono@4";
import { encodeBase64 } from "jsr:@std/encoding/base64";

import { requireUser } from "../../_shared/auth.ts";
import {
  applyCreditEvent,
  creditsForGenerateText,
  formatInsufficientCreditsDetail,
} from "../../_shared/credits.ts";
import { modalProvider } from "../../_shared/tts/providers/modal.ts";
import {
  getGenerateTextCapForMode,
  getQwenConfig,
  getTtsProviderMode,
} from "../../_shared/tts/provider.ts";
import {
  normalizeProviderError,
  providerDetailMessage,
} from "../../_shared/tts/providers/errors.ts";
import { qwenProvider } from "../../_shared/tts/providers/qwen.ts";
import { createAdminClient, createUserClient } from "../../_shared/supabase.ts";

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

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 1000);
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

async function refundGenerateCredits(params: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  generationId: string;
  amount: number;
  reason: string;
}) {
  await applyCreditEvent(params.admin, {
    userId: params.userId,
    eventKind: "refund",
    operation: "generate",
    amount: params.amount,
    referenceType: "generation",
    referenceId: params.generationId,
    idempotencyKey: `generate:${params.generationId}:refund`,
    metadata: {
      reason: params.reason,
    },
  });
}

async function markQwenGenerationCancelled(params: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  taskId: string;
  generationId: string;
  creditsToDebit: number;
  reason: string;
}) {
  const { admin, userId, taskId, generationId, creditsToDebit, reason } =
    params;
  const now = new Date();
  const nowIso = now.toISOString();

  const generationRes = await admin
    .from("generations")
    .select("created_at")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();

  const createdAt = parseIsoDate(
    (generationRes.data as { created_at?: string | null } | null)?.created_at ??
      null,
  );
  const generationTimeSeconds = createdAt
    ? secondsBetween(createdAt, now)
    : null;

  await admin
    .from("tasks")
    .update({
      status: "cancelled",
      provider_status: "cancelled",
      completed_at: nowIso,
      error: "Cancelled by user",
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .in("status", ["pending", "processing"]);

  await admin
    .from("generations")
    .update({
      status: "cancelled",
      error_message: "Cancelled by user",
      completed_at: nowIso,
      generation_time_seconds: generationTimeSeconds,
    })
    .eq("id", generationId)
    .eq("user_id", userId)
    .not("status", "in", "(completed,failed,cancelled)");

  await refundGenerateCredits({
    admin,
    userId,
    generationId,
    amount: creditsToDebit,
    reason,
  });
}

async function shouldCancelQwenTask(params: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  taskId: string;
}) {
  const { data } = await params.admin
    .from("tasks")
    .select("status, cancellation_requested")
    .eq("id", params.taskId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (!data) return true;
  const row = data as { status?: string; cancellation_requested?: boolean };
  return row.cancellation_requested === true || row.status === "cancelled";
}

async function processQwenGenerationTask(params: {
  userId: string;
  taskId: string;
  generationId: string;
  text: string;
  language: string;
  providerVoiceId: string;
  providerTargetModel: string;
  creditsToDebit: number;
}) {
  const {
    userId,
    taskId,
    generationId,
    text,
    language,
    providerVoiceId,
    providerTargetModel,
    creditsToDebit,
  } = params;

  const admin = createAdminClient();

  try {
    if (await shouldCancelQwenTask({ admin, userId, taskId })) {
      await markQwenGenerationCancelled({
        admin,
        userId,
        taskId,
        generationId,
        creditsToDebit,
        reason: "cancelled_before_submit",
      });
      return;
    }

    await admin
      .from("tasks")
      .update({
        status: "processing",
        provider_status: "provider_synthesizing",
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .in("status", ["pending", "processing"]);

    const synthesis = await qwenProvider.synthesizeQwenNonStreaming({
      model: providerTargetModel,
      text,
      voice: providerVoiceId,
      language,
    });

    if (await shouldCancelQwenTask({ admin, userId, taskId })) {
      await markQwenGenerationCancelled({
        admin,
        userId,
        taskId,
        generationId,
        creditsToDebit,
        reason: "cancelled_before_download",
      });
      return;
    }

    await admin
      .from("tasks")
      .update({
        provider_status: "provider_downloading",
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .in("status", ["pending", "processing"]);

    const downloaded = await qwenProvider.downloadQwenAudioWithRetry({
      url: synthesis.audioUrl,
      retries: 2,
    });

    if (await shouldCancelQwenTask({ admin, userId, taskId })) {
      await markQwenGenerationCancelled({
        admin,
        userId,
        taskId,
        generationId,
        creditsToDebit,
        reason: "cancelled_before_persist",
      });
      return;
    }

    await admin
      .from("tasks")
      .update({
        provider_status: "provider_persisting",
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .in("status", ["pending", "processing"]);

    const generationRes = await admin
      .from("generations")
      .select("audio_object_key, created_at")
      .eq("id", generationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (generationRes.error || !generationRes.data) {
      throw new Error("Failed to load generation row during finalization.");
    }

    const generationRow = generationRes.data as {
      audio_object_key?: string | null;
      created_at?: string | null;
    };

    const objectKey = generationRow.audio_object_key ||
      `${userId}/${generationId}.wav`;

    if (!generationRow.audio_object_key) {
      const upload = await admin.storage
        .from("generations")
        .upload(objectKey, downloaded.bytes, {
          contentType: downloaded.contentType || "audio/wav",
          upsert: true,
        });

      if (upload.error) {
        throw new Error("Failed to upload generation audio.");
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const createdAt = parseIsoDate(generationRow.created_at ?? null);
    const generationTimeSeconds = createdAt
      ? secondsBetween(createdAt, now)
      : null;

    await admin
      .from("generations")
      .update({
        audio_object_key: objectKey,
        status: "completed",
        completed_at: nowIso,
        generation_time_seconds: generationTimeSeconds,
        output_format: "wav",
        provider_metadata: {
          request_id: synthesis.requestId,
          audio_id: synthesis.audioId,
          audio_expires_at: synthesis.audioExpiresAt,
          usage: synthesis.usage,
        },
      })
      .eq("id", generationId)
      .eq("user_id", userId)
      .not("status", "in", "(completed,failed,cancelled)");

    await admin
      .from("tasks")
      .update({
        status: "completed",
        provider_status: "completed",
        completed_at: nowIso,
        result: {
          audio_url: `/api/generations/${generationId}/audio`,
        },
        error: null,
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .not("status", "in", "(completed,failed,cancelled)");
  } catch (error) {
    const normalized = normalizeProviderError(error);
    const message = providerDetailMessage(normalized);
    const nowIso = new Date().toISOString();

    await admin
      .from("tasks")
      .update({
        status: "failed",
        provider_status: "failed",
        completed_at: nowIso,
        error: message,
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .not("status", "in", "(completed,failed,cancelled)");

    await admin
      .from("generations")
      .update({
        status: "failed",
        error_message: message,
        completed_at: nowIso,
      })
      .eq("id", generationId)
      .eq("user_id", userId)
      .not("status", "in", "(completed,failed,cancelled)");

    await refundGenerateCredits({
      admin,
      userId,
      generationId,
      amount: creditsToDebit,
      reason: "qwen_generate_failed",
    });
  }
}

export const generateRoutes = new Hono();

generateRoutes.post("/generate", async (c) => {
  let userId: string;
  let userClient: ReturnType<typeof createUserClient>;
  try {
    const { user, supabase } = await requireUser(c.req.raw);
    userId = user.id;
    userClient = supabase;
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

  const maxTextChars = getGenerateTextCapForMode(providerMode);
  if (text.length > maxTextChars) {
    return jsonDetail(`Text cannot exceed ${maxTextChars} characters`, 400);
  }
  if (!language) return jsonDetail("Language is required.", 400);

  const { data: voice, error: voiceError } = await userClient
    .from("voices")
    .select(
      "id, name, reference_object_key, reference_transcript, tts_provider, provider_voice_id, provider_target_model, provider_voice_kind, deleted_at",
    )
    .eq("id", voiceId)
    .maybeSingle();

  if (voiceError) return jsonDetail("Failed to load voice.", 500);
  if (!voice) return jsonDetail("Voice not found", 404);

  const selectedVoice = voice as {
    name: string;
    reference_object_key: string | null;
    reference_transcript: string | null;
    tts_provider?: string | null;
    provider_voice_id?: string | null;
    provider_target_model?: string | null;
    provider_voice_kind?: string | null;
    deleted_at?: string | null;
  };

  if (selectedVoice.deleted_at) {
    return jsonDetail("Voice not found", 404);
  }

  const voiceProvider = selectedVoice.tts_provider ?? "modal";
  if (voiceProvider !== providerMode) {
    return jsonDetail(
      `Voice belongs to provider '${voiceProvider}'. Switch provider mode or create a ${providerMode} voice.`,
      409,
    );
  }

  const admin = createAdminClient();

  let refText: string | null = null;
  let refKey: string | null = null;

  if (providerMode === "modal") {
    refText = selectedVoice.reference_transcript;
    refKey = selectedVoice.reference_object_key;

    if (!refText) {
      return jsonDetail(
        "This voice has no reference transcript. Re-clone with a transcript to use Qwen3-TTS.",
        400,
      );
    }
    if (!refKey) return jsonDetail("Voice has no reference audio.", 400);

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
  }

  if (providerMode === "qwen") {
    const providerVoiceId = selectedVoice.provider_voice_id;
    const providerTargetModel = selectedVoice.provider_target_model;

    if (!providerVoiceId || !providerTargetModel) {
      return jsonDetail(
        "Voice is missing qwen provider metadata. Re-clone or redesign this voice.",
        409,
      );
    }

    let qwenConfig: ReturnType<typeof getQwenConfig>;
    try {
      qwenConfig = getQwenConfig();
    } catch (error) {
      return jsonDetail(
        error instanceof Error ? error.message : "Provider config error",
        500,
      );
    }
    const allowedTargets = new Set([
      qwenConfig.vcTargetModel,
      qwenConfig.vdTargetModel,
    ]);

    if (!allowedTargets.has(providerTargetModel)) {
      return jsonDetail(
        "Voice target model is not supported by current qwen rollout configuration.",
        409,
      );
    }

    const kind = selectedVoice.provider_voice_kind;
    if (kind === "vc" && providerTargetModel !== qwenConfig.vcTargetModel) {
      return jsonDetail("Voice/provider model mismatch (vc).", 409);
    }
    if (kind === "vd" && providerTargetModel !== qwenConfig.vdTargetModel) {
      return jsonDetail("Voice/provider model mismatch (vd).", 409);
    }
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
      tts_provider: providerMode,
      provider_model: providerMode === "qwen"
        ? selectedVoice.provider_target_model
        : null,
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
      provider: providerMode,
      provider_status: providerMode === "qwen" ? "provider_submitting" : null,
      metadata: {
        voice_id: voiceId,
        voice_name: selectedVoice.name,
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
    await refundGenerateCredits({
      admin,
      userId,
      generationId,
      amount: creditsToDebit,
      reason: "task_insert_failed",
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

  const taskId = (task as { id: string }).id;

  if (providerMode === "qwen") {
    EdgeRuntime.waitUntil(
      processQwenGenerationTask({
        userId,
        taskId,
        generationId,
        text,
        language,
        providerVoiceId: selectedVoice.provider_voice_id ?? "",
        providerTargetModel: selectedVoice.provider_target_model ?? "",
        creditsToDebit,
      }),
    );

    return c.json({
      task_id: taskId,
      status: "processing",
      is_long_running: true,
      estimated_duration_minutes: estimatedMinutes,
      generation_id: generationId,
    });
  }

  try {
    const refKey = selectedVoice.reference_object_key;
    const refText = selectedVoice.reference_transcript;
    if (!refKey || !refText) {
      throw new Error("Voice has no reference audio or transcript.");
    }

    const { data: audioBlob, error: downloadError } = await admin.storage
      .from("references")
      .download(refKey);
    if (downloadError || !audioBlob) {
      throw new Error("Failed to download reference audio.");
    }

    const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
    const audioB64 = encodeBase64(audioBytes);

    const { job_id } = await modalProvider.submitJob({
      text,
      language,
      ref_audio_base64: audioB64,
      ref_text: refText,
      max_new_tokens: 4096,
    });

    const { error: updateError } = await admin
      .from("tasks")
      .update({
        modal_job_id: job_id,
        provider_job_id: job_id,
        status: "processing",
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    if (updateError) return jsonDetail("Failed to update task.", 500);

    return c.json({
      task_id: taskId,
      status: "processing",
      is_long_running: true,
      estimated_duration_minutes: estimatedMinutes,
      generation_id: generationId,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Failed to submit generation job.";

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

    await admin
      .from("generations")
      .update({
        status: "failed",
        error_message: "Failed to generate speech. Please try again.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", generationId)
      .eq("user_id", userId);

    await refundGenerateCredits({
      admin,
      userId,
      generationId,
      amount: creditsToDebit,
      reason: "modal_submit_failed",
    });

    return jsonDetail("Failed to submit generation job.", 502);
  }
});
