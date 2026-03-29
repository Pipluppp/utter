import { infiniteQueryOptions } from "@tanstack/react-query";
import { apiJson } from "../../lib/api";
import type { TaskListResponse, TaskListType } from "../../lib/types";

type TaskListFilters = {
  status: string;
  type: TaskListType;
};

export const taskQueries = {
  all: () => ["tasks"] as const,
  lists: () => [...taskQueries.all(), "list"] as const,
  list: (filters: TaskListFilters) =>
    infiniteQueryOptions({
      queryKey: [...taskQueries.lists(), filters] as const,
      queryFn: ({ pageParam, signal }) => {
        const qs = new URLSearchParams({
          status: filters.status,
          type: filters.type,
          limit: "10",
        });
        if (pageParam) qs.set("before", pageParam);
        return apiJson<TaskListResponse>(`/api/tasks?${qs.toString()}`, { signal });
      },
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.next_before,
    }),
};
