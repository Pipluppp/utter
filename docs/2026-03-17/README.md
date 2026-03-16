# 2026-03-17 Final Parity Plans

The app is at ~95% feature parity. Two categories of work remain — both have implementation plans with prompts.

## Plans

| # | File | Scope | Est. |
|---|------|-------|------|
| 1 | `01-audio-player-component.md` | Reusable play/pause + progress bar component, integrated across Generate, History, Design, Voices, (stretch) Clone | 1 session |
| 2 | `02-theme-toggle.md` | ThemeProvider context, dark/light color tokens, toggle in Account, migrate all screens | 1–2 sessions |

## Recommended order

1. **Audio player first** — smaller scope (1 new component + 4 integrations), closes 3 parity gaps
2. **Theme toggle second** — larger scope (touches every file), closes the last parity gap. Will also theme the new AudioPlayerBar.

## After both plans are done

The app will be at full feature parity with the web frontend (minus drag-and-drop which is N/A on mobile). The parity plan should show all features as Done.

## Branch

- Branch: `feat/mobile-app`
- Worktree: `C:\Users\Duncan\Desktop\utter-mobile`
