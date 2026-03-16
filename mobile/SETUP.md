# Mobile App Setup

Expo SDK 54 + React Native 0.81 + TypeScript app for Utter.

## Architecture

```
mobile/
├── app/                   # Expo Router screens
│   ├── _layout.tsx        # Root: providers + auth gate
│   ├── sign-in.tsx        # Email/password + magic link auth
│   ├── clone.tsx          # Clone voice (modal, mic recording + transcription)
│   ├── account.tsx        # Credits, billing, profile, theme toggle
│   ├── tasks.tsx          # Task queue viewer (cancel/dismiss, live polling)
│   └── (tabs)/            # Tab navigator
│       ├── _layout.tsx    # Tab bar + active-task badge
│       ├── index.tsx      # Voices list (search, filter, delete)
│       ├── generate.tsx   # TTS generation
│       ├── design.tsx     # Voice design
│       └── history.tsx    # Generation history (playback, share, delete)
├── lib/                   # Shared utilities
│   ├── supabase.ts        # Supabase client (SecureStore adapter, deduped refresh)
│   ├── api.ts             # Typed API client (bearer + 401 retry + redirect fix)
│   ├── types.ts           # API contract types (mirrored from web)
│   ├── constants.ts       # Env vars
│   ├── haptics.ts         # Haptic feedback helpers
│   └── formPersistence.ts # Form draft persistence
├── providers/
│   ├── AuthProvider.tsx    # Supabase auth context (deep link handling)
│   ├── TaskProvider.tsx    # Task polling + persistence (AsyncStorage)
│   └── ThemeProvider.tsx   # Dark/light/system theme context
└── components/
    ├── AudioPlayerBar.tsx  # Play/pause + drag-to-seek progress bar
    ├── ErrorBoundary.tsx   # Screen-level error boundary
    └── Select.tsx          # Cross-platform picker
```

### Progress

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Scaffold, auth, API client, types | Done |
| 1 | All screens: voices, generate, design, clone, history, tasks, account | Done |
| 2 | Audio recording (expo-audio), playback, credits/billing, theme toggle | Done |
| Clean-up A | TaskProvider stabilization, AudioPlayerBar fixes, clone modal safety | Done |
| Clean-up B | FlatList performance, auth & API hardening | Done |
| Clean-up C | UX polish (keyboard, icons, a11y) + feature parity gaps | Next |

### Data flow

```
Mobile app
  ↓ Supabase Auth (SecureStore session)
  ↓ Bearer token
API Worker (same as web)
  ↓ Supabase RLS + R2 + Queues
  ↓ Qwen TTS provider
```

No server changes needed — the mobile app is a pure client consuming the same `/api/*` routes.

### Key implementation details

- **FlatList performance**: All list screens (voices, history, tasks) use `React.memo` card components and `StyleSheet.create` at module level. History auto-refresh uses a ref to avoid interval teardown.
- **Auth**: Deep link callbacks have error handling with user-facing alerts. `getSession`/`onAuthStateChange` race condition is guarded with a stale flag.
- **API client**: `apiRedirectUrl` uses `redirect:'manual'` + Location header (Android OkHttp compat). Concurrent 401 refreshes are deduplicated via shared promise.
- **Task polling**: Persistent via AsyncStorage, stable context refs, 1s polling for active tasks.
- **Theme**: System/dark/light toggle stored in AsyncStorage, color tokens via context.

## Prerequisites

- **Node.js** 20+
- **Expo CLI**: `npm install -g expo-cli` (or use `npx expo`)
- **Android**: Android Studio + emulator (API 34+), or physical device with Expo Go
- **iOS** (macOS only): Xcode 15+, or physical device with Expo Go
- **Backend running**: Follow root `docs/setup.md` to start Supabase + API Worker

## Install

```bash
cd mobile
npm install --legacy-peer-deps
```

## Environment

```bash
cp .env.example .env
```

Fill in your values:

| Variable | Value |
|----------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | Same as web `VITE_SUPABASE_URL` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same as web `VITE_SUPABASE_ANON_KEY` |
| `EXPO_PUBLIC_API_BASE_URL` | See table below |

### API URL by platform

| Platform | `EXPO_PUBLIC_API_BASE_URL` |
|----------|---------------------------|
| Android emulator | `http://10.0.2.2:8787` |
| iOS simulator | `http://127.0.0.1:8787` |
| Physical device | `http://<YOUR_LAN_IP>:8787` |
| Production | `https://utter-wheat.vercel.app` |

For physical devices, find your LAN IP with `ipconfig` (Windows) or `ifconfig` (macOS/Linux).

## Run

```bash
# Start Expo dev server
npx expo start

# Or target a specific platform
npx expo start --android
npx expo start --ios
```

Press `a` for Android emulator, `i` for iOS simulator, or scan the QR code with Expo Go on a physical device.

## Typecheck

```bash
npx tsc --noEmit
```

## What's next (Session C)

Remaining clean-up plans in `docs/2026-03-16/clean-up/`:

- **06-ux-polish.md** — Tab icons (Ionicons), KeyboardAvoidingView on form screens, focus-gated polling, form persistence migration to AsyncStorage, splash screen gate, accessibility labels
- **07-feature-parity-gaps.md** — Voice preview playback on voices list, model parameter passthrough, cancelled status filter in history, transcribe-upload button in clone, type sync for missing fields

See `docs/2026-03-16/clean-up/README.md` for the full session C prompt and priority order.

## Troubleshooting

### "Network request failed" on API calls
- Verify API Worker is running at `http://127.0.0.1:8787`
- Check `EXPO_PUBLIC_API_BASE_URL` matches your platform (see table above)
- For physical devices, ensure phone and dev machine are on the same network
- Check API Worker CORS allows the request origin

### "Unable to resolve module" after install
```bash
npx expo start --clear
```

### Android emulator can't reach localhost
Android emulator uses `10.0.2.2` to reach the host machine's `127.0.0.1`. Set `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8787`.

### SecureStore errors on web
SecureStore is native-only. The app is designed for iOS/Android. For web testing, use the existing web frontend.

### Peer dependency conflicts during install
```bash
npm install --legacy-peer-deps
```
The project has a react 19.1 / react-dom 19.2 peer dep mismatch that requires `--legacy-peer-deps` for now.

### Expo version mismatches
```bash
npx expo install --fix
```
This resolves all dependency versions to be compatible with your Expo SDK version.
