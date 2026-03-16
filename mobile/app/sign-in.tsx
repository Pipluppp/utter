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

type AuthMode = 'password' | 'magic-link';
type PasswordIntent = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const { signIn, signUp, signInWithOtp } = useAuth();

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
      style={styles.container}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.brand}>Utter</Text>
        <Text style={styles.subtitle}>
          {authMode === 'magic-link'
            ? 'Sign in with a magic link'
            : passwordIntent === 'sign-in'
              ? 'Sign in to your account'
              : 'Create a new account'}
        </Text>

        {/* Mode tabs */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeTab, authMode === 'password' && styles.modeTabActive]}
            onPress={() => switchMode('password')}
            disabled={loading}
          >
            <Text style={[styles.modeTabText, authMode === 'password' && styles.modeTabTextActive]}>
              Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, styles.modeTabRight, authMode === 'magic-link' && styles.modeTabActive]}
            onPress={() => switchMode('magic-link')}
            disabled={loading}
          >
            <Text style={[styles.modeTabText, authMode === 'magic-link' && styles.modeTabTextActive]}>
              Magic Link
            </Text>
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {info && <Text style={styles.info}>{info}</Text>}

        {authMode === 'magic-link' && magicLinkSent ? (
          <View style={styles.sentContainer}>
            <Text style={styles.sentText}>
              Check your email for a magic link to sign in.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setMagicLinkSent(false);
                setEmail('');
              }}
            >
              <Text style={styles.toggleText}>Send another</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {authMode === 'password' && (
              <>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#666"
                  secureTextEntry
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={authMode === 'magic-link' ? handleMagicLink : handlePasswordSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>
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
                <Text style={styles.toggleText}>
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
  container: { flex: 1, backgroundColor: '#000' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  brand: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  modeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    marginBottom: 24,
    overflow: 'hidden',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#000',
  },
  modeTabRight: {
    borderLeftWidth: 1,
    borderLeftColor: '#333',
  },
  modeTabActive: {
    backgroundColor: '#fff',
  },
  modeTabText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeTabTextActive: {
    color: '#000',
  },
  sentContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  sentText: {
    color: '#0c6',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  label: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  toggle: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: '#0af', fontSize: 14 },
  error: {
    color: '#f44',
    fontSize: 14,
    padding: 12,
    backgroundColor: '#1a0000',
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 8,
  },
  info: {
    color: '#0c6',
    fontSize: 14,
    padding: 12,
    backgroundColor: '#001a0a',
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 8,
  },
});
