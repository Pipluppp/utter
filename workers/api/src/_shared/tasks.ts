import type { createAdminClient } from "./supabase.ts";

export const QUEUE_BACKED_TASK_TYPES = ["generate", "design_preview"] as const;
export const ACTIVE_TASK_STATUSES = ["pending", "processing"] as const;

export type QueueBackedTaskType = typeof QUEUE_BACKED_TASK_TYPES[number];

type AdminClient = ReturnType<typeof createAdminClient>;

type ActiveTaskCounts = Record<QueueBackedTaskType, number>;

function emptyActiveTaskCounts(): ActiveTaskCounts {
  return {
    generate: 0,
    design_preview: 0,
  };
}

function asMetadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export function isQueueBackedTaskType(
  value: string,
): value is QueueBackedTaskType {
  return QUEUE_BACKED_TASK_TYPES.includes(value as QueueBackedTaskType);
}

export async function getQueueBackedTaskCapacity(params: {
  admin: AdminClient;
  userId: string;
}) {
  const { admin, userId } = params;

  const profileRes = await admin
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();

  if (profileRes.error) {
    return { error: "Failed to load subscription tier." as const };
  }

  const subscriptionTier =
    typeof profileRes.data?.subscription_tier === "string"
      ? profileRes.data.subscription_tier
      : "free";

  const activeRes = await admin
    .from("tasks")
    .select("type")
    .eq("user_id", userId)
    .in("type", [...QUEUE_BACKED_TASK_TYPES])
    .in("status", [...ACTIVE_TASK_STATUSES]);

  if (activeRes.error) {
    return { error: "Failed to check active tasks." as const };
  }

  const activeByType = emptyActiveTaskCounts();
  for (const row of activeRes.data ?? []) {
    const type = typeof row.type === "string" ? row.type : null;
    if (!type || !isQueueBackedTaskType(type)) continue;
    activeByType[type] += 1;
  }

  const totalActive = Object.values(activeByType).reduce(
    (sum, count) => sum + count,
    0,
  );
  const limit = Math.max(1, subscriptionTier === "free" ? 2 : 4);

  return {
    error: null,
    subscriptionTier,
    limit,
    totalActive,
    activeByType,
  };
}

export function buildActiveTaskCapDetail(params: {
  limit: number;
  totalActive: number;
  activeByType: ActiveTaskCounts;
}) {
  const { limit, totalActive, activeByType } = params;
  const activeParts: string[] = [];
  if (activeByType.generate > 0) {
    activeParts.push(
      `${activeByType.generate} generation${
        activeByType.generate === 1 ? "" : "s"
      }`,
    );
  }
  if (activeByType.design_preview > 0) {
    activeParts.push(
      `${activeByType.design_preview} design preview${
        activeByType.design_preview === 1 ? "" : "s"
      }`,
    );
  }

  const activeSummary = activeParts.length > 0
    ? ` You currently have ${activeParts.join(" and ")} running or queued.`
    : "";

  return `Active job limit reached (${totalActive}/${limit}). Wait for a running job to finish or cancel one before starting another.${activeSummary}`;
}

export function originPageForTaskType(type: string): string {
  if (type === "generate") return "/generate";
  if (type === "design_preview") return "/design";
  if (type === "clone") return "/clone";
  return "/tasks";
}

export function describeTaskDisplay(type: string, metadata: unknown): {
  title: string;
  subtitle: string | null;
  language: string | null;
  voiceName: string | null;
  textPreview: string | null;
  estimatedDurationMinutes: number | null;
} {
  const record = asMetadataRecord(metadata);
  const language = asTrimmedString(record.language);
  const estimatedDurationMinutes = asFiniteNumber(
    record.estimated_duration_minutes,
  );

  if (type === "generate") {
    const voiceName = asTrimmedString(record.voice_name);
    const textPreview = asTrimmedString(record.text_preview);
    return {
      title: voiceName ? `Generate with ${voiceName}` : "Generate speech",
      subtitle: textPreview ? truncateText(textPreview, 80) : null,
      language,
      voiceName,
      textPreview: textPreview ? truncateText(textPreview, 120) : null,
      estimatedDurationMinutes,
    };
  }

  if (type === "design_preview") {
    const preferredName = asTrimmedString(record.name);
    const instruct = asTrimmedString(record.instruct);
    const textPreview = asTrimmedString(record.text);
    const subtitle = instruct
      ? truncateText(instruct, 80)
      : textPreview
      ? truncateText(textPreview, 80)
      : null;

    return {
      title: preferredName
        ? `Design preview: ${preferredName}`
        : "Design preview",
      subtitle,
      language,
      voiceName: null,
      textPreview: textPreview ? truncateText(textPreview, 120) : null,
      estimatedDurationMinutes,
    };
  }

  return {
    title: "Task",
    subtitle: null,
    language,
    voiceName: null,
    textPreview: null,
    estimatedDurationMinutes,
  };
}
