import { createFileRoute } from "@tanstack/react-router";
import { AccountLayoutPage } from "../../../features/account/AccountLayout";

export const Route = createFileRoute("/_app/account")({
  component: AccountLayoutPage,
});
