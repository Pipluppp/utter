import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { TaskProvider } from '../providers/TaskProvider';
import { ThemeProvider, useTheme } from '../providers/ThemeProvider';

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { session, isLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;

    const inTabs = segments[0] === '(tabs)';

    if (session && !inTabs) {
      router.replace('/(tabs)');
    } else if (!session && segments[0] !== 'sign-in') {
      router.replace('/sign-in');
    }
  }, [session, isLoading, segments, router]);

  if (isLoading) return null; // splash screen still visible

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="clone"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Clone Voice',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="account"
          options={{
            presentation: 'modal',
            title: 'Account',
            headerShown: true,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="tasks"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Tasks',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <TaskProvider>
            <AuthGate />
          </TaskProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
