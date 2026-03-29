import { formatElapsed } from "./time";
import type { StoredTask, TaskStatus } from "./types";

const TERMINAL_LABELS: Partial<Record<TaskStatus, string>> = {
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Maps a provider/modal/top-level status string to a human label. */
const STATUS_LABELS: Record<string, string> = {
  provider_submitting: "Submitting...",
  provider_queued: "Waiting for GPU...",
  provider_synthesizing: "Synthesizing...",
  provider_downloading: "Downloading...",
  provider_persisting: "Finalizing...",
  queued: "Waiting for GPU...",
  processing: "Generating...",
  sending: "Starting generation...",
};

/** Pending top-level status also means "Waiting for GPU..." */
const PENDING_LABEL = "Waiting for GPU...";

/** Human-readable label for a task's current status. */
export function getStatusText(
  status: TaskStatus,
  modalStatus?: string | null,
  providerStatus?: string | null,
): string {
  const terminal = TERMINAL_LABELS[status];
  if (terminal) return terminal;

  // Priority 1: combined effective status (provider → modal fallback)
  const effective = (providerStatus ?? modalStatus ?? "").toLowerCase();
  const fromEffective = STATUS_LABELS[effective];
  if (fromEffective) return fromEffective;

  // Priority 2: modal "queued" or top-level "pending" both mean waiting
  const modal = (modalStatus ?? "").toLowerCase();
  if (modal === "queued" || status === "pending") return PENDING_LABEL;

  // Priority 3: modal processing/sending or top-level processing
  if (modal === "processing" || status === "processing") return "Generating...";
  if (modal === "sending") return "Starting generation...";

  return "Processing...";
}

/** Short elapsed label for a task (terminal states get a fixed word). */
export function formatTaskElapsed(task: StoredTask): string {
  if (task.status === "completed") return "Ready";
  if (task.status === "failed") return "Failed";
  if (task.status === "cancelled") return "Cancelled";
  return formatElapsed(task.startedAt);
}
