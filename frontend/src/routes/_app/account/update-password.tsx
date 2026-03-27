import { createFileRoute } from "@tanstack/react-router";
import { UpdatePasswordPage } from "../../../features/account/UpdatePassword";

export const Route = createFileRoute("/_app/account/update-password")({
  component: UpdatePasswordPage,
});
