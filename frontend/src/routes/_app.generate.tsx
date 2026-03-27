import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodSearchValidator } from "@tanstack/router-zod-adapter";
import { z } from "zod";
import { GeneratePage } from "../features/generate/Generate";

const generateSearchSchema = z.object({
  voice: fallback(z.string().optional(), undefined),
  text: fallback(z.string().optional(), undefined),
  language: fallback(z.string().optional(), undefined),
  demo: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_app/generate")({
  validateSearch: zodSearchValidator(generateSearchSchema),
  component: GeneratePage,
});
