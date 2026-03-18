# 2026-03-16 Mobile App Plans

This folder contains all execution plans for bringing the Utter mobile app to full web parity and then cleaning up the resulting codebase.

## initial/ -- Web Parity Implementation (complete)

All core feature implementation plans that brought the app from scaffold to feature-complete.

| # | File | Scope | Status |
|---|------|-------|--------|
| 1 | `01-phase1-remaining.md` | Share audio, error boundaries, haptics, voice search, duration validation | Done |
| 2 | `02-history-screen.md` | History screen: generation list, search, filter, playback, delete | Done |
| 3 | `03-account-screens.md` | Account: credits, trials, checkout, activity, profile, sign out | Done |
| 4 | `04-tasks-screen.md` | Tasks screen: queue viewer, cancel/dismiss, live polling | Done |
| 5 | `05-clone-recording.md` | Clone recording: expo-audio mic capture, level meter, timer, auto-transcription | Done |
| 6 | `06-phase3-stretch.md` | Magic link auth, form persistence | Done |
| 7 | `07-audio-player-component.md` | Reusable play/pause + progress bar, integrated across 4 screens | Done |
| 8 | `08-theme-toggle.md` | ThemeProvider context, dark/light color tokens, toggle in Account | Done |

## clean-up/ -- Code Review Fixes (next)

Post-parity code review found critical bugs, performance anti-patterns, and missing platform handling. These plans fix the issues grouped by subsystem.

| # | File | Scope | Severity | Est. |
|---|------|-------|----------|------|
| 1 | `01-task-provider-stabilization.md` | Fix polling churn, stabilize context refs, add persistence | Critical + High | 1 session |
| 2 | `02-audio-player-fixes.md` | Render side-effect, seek UX, icon consistency, cleanup | Critical + High | 0.5 session |
| 3 | `03-clone-modal-safety.md` | Duration-check leak, recording cleanup, example fetch auth | Critical + High | 0.5 session |
| 4 | `04-list-performance.md` | FlatList memoization, inline styles, double-fetch, HighlightedText | High | 1 session |
| 5 | `05-auth-and-api-hardening.md` | Deep link errors, redirect URL Android, 401 dedup, Clipboard | High | 0.5 session |
| 6 | `06-ux-polish.md` | KeyboardAvoidingView, screen-focus polling, form persistence storage, accessibility | Medium | 1 session |
| 7 | `07-feature-parity-gaps.md` | Remaining web->mobile gaps: voice preview, task persistence, model param, etc. | Medium | 1-2 sessions |

## Branch

- Branch: `feat/mobile-app`
- Worktree: `C:\Users\Duncan\Desktop\utter-mobile`
