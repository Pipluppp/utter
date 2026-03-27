import { createFileRoute } from "@tanstack/react-router";
import { TasksPage } from "../../features/tasks/Tasks";

export const Route = createFileRoute("/_app/tasks")({
  component: TasksPage,
});
