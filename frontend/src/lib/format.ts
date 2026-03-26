/**
 * Format a created_at ISO date string for display.
 * Returns "Created: YYYY-MM-DD HH:mm" in local timezone, or null for null input.
 */
export function formatCreatedAt(dateString: string | null): string | null {
  if (dateString === null) return null;

  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `Created: ${year}-${month}-${day} ${hours}:${minutes}`;
}
