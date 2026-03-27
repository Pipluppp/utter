import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodSearchValidator } from "@tanstack/router-zod-adapter";
import { z } from "zod";
import { ClonePage } from "../../features/clone/Clone";

const cloneSearchSchema = z.object({
  demo: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_app/clone")({
  validateSearch: zodSearchValidator(cloneSearchSchema),
  component: ClonePage,
});
