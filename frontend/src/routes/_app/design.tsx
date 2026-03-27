import { createFileRoute } from "@tanstack/react-router";
import { DesignPage } from "../../features/design/Design";

export const Route = createFileRoute("/_app/design")({
  component: DesignPage,
});
