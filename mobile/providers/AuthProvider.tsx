import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signInWithOtp: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

/** Redirect URL for magic link emails — uses utter:// in production, exp:// in Expo Go */
export const MAGIC_LINK_REDIRECT_URL = Linking.createURL('auth/callback');

/**
 * Parse auth params from a deep link URL.
 * Handles both implicit grant (hash fragment) and PKCE (query code) flows.
 */
function getParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashIdx = url.indexOf('#');
  if (hashIdx !== -1) {
    for (const pair of url.slice(hashIdx + 1).split('&')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx !== -1) {
        params[pair.slice(0, eqIdx)] = decodeURIComponent(pair.slice(eqIdx + 1));
      }
    }
  }
  const qIdx = url.indexOf('?');
  if (qIdx !== -1) {
    const end = hashIdx !== -1 ? hashIdx : url.length;
    for (const pair of url.slice(qIdx + 1, end).split('&')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx !== -1) {
        params[pair.slice(0, eqIdx)] = decodeURIComponent(pair.slice(eqIdx + 1));
      }
    }
  }
  return params;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let stale = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!stale) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      stale = true;
      setSession(session);
      setIsLoading(false);
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  // Deep link handler for magic link auth callbacks
  useEffect(() => {
    const handleAuthUrl = async (url: string) => {
      try {
        const params = getParamsFromUrl(url);

        if (params.access_token && params.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          if (error) Alert.alert('Sign-in failed', error.message);
          return;
        }

        if (params.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) Alert.alert('Sign-in failed', error.message);
        }
      } catch {
        Alert.alert('Sign-in failed', 'The link may have expired. Please try again.');
      }
    };

    // Handle cold-start deep link (app opened from link while not running)
    Linking.getInitialURL()
      .then((url) => { if (url) return handleAuthUrl(url); })
      .catch(() => {});

    // Handle deep links while app is in foreground
    const sub = Linking.addEventListener('url', (event) => {
      void handleAuthUrl(event.url);
    });

    return () => sub.remove();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signUp = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  };

  const signInWithOtp = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: MAGIC_LINK_REDIRECT_URL },
    });
    return error?.message ?? null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signIn,
      signUp,
      signInWithOtp,
      signOut,
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
