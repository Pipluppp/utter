import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { useTheme } from '../providers/ThemeProvider';

type AuthMode = 'password' | 'magic-link';
type PasswordIntent = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const { signIn, signUp, signInWithOtp } = useAuth();
  const { colors, isDark } = useTheme();

  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [passwordIntent, setPasswordIntent] = useState<PasswordIntent>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handlePasswordSubmit = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    setInfo(null);

    if (passwordIntent === 'sign-in') {
      const err = await signIn(email.trim(), password);
      if (err) setError(err);
    } else {
      const err = await signUp(email.trim(), password);
      if (err) {
        setError(err);
      } else {
        setInfo('Check your email to confirm your account, then sign in.');
        setPasswordIntent('sign-in');
      }
    }

    setLoading(false);
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);

    const err = await signInWithOtp(email.trim());
    if (err) {
      setError(err);
    } else {
      setMagicLinkSent(true);
    }
    setLoading(false);
  };

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setError(null);
    setInfo(null);
    setMagicLinkSent(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={[styles.brand, { color: colors.text }]}>Utter</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {authMode === 'magic-link'
            ? 'Sign in with a magic link'
            : passwordIntent === 'sign-in'
              ? 'Sign in to your account'
              : 'Create a new account'}
        </Text>

        {/* Mode tabs */}
        <View style={[styles.modeToggle, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.modeTab, { backgroundColor: colors.background }, authMode === 'password' && { backgroundColor: colors.text }]}
            onPress={() => switchMode('password')}
            disabled={loading}
          >
            <Text style={[styles.modeTabText, { color: colors.textSecondary }, authMode === 'password' && { color: colors.background }]}>
              Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, styles.modeTabRight, { backgroundColor: colors.background, borderLeftColor: colors.border }, authMode === 'magic-link' && { backgroundColor: colors.text }]}
            onPress={() => switchMode('magic-link')}
            disabled={loading}
          >
            <Text style={[styles.modeTabText, { color: colors.textSecondary }, authMode === 'magic-link' && { color: colors.background }]}>
              Magic Link
            </Text>
          </TouchableOpacity>
        </View>

        {error && <Text style={[styles.error, { color: colors.danger, backgroundColor: isDark ? '#1a0000' : '#fde8e8' }]}>{error}</Text>}
        {info && <Text style={[styles.info, { color: colors.success, backgroundColor: isDark ? '#001a0a' : '#e8fde8' }]}>{info}</Text>}

        {authMode === 'magic-link' && magicLinkSent ? (
          <View style={styles.sentContainer}>
            <Text style={[styles.sentText, { color: colors.success }]}>
              Check your email for a magic link to sign in.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setMagicLinkSent(false);
                setEmail('');
              }}
            >
              <Text style={[styles.toggleText, { color: colors.accent }]}>Send another</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {authMode === 'password' && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.text }, loading && styles.buttonDisabled]}
              onPress={authMode === 'magic-link' ? handleMagicLink : handlePasswordSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.background }]}>
                  {authMode === 'magic-link'
                    ? 'Send Magic Link'
                    : passwordIntent === 'sign-in'
                      ? 'Sign In'
                      : 'Sign Up'}
                </Text>
              )}
            </TouchableOpacity>

            {authMode === 'password' && (
              <TouchableOpacity
                style={styles.toggle}
                onPress={() => {
                  setPasswordIntent(passwordIntent === 'sign-in' ? 'sign-up' : 'sign-in');
                  setError(null);
                  setInfo(null);
                }}
              >
                <Text style={[styles.toggleText, { color: colors.accent }]}>
                  {passwordIntent === 'sign-in'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  brand: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  modeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 24,
    overflow: 'hidden',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeTabRight: {
    borderLeftWidth: 1,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sentContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  sentText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  toggle: { marginTop: 20, alignItems: 'center' },
  toggleText: { fontSize: 14 },
  error: {
    fontSize: 14,
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 8,
  },
  info: {
    fontSize: 14,
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 8,
  },
});
