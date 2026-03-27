import type { AuthStateSnapshot } from "./app/auth/AuthStateProvider";

export interface RouterContext {
  authState: AuthStateSnapshot;
}
