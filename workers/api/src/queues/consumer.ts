import { setRuntimeEnv } from "../_shared/runtime_env.ts";
import type { WorkerEnv } from "../env.ts";
import { runQwenDesignPreviewTask } from "../routes/design.ts";
import { processQwenGenerationTask } from "../routes/generate.ts";
import {
  processModalDesignPreviewTask,
  processModalGenerateCheckTask,
} from "../routes/tasks.ts";
import {
  buildGenerateModalCheckMessage,
  isTtsJobMessage,
} from "./messages.ts";

const INTERNAL_QUEUE_REQUEST = new Request("https://queue.internal/api/queue");
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429]);
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 405, 410, 422]);

function backoffDelaySeconds(attempts: number): number {
  const exponent = Math.min(8, Math.max(0, attempts - 1));
  return Math.min(300, 2 ** exponent);
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

function parseStatusCodeFromMessage(message: string): number | null {
  const codeMatch = message.match(/\((\d{3})\)/);
  if (!codeMatch) return null;
  const code = Number(codeMatch[1]);
  return Number.isFinite(code) ? code : null;
}

function shouldRetryQueueMessage(error: unknown): {
  retry: boolean;
  reason: string;
} {
  const message = errorMessageOf(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("missing env var")) {
    return { retry: false, reason: "configuration_error" };
  }

  const statusCode = parseStatusCodeFromMessage(message);
  if (statusCode !== null) {
    if (statusCode >= 500 || RETRYABLE_STATUS_CODES.has(statusCode)) {
      return { retry: true, reason: `upstream_http_${statusCode}` };
    }
    if (NON_RETRYABLE_STATUS_CODES.has(statusCode)) {
      return { retry: false, reason: `non_retryable_http_${statusCode}` };
    }
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("network") ||
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("connection reset")
  ) {
    return { retry: true, reason: "transient_network_or_timeout" };
  }

  if (
    normalized.includes("invalid") ||
    normalized.includes("not found") ||
    normalized.includes("required") ||
    normalized.includes("unsupported") ||
    normalized.includes("mismatch")
  ) {
    return { retry: false, reason: "non_retryable_validation_or_contract" };
  }

  return { retry: true, reason: "unknown_retryable_default" };
}

export async function handleTtsQueueBatch(
  batch: MessageBatch<unknown>,
  env: WorkerEnv,
) {
  setRuntimeEnv(env as unknown as Record<string, unknown>);

  for (const message of batch.messages) {
    if (!isTtsJobMessage(message.body)) {
      console.error("queue.invalid_message", {
        attempts: message.attempts,
      });
      message.ack();
      continue;
    }

    const body = message.body;
    const attempts = typeof message.attempts === "number" ? message.attempts : 1;

    try {
      if (body.type === "generate.qwen.start") {
        await processQwenGenerationTask({
          userId: body.user_id,
          taskId: body.task_id,
          generationId: body.generation_id,
          text: body.payload.text,
          language: body.payload.language,
          providerVoiceId: body.payload.provider_voice_id,
          providerTargetModel: body.payload.provider_target_model,
          creditsToDebit: body.payload.credits_to_debit,
          req: INTERNAL_QUEUE_REQUEST,
        });
        message.ack();
        continue;
      }

      if (body.type === "design_preview.qwen.start") {
        await runQwenDesignPreviewTask({
          userId: body.user_id,
          taskId: body.task_id,
          text: body.payload.text,
          language: body.payload.language,
          instruct: body.payload.instruct,
          name: body.payload.name,
          req: INTERNAL_QUEUE_REQUEST,
          usedTrial: body.payload.used_trial,
          trialIdempotencyKey: body.payload.trial_idempotency_key,
          creditsToDebit: body.payload.credits_to_debit,
        });
        message.ack();
        continue;
      }

      if (body.type === "design_preview.modal.start") {
        await processModalDesignPreviewTask({
          taskId: body.task_id,
          userId: body.user_id,
          req: INTERNAL_QUEUE_REQUEST,
          text: body.payload.text,
          language: body.payload.language,
          instruct: body.payload.instruct,
        });
        message.ack();
        continue;
      }

      if (body.type === "generate.modal.check") {
        const result = await processModalGenerateCheckTask({
          taskId: body.task_id,
          userId: body.user_id,
          generationId: body.generation_id,
          providerJobId: body.payload.provider_job_id,
          req: INTERNAL_QUEUE_REQUEST,
        });

        if (result.requeueDelaySeconds && env.TTS_QUEUE) {
          const nextMessage = buildGenerateModalCheckMessage({
            taskId: body.task_id,
            userId: body.user_id,
            generationId: body.generation_id,
            providerJobId: body.payload.provider_job_id,
            attempt: (body.attempt ?? 1) + 1,
          });
          await env.TTS_QUEUE.send(nextMessage, {
            delaySeconds: Math.max(1, Math.min(300, result.requeueDelaySeconds)),
          });
        }

        message.ack();
        continue;
      }

      message.ack();
    } catch (error) {
      const classification = shouldRetryQueueMessage(error);
      console.error("queue.message_failed", {
        type: body.type,
        task_id: body.task_id,
        user_id: body.user_id,
        attempts,
        action: classification.retry ? "retry" : "ack",
        reason: classification.reason,
        error: error instanceof Error ? error.message : String(error),
      });
      if (classification.retry) {
        message.retry({ delaySeconds: backoffDelaySeconds(attempts) });
      } else {
        message.ack();
      }
    }
  }
}
