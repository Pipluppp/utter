import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "../features/auth/ForgotPassword";

export const Route = createFileRoute("/_auth/auth/forgot-password")({
  component: ForgotPasswordPage,
});
