# 2026-03-15 Mobile App Initial Scaffold

This folder captures the initial scaffolding of the Expo React Native mobile app for Utter, from zero to a working app running on a physical device via Expo Go.

## Scope

- Scaffold the `mobile/` directory as a new Expo SDK 54 app inside the monorepo
- Implement all core screens mirroring the web frontend (auth, voices, generate, design, clone)
- Set up Supabase auth with SecureStore, typed API client, and async task polling
- Align codebase with agent skills (`building-native-ui`, `expo-dev-client`, `expo-tailwind-setup`)
- Upgrade from SDK 52 to SDK 54 to match Expo Go on device
- Verify typecheck and Expo Go launch on physical device

## Artifacts

All initial scaffold plans are in `initial/`:

1. `initial/00-initial-scaffold-summary.md` -- What was built and how the mobile app works
2. `initial/01-web-parity-plan.md` -- Feature gap analysis and phased plan to reach 1:1 web parity
3. `initial/02-architecture-and-setup.md` -- Technical architecture, file map, and developer setup guide
4. `initial/03-next-session-prompt.md` -- Continuation prompt for next session

## Branch

- Branch: `feat/mobile-app`
- Worktree: `C:\Users\Duncan\Desktop\utter-mobile` (git worktree of `utter/`)

## Working style

- Worktree-based development: `utter-mobile/` is an isolated worktree on `feat/mobile-app`
- Mobile app lives in `mobile/` subdirectory of the monorepo
- Connects to production backend (`https://utter-wheat.vercel.app`) during development
- Tested via Expo Go on physical Android device over LAN
