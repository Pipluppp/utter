import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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

// To skip auth when we run npm run dev:tunnel locally, and test it on mobile quickly and all the pages
const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === "true";

const MOCK_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "dev@localhost",
};

async function resolveAuthSnapshot(): Promise<AuthStateCore> {
  if (SKIP_AUTH) {
    return { status: "signed_in", user: MOCK_USER, error: null };
  }

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
