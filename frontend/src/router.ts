import { createRouter } from "@tanstack/react-router";
import { NotFoundContent } from "./components/NotFoundContent";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultNotFoundComponent: NotFoundContent,
  context: {
    authState: undefined!,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
