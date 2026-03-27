import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodSearchValidator } from "@tanstack/router-zod-adapter";
import { z } from "zod";
import { AuthPage } from "../../features/auth/Auth";

export const authSearchSchema = z.object({
  returnTo: fallback(z.string().optional(), undefined),
  error: fallback(z.string().optional(), undefined),
  intent: fallback(z.enum(["sign_in", "sign_up"]), "sign_in"),
});

export const Route = createFileRoute("/_auth/auth")({
  validateSearch: zodSearchValidator(authSearchSchema),
  component: AuthPage,
});
