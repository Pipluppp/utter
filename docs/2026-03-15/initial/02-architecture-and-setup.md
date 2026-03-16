# Mobile App: Architecture and Setup

> **Date**: 2026-03-15
> **SDK**: Expo 54 (React Native 0.81.5, React 19.1.0)
> **Routing**: expo-router v6 (file-based)

## File structure

```
mobile/
├── app.json                    # Expo config (bundle ID, permissions, plugins)
├── babel.config.js             # Babel preset (babel-preset-expo)
├── package.json                # Dependencies (SDK 54 aligned)
├── tsconfig.json               # TypeScript config (strict, path aliases)
├── .env                        # Runtime environment vars
├── .env.example                # Template for local dev
├── SETUP.md                    # Original setup guide (SDK 52 era, partially outdated)
│
├── app/                        # Expo Router file-based routes
│   ├── _layout.tsx             # Root: AuthProvider > TaskProvider > Stack with auth gate
│   ├── sign-in.tsx             # Unauthenticated: email/password form
│   ├── clone.tsx               # Modal: voice cloning (file upload + metadata)
│   └── (tabs)/                 # Authenticated: tab navigator
│       ├── _layout.tsx         # Tab config (Voices, Generate, Design) + badge
│       ├── index.tsx           # Voices tab: FlatList of user voices
│       ├── generate.tsx        # Generate tab: TTS form + task tracking + playback
│       └── design.tsx          # Design tab: voice design form + preview + save
│
├── providers/
│   ├── AuthProvider.tsx        # Supabase session context (signIn, signUp, signOut)
│   └── TaskProvider.tsx        # Task state machine (polling, reducer, activeCount)
│
├── lib/
│   ├── api.ts                  # apiJson<T>(), apiRedirectUrl() with bearer + 401 retry
│   ├── constants.ts            # EXPO_PUBLIC_* env var exports
│   ├── supabase.ts             # createClient() with SecureStore adapter
│   └── types.ts                # API contract types (mirrors backend)
│
└── components/
    └── Select.tsx              # Cross-platform modal picker
```

## Architecture diagram

```
┌──────────────────────────────────────────────────┐
│                   Expo Go App                     │
│                                                   │
│  ┌─────────────┐   ┌──────────────────────────┐  │
│  │ AuthProvider │   │      TaskProvider         │  │
│  │  (Supabase)  │   │  (polling + reducer)      │  │
│  └──────┬───────┘   └────────────┬─────────────┘  │
│         │                        │                 │
│  ┌──────┴────────────────────────┴──────────────┐  │
│  │              expo-router Stack                │  │
│  │                                               │  │
│  │  Unauthed:  sign-in.tsx                       │  │
│  │                                               │  │
│  │  Authed:    (tabs)/                           │  │
│  │             ├── index.tsx    (Voices)          │  │
│  │             ├── generate.tsx (Generate)        │  │
│  │             └── design.tsx  (Design)          │  │
│  │                                               │  │
│  │  Modal:     clone.tsx                         │  │
│  └───────────────────────────────────────────────┘  │
│                        │                           │
│                   lib/api.ts                       │
│              (bearer token + retry)                │
└────────────────────────┬───────────────────────────┘
                         │ HTTPS
                         ▼
              ┌─────────────────────┐
              │  Cloudflare Workers  │
              │  /api/* (Hono)       │
              │  utter-wheat.vercel  │
              └──────────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │     Supabase        │
              │  Auth + Postgres    │
              │  + Storage (R2)     │
              └─────────────────────┘
```

## Authentication flow

```
App launch
  │
  ├── SecureStore has session? ──yes──► Auto-restore session
  │                                     │
  │                                     ├── Token valid? ──yes──► Show (tabs)
  │                                     │
  │                                     └── Token expired? ──► Supabase auto-refresh
  │                                                              │
  │                                                              ├── Refresh OK ──► Show (tabs)
  │                                                              └── Refresh fail ──► Show sign-in
  │
  └── No session? ──► Show sign-in
                         │
                         ├── signIn(email, password) ──► Supabase auth
                         └── signUp(email, password) ──► Supabase auth
                                                          │
                                                          └── Session stored in SecureStore
                                                              └── Show (tabs)
```

## API client pattern

All API calls go through `lib/api.ts`:

```
apiJson<T>(path, init)
  │
  ├── Get access token from Supabase session
  ├── Attach Authorization: Bearer {token}
  ├── fetch(API_BASE_URL + path, init)
  │
  ├── 401 response?
  │   ├── Refresh session (supabase.auth.refreshSession())
  │   ├── Retry with new token
  │   └── Still 401? ──► Throw ApiError
  │
  ├── !ok? ──► Parse JSON error (detail or message) ──► Throw ApiError
  │
  └── ok? ──► Parse JSON ──► Return T
```

The `apiRedirectUrl(path)` variant follows redirects and returns the final URL (used for signed audio URLs from Supabase Storage).

## Task polling system

```
startTask(taskId, type, description)
  │
  ├── Dispatch ADD_TASK to reducer
  ├── Start setInterval(1000ms) for this taskId
  │
  └── Every tick:
      ├── GET /api/tasks/{taskId}
      ├── Dispatch UPSERT_TASK with server response
      │
      └── Terminal status (completed/failed/cancelled)?
          └── clearInterval() for this taskId
```

The `activeCount` from TaskProvider drives the Generate tab badge.

## SDK 54 specifics

### Key dependency versions

| Package | Version | Notes |
|---------|---------|-------|
| expo | ^54 | SDK 54 |
| react | 19.1.0 | Pinned exact (must match react-native-renderer) |
| react-native | 0.81.5 | New Architecture enabled |
| expo-router | ~6.0.23 | v6 (breaking changes from v4) |
| expo-audio | ~1.1.1 | Replaces expo-av (deprecated in SDK 54) |
| expo-file-system | ~19.0.21 | New File class (implements Blob), legacy uploadAsync removed |

### Breaking changes from SDK 52

1. **expo-av removed** -- Use `expo-audio` with `useAudioPlayer(source)` hook
2. **FileSystem.uploadAsync removed** -- Use `new File(uri)` (implements Blob) + `fetch()`
3. **expo-router v4 to v6** -- Import paths and some APIs changed
4. **React 18 to 19** -- Must pin exact version to match react-native-renderer
5. **babel-preset-expo** -- Must be explicitly installed (not bundled)
6. **`--legacy-peer-deps`** -- Required for npm install due to transient peer conflicts

### Expo Go compatibility

All packages used are Expo Go compatible. No custom native code is required. If future features need native modules (e.g., waveform visualization via Skia), a dev client build will be needed -- see `expo-dev-client` agent skill.

## Environment configuration

### Production (current)

```env
EXPO_PUBLIC_SUPABASE_URL=https://jgmivviwockcwjkvpqra.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase_anon_key>
EXPO_PUBLIC_API_BASE_URL=https://utter-wheat.vercel.app
```

### Local development (for running against local Workers)

```env
# Android emulator
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8787

# iOS simulator
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8787

# Physical device (use LAN IP of dev machine)
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8787
```

## Developer setup

### Prerequisites

- Node.js 20+
- Expo Go app installed on phone (SDK 54 compatible)
- Phone and dev machine on same Wi-Fi network

### Quick start

```bash
# Navigate to worktree
cd C:\Users\Duncan\Desktop\utter-mobile\mobile

# Install dependencies
npm install --legacy-peer-deps

# Start Metro bundler
npx expo start -c

# Scan QR code with Expo Go on phone
```

### Typecheck

```bash
npx tsc --noEmit
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| React version mismatch error | Ensure `react` is pinned to `19.1.0` (exact), not `^19.1.0` |
| `expo-av` plugin not found | Removed from `app.json` plugins; use `expo-audio` instead |
| `babel-preset-expo` not found | `npx expo install babel-preset-expo` |
| Can't connect from Expo Go | Press `s` in terminal for tunnel mode, or ensure same Wi-Fi |
| `FileSystemUploadType` not found | SDK 54 removed it; use `new File(uri)` + `fetch()` |
| npm peer dep conflicts | Use `npm install --legacy-peer-deps` |

## App configuration (app.json)

```json
{
  "expo": {
    "name": "Utter",
    "slug": "utter",
    "version": "0.1.0",
    "scheme": "utter",
    "userInterfaceStyle": "dark",
    "newArchEnabled": true,
    "ios": { "bundleIdentifier": "com.utter.app" },
    "android": { "package": "com.utter.app", "permissions": ["RECORD_AUDIO"] },
    "plugins": ["expo-router", "expo-secure-store", ["expo-audio", { "microphonePermission": "..." }], "expo-asset", "expo-font"]
  }
}
```
