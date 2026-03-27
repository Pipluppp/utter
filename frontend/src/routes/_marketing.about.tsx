import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "../features/about/About";

export const Route = createFileRoute("/_marketing/about")({
  component: AboutPage,
});
