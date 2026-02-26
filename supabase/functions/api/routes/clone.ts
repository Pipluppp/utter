import { Hono } from "npm:hono@4";

import { requireUser } from "../../_shared/auth.ts";
import {
  applyCreditEvent,
  creditsForCloneTranscript,
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

export const cloneRoutes = new Hono();

cloneRoutes.post("/clone/upload-url", async (c) => {
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

  const name = normalizeString(body.name);
  const language = normalizeString(body.language);
  const transcript = normalizeString(body.transcript);

  if (!name || name.length > 100) {
    return jsonDetail("Name must be 1-100 characters.", 400);
  }
  if (!language) return jsonDetail("Language is required.", 400);
  if (!transcript) return jsonDetail("Transcript is required.", 400);

  const voiceId = crypto.randomUUID();
  const objectKey = `${userId}/${voiceId}/reference.wav`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("references")
    .createSignedUploadUrl(objectKey);

  if (error || !data?.signedUrl) {
    return jsonDetail("Failed to create signed upload URL.", 500);
  }

  return c.json({
    voice_id: voiceId,
    upload_url: resolveStorageUrl(c.req.raw, data.signedUrl),
    object_key: objectKey,
  });
});

cloneRoutes.post("/clone/finalize", async (c) => {
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

  const voiceId = normalizeString(body.voice_id);
  const name = normalizeString(body.name);
  const language = normalizeString(body.language);
  const transcript = normalizeString(body.transcript);
  const description = normalizeString(body.description);

  if (!voiceId) return jsonDetail("voice_id is required.", 400);
  if (!name || name.length > 100) {
    return jsonDetail("Name must be 1-100 characters.", 400);
  }
  if (!language) return jsonDetail("Language is required.", 400);
  if (!transcript) return jsonDetail("Transcript is required.", 400);

  const objectKey = `${userId}/${voiceId}/reference.wav`;

  const admin = createAdminClient();
  const { data: listing, error: listError } = await admin.storage
    .from("references")
    .list(`${userId}/${voiceId}`, { limit: 100 });

  if (listError) return jsonDetail("Failed to verify uploaded audio.", 500);
  const referenceObject = (listing ?? []).find((o) =>
    o.name === "reference.wav"
  );
  if (!referenceObject) return jsonDetail("Audio file not uploaded.", 400);

  const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
  const referenceSize = getObjectSizeBytes(referenceObject);
  if (referenceSize !== null && referenceSize > MAX_REFERENCE_BYTES) {
    return jsonDetail("Reference audio must be under 10MB.", 400);
  }

  const creditsToDebit = creditsForCloneTranscript();
  const chargeIdempotencyKey = `clone:${voiceId}:charge`;
  const charge = await trialOrDebit(admin, {
    userId,
    operation: "clone",
    debitAmount: creditsToDebit,
    referenceType: "voice",
    referenceId: voiceId,
    idempotencyKey: chargeIdempotencyKey,
    metadata: {
      reason: "clone_finalize",
      transcript_length: transcript.length,
      audio_bytes: referenceSize,
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

  if (charge.row.duplicate) {
    const existingVoice = await admin
      .from("voices")
      .select("id, name")
      .eq("id", voiceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingVoice.error) {
      return jsonDetail("Failed to load existing voice.", 500);
    }

    if (existingVoice.data) {
      const row = existingVoice.data as { id: string; name: string };
      return c.json({ id: row.id, name: row.name });
    }

    return jsonDetail(
      "Duplicate finalize request detected. Please start a new clone upload.",
      409,
    );
  }

  const usedTrial = charge.row.used_trial;
  let providerMode: "modal" | "qwen";
  try {
    providerMode = getTtsProviderMode();
  } catch (error) {
    return jsonDetail(
      error instanceof Error ? error.message : "Provider config error",
      500,
    );
  }

  let providerVoiceId: string | null = null;
  let providerTargetModel: string | null = null;
  let providerRequestId: string | null = null;
  let providerRegion: string | null = null;
  let providerMetadata: Record<string, unknown> = {};

  if (providerMode === "qwen") {
    try {
      const { data: signed, error: signedError } = await admin.storage
        .from("references")
        .createSignedUrl(objectKey, 600);

      if (signedError || !signed?.signedUrl) {
        throw new Error(
          "Failed to create signed URL for provider voice cloning.",
        );
      }

      const signedUrl = resolveStorageUrl(c.req.raw, signed.signedUrl);
      const created = await qwenProvider.createQwenCloneVoice({
        preferredName: name,
        referenceAudioUrl: signedUrl,
        transcript,
        language,
      });

      const config = getQwenConfig();
      providerVoiceId = created.providerVoiceId;
      providerTargetModel = created.targetModel;
      providerRequestId = created.requestId;
      providerRegion = config.region;
      providerMetadata = {
        usage: created.usage,
      };
    } catch (error) {
      if (usedTrial) {
        await trialRestore(admin, {
          userId,
          operation: "clone",
          idempotencyKey: chargeIdempotencyKey,
          metadata: {
            reason: "qwen_clone_failed",
            voice_id: voiceId,
          },
        });
      } else {
        await applyCreditEvent(admin, {
          userId,
          eventKind: "refund",
          operation: "clone",
          amount: creditsToDebit,
          referenceType: "voice",
          referenceId: voiceId,
          idempotencyKey: `clone:${voiceId}:refund`,
          metadata: {
            reason: "qwen_clone_failed",
          },
        });
      }

      const providerError = normalizeProviderError(error);
      return jsonDetail(providerDetailMessage(providerError), 502);
    }
  }

  const { data, error } = await admin
    .from("voices")
    .insert({
      id: voiceId,
      user_id: userId,
      name,
      language,
      source: "uploaded",
      reference_object_key: objectKey,
      reference_transcript: transcript,
      description: description ?? null,
      tts_provider: providerMode,
      provider_voice_id: providerVoiceId,
      provider_target_model: providerTargetModel,
      provider_voice_kind: providerMode === "qwen" ? "vc" : null,
      provider_region: providerRegion,
      provider_request_id: providerRequestId,
      provider_metadata: providerMetadata,
    })
    .select("id, name")
    .single();

  if (error || !data) {
    if (usedTrial) {
      await trialRestore(admin, {
        userId,
        operation: "clone",
        idempotencyKey: chargeIdempotencyKey,
        metadata: {
          reason: "voice_insert_failed",
          voice_id: voiceId,
        },
      });
    } else {
      await applyCreditEvent(admin, {
        userId,
        eventKind: "refund",
        operation: "clone",
        amount: creditsToDebit,
        referenceType: "voice",
        referenceId: voiceId,
        idempotencyKey: `clone:${voiceId}:refund`,
        metadata: {
          reason: "voice_insert_failed",
        },
      });
    }
    await admin.storage.from("references").remove([objectKey]).catch(() => {});
    return jsonDetail("Failed to create voice.", 500);
  }

  return c.json({ id: data.id, name: data.name });
});
