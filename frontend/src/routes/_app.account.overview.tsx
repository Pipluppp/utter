import { createFileRoute } from "@tanstack/react-router";
import { AccountOverviewPage } from "../features/account/Overview";

export const Route = createFileRoute("/_app/account/overview")({
  component: AccountOverviewPage,
});
