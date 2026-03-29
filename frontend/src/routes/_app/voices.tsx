import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodSearchValidator } from "@tanstack/router-zod-adapter";
import { z } from "zod";
import { VoicesPage } from "../../features/voices/Voices";

export const voicesSearchSchema = z.object({
  search: fallback(z.string(), ""),
  source: fallback(z.enum(["all", "uploaded", "designed"]), "all"),
  page: fallback(z.number().int().min(1), 1),
  sort: fallback(z.enum(["created_at", "name", "generation_count"]), "created_at"),
  sort_dir: fallback(z.enum(["asc", "desc"]), "desc"),
  favorites: fallback(z.enum(["all", "true"]), "all"),
  voice_id: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_app/voices")({
  validateSearch: zodSearchValidator(voicesSearchSchema),
  component: VoicesPage,
});
