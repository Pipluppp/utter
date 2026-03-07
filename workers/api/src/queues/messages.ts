export type GenerateQwenStartMessage = {
  version: 1;
  type: "generate.qwen.start";
  task_id: string;
  user_id: string;
  generation_id: string;
  provider: "qwen";
  payload: {
    text: string;
    language: string;
    provider_voice_id: string;
    provider_target_model: string;
    credits_to_debit: number;
  };
  enqueued_at: string;
};

export type DesignPreviewQwenStartMessage = {
  version: 1;
  type: "design_preview.qwen.start";
  task_id: string;
  user_id: string;
  provider: "qwen";
  payload: {
    text: string;
    language: string;
    instruct: string;
    name: string;
    used_trial: boolean;
    trial_idempotency_key: string | null;
    credits_to_debit: number;
  };
  enqueued_at: string;
};

export type TtsJobMessage =
  | GenerateQwenStartMessage
  | DesignPreviewQwenStartMessage;

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isTtsJobMessage(value: unknown): value is TtsJobMessage {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.version !== 1) return false;
  if (!isString(row.task_id) || !isString(row.user_id) || !isString(row.enqueued_at)) {
    return false;
  }

  if (row.type === "generate.qwen.start") {
    if (row.provider !== "qwen") return false;
    if (!isString(row.generation_id)) return false;
    const payload = row.payload as Record<string, unknown> | undefined;
    if (!payload || typeof payload !== "object") return false;
    return isString(payload.text) &&
      isString(payload.language) &&
      isString(payload.provider_voice_id) &&
      isString(payload.provider_target_model) &&
      isNumber(payload.credits_to_debit);
  }

  if (row.type === "design_preview.qwen.start") {
    if (row.provider !== "qwen") return false;
    const payload = row.payload as Record<string, unknown> | undefined;
    if (!payload || typeof payload !== "object") return false;
    const trialKey = payload.trial_idempotency_key;
    const validTrialKey = trialKey === null || typeof trialKey === "string";
    return isString(payload.text) &&
      isString(payload.language) &&
      isString(payload.instruct) &&
      isString(payload.name) &&
      typeof payload.used_trial === "boolean" &&
      validTrialKey &&
      isNumber(payload.credits_to_debit);
  }

  return false;
}

export function buildGenerateQwenStartMessage(params: {
  taskId: string;
  userId: string;
  generationId: string;
  text: string;
  language: string;
  providerVoiceId: string;
  providerTargetModel: string;
  creditsToDebit: number;
}): GenerateQwenStartMessage {
  return {
    version: 1,
    type: "generate.qwen.start",
    task_id: params.taskId,
    user_id: params.userId,
    generation_id: params.generationId,
    provider: "qwen",
    payload: {
      text: params.text,
      language: params.language,
      provider_voice_id: params.providerVoiceId,
      provider_target_model: params.providerTargetModel,
      credits_to_debit: params.creditsToDebit,
    },
    enqueued_at: new Date().toISOString(),
  };
}

export function buildDesignPreviewQwenStartMessage(params: {
  taskId: string;
  userId: string;
  text: string;
  language: string;
  instruct: string;
  name: string;
  usedTrial: boolean;
  trialIdempotencyKey: string | null;
  creditsToDebit: number;
}): DesignPreviewQwenStartMessage {
  return {
    version: 1,
    type: "design_preview.qwen.start",
    task_id: params.taskId,
    user_id: params.userId,
    provider: "qwen",
    payload: {
      text: params.text,
      language: params.language,
      instruct: params.instruct,
      name: params.name,
      used_trial: params.usedTrial,
      trial_idempotency_key: params.trialIdempotencyKey,
      credits_to_debit: params.creditsToDebit,
    },
    enqueued_at: new Date().toISOString(),
  };
}
