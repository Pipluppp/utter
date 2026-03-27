import { createFileRoute } from "@tanstack/react-router";
import { AccountProfilePage } from "../features/account/Profile";

export const Route = createFileRoute("/_app/account/")({
  component: AccountProfilePage,
});
