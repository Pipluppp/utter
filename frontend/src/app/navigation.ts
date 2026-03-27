import type { AuthStatus } from "./auth/AuthStateProvider";

export type RouteFamily = "marketing" | "auth" | "app";

export type NavVariant =
  | "marketing_public"
  | "marketing_member"
  | "app_member"
  | "auth_minimal"
  | "app_pending_auth";

export function getNavVariant(routeFamily: RouteFamily, authStatus: AuthStatus): NavVariant {
  if (routeFamily === "auth") {
    return "auth_minimal";
  }

  if (routeFamily === "app") {
    return authStatus === "signed_in" ? "app_member" : "app_pending_auth";
  }

  return authStatus === "signed_in" ? "marketing_member" : "marketing_public";
}

export function buildReturnTo(location: {
  pathname: string;
  search: string | Record<string, unknown>;
  hash: string;
}) {
  const searchStr =
    typeof location.search === "string"
      ? location.search
      : (() => {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(location.search)) {
            if (v !== undefined && v !== null && v !== "") {
              params.set(k, String(v));
            }
          }
          const qs = params.toString();
          return qs ? `?${qs}` : "";
        })();
  return `${location.pathname}${searchStr}${location.hash}`;
}

export function getSafeReturnTo(returnTo: string | null | undefined) {
  const candidate = (returnTo ?? "").trim();
  if (!candidate.startsWith("/")) {
    return "/";
  }
  return candidate || "/";
}

export function buildAuthHref(returnTo: string, intent: "sign_in" | "sign_up" = "sign_in") {
  const params = new URLSearchParams({ returnTo: getSafeReturnTo(returnTo) });
  if (intent === "sign_up") {
    params.set("intent", intent);
  }
  return `/auth?${params.toString()}`;
}

export type MarketingHash = "#demos" | "#features" | "#pricing";

export type NavSectionItem =
  | {
      kind: "route";
      label: string;
      to: string;
      shortcut?: string;
      showTaskBadge?: boolean;
      showProfileIcon?: boolean;
    }
  | {
      kind: "hash";
      label: string;
      hash: MarketingHash;
    };
