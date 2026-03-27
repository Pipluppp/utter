import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "../../features/landing/Landing";

export const Route = createFileRoute("/_marketing/")({
  component: LandingPage,
});
