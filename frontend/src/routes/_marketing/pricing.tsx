import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/pricing")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "pricing" });
  },
});
