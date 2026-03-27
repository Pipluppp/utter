import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/account/profile")({
  beforeLoad: () => {
    throw redirect({ to: "/account" });
  },
});
