# Mobile App Setup

Expo + TypeScript React Native app for Utter.

## Architecture

```
mobile/
├── app/                 # Expo Router screens
│   ├── _layout.tsx      # Root: providers + auth gate
│   ├── sign-in.tsx      # Email/password auth
│   ├── clone.tsx        # Clone voice (modal)
│   └── (tabs)/          # Tab navigator
│       ├── index.tsx    # Voices list
│       ├── generate.tsx # TTS generation
│       └── design.tsx   # Voice design
├── lib/                 # Shared utilities
│   ├── supabase.ts      # Supabase client (SecureStore adapter)
│   ├── api.ts           # Typed API client (bearer + 401 retry)
│   ├── types.ts         # API contract types (mirrored from web)
│   └── constants.ts     # Env vars
├── providers/
│   ├── AuthProvider.tsx  # Supabase auth context
│   └── TaskProvider.tsx  # Task polling + state
└── components/
    └── Select.tsx       # Cross-platform picker
```

### Phase plan

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Scaffold, auth, API client, types | Done |
| 1 | Voices list, Generate, Design, Clone screens, task polling | Done |
| 2 | Audio recording (expo-av), playback polish, credits/billing | Planned |
| 3 | Offline caching, push notifications, performance tuning | Planned |

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

## Prerequisites

- **Node.js** 20+
- **Expo CLI**: `npm install -g expo-cli` (or use `npx expo`)
- **Android**: Android Studio + emulator (API 34+), or physical device with Expo Go
- **iOS** (macOS only): Xcode 15+, or physical device with Expo Go
- **Backend running**: Follow root `docs/setup.md` to start Supabase + API Worker

## Install

```bash
cd mobile
npm install
npx expo install --fix   # resolves exact compatible versions
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

## VS Code setup

### Recommended extensions

- **Expo Tools** (`expo.vscode-expo-tools`) — app.json intellisense, EAS helpers
- **React Native Tools** (`msjsdiag.vscode-react-native`) — debugger, log streaming
- **ESLint** + **Prettier** — standard linting

### Workspace settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### Debug configuration

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Expo: Debug",
      "type": "reactnative",
      "request": "attach",
      "platform": "exponent",
      "expoHostType": "lan"
    }
  ]
}
```

## Typecheck

```bash
npm run typecheck
```

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

### Expo version mismatches
```bash
npx expo install --fix
```
This resolves all dependency versions to be compatible with your Expo SDK version.
