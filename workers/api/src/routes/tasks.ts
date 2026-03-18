import { Hono } from "hono";

import { requireUser } from "../_shared/auth.ts";
import { applyCreditEvent, trialRestore } from "../_shared/credits.ts";
import { createStorageProvider } from "../_shared/storage.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";
import {
  ACTIVE_TASK_STATUSES,
  describeTaskDisplay,
  originPageForTaskType,
  QUEUE_BACKED_TASK_TYPES,
} from "../_shared/tasks.ts";

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 1000);
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
}

function parseLimit(value: string | null | undefined): number {
  if (!value) return 20;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  const normalized = Math.floor(parsed);
  if (normalized < 1) return 20;
  return Math.min(normalized, 50);
}

function parseTaskListStatus(
  value: string | null | undefined,
): "active" | "terminal" | "all" {
  if (value === "terminal" || value === "all") return value;
  return "active";
}

function parseTaskListType(
  value: string | null | undefined,
): "all" | typeof QUEUE_BACKED_TASK_TYPES[number] {
  if (value === "generate" || value === "design_preview") return value;
  return "all";
}

function parseBeforeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type TaskListRow = {
  id: string;
  type: string;
  status: string;
  created_at: string | null;
  completed_at: string | null;
  provider: string | null;
  provider_status: string | null;
  generation_id: string | null;
  metadata: unknown;
  error: string | null;
};

function serializeTaskListItem(task: TaskListRow) {
  const display = describeTaskDisplay(task.type, task.metadata);
  const supportsCancel =
    task.status === "pending" || task.status === "processing";

  return {
    id: task.id,
    type: task.type,
    status: task.status,
    created_at: task.created_at,
    completed_at: task.completed_at,
    provider: task.provider ?? "qwen",
    provider_status: task.provider_status ?? null,
    generation_id: task.generation_id,
    title: display.title,
    subtitle: display.subtitle,
    language: display.language,
    voice_name: display.voiceName,
    text_preview: display.textPreview,
    estimated_duration_minutes: display.estimatedDurationMinutes,
    origin_page: originPageForTaskType(task.type),
    supports_cancel: supportsCancel,
    error: task.error ?? null,
  };
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

export const tasksRoutes = new Hono();

tasksRoutes.get("/tasks", async (c) => {
  let supabase: ReturnType<typeof createUserClient>;
  try {
    const { supabase: userClient } = await requireUser(c.req.raw);
    supabase = userClient;
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const statusFilter = parseTaskListStatus(c.req.query("status"));
  const typeFilter = parseTaskListType(c.req.query("type"));
  const limit = parseLimit(c.req.query("limit"));
  const before = parseBeforeTimestamp(c.req.query("before"));

  let query = supabase
    .from("tasks")
    .select(
      "id, type, status, created_at, completed_at, provider, provider_status, generation_id, metadata, error",
    )
    .in("type", [...QUEUE_BACKED_TASK_TYPES])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (statusFilter === "active") {
    query = query.in("status", [...ACTIVE_TASK_STATUSES]);
  } else if (statusFilter === "terminal") {
    query = query.not("status", "in", `(${ACTIVE_TASK_STATUSES.join(",")})`);
  }

  if (typeFilter !== "all") {
    query = query.eq("type", typeFilter);
  }

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error) return jsonDetail("Failed to load tasks.", 500);

  const rows = (data ?? []) as TaskListRow[];
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const nextBefore = hasMore ? sliced[sliced.length - 1]?.created_at ?? null : null;

  return c.json({
    tasks: sliced.map(serializeTaskListItem),
    status: statusFilter,
    type: typeFilter,
    limit,
    next_before: nextBefore,
  });
});

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
      "id, type, status, result, error, provider, provider_status, provider_poll_count, modal_poll_count, generation_id, created_at, completed_at, metadata",
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
    modal_poll_count: number | null;
    generation_id: string | null;
    created_at: string | null;
    completed_at: string | null;
    metadata: unknown;
  };

  const display = describeTaskDisplay(taskRow.type, taskRow.metadata);

  const base = {
    id: taskRow.id,
    type: taskRow.type,
    status: taskRow.status,
    generation_id: taskRow.generation_id,
    result: taskRow.result ?? undefined,
    error: taskRow.error ?? null,
    provider: taskRow.provider ?? "qwen",
    provider_status: taskRow.provider_status ?? null,
    provider_poll_count: taskRow.provider_poll_count ?? 0,
    modal_status: null as string | null,
    modal_elapsed_seconds: null as number | null,
    modal_poll_count: taskRow.modal_poll_count ?? 0,
    created_at: taskRow.created_at,
    completed_at: taskRow.completed_at,
    title: display.title,
    subtitle: display.subtitle,
    language: display.language,
    voice_name: display.voiceName,
    text_preview: display.textPreview,
    estimated_duration_minutes: display.estimatedDurationMinutes,
    origin_page: originPageForTaskType(taskRow.type),
    supports_cancel:
      taskRow.status === "pending" || taskRow.status === "processing",
  };

  if (base.status === "completed" && base.type === "design_preview") {
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

  if (base.status === "completed" && taskRow.generation_id) {
    base.result = {
      ...(typeof base.result === "object" && base.result ? base.result : {}),
      audio_url: `/api/generations/${taskRow.generation_id}/audio`,
    };
  }

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
    .select("id, type, status, provider, generation_id, created_at, metadata")
    .eq("id", taskId)
    .maybeSingle();

  if (error) return jsonDetail("Failed to load task.", 500);
  if (!task) return jsonDetail("Task not found.", 404);

  const taskRow = task as {
    status: string;
    generation_id: string | null;
    type: string;
    created_at: string | null;
    metadata: unknown;
  };

  const status = taskRow.status;
  if (status !== "pending" && status !== "processing") {
    return jsonDetail(`Cannot cancel task with status: ${status}`, 400);
  }

  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const generationId = taskRow.generation_id;

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
});
