import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "../../features/legal/Terms";

export const Route = createFileRoute("/_marketing/terms")({
  component: TermsPage,
});
