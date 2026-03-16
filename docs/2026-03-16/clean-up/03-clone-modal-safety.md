# Plan 03: Clone Modal Safety

**Severity:** Critical + High
**Est:** 0.5 session
**Files:** `mobile/app/clone.tsx`

## Problem

The Clone modal has three safety issues: a leaking duration-check loop, no recording cleanup on dismiss, and unauthenticated static file fetches.

### 3.1 Duration-check polling loop leaks (Critical)

When validating uploaded audio duration, a polling loop checks `tempPlayer.isLoaded` every 100ms with a 5-second timeout:

```tsx
const tempPlayer = createAudioPlayer({ uri: asset.uri });
await new Promise<void>((resolve) => {
  const check = () => {
    if (tempPlayer.isLoaded) {
      resolve();
    } else {
      setTimeout(check, 100);
    }
  };
  check();
  setTimeout(resolve, 5000); // safety timeout
});
const duration = tempPlayer.duration;
tempPlayer.release();
```

Problems:
1. The 5s timeout resolves the promise but does **not** cancel the `check` loop — it continues calling `setTimeout(check, 100)` indefinitely after the promise resolves
2. If resolved via timeout, `tempPlayer.isLoaded` is false, so `duration` is 0/undefined — the 60s check passes trivially for any file length
3. `tempPlayer.release()` is called while the player may still be loading

**Fix:** Use a single mechanism with proper cleanup:

```tsx
const tempPlayer = createAudioPlayer({ uri: asset.uri });
const duration = await new Promise<number>((resolve, reject) => {
  let settled = false;
  const timeoutId = setTimeout(() => {
    if (!settled) {
      settled = true;
      reject(new Error('Could not read audio duration'));
    }
  }, 5000);

  const check = () => {
    if (settled) return;
    if (tempPlayer.isLoaded) {
      settled = true;
      clearTimeout(timeoutId);
      resolve(tempPlayer.duration);
    } else {
      setTimeout(check, 100);
    }
  };
  check();
});
tempPlayer.release();
```

Alternatively, if expo-audio exposes a `statusChange` event, use that instead of polling.

### 3.2 No recording cleanup on modal dismiss (Critical)

If the user swipes down to close the Clone modal while actively recording, `recorder.stop()` is never called. The microphone stays active in the background, draining battery and potentially causing permission issues.

**Fix:** Add a cleanup effect:

```tsx
useEffect(() => {
  return () => {
    if (recorder.isRecording) {
      recorder.stop().catch(() => {});
    }
  };
}, [recorder]);
```

Also consider adding a `useEffect` that listens to navigation state and stops recording when the screen blurs, since modal dismiss may not always trigger unmount immediately.

### 3.3 `loadExample` bypasses API client (Medium)

```tsx
const [textRes, audioRes] = await Promise.all([
  fetch(`${API_BASE_URL}/static/examples/audio_text.txt`),
  fetch(`${API_BASE_URL}/static/examples/audio.wav`),
]);
```

Uses raw `fetch()` without auth headers. If these endpoints ever require authentication (or if the API adds CORS restrictions), this breaks silently.

**Fix:** Use `apiJson` for the text file and `apiRedirectUrl` or a raw fetch with the auth header builder for the audio file:

```tsx
import { apiJson } from '../lib/api';

// For the text response:
const textRes = await fetch(`${API_BASE_URL}/static/examples/audio_text.txt`, {
  headers: await authHeaders(),
});

// Or if truly public and stable, add a comment explaining why:
// These are public static assets served without auth — no apiJson needed
```

### 3.4 `FormData.append` with RN object literal (Low — document only)

```tsx
form.append('audio', { uri, type: 'audio/mp4', name: 'recording.m4a' } as unknown as Blob);
```

This is standard React Native behavior for FormData file uploads, but the `as unknown as Blob` cast obscures it. Add a comment:

```tsx
// React Native FormData accepts { uri, type, name } objects for file uploads.
// The Blob cast is a TypeScript workaround — RN's fetch handles the actual multipart encoding.
form.append('audio', { uri, type: 'audio/mp4', name: 'recording.m4a' } as any);
```

## Acceptance criteria

- [ ] Duration check: polling loop terminates when timeout fires (no leaked `setTimeout` chain)
- [ ] Duration check: timeout path shows an error to the user instead of silently passing
- [ ] Recording stops when Clone modal is dismissed mid-recording
- [ ] `loadExample` either uses the API client or has a clear comment explaining why it doesn't
- [ ] FormData file append has an explanatory comment
