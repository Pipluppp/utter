# Plan 1: Phase 1 Remaining — Share, Search, Error Boundaries, Haptics

> **Scope**: Finish Phase 1 leftovers that weren't part of core polish
> **Estimate**: 1 session
> **Depends on**: Phase 1 core polish (done)

## Tasks

### 1. Audio share (Generate screen)

The web has a download button. On mobile, this should use the native Share sheet.

**Implementation:**
- After audio plays successfully, add a "Share" button next to Play
- Use `expo-sharing` to share the audio file
- Download the audio to a temp file via `expo-file-system`, then share the URI
- Check Expo Go compatibility: `expo-sharing` is Expo Go compatible

**Files:**
- `mobile/app/(tabs)/generate.tsx` — add Share button per completed task
- May need `expo-sharing` and `expo-file-system` in dependencies

**Web reference:** `frontend/src/pages/Generate.tsx` — `onDownload()` + `triggerDownload()`

### 2. Voice search and filter (Voices screen)

The web has debounced search, source filter (All/Clone/Designed), and pagination.

**Implementation:**
- Add search bar at top of FlatList (TextInput with search icon)
- Add source filter (segmented control: All / Clone / Designed)
- Debounce search input (300ms) using a custom hook or `useRef` timer
- Pass `?search=...&source=...&page=...&per_page=20` to `/api/voices`
- Add pagination: "Load More" button at end of list, or infinite scroll
- Skeleton loading during search transitions

**Files:**
- `mobile/app/(tabs)/index.tsx` — main implementation
- `mobile/lib/types.ts` — `VoicesResponse` already has `pagination`

**Web reference:** `frontend/src/pages/Voices.tsx` — search/filter/pagination logic

### 3. Error boundaries

Wrap the app in a top-level error boundary to catch unhandled JS crashes.

**Implementation:**
- Create `mobile/components/ErrorBoundary.tsx` (class component — RN requires class for error boundaries)
- Wrap root layout in `_layout.tsx` with the boundary
- Show a "Something went wrong" screen with "Reload" button
- Use `expo-updates` or `Updates.reloadAsync()` for reload (or just re-render)

**Files:**
- `mobile/components/ErrorBoundary.tsx` — new file
- `mobile/app/_layout.tsx` — wrap `AuthGate` or `AuthProvider`

### 4. Haptic feedback

Add haptics on key user actions for a native feel.

**Implementation:**
- Install `expo-haptics` (Expo Go compatible)
- Add `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` on:
  - Generate/Preview/Clone submit buttons
  - Delete confirmation (Heavy)
  - Success alerts (Success/NotificationSuccess)
  - Task completion (Light)
- Create a `mobile/lib/haptics.ts` helper:
  ```ts
  import * as Haptics from 'expo-haptics';
  export const hapticSubmit = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  export const hapticSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  export const hapticError = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  export const hapticDelete = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  ```

**Files:**
- `mobile/lib/haptics.ts` — new helper
- All screen files — add haptic calls at action points

### 5. Audio duration validation (Clone screen)

The web validates audio duration (60s max). Mobile only checks file size.

**Implementation:**
- After picking a file, use `expo-audio` to check duration
- Create a temporary `AudioPlayer` to load the file and read `duration`
- Reject files > 60 seconds with an error message
- This is best-effort — some formats may not report duration

**Files:**
- `mobile/app/clone.tsx` — add duration check in `pickFile`

---

## Session Prompt

```
We're continuing work on the Expo React Native mobile app for our Utter project.

**Context:**
- Worktree: C:\Users\Duncan\Desktop\utter-mobile (branch: feat/mobile-app)
- Mobile app: mobile/ directory (Expo SDK 54, expo-router v6, React 19.1.0)
- The app runs on Expo Go on a physical device, connected to production backend
- Session docs: docs/2026-03-15/ (scaffold + architecture), docs/2026-03-16/ (plans)
- Previous work: Phase 1 core polish is done (voices, generate, design, clone screens all polished)

**Task: Phase 1 Remaining**

Read docs/2026-03-16/01-phase1-remaining.md for the full plan. Use the /building-native-ui skill for all UI work.

Work through these in order:

1. **Audio share** — Add Share button on completed generations (Generate screen). Use expo-sharing + expo-file-system to download-then-share. Cross-reference frontend/src/pages/Generate.tsx.

2. **Voice search & filter** — Add search bar (debounced), source filter (All/Clone/Designed), and pagination to Voices screen. Cross-reference frontend/src/pages/Voices.tsx.

3. **Error boundary** — Create mobile/components/ErrorBoundary.tsx (class component), wrap in _layout.tsx. Show crash screen with reload.

4. **Haptic feedback** — Install expo-haptics, create mobile/lib/haptics.ts helper, wire into submit/success/error/delete actions across all screens.

5. **Audio duration validation** — Validate Clone audio file duration (60s max) using expo-audio after file pick.

Install new dependencies with --legacy-peer-deps. Run npx tsc --noEmit from mobile/ after each change. Commit after completing each feature.

**Post-session docs update (required):**
After all features are implemented:
1. Update docs/2026-03-15/01-web-parity-plan.md — change Status from "Missing" to "Done" for every feature you implemented (search, error boundaries, haptics, download/share, duration validation, etc.)
2. Add a "## Completed" section at the bottom of this plan file with: what was built, any deviations from the plan, and the commit hash(es)
3. Commit the doc updates separately: `docs(mobile): update parity plan after phase 1 remaining`
```

## Completed

**Date**: 2026-03-16

### What was built

1. **Audio share** (Generate screen) — Download generation to cache via `expo-file-system/legacy`, then share via `expo-sharing` native sheet. Play and Share buttons side by side on completed tasks.
2. **Voice search & filter** (Voices screen) — Debounced search TextInput (300ms), segmented source filter (All/Clone/Designed), infinite scroll pagination (20 per page with `onEndReached`). Empty state adapts to active filters.
3. **Error boundary** — `ErrorBoundary` class component in `mobile/components/ErrorBoundary.tsx`, wraps root layout. Shows "Something went wrong" with error message and "Try Again" reset button.
4. **Haptic feedback** — `mobile/lib/haptics.ts` helper with `hapticSubmit`, `hapticSuccess`, `hapticError`, `hapticDelete`, `hapticLight`. Wired into Generate (submit + playback), Design (preview submit + save), Clone (submit + success), Voices (delete).
5. **Audio duration validation** (Clone screen) — Uses `createAudioPlayer` to load picked file, waits for `isLoaded`, checks `duration` property. Rejects files > 60 seconds. Best-effort (allows through if duration can't be read).

### Deviations from plan

- None. All 5 features implemented as specified.

### Commits

- `d58e4a9` — feat(mobile): add audio share on Generate screen
- `5fad91d` — feat(mobile): add voice search, source filter, and pagination
- `34159b4` — feat(mobile): add error boundary with crash recovery
- `1d6dc18` — feat(mobile): add haptic feedback across all screens
- `ac55a48` — feat(mobile): add audio duration validation on Clone screen
