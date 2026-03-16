import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const THEME_KEY = 'user_theme_preference';

type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  danger: string;
  success: string;
  warning: string;
  skeleton: string;
  skeletonHighlight: string;
}

const darkColors: ThemeColors = {
  background: '#000',
  surface: '#111',
  surfaceHover: '#1a1a1a',
  border: '#333',
  text: '#fff',
  textSecondary: '#888',
  textTertiary: '#555',
  accent: '#0af',
  danger: '#f44',
  success: '#0a0',
  warning: '#fa0',
  skeleton: '#111',
  skeletonHighlight: '#222',
};

const lightColors: ThemeColors = {
  background: '#fff',
  surface: '#f5f5f5',
  surfaceHover: '#eee',
  border: '#ddd',
  text: '#111',
  textSecondary: '#666',
  textTertiary: '#999',
  accent: '#07f',
  danger: '#d33',
  success: '#090',
  warning: '#e90',
  skeleton: '#eee',
  skeletonHighlight: '#ddd',
};

type ThemeContextValue = {
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await SecureStore.getItemAsync(THEME_KEY);
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        setMode(stored);
      }
      setLoaded(true);
    })();
  }, []);

  const setTheme = (next: ThemeMode) => {
    setMode(next);
    void SecureStore.setItemAsync(THEME_KEY, next);
  };

  const isDark = mode === 'system' ? (systemScheme ?? 'dark') === 'dark' : mode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: isDark ? darkColors : lightColors, mode, isDark, setTheme }),
    [isDark, mode],
  );

  // Don't render children until we've loaded the persisted preference
  // to avoid a flash of wrong theme
  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
