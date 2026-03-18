import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthGateSkeleton } from "../components/ui/RouteSkeletons";
import { useAuthState } from "./auth/AuthStateProvider";
import { buildAuthHref, buildReturnTo } from "./navigation";

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const authState = useAuthState();
  const returnTo = buildReturnTo(location);

  if (authState.status === "loading") {
    return <AuthGateSkeleton />;
  }

  if (authState.status !== "signed_in") {
    return <Navigate to={buildAuthHref(returnTo)} replace />;
  }

  return children;
}
