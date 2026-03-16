# 2026-03-16 Phase 1 Completion & Phase 2–3 Plans

This folder contains execution plans and session prompts for bringing the Utter mobile app to web parity.

## What happened today

- Completed Phase 1 core polish (4 screens: Voices, Generate, Design, Clone)
- Created plans and session prompts for all remaining work

## Plans

| # | File | Scope | Est. session |
|---|------|-------|-------------|
| 1 | `01-phase1-remaining.md` | Phase 1 leftovers: share audio, error boundaries, haptics, voice search | 1 session |
| 2 | `02-history-screen.md` | History screen: generation list, search, filter, playback, delete | 1 session |
| 3 | `03-account-screens.md` | Account: overview, credits, profile, Stripe checkout | 1 session |
| 4 | `04-tasks-screen.md` | Tasks screen: queue viewer, cancel/dismiss, live polling | 1 session |
| 5 | `05-clone-recording.md` | Clone recording: expo-audio mic capture, level meter, timer, auto-transcription | 1 session |
| 6 | `06-phase3-stretch.md` | Phase 3 stretch: magic link auth, form persistence, theme toggle | 1–2 sessions |

## Post-session requirement

After completing each plan, the agent MUST:
1. Update `docs/2026-03-15/01-web-parity-plan.md` — change Status from "Missing" to "Done" for every feature implemented
2. Update the plan file itself — add a "Completed" section at the bottom with what was actually built, any deviations, and the commit hash
3. Commit the doc updates as a separate commit: `docs(mobile): update parity plan after <phase name>`

## Branch

- Branch: `feat/mobile-app`
- Worktree: `C:\Users\Duncan\Desktop\utter-mobile`
- Last commit: Phase 1 core polish (all 4 screens)
