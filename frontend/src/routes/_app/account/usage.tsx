import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/account/usage")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/account/credits",
      search: location.search,
      hash: location.hash,
    });
  },
});
