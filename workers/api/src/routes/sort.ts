export const VOICES_SORT_ALLOWLIST = ["name", "created_at", "generation_count"] as const;
export const GENERATIONS_SORT_ALLOWLIST = ["created_at", "duration_seconds", "voice_name"] as const;

export function validateSort<T extends string>(
  value: string | undefined,
  allowlist: readonly T[],
  fallback: T,
): T {
  return allowlist.includes(value as T) ? (value as T) : fallback;
}

export function validateSortDir(value: string | undefined): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}
