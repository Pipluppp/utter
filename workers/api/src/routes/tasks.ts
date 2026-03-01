import { Hono } from "hono";

import { requireUser } from "../_shared/auth.ts";
import { applyCreditEvent, trialRestore } from "../_shared/credits.ts";
import { createStorageProvider } from "../_shared/storage.ts";
import { modalProvider } from "../_shared/tts/providers/modal.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const tasksRoutes = new Hono();

function isTerminal(status: string) {
  return status === "completed" || status === "failed" ||
    status === "cancelled";
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 1000);
}

function queueFlagEnabled(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
}

function inferDebitedCredits(type: string, metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;

  const explicit = asPositiveInt(record.credits_debited);
  if (explicit) return explicit;

  if (type === "generate") {
    return asPositiveInt(record.text_length);
  }

  if (type === "design_preview") {
    const text = typeof record.text === "string" ? record.text.length : 0;
    const instruct = typeof record.instruct === "string"
      ? record.instruct.length
      : 0;
    const inferred = text + instruct;
    return inferred > 0 ? inferred : null;
  }

  return null;
}

async function refundTaskCredits(params: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  taskId: string;
  taskType: string;
  generationId: string | null;
  metadata: unknown;
  reason: string;
}) {
  const { admin, userId, taskId, taskType, generationId, metadata, reason } =
    params;
  const amount = inferDebitedCredits(taskType, metadata);

  if (taskType === "generate") {
    if (!amount) return;

    const referenceId = generationId ?? taskId;
    const idempotencyKey = generationId
      ? `generate:${generationId}:refund`
      : `generate:${taskId}:refund`;

    await applyCreditEvent(admin, {
      userId,
      eventKind: "refund",
      operation: "generate",
      amount,
      referenceType: "generation",
      referenceId,
      idempotencyKey,
      metadata: {
        reason,
        task_id: taskId,
      },
    });
    return;
  }

  if (taskType === "design_preview") {
    const record = metadata && typeof metadata === "object"
      ? metadata as Record<string, unknown>
      : {};
    const usedTrial = record.used_trial === true;
    const trialKey = typeof record.trial_idempotency_key === "string"
      ? record.trial_idempotency_key.trim()
      : "";

    if (usedTrial && trialKey) {
      await trialRestore(admin, {
        userId,
        operation: "design_preview",
        idempotencyKey: trialKey,
        metadata: {
          reason,
          task_id: taskId,
        },
      });
      return;
    }

    if (!amount) return;

    await applyCreditEvent(admin, {
      userId,
      eventKind: "refund",
      operation: "design_preview",
      amount,
      referenceType: "task",
      referenceId: taskId,
      idempotencyKey: `design-preview:${taskId}:refund`,
      metadata: {
        reason,
      },
    });
  }
}

export async function processModalDesignPreviewTask(params: {
  taskId: string;
  userId: string;
  req: Request;
  text?: string;
  language?: string;
  instruct?: string;
}) {
  const { taskId, userId, req } = params;
  const admin = createAdminClient();
  const storage = createStorageProvider({ admin, req });

  const taskRes = await admin
    .from("tasks")
    .select("id, type, status, provider, metadata")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskRes.error || !taskRes.data) return;

  const task = taskRes.data as {
    id: string;
    type: string;
    status: string;
    provider: string | null;
    metadata: unknown;
  };

  if (isTerminal(task.status)) return;
  if (task.type !== "design_preview") return;
  if ((task.provider ?? "modal") !== "modal") return;

  await admin
    .from("tasks")
    .update({
      status: "processing",
      // Keep provider_queued until terminal; this tells GET /tasks to stay read-only.
      provider_status: "provider_queued",
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .in("status", ["pending", "processing"]);

  const metadata = task.metadata && typeof task.metadata === "object"
    ? task.metadata as Record<string, unknown>
    : {};
  const text = (params.text ??
    (typeof metadata.text === "string" ? metadata.text : "")).trim();
  const language = (params.language ??
    (typeof metadata.language === "string" ? metadata.language : "English"))
    .trim() || "English";
  const instruct = (params.instruct ??
    (typeof metadata.instruct === "string" ? metadata.instruct : "")).trim();

  if (!text || !instruct) {
    await admin
      .from("tasks")
      .update({
        status: "failed",
        provider_status: "failed",
        error: "Invalid design preview task metadata.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    await refundTaskCredits({
      admin,
      userId,
      taskId,
      taskType: "design_preview",
      generationId: null,
      metadata: task.metadata,
      reason: "invalid_design_preview_metadata",
    });
    return;
  }

  try {
    const bytes = await modalProvider.designVoicePreviewBytes({
      text,
      language,
      instruct,
    });
    const objectKey = `${userId}/preview_${taskId}.wav`;
    const upload = await storage.upload(
      "references",
      objectKey,
      new Uint8Array(bytes),
      {
        contentType: "audio/wav",
        upsert: true,
      },
    );
    if (upload.error) throw new Error("Failed to upload preview audio.");

    const nowIso = new Date().toISOString();
    await admin
      .from("tasks")
      .update({
        status: "completed",
        provider_status: "completed",
        completed_at: nowIso,
        result: { object_key: objectKey },
        error: null,
      })
      .eq("id", taskId)
      .eq("user_id", userId);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Failed to design voice preview.";
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
    await refundTaskCredits({
      admin,
      userId,
      taskId,
      taskType: "design_preview",
      generationId: null,
      metadata: task.metadata,
      reason: "design_preview_generation_failed",
    });
  }
}

export async function processModalGenerateCheckTask(params: {
  taskId: string;
  userId: string;
  generationId: string | null;
  providerJobId: string;
  req: Request;
}): Promise<{ requeueDelaySeconds: number | null }> {
  const { taskId, userId, req } = params;
  const admin = createAdminClient();
  const storage = createStorageProvider({ admin, req });

  const taskRes = await admin
    .from("tasks")
    .select(
      "id, type, status, provider, metadata, generation_id, provider_job_id, modal_job_id",
    )
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskRes.error || !taskRes.data) return { requeueDelaySeconds: null };

  const task = taskRes.data as {
    id: string;
    type: string;
    status: string;
    provider: string | null;
    metadata: unknown;
    generation_id: string | null;
    provider_job_id: string | null;
    modal_job_id: string | null;
  };

  if (isTerminal(task.status)) return { requeueDelaySeconds: null };
  if (task.type !== "generate") return { requeueDelaySeconds: null };
  if ((task.provider ?? "modal") !== "modal") return { requeueDelaySeconds: null };

  const generationId = params.generationId ?? task.generation_id;
  const modalJobId = params.providerJobId || task.provider_job_id ||
    task.modal_job_id;
  if (!generationId || !modalJobId) {
    return { requeueDelaySeconds: null };
  }

  const pollResult = await admin.rpc("increment_task_modal_poll_count", {
    p_task_id: taskId,
    p_user_id: userId,
  });
  if (pollResult.error) {
    console.warn("tasks.modal_poll_count_increment_failed", {
      taskId,
      userId,
      error: pollResult.error.message,
    });
  }

  let modal;
  try {
    modal = await modalProvider.checkJobStatus(modalJobId);
  } catch {
    return { requeueDelaySeconds: 5 };
  }

  const modalStatus = (modal.status ?? "").toLowerCase();
  if (modalStatus === "failed") {
    const message = modal.error || "Generation failed. Please try again.";
    const nowIso = new Date().toISOString();
    await admin
      .from("tasks")
      .update({
        status: "failed",
        provider_status: "failed",
        error: message,
        completed_at: nowIso,
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    await admin
      .from("generations")
      .update({
        status: "failed",
        error_message: message,
        completed_at: nowIso,
      })
      .eq("id", generationId)
      .eq("user_id", userId);

    await refundTaskCredits({
      admin,
      userId,
      taskId,
      taskType: "generate",
      generationId,
      metadata: task.metadata,
      reason: "modal_reported_failed",
    });
    return { requeueDelaySeconds: null };
  }

  const ready = modalStatus === "completed" && Boolean(modal.result_ready);
  if (!ready) {
    await admin
      .from("tasks")
      .update({
        status: "processing",
        provider_status: "provider_queued",
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .in("status", ["pending", "processing"]);
    return { requeueDelaySeconds: 5 };
  }

  const { data: gen, error: genError } = await admin
    .from("generations")
    .select("id, created_at, audio_object_key")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (genError || !gen) return { requeueDelaySeconds: null };

  const existingKey =
    (gen as { audio_object_key: string | null }).audio_object_key;
  const objectKey = existingKey || `${userId}/${generationId}.wav`;
  const now = new Date();
  const nowIso = now.toISOString();

  if (!existingKey) {
    let bytes: ArrayBuffer;
    try {
      bytes = await modalProvider.getJobResultBytes(modalJobId);
    } catch {
      return { requeueDelaySeconds: 5 };
    }

    const uploadRes = await storage.upload(
      "generations",
      objectKey,
      new Uint8Array(bytes),
      {
        contentType: "audio/wav",
        upsert: true,
      },
    );
    if (uploadRes.error) throw new Error("Failed to upload generation audio.");

    const createdAt = parseIsoDate((gen as { created_at: string | null }).created_at);
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
      })
      .eq("id", generationId)
      .eq("user_id", userId)
      .not("status", "in", "(completed,failed,cancelled)")
      .is("audio_object_key", null);
  }

  await admin
    .from("tasks")
    .update({
      status: "completed",
      provider_status: "completed",
      completed_at: nowIso,
      result: { audio_url: `/api/generations/${generationId}/audio` },
      error: null,
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .in("status", ["pending", "processing"]);

  return { requeueDelaySeconds: null };
}

tasksRoutes.get("/tasks/:id", async (c) => {
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

  const taskId = c.req.param("id");
  const { data: task, error } = await supabase
    .from("tasks")
    .select(
      "id, type, status, result, error, provider, provider_status, provider_poll_count, provider_job_id, modal_poll_count, modal_job_id, generation_id, created_at, metadata",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (error) return jsonDetail("Failed to load task.", 500);
  if (!task) return jsonDetail("Task not found.", 404);

  const taskRow = task as {
    id: string;
    type: string;
    status: string;
    result: unknown;
    error: string | null;
    provider: string | null;
    provider_status: string | null;
    provider_poll_count: number | null;
    provider_job_id: string | null;
    modal_poll_count: number | null;
    modal_job_id: string | null;
    generation_id: string | null;
    created_at: string | null;
    metadata: unknown;
  };

  const provider = taskRow.provider ?? "modal";

  const base = {
    id: taskRow.id,
    type: taskRow.type,
    status: taskRow.status,
    result: taskRow.result ?? undefined,
    error: taskRow.error ?? null,
    provider,
    provider_status: taskRow.provider_status ?? null,
    provider_poll_count: taskRow.provider_poll_count ?? 0,
    modal_status: null as string | null,
    modal_elapsed_seconds: null as number | null,
    modal_poll_count: taskRow.modal_poll_count ?? 0,
  };

  const status = base.status;
  const type = base.type;
  const modalJobId = taskRow.modal_job_id ?? taskRow.provider_job_id;
  const generationId = taskRow.generation_id;
  const queueModalEnabled = queueFlagEnabled(
    (c.env as { QUEUE_MODAL_RECHECK_ENABLED?: string }).QUEUE_MODAL_RECHECK_ENABLED,
  );

  if (provider === "qwen") {
    if (status === "completed" && type === "design_preview") {
      const currentResult = (typeof base.result === "object" && base.result)
        ? base.result as Record<string, unknown>
        : {};
      const objectKey = typeof currentResult.object_key === "string"
        ? currentResult.object_key
        : null;
      if (objectKey) {
        const admin = createAdminClient();
        const storage = createStorageProvider({ admin, req: c.req.raw });
        const { data: signed, error: signedError } = await storage.createSignedUrl(
          "references",
          objectKey,
          3600,
        );
        if (!signedError && signed?.signedUrl) {
          base.result = {
            ...currentResult,
            audio_url: signed.signedUrl,
          };
        }
      }
    }

    if (status === "completed" && generationId) {
      base.result = {
        ...(typeof base.result === "object" && base.result ? base.result : {}),
        audio_url: `/api/generations/${generationId}/audio`,
      };
    }

    return c.json(base);
  }

  if (
    queueModalEnabled &&
    provider === "modal" &&
    !isTerminal(status) &&
    taskRow.provider_status === "provider_queued"
  ) {
    return c.json(base);
  }

  if (!isTerminal(status) && type === "design_preview" && !modalJobId) {
    const admin = createAdminClient();
    if (status !== "pending") {
      const { data: pollCount, error: pollError } = await admin.rpc(
        "increment_task_modal_poll_count",
        { p_task_id: taskId, p_user_id: userId },
      );
      if (!pollError && typeof pollCount === "number") {
        base.modal_poll_count = pollCount;
        base.provider_poll_count = pollCount;
      }
      base.status = "processing";
      base.modal_status = "processing";
      base.provider_status = "processing";
      return c.json(base);
    }

    const claimed = await admin
      .from("tasks")
      .update({ status: "processing", provider_status: "processing" })
      .eq("id", taskId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimed.error) {
      return jsonDetail("Failed to start design preview.", 500);
    }
    if (!claimed.data) {
      base.status = "processing";
      base.modal_status = "processing";
      base.provider_status = "processing";
      return c.json(base);
    }

    const { data: pollCount, error: pollError } = await admin.rpc(
      "increment_task_modal_poll_count",
      { p_task_id: taskId, p_user_id: userId },
    );
    if (!pollError && typeof pollCount === "number") {
      base.modal_poll_count = pollCount;
      base.provider_poll_count = pollCount;
    }

    const metadata = taskRow.metadata as
      | { text?: string; language?: string; instruct?: string }
      | null;

    const text = typeof metadata?.text === "string" ? metadata.text.trim() : "";
    const language = typeof metadata?.language === "string"
      ? metadata.language.trim()
      : "English";
    const instruct = typeof metadata?.instruct === "string"
      ? metadata.instruct.trim()
      : "";

    if (!text || !instruct) {
      await admin
        .from("tasks")
        .update({
          status: "failed",
          provider_status: "failed",
          error: "Invalid design preview task metadata.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("user_id", userId);
      await refundTaskCredits({
        admin,
        userId,
        taskId,
        taskType: type,
        generationId,
        metadata: taskRow.metadata,
        reason: "invalid_design_preview_metadata",
      });

      base.status = "failed";
      base.provider_status = "failed";
      base.error = "Invalid design preview task metadata.";
      return c.json(base);
    }

    c.executionCtx.waitUntil((async () => {
      const bgAdmin = createAdminClient();
      const bgStorage = createStorageProvider({ admin: bgAdmin, req: c.req.raw });
      try {
        const bytes = await modalProvider.designVoicePreviewBytes({
          text,
          language,
          instruct,
        });
        const objectKey = `${userId}/preview_${taskId}.wav`;
        const upload = await bgStorage.upload(
          "references",
          objectKey,
          new Uint8Array(bytes),
          {
            contentType: "audio/wav",
            upsert: true,
          },
        );
        if (upload.error) throw new Error("Failed to upload preview audio.");

        const nowIso = new Date().toISOString();
        await bgAdmin
          .from("tasks")
          .update({
            status: "completed",
            provider_status: "completed",
            completed_at: nowIso,
            result: { object_key: objectKey },
            error: null,
          })
          .eq("id", taskId)
          .eq("user_id", userId);
      } catch (e) {
        const message = e instanceof Error
          ? e.message
          : "Failed to design voice preview.";
        await bgAdmin
          .from("tasks")
          .update({
            status: "failed",
            provider_status: "failed",
            error: message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .eq("user_id", userId);
        await refundTaskCredits({
          admin: bgAdmin,
          userId,
          taskId,
          taskType: "design_preview",
          generationId: null,
          metadata: taskRow.metadata,
          reason: "design_preview_generation_failed",
        });
      }
    })());

    base.status = "processing";
    base.modal_status = "processing";
    base.provider_status = "processing";
    return c.json(base);
  }

  if (isTerminal(status) || !modalJobId) {
    if (status === "completed" && type === "design_preview") {
      const currentResult = (typeof base.result === "object" && base.result)
        ? base.result as Record<string, unknown>
        : {};
      const objectKey = typeof currentResult.object_key === "string"
        ? currentResult.object_key
        : null;
      if (objectKey) {
        const admin = createAdminClient();
        const storage = createStorageProvider({ admin, req: c.req.raw });
        const { data: signed, error: signedError } = await storage.createSignedUrl(
          "references",
          objectKey,
          3600,
        );
        if (!signedError && signed?.signedUrl) {
          base.result = {
            ...currentResult,
            audio_url: signed.signedUrl,
          };
        }
      }
    }

    if (status === "completed" && generationId) {
      base.result = {
        ...(typeof base.result === "object" && base.result ? base.result : {}),
        audio_url: `/api/generations/${generationId}/audio`,
      };
    }
    return c.json(base);
  }

  const admin = createAdminClient();
  const storage = createStorageProvider({ admin, req: c.req.raw });
  const { data: pollCount, error: pollError } = await admin.rpc(
    "increment_task_modal_poll_count",
    { p_task_id: taskId, p_user_id: userId },
  );
  if (!pollError && typeof pollCount === "number") {
    base.modal_poll_count = pollCount;
    base.provider_poll_count = pollCount;
  }

  let modal;
  try {
    modal = await modalProvider.checkJobStatus(modalJobId);
  } catch (e) {
    base.modal_status = "status_error";
    base.provider_status = "status_error";
    base.error = e instanceof Error ? e.message : "Failed to check job status.";
    return c.json(base);
  }

  base.modal_status = modal.status ?? null;
  base.provider_status = modal.status ?? base.provider_status;
  base.modal_elapsed_seconds = typeof modal.elapsed_seconds === "number"
    ? modal.elapsed_seconds
    : null;

  const modalStatus = (modal.status ?? "").toLowerCase();

  if (modalStatus === "failed") {
    const message = modal.error || "Generation failed. Please try again.";
    const nowIso = new Date().toISOString();
    await admin
      .from("tasks")
      .update({
        status: "failed",
        provider_status: "failed",
        error: message,
        completed_at: nowIso,
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    if (generationId) {
      await admin
        .from("generations")
        .update({
          status: "failed",
          error_message: message,
          completed_at: nowIso,
        })
        .eq("id", generationId)
        .eq("user_id", userId);
    }

    await refundTaskCredits({
      admin,
      userId,
      taskId,
      taskType: type,
      generationId,
      metadata: taskRow.metadata,
      reason: "modal_reported_failed",
    });

    base.status = "failed";
    base.provider_status = "failed";
    base.error = message;
    return c.json(base);
  }

  const ready = modalStatus === "completed" && Boolean(modal.result_ready);
  if (!ready || !generationId) {
    if (status !== "processing") {
      await admin
        .from("tasks")
        .update({
          status: "processing",
          provider_status: modalStatus || "processing",
        })
        .eq("id", taskId)
        .eq("user_id", userId);
    }
    base.status = "processing";
    return c.json(base);
  }

  const { data: gen, error: genError } = await admin
    .from("generations")
    .select("id, created_at, audio_object_key")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (genError) return jsonDetail("Failed to load generation.", 500);
  if (!gen) return jsonDetail("Generation not found.", 404);

  const existingKey =
    (gen as { audio_object_key: string | null }).audio_object_key;
  const objectKey = existingKey || `${userId}/${generationId}.wav`;
  const now = new Date();
  const nowIso = now.toISOString();

  if (!existingKey) {
    let bytes: ArrayBuffer;
    try {
      bytes = await modalProvider.getJobResultBytes(modalJobId);
    } catch (e) {
      base.status = "processing";
      base.modal_status = "finalizing";
      base.provider_status = "finalizing";
      base.error = e instanceof Error ? e.message : null;
      return c.json(base);
    }

    const uploadRes = await storage.upload(
      "generations",
      objectKey,
      new Uint8Array(bytes),
      {
        contentType: "audio/wav",
        upsert: true,
      },
    );
    if (uploadRes.error) {
      return jsonDetail("Failed to upload generation audio.", 500);
    }

    const createdAt = parseIsoDate(
      (gen as { created_at: string | null }).created_at,
    );
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
      })
      .eq("id", generationId)
      .eq("user_id", userId)
      .not("status", "in", "(completed,failed,cancelled)")
      .is("audio_object_key", null);
  }

  const completeTaskUpdate = await admin
    .from("tasks")
    .update({
      status: "completed",
      provider_status: "completed",
      completed_at: nowIso,
      result: { audio_url: `/api/generations/${generationId}/audio` },
      error: null,
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .in("status", ["pending", "processing"])
    .select("id")
    .maybeSingle();

  if (completeTaskUpdate.error) {
    return jsonDetail("Failed to update task.", 500);
  }
  if (!completeTaskUpdate.data) {
    const { data: currentTask } = await admin
      .from("tasks")
      .select("status, provider_status, result, error")
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();

    if (currentTask) {
      const row = currentTask as {
        status?: string | null;
        provider_status?: string | null;
        result?: unknown;
        error?: string | null;
      };
      base.status = row.status ?? base.status;
      base.provider_status = row.provider_status ?? base.provider_status;
      base.result = row.result ?? base.result;
      base.error = row.error ?? base.error;
    }
    return c.json(base);
  }

  base.status = "completed";
  base.provider_status = "completed";
  base.result = { audio_url: `/api/generations/${generationId}/audio` };
  base.error = null;
  return c.json(base);
});

tasksRoutes.delete("/tasks/:id", async (c) => {
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

  const taskId = c.req.param("id");
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .maybeSingle();

  if (error) return jsonDetail("Failed to load task.", 500);
  if (!task) return jsonDetail("Task not found.", 404);

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);

  if (deleteError) return jsonDetail("Failed to delete task.", 500);
  return c.json({ ok: true });
});

tasksRoutes.post("/tasks/:id/cancel", async (c) => {
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

  const taskId = c.req.param("id");
  const { data: task, error } = await supabase
    .from("tasks")
    .select(
      "id, type, status, provider, provider_job_id, modal_job_id, generation_id, created_at, metadata",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (error) return jsonDetail("Failed to load task.", 500);
  if (!task) return jsonDetail("Task not found.", 404);

  const taskRow = task as {
    status: string;
    provider: string | null;
    provider_job_id: string | null;
    modal_job_id: string | null;
    generation_id: string | null;
    type: string;
    created_at: string | null;
    metadata: unknown;
  };

  const status = taskRow.status;
  if (status !== "pending" && status !== "processing") {
    return jsonDetail(`Cannot cancel task with status: ${status}`, 400);
  }

  const provider = taskRow.provider ?? "modal";
  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const generationId = taskRow.generation_id;

  if (provider === "qwen") {
    const cancelUpdate = await admin
      .from("tasks")
      .update({
        cancellation_requested: true,
        status: "cancelled",
        provider_status: "cancelled",
        error: "Cancelled by user",
        completed_at: nowIso,
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .in("status", ["pending", "processing"])
      .select("id")
      .maybeSingle();

    if (cancelUpdate.error) return jsonDetail("Failed to cancel task.", 500);
    if (!cancelUpdate.data) {
      return jsonDetail("Task is no longer cancellable.", 409);
    }

    if (generationId) {
      const createdAt = parseIsoDate(taskRow.created_at);
      const generationTimeSeconds = createdAt
        ? secondsBetween(createdAt, now)
        : null;
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
    }

    await refundTaskCredits({
      admin,
      userId,
      taskId,
      taskType: taskRow.type,
      generationId,
      metadata: taskRow.metadata,
      reason: "cancelled_by_user",
    });

    return c.json({ cancelled: true, task_id: taskId });
  }

  const cancelUpdate = await admin
    .from("tasks")
    .update({
      status: "cancelled",
      provider_status: "cancelled",
      error: "Cancelled by user",
      completed_at: nowIso,
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .in("status", ["pending", "processing"])
    .select("id")
    .maybeSingle();

  if (cancelUpdate.error) return jsonDetail("Failed to cancel task.", 500);
  if (!cancelUpdate.data) {
    return jsonDetail("Task is no longer cancellable.", 409);
  }

  const modalJobId = taskRow.provider_job_id ?? taskRow.modal_job_id;
  if (modalJobId) await modalProvider.cancelJob(modalJobId);

  if (generationId) {
    const createdAt = parseIsoDate(taskRow.created_at);
    const generationTimeSeconds = createdAt
      ? secondsBetween(createdAt, now)
      : null;
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
  }

  await refundTaskCredits({
    admin,
    userId,
    taskId,
    taskType: taskRow.type,
    generationId,
    metadata: taskRow.metadata,
    reason: "cancelled_by_user",
  });

  return c.json({ cancelled: true, task_id: taskId });
});
