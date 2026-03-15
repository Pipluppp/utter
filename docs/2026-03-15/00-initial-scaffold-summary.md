# Mobile App: Initial Scaffold Summary

> **Date**: 2026-03-15
> **Branch**: `feat/mobile-app`
> **Status**: Working on physical device via Expo Go

## What was built

A complete Expo React Native mobile app scaffold that mirrors the core functionality of the existing web frontend. The app runs on Expo Go (no custom native code required) and connects to the production Cloudflare Workers API backend.

### Screens implemented

| Screen | File | Description |
|--------|------|-------------|
| Sign In | `app/sign-in.tsx` | Email/password auth with sign-in/sign-up toggle |
| Voices | `app/(tabs)/index.tsx` | FlatList of user voices with Clone and Sign Out actions |
| Generate | `app/(tabs)/generate.tsx` | Voice + language selectors, text input, task tracking, audio playback |
| Design | `app/(tabs)/design.tsx` | Voice description + preview text, task tracking, save to library |
| Clone | `app/clone.tsx` | Modal -- file picker, voice name, language, transcript, 3-step upload |

### Infrastructure implemented

| Layer | File(s) | Description |
|-------|---------|-------------|
| Auth | `providers/AuthProvider.tsx`, `lib/supabase.ts` | Supabase auth with SecureStore token persistence |
| API Client | `lib/api.ts` | Typed JSON/redirect client with bearer token injection and 401 retry |
| Task Polling | `providers/TaskProvider.tsx` | 1-second interval polling with in-memory reducer, terminal state auto-cleanup |
| Types | `lib/types.ts` | Mirrors backend API contracts (Voice, Generation, Task, etc.) |
| Config | `lib/constants.ts`, `.env` | Environment-based Supabase + API URLs |
| Navigation | `app/_layout.tsx`, `app/(tabs)/_layout.tsx` | Stack root with auth gate, 3-tab navigator with badge |
| Components | `components/Select.tsx` | Cross-platform modal picker |

### Key decisions

1. **Inline styles over StyleSheet.create** -- per `building-native-ui` skill, inline styles are preferred for native development
2. **expo-audio over expo-av** -- hook-based `useAudioPlayer` replaces imperative `Audio.Sound` (SDK 54 deprecated expo-av)
3. **Native tab headers** -- `headerShown: true` with dark theme styling instead of custom header components
4. **No Tailwind/NativeWind** -- deferred; inline styles are sufficient for the scaffold phase
5. **No dev client needed** -- all dependencies are Expo Go compatible
6. **Production backend** -- connects to `https://utter-wheat.vercel.app` during development (no local Workers needed)

## Session timeline

### Phase 1: Initial scaffold (prior session)

- Created `mobile/` directory with Expo SDK 52
- Implemented all screens, providers, API client, types
- Set up Supabase auth with SecureStore adapter
- Created task polling system with 1s interval
- Set up file-based routing with expo-router

### Phase 2: Skill alignment and bug fixes (this session)

- **Reviewed agent skills**: `building-native-ui`, `expo-dev-client`, `expo-tailwind-setup`
- **Rewrote all tab screens** to align with `building-native-ui` conventions:
  - Swapped `expo-av` to `expo-audio` (`useAudioPlayer` hook)
  - Enabled native tab headers (removed custom title elements)
  - Switched from `StyleSheet.create` to inline styles
  - Added `contentInsetAdjustmentBehavior="automatic"` for safe areas
  - Added `borderCurve: 'continuous'` on rounded elements
  - Added `selectable` prop on error/data Text elements
  - Replaced `Platform.OS` with `process.env.EXPO_OS`
- **Fixed 3 runtime bugs**:
  - TaskProvider null crash on `stopPolling(task.taskId)` when task was null
  - Sound resource leak in generate.tsx error handler
  - Dead FormData creation in design.tsx
- **Confirmed**: Tailwind not needed for scaffold, dev client not needed for Expo Go

### Phase 3: SDK upgrade and launch (this session)

- **Upgraded SDK 52 to SDK 54** to match Expo Go on device:
  - Bumped all dependencies (react 19.1.0, react-native 0.81.5, expo-router 6, etc.)
  - Fixed `clone.tsx` breaking change: replaced `FileSystem.uploadAsync` + `FileSystemUploadType.BINARY_CONTENT` with new `File` class (implements `Blob`) + native `fetch`
  - Removed `expo-av` from plugins, moved microphone permission to `expo-audio` plugin
  - Pinned `react` to `19.1.0` (exact) to match react-native-renderer version
  - Installed missing `babel-preset-expo`
  - Used `--legacy-peer-deps` to resolve transient peer conflicts
- **Typecheck passes**: zero errors
- **Expo Go launches**: app loads on physical Android device

## What is NOT yet implemented

See `01-web-parity-plan.md` for the full gap analysis. Key missing features:

- Audio recording for voice cloning (browser WebAudio APIs don't exist in RN)
- Waveform visualization (WaveSurfer.js is web-only)
- Voice library search, filtering, and pagination
- Generation history page
- Task queue viewer page
- Account/billing pages
- Stripe checkout integration
- Auto-transcription
- Form state persistence (localStorage equivalent)
- Dark/light theme switching
