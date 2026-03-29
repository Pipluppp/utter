import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { queryClient } from "../lib/queryClient";
import { router } from "../router";
import { TaskProvider } from "./TaskProvider";
import { AuthStateProvider, useAuthState } from "./auth/AuthStateProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

function InnerApp() {
  const authState = useAuthState();

  // Re-run beforeLoad guards whenever auth state settles
  useEffect(() => {
    if (authState.status !== "loading") {
      void router.invalidate();
    }
  }, [authState.status]);

  return <RouterProvider router={router} context={{ authState }} />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthStateProvider>
        <TaskProvider>
          <QueryClientProvider client={queryClient}>
            <InnerApp />
          </QueryClientProvider>
        </TaskProvider>
      </AuthStateProvider>
    </ThemeProvider>
  );
}
