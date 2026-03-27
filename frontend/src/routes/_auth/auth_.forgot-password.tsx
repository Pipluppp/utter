import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "../../features/auth/ForgotPassword";

export const Route = createFileRoute("/_auth/auth_/forgot-password")({
  component: ForgotPasswordPage,
});
