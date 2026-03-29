/** Splits a search query into whitespace-separated non-empty tokens. */
export function tokenize(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean);
}
