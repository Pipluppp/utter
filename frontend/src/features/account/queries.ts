import { queryOptions } from "@tanstack/react-query";
import { loadAccountSnapshot } from "./accountData";

export const accountQueries = {
  all: () => ["account"] as const,
  snapshot: () =>
    queryOptions({
      queryKey: [...accountQueries.all(), "snapshot"] as const,
      queryFn: loadAccountSnapshot,
      staleTime: 1000 * 30, // 30s
    }),
};
