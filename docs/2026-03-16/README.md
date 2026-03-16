# 2026-03-16 Mobile App Parity Plans

This folder contains all execution plans for bringing the Utter mobile app to full web parity. Plans were created 2026-03-16; plans 07–08 added 2026-03-17 to cover the final gaps.

## Status summary

All core features are implemented. Two tasks remain: an audio player component (replaces bare Play buttons with progress bar) and a dark/light theme toggle.

## Plans

| # | File | Scope | Est. | Status |
|---|------|-------|------|--------|
| 1 | `01-phase1-remaining.md` | Share audio, error boundaries, haptics, voice search, duration validation | 1 | ✅ Done |
| 2 | `02-history-screen.md` | History screen: generation list, search, filter, playback, delete | 1 | ✅ Done |
| 3 | `03-account-screens.md` | Account: credits, trials, checkout, activity, profile, sign out | 1 | ✅ Done |
| 4 | `04-tasks-screen.md` | Tasks screen: queue viewer, cancel/dismiss, live polling | 1 | ✅ Done |
| 5 | `05-clone-recording.md` | Clone recording: expo-audio mic capture, level meter, timer, auto-transcription | 1 | ✅ Done |
| 6 | `06-phase3-stretch.md` | Magic link auth, form persistence, ~~theme toggle~~ | 1–2 | ✅ Partial (magic link + form persistence done; theme moved to plan 08) |
| 7 | `07-audio-player-component.md` | Reusable play/pause + progress bar, integrated across 4 screens | 1 | **Next** |
| 8 | `08-theme-toggle.md` | ThemeProvider context, dark/light color tokens, toggle in Account, migrate all screens | 1–2 | Not started |

## Recommended order for remaining work

1. **Plan 07 — Audio player** (1 session) — smaller scope, closes 3 parity gaps (Voices preview, Generate waveform, Clone recording waveform)
2. **Plan 08 — Theme toggle** (1–2 sessions) — larger scope, closes the last parity gap (dark/light toggle). Will also theme the new AudioPlayerBar.

After both plans are done, the app reaches full web feature parity (minus drag-and-drop, which is N/A on mobile).

## Post-session requirement

After completing each plan, the agent MUST:
1. Update `docs/2026-03-15/01-web-parity-plan.md` — change Status from "Missing"/"Partial" to "Done" for every feature implemented
2. Update the plan file itself — add a "## Completed" section at the bottom with what was actually built, any deviations, and the commit hash(es)
3. Commit the doc updates as a separate commit: `docs(mobile): update parity plan after <plan name>`

## Branch

- Branch: `feat/mobile-app`
- Worktree: `C:\Users\Duncan\Desktop\utter-mobile`
