import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "../../features/legal/Privacy";

export const Route = createFileRoute("/_marketing/privacy")({
  component: PrivacyPage,
});
