import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodSearchValidator } from "@tanstack/router-zod-adapter";
import { z } from "zod";
import { AccountCreditsPage } from "../features/account/Credits";

const creditsSearchSchema = z.object({
  checkout: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_app/account/credits")({
  validateSearch: zodSearchValidator(creditsSearchSchema),
  component: AccountCreditsPage,
});
