# Plan 05: Auth & API Client Hardening

**Severity:** High
**Est:** 0.5 session
**Files:** `mobile/providers/AuthProvider.tsx`, `mobile/lib/api.ts`, `mobile/app/account.tsx`

## Problem

The auth provider swallows deep link errors, the API client has a platform-specific redirect bug and no concurrent 401 deduplication, and the account screen uses a deprecated RN API.

### 5.1 Deep link error handling missing (High)

Both `setSession` and `exchangeCodeForSession` in `handleAuthUrl` can throw (expired link, invalid code), but errors are silently swallowed:

```tsx
const handleAuthUrl = async (url: string) => {
  const params = getParamsFromUrl(url);
  if (params.access_token && params.refresh_token) {
    await supabase.auth.setSession({ ... }); // can throw
    return;
  }
  if (params.code) {
    await supabase.auth.exchangeCodeForSession(params.code); // can throw
  }
};
```

Also, `getInitialURL().then(url => handleAuthUrl(url))` has an unhandled rejection.

**Fix:**

```tsx
const handleAuthUrl = async (url: string) => {
  try {
    const params = getParamsFromUrl(url);
    if (params.access_token && params.refresh_token) {
      const { error } = await supabase.auth.setSession({ ... });
      if (error) Alert.alert('Sign-in failed', error.message);
      return;
    }
    if (params.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) Alert.alert('Sign-in failed', error.message);
    }
  } catch (err) {
    Alert.alert('Sign-in failed', 'The link may have expired. Please try again.');
  }
};

// And for initial URL:
Linking.getInitialURL()
  .then((url) => { if (url) return handleAuthUrl(url); })
  .catch(() => {}); // initial URL read failed — no action needed
```

### 5.2 Race condition between `onAuthStateChange` and `getSession` (Medium)

If `onAuthStateChange` fires before `getSession` resolves (possible with cached session), the second `setSession` from `getSession` may overwrite a newer session.

**Fix:** Use a mounted/stale guard:

```tsx
useEffect(() => {
  let stale = false;

  supabase.auth.getSession().then(({ data }) => {
    if (!stale) {
      setSession(data.session);
      setIsLoading(false);
    }
  });

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    stale = true; // getSession result is now stale
    setSession(session);
    setIsLoading(false);
  });

  return () => { sub.subscription.unsubscribe(); };
}, []);
```

### 5.3 `apiRedirectUrl` returns wrong URL on Android (High)

On Android (OkHttp), `Response.url` after a followed redirect returns the **original** URL, not the final redirected URL. Audio playback could silently fail.

**Fix:** Use `redirect: 'manual'` and read the `Location` header:

```tsx
export async function apiRedirectUrl(path: string): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    redirect: 'manual',
  });

  if (res.status >= 300 && res.status < 400) {
    return res.headers.get('Location') || `${API_BASE_URL}${path}`;
  }
  // Not a redirect — return the original URL
  return `${API_BASE_URL}${path}`;
}
```

Test on both iOS and Android physical devices to verify.

### 5.4 No concurrent 401 deduplication (Medium)

If two API calls hit 401 simultaneously, both call `refreshAccessToken()`, which calls `supabase.auth.refreshSession()` twice. If the first refresh invalidates the old refresh token before the second completes, the user is silently logged out.

**Fix:** Use a shared promise for concurrent refreshes:

```tsx
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) return null;
      return data.session.access_token;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
```

### 5.5 `Clipboard` from `react-native` is deprecated (High)

`account.tsx` imports `Clipboard` from `react-native`, which was removed in RN 0.72+. On RN 0.81.5 this will throw at runtime.

**Fix:** Replace with `expo-clipboard`:

```bash
npx expo install expo-clipboard
```

```tsx
import * as Clipboard from 'expo-clipboard';

// Usage:
await Clipboard.setStringAsync(userId);
```

### 5.6 `apiForm` Content-Type override risk (Low)

If `authHeaders()` or `extraHeaders` set `Content-Type`, it overrides React Native's auto-detected `multipart/form-data` boundary. Currently safe because neither sets it, but fragile.

**Fix:** Explicitly delete `Content-Type` when body is FormData:

```tsx
const headers = buildHeaders(await authHeaders());
if (body instanceof FormData) {
  delete headers['Content-Type'];
}
```

## Implementation order

1. **5.5** — Clipboard fix (will crash at runtime — quick fix)
2. **5.3** — `apiRedirectUrl` Android fix (audio playback broken on Android)
3. **5.1** — Deep link error handling
4. **5.4** — 401 deduplication
5. **5.2** — Auth race condition
6. **5.6** — Content-Type guard

## Acceptance criteria

- [ ] Expired magic link shows an error alert instead of silently failing
- [ ] Audio playback works on Android physical device (verify `apiRedirectUrl`)
- [ ] Copy User ID works on account screen (expo-clipboard)
- [ ] Two simultaneous 401s result in exactly 1 token refresh call
- [ ] Auth init does not overwrite a newer session with a stale one
