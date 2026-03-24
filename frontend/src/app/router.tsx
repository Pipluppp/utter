import { lazy } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import { LandingPage } from "../pages/Landing";
import { Layout } from "./Layout";
import type { RouteFamily } from "./navigation";
import { RequireAuth } from "./RequireAuth";
const ClonePage = lazy(async () => {
  const m = await import("../pages/Clone");
  return { default: m.ClonePage };
});
const GeneratePage = lazy(async () => {
  const m = await import("../pages/Generate");
  return { default: m.GeneratePage };
});
const DesignPage = lazy(async () => {
  const m = await import("../pages/Design");
  return { default: m.DesignPage };
});
const VoicesPage = lazy(async () => {
  const m = await import("../pages/Voices");
  return { default: m.VoicesPage };
});
const HistoryPage = lazy(async () => {
  const m = await import("../pages/History");
  return { default: m.HistoryPage };
});
const TasksPage = lazy(async () => {
  const m = await import("../pages/Tasks");
  return { default: m.TasksPage };
});
const AboutPage = lazy(async () => {
  const m = await import("../pages/About");
  return { default: m.AboutPage };
});
const PrivacyPage = lazy(async () => {
  const m = await import("../pages/Privacy");
  return { default: m.PrivacyPage };
});
const TermsPage = lazy(async () => {
  const m = await import("../pages/Terms");
  return { default: m.TermsPage };
});
const AuthPage = lazy(async () => {
  const m = await import("../pages/Auth");
  return { default: m.AuthPage };
});
const ForgotPasswordPage = lazy(async () => {
  const m = await import("../pages/ForgotPassword");
  return { default: m.ForgotPasswordPage };
});
const AccountLayoutPage = lazy(async () => {
  const m = await import("../pages/account/AccountLayout");
  return { default: m.AccountLayoutPage };
});
const AccountOverviewPage = lazy(async () => {
  const m = await import("../pages/account/Overview");
  return { default: m.AccountOverviewPage };
});
const AccountProfilePage = lazy(async () => {
  const m = await import("../pages/account/Profile");
  return { default: m.AccountProfilePage };
});
const AccountCreditsPage = lazy(async () => {
  const m = await import("../pages/account/Credits");
  return { default: m.AccountCreditsPage };
});
const UpdatePasswordPage = lazy(async () => {
  const m = await import("../pages/account/UpdatePassword");
  return { default: m.UpdatePasswordPage };
});

function AccountLegacyRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={{
        pathname: "/account/credits",
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );
}

function familyHandle(routeFamily: RouteFamily) {
  return { routeFamily };
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        handle: familyHandle("marketing"),
        children: [
          { path: "/", element: <LandingPage /> },
          { path: "/pricing", element: <Navigate to="/#pricing" replace /> },
          { path: "/privacy", element: <PrivacyPage /> },
          { path: "/terms", element: <TermsPage /> },
          { path: "/about", element: <AboutPage /> },
        ],
      },
      {
        handle: familyHandle("auth"),
        children: [
          { path: "/auth", element: <AuthPage /> },
          { path: "/auth/forgot-password", element: <ForgotPasswordPage /> },
        ],
      },
      {
        handle: familyHandle("app"),
        children: [
          {
            path: "/clone",
            element: (
              <RequireAuth>
                <ClonePage />
              </RequireAuth>
            ),
          },
          {
            path: "/generate",
            element: (
              <RequireAuth>
                <GeneratePage />
              </RequireAuth>
            ),
          },
          {
            path: "/design",
            element: (
              <RequireAuth>
                <DesignPage />
              </RequireAuth>
            ),
          },
          {
            path: "/voices",
            element: (
              <RequireAuth>
                <VoicesPage />
              </RequireAuth>
            ),
          },
          {
            path: "/history",
            element: (
              <RequireAuth>
                <HistoryPage />
              </RequireAuth>
            ),
          },
          {
            path: "/tasks",
            element: (
              <RequireAuth>
                <TasksPage />
              </RequireAuth>
            ),
          },
          {
            path: "/account",
            element: (
              <RequireAuth>
                <AccountLayoutPage />
              </RequireAuth>
            ),
            children: [
              { index: true, element: <AccountProfilePage /> },
              { path: "auth", element: <Navigate to="/auth" replace /> },
              { path: "profile", element: <Navigate to="/account" replace /> },
              { path: "overview", element: <AccountOverviewPage /> },
              { path: "credits", element: <AccountCreditsPage /> },
              { path: "update-password", element: <UpdatePasswordPage /> },
              { path: "usage", element: <AccountLegacyRedirect /> },
              { path: "billing", element: <AccountLegacyRedirect /> },
            ],
          },
        ],
      },
    ],
  },
]);
