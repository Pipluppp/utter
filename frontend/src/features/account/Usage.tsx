import { Navigate, useLocation } from "react-router-dom";

export function AccountUsagePage() {
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
