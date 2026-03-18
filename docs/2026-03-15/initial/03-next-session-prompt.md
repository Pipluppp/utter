# Next Session Prompt: Phase 1 — Core Polish

> **Date**: 2026-03-15
> **Use after**: Initial scaffold is working on Expo Go

## Prompt

```
We're continuing work on the Expo React Native mobile app for our Utter project.

**Context:**
- Worktree: C:\Users\Duncan\Desktop\utter-mobile (branch: feat/mobile-app)
- Mobile app: mobile/ directory (Expo SDK 54, expo-router v6, React 19.1.0)
- The app runs on Expo Go on a physical device, connected to production backend
- Session docs: docs/2026-03-15/ (read all 4 files for full context)
- Previous work: initial scaffold with 5 screens (sign-in, voices, generate, design, clone), Supabase auth, API client, task polling

**Task: Phase 1 — Core Polish**

Read docs/2026-03-15/01-web-parity-plan.md for the full Phase 1 breakdown. Before writing any code, read each existing screen file in mobile/app/ to understand the current state. Use the /building-native-ui skill for all UI work.

Work through these in order:

1. **Voices screen** (mobile/app/(tabs)/index.tsx)
   - Add source badges (Clone/Designed), pull-to-refresh, skeleton loading, empty state
   - Add "Generate" action per voice (navigate to Generate tab with voice pre-selected)
   - Add delete voice with confirmation
   - Cross-reference the web implementation at frontend/src/pages/Voices.tsx

2. **Generate screen** (mobile/app/(tabs)/generate.tsx)
   - Add character counter on text input (0/5000)
   - Add elapsed time display during active task
   - Add multi-task tracking list (show recent generations)
   - Cross-reference frontend/src/pages/Generate.tsx

3. **Design screen** (mobile/app/(tabs)/design.tsx)
   - Add character counters on description and preview text (500 each)
   - Wire up preview audio playback on task completion
   - Add multi-preview tracking
   - Cross-reference frontend/src/pages/Design.tsx

4. **Clone screen** (mobile/app/clone.tsx)
   - Add example voice loader button
   - Cross-reference frontend/src/pages/Clone.tsx

5. **Cross-cutting**
   - Add pull-to-refresh on all list screens
   - Ensure cross-navigation between features (e.g., "Generate from this voice", "Go to Generate" after clone success)

All work happens in the utter-mobile/ worktree. Commit to feat/mobile-app as you complete each screen. Run npx tsc --noEmit from mobile/ after each change to verify types.
```
