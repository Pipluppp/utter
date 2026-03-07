import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { supabase } from '../../lib/supabase'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in'

export type AuthStateSnapshot = {
  status: AuthStatus
  session: Session | null
  user: User | null
  error: Error | null
}

const AuthStateContext = createContext<AuthStateSnapshot | null>(null)

function createSignedOutSnapshot(
  error: Error | null = null,
): AuthStateSnapshot {
  return {
    status: 'signed_out',
    session: null,
    user: null,
    error,
  }
}

function createLoadingSnapshot(): AuthStateSnapshot {
  return {
    status: 'loading',
    session: null,
    user: null,
    error: null,
  }
}

async function resolveAuthSnapshot(): Promise<AuthStateSnapshot> {
  if (!supabase) {
    return createSignedOutSnapshot()
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()
  if (sessionError) {
    return createSignedOutSnapshot(sessionError)
  }

  const session = sessionData.session
  if (!session) {
    return createSignedOutSnapshot()
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    return createSignedOutSnapshot(userError)
  }

  const user = userData.user
  if (!user) {
    return createSignedOutSnapshot(
      new Error('Supabase returned a session without a user.'),
    )
  }

  return {
    status: 'signed_in',
    session,
    user,
    error: null,
  }
}

export function AuthStateProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthStateSnapshot>(() =>
    supabase ? createLoadingSnapshot() : createSignedOutSnapshot(),
  )
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!supabase) {
      setAuthState(createSignedOutSnapshot())
      return
    }

    let cancelled = false

    const syncAuthState = async () => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      const snapshot = await resolveAuthSnapshot()
      if (cancelled || requestId !== requestIdRef.current) {
        return
      }

      if (snapshot.error) {
        console.error('Failed to resolve auth state.', snapshot.error)
      }

      setAuthState(snapshot)
    }

    void syncAuthState()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) {
        return
      }

      requestIdRef.current += 1

      if (!session) {
        setAuthState(createSignedOutSnapshot())
        return
      }

      setAuthState(createLoadingSnapshot())
      void syncAuthState()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthStateContext.Provider value={authState}>
      {children}
    </AuthStateContext.Provider>
  )
}

export function useAuthState() {
  const value = useContext(AuthStateContext)
  if (!value) {
    throw new Error('useAuthState must be used within an AuthStateProvider.')
  }
  return value
}
