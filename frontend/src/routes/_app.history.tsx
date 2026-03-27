import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodSearchValidator } from "@tanstack/router-zod-adapter";
import { z } from "zod";
import { HistoryPage } from "../features/history/History";

export const historySearchSchema = z.object({
  search: fallback(z.string(), ""),
  status: fallback(z.string().optional(), undefined),
  page: fallback(z.number().int().min(1), 1),
  sort: fallback(z.string(), "created_at"),
  sort_dir: fallback(z.enum(["asc", "desc"]), "desc"),
  voice_id: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_app/history")({
  validateSearch: zodSearchValidator(historySearchSchema),
  component: HistoryPage,
});
