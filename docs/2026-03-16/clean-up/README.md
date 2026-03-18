# Mobile App Clean-Up — Execution Guide

Post-parity code review fixes, split into 3 sessions based on dependency order.

## Dependency graph

```
Session A (critical):  01-TaskProvider ─┐
                       02-AudioPlayer   │  (no interdeps between A plans)
                       03-CloneModal    │
                                        ▼
Session B (high):      04-ListPerf ◄── 01 done (stable getTasksByType)
                       05-AuthAPI       (standalone)
                                        ▼
Session C (medium):    06-UXPolish ◄── 01+02 done (stable rerenders, icons)
                       07-FeatureParity ◄── 01+02+05 done
```

## Session A — Critical Fixes (Plans 01 + 02 + 03)

**~1,850 lines of source, ~365 lines of plans**
**Scope:** TaskProvider stabilization, AudioPlayerBar render fix, Clone modal safety

Files touched:
- `providers/TaskProvider.tsx` (240 lines)
- `components/AudioPlayerBar.tsx` (125 lines)
- `app/clone.tsx` (613 lines)
- `app/(tabs)/generate.tsx` (386 lines) — consumer fixes for 01 + 02
- `app/(tabs)/design.tsx` (451 lines) — consumer fixes for 01 + 02
- `app/(tabs)/_layout.tsx` (35 lines) — tab badge stability from 01

New dependencies to install: `@react-native-async-storage/async-storage` (for task persistence in 01)

### Prompt

```
You are working in the utter-mobile git worktree on branch feat/mobile-app.
The mobile app is an Expo SDK 54 / React Native 0.81 port of a React web app.

Execute these 3 clean-up plans IN ORDER. Read each plan fully before starting.
Commit after each plan with the convention: fix(mobile): <concise description>

Plans to execute:
1. docs/2026-03-16/clean-up/01-task-provider-stabilization.md
2. docs/2026-03-16/clean-up/02-audio-player-fixes.md
3. docs/2026-03-16/clean-up/03-clone-modal-safety.md

Key files to read first:
- mobile/providers/TaskProvider.tsx
- mobile/components/AudioPlayerBar.tsx
- mobile/app/clone.tsx
- mobile/app/(tabs)/generate.tsx
- mobile/app/(tabs)/design.tsx
- mobile/app/(tabs)/_layout.tsx

Rules:
- Follow the plan's fix approach and acceptance criteria exactly
- Install @react-native-async-storage/async-storage for task persistence (plan 01)
- When fixing TaskProvider consumers (generate.tsx, design.tsx), apply the
  memoization pattern from plan 01's "Consumer fixes" section
- Run `npx tsc --noEmit` after each plan to verify no type errors
- Do not refactor code beyond what the plan specifies
- Do not add comments, docstrings, or type annotations to unchanged code
- Commit convention: fix(mobile): <description> — no co-author line
```

---

## Session B — Performance + Hardening (Plans 04 + 05)

**~1,894 lines of source, ~326 lines of plans**
**Scope:** FlatList memoization, double-fetch fixes, auth deep link errors, API redirect fix, Clipboard replacement

Files touched:
- `app/(tabs)/index.tsx` (309 lines) — extract VoiceCard, StyleSheet, fix double-fetch
- `app/(tabs)/history.tsx` (409 lines) — extract GenerationCard, fix auto-refresh interval
- `app/tasks.tsx` (372 lines) — extract TaskCard, focus-gated polling prep
- `providers/AuthProvider.tsx` (139 lines) — error handling, race condition
- `lib/api.ts` (148 lines) — redirect fix, 401 dedup
- `app/account.tsx` (464 lines) — replace Clipboard

New dependencies to install: `expo-clipboard` (for plan 05)

### Prompt

```
You are working in the utter-mobile git worktree on branch feat/mobile-app.
The mobile app is an Expo SDK 54 / React Native 0.81 port of a React web app.

Session A (plans 01-03) has already been completed — TaskProvider context refs
are now stable, AudioPlayerBar render side-effect is fixed, and clone modal
cleanup is done.

Execute these 2 clean-up plans IN ORDER. Read each plan fully before starting.
Commit after each plan with the convention: fix(mobile): <concise description>

Plans to execute:
1. docs/2026-03-16/clean-up/04-list-performance.md
2. docs/2026-03-16/clean-up/05-auth-and-api-hardening.md

Key files to read first:
- mobile/app/(tabs)/index.tsx
- mobile/app/(tabs)/history.tsx
- mobile/app/tasks.tsx
- mobile/providers/AuthProvider.tsx
- mobile/lib/api.ts
- mobile/app/account.tsx

Rules:
- For plan 04: extract each list's renderItem into a React.memo component in
  the SAME file (no new files). Move all inline styles to StyleSheet.create
  at module level. Fix the history auto-refresh interval FIRST (critical).
- For plan 05: install expo-clipboard via `npx expo install expo-clipboard`.
  For apiRedirectUrl, use redirect:'manual' + Location header approach.
  For 401 dedup, use the shared promise pattern from the plan.
- Run `npx tsc --noEmit` after each plan to verify no type errors
- Do not refactor code beyond what the plan specifies
- Do not add comments, docstrings, or type annotations to unchanged code
- Commit convention: fix(mobile): <description> — no co-author line
```

---

## Session C — Polish + Parity (Plans 06 + 07)

**~1,500 lines of source across many small touches, ~383 lines of plans**
**Scope:** Tab icons, keyboard handling, Clone/Account navigation, accessibility, feature parity gaps

Files touched:
- `app/(tabs)/_layout.tsx` — tab icons
- `app/(tabs)/index.tsx` — voice preview, clone button styling
- `app/(tabs)/generate.tsx` — KeyboardAvoidingView, model param
- `app/(tabs)/design.tsx` — KeyboardAvoidingView
- `app/(tabs)/history.tsx` — cancelled filter
- `app/clone.tsx` — KeyboardAvoidingView, transcribe upload button
- `app/sign-in.tsx` — KeyboardAvoidingView
- `app/account.tsx` — modal presentation
- `app/_layout.tsx` — splash screen gate, account as modal
- `app/tasks.tsx` — focus-gated polling
- `lib/types.ts` — sync missing fields
- `lib/formPersistence.ts` — migrate to AsyncStorage
- `components/AudioPlayerBar.tsx` — already has player for voice preview

### Prompt

```
You are working in the utter-mobile git worktree on branch feat/mobile-app.
The mobile app is an Expo SDK 54 / React Native 0.81 port of a React web app.

Sessions A+B (plans 01-05) are done — TaskProvider is stable, AudioPlayerBar
is fixed, FlatLists are memoized, auth/API are hardened.

Execute these 2 clean-up plans. Read each plan fully before starting.
Make atomic commits per logical change with: fix(mobile): or feat(mobile):

Plans to execute:
1. docs/2026-03-16/clean-up/06-ux-polish.md
2. docs/2026-03-16/clean-up/07-feature-parity-gaps.md

For plan 06, prioritize in this order:
  6.5 (tab icons), 6.7 (clone button), 6.6 (account modal),
  6.4 (ElapsedTimer), 6.1 (KeyboardAvoidingView), 6.3 (AsyncStorage forms),
  6.2 (focus polling), 6.9 (splash screen), 6.8 (a11y labels)

For plan 07, prioritize in this order:
  7.1 (voice preview), 7.2 (model param), 7.4 (cancelled filter),
  7.5 (transcribe uploads), 7.7 (type sync), 7.8 (max chars from server)
  Skip 7.3 (provider compat) and 7.9 (demo content) — defer to later.

Rules:
- Use @expo/vector-icons (Ionicons) for tab icons — already bundled with Expo
- For voice preview (7.1), use a single shared AudioPlayerBar instance on the
  Voices list, not one per row — same pattern as history.tsx
- For KeyboardAvoidingView, wrap the outermost ScrollView on each screen
- Run `npx tsc --noEmit` after major changes to catch type errors
- Do not refactor code beyond what the plans specify
- Commit convention: fix(mobile): or feat(mobile): — no co-author line
```

---

## After all sessions

1. Run `npx expo start` and test all screens on device
2. Run `npx tsc --noEmit` for final type check
3. Update plan files — add `## Completed` section to each with what was built
4. Update `docs/2026-03-15/initial/01-web-parity-plan.md` status if any gaps closed
