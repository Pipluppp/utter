import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/account/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
