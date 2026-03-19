import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { getAuthSession, type AuthUser } from "../../lib/auth";

export type AuthStatus = "loading" | "signed_out" | "signed_in";

type AuthStateCore = {
  status: AuthStatus;
  user: AuthUser | null;
  error: Error | null;
};

export type AuthStateSnapshot = AuthStateCore & {
  refresh: () => Promise<void>;
};

const AuthStateContext = createContext<AuthStateSnapshot | null>(null);

function createSignedOutSnapshot(error: Error | null = null): AuthStateCore {
  return {
    status: "signed_out",
    user: null,
    error,
  };
}

function createLoadingSnapshot(): AuthStateCore {
  return {
    status: "loading",
    user: null,
    error: null,
  };
}

async function resolveAuthSnapshot(): Promise<AuthStateCore> {
  const session = await getAuthSession();
  if (!session.signed_in || !session.user) {
    return createSignedOutSnapshot();
  }

  return {
    status: "signed_in",
    user: session.user,
    error: null,
  };
}

export function AuthStateProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthStateCore>(() => createLoadingSnapshot());
  const requestIdRef = useRef(0);

  const refresh = async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const snapshot = await resolveAuthSnapshot();
      if (requestId !== requestIdRef.current) {
        return;
      }

      setAuthState(snapshot);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setAuthState(
        createSignedOutSnapshot(
          error instanceof Error ? error : new Error("Failed to resolve auth state."),
        ),
      );
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AuthStateContext.Provider value={{ ...authState, refresh }}>
      {children}
    </AuthStateContext.Provider>
  );
}

export function useAuthState() {
  const value = useContext(AuthStateContext);
  if (!value) {
    throw new Error("useAuthState must be used within an AuthStateProvider.");
  }
  return value;
}
