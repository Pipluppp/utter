# Plan 6: Phase 3 Stretch — Magic Link, Form Persistence, Theme Toggle

> **Scope**: Nice-to-have features that improve UX but aren't blocking
> **Estimate**: 1–2 sessions
> **Depends on**: Phase 2 screens mostly done

## Tasks

### 1. Magic link authentication

The web supports passwordless sign-in via magic link email. Mobile needs deep link handling.

**Implementation:**
- Add magic link option on sign-in screen (email input + "Send Magic Link" button)
- Call `supabase.auth.signInWithOtp({ email })` — sends email with link
- Handle the magic link deep link:
  - Configure URL scheme in `app.json`: `{ "scheme": "utter" }`
  - Configure universal links if needed (for `https://` links)
  - Use `expo-linking` to handle incoming URLs
  - Parse the token from the URL and pass to Supabase: `supabase.auth.verifyOtp()`
- Supabase redirect URL must be configured to use `utter://` scheme on mobile

**Files:**
- `mobile/app/sign-in.tsx` — add magic link form option
- `mobile/app.json` — add `scheme` field
- `mobile/lib/supabase.ts` — may need deep link URL configuration

**Complexity:** Medium — deep link setup requires testing with real email delivery and URL scheme handling. May need Supabase dashboard configuration for mobile redirect URLs.

### 2. Form state persistence

The web persists Generate/Design form state to localStorage so users don't lose input on page reload. Mobile equivalent uses AsyncStorage or SecureStore.

**Implementation:**
- Use `expo-secure-store` (already installed for auth) or `@react-native-async-storage/async-storage`
- Save form state on each change (debounced 500ms) to a known key
- Restore on screen mount
- Clear on successful submission

**Screens:**
- Generate: `{ voiceId, language, text }`
- Design: `{ name, language, text, instruct }`

**Files:**
- Create `mobile/lib/formPersistence.ts` — generic save/restore helpers
- `mobile/app/(tabs)/generate.tsx` — wire save/restore
- `mobile/app/(tabs)/design.tsx` — wire save/restore

**Complexity:** Low — straightforward key-value storage.

### 3. Dark/light theme toggle

Currently the app is hardcoded dark. The web supports both themes.

**Implementation:**
- Create a `ThemeProvider` context with system/dark/light options
- Use `useColorScheme()` from React Native for system preference
- Store user preference in SecureStore
- Define color tokens: `colors.background`, `colors.surface`, `colors.text`, etc.
- Replace all hardcoded color values with theme tokens
- Add toggle in Account screen (or settings)

**Complexity:** High — touches every screen file. Best done as a dedicated refactor session. Consider using NativeWind/Tailwind at this point if the color system is getting complex.

### 4. Offline handling (optional)

Neither web nor mobile handles offline gracefully. This is a stretch goal.

**Implementation:**
- Detect network state with `@react-native-community/netinfo`
- Show a banner when offline: "You're offline — some features unavailable"
- Queue operations that fail due to network for retry
- Cache voice list for offline viewing

**Complexity:** Medium-High — requires rethinking data flow for cached state.

---

## Session Prompt (Magic Link + Form Persistence)

```
We're continuing work on the Expo React Native mobile app for our Utter project.

**Context:**
- Worktree: C:\Users\Duncan\Desktop\utter-mobile (branch: feat/mobile-app)
- Mobile app: mobile/ directory (Expo SDK 54, expo-router v6, React 19.1.0)
- The app runs on Expo Go on a physical device, connected to production backend
- Session docs: docs/2026-03-15/ (scaffold + architecture), docs/2026-03-16/ (plans)
- Previous work: Phase 1 + Phase 2 screens done

**Task: Stretch Features**

Read docs/2026-03-16/06-phase3-stretch.md for the full plan. Use the /building-native-ui skill for all UI work.

Work through these:

1. **Magic link auth** — Add passwordless sign-in to sign-in.tsx
   - Add email-only form with "Send Magic Link" button
   - Call supabase.auth.signInWithOtp({ email })
   - Configure URL scheme in app.json for deep link handling
   - Handle incoming magic link with expo-linking
   - Cross-reference frontend/src/pages/Auth.tsx

2. **Form state persistence** — Save/restore Generate + Design form state
   - Create mobile/lib/formPersistence.ts with generic save/restore helpers
   - Wire into generate.tsx and design.tsx
   - Debounce saves (500ms), restore on mount, clear on submit

Run npx tsc --noEmit from mobile/ after changes. Commit after each feature.
```

## Session Prompt (Theme Toggle)

```
We're continuing work on the Expo React Native mobile app for our Utter project.

**Context:**
- Worktree: C:\Users\Duncan\Desktop\utter-mobile (branch: feat/mobile-app)
- Mobile app: mobile/ directory (Expo SDK 54, expo-router v6, React 19.1.0)
- Session docs: docs/2026-03-15/, docs/2026-03-16/
- Previous work: all Phase 1–3 features done except theme

**Task: Theme System**

Read docs/2026-03-16/06-phase3-stretch.md (section 3) for context. Use the /building-native-ui skill.

Build a theme system:

1. **Create mobile/providers/ThemeProvider.tsx** — context with system/dark/light modes
   - Use useColorScheme() for system preference
   - Store user preference in SecureStore
   - Export useTheme() hook with color tokens

2. **Define color tokens** — background, surface, text, muted, border, accent, error, etc.

3. **Refactor all screens** — replace hardcoded #000/#111/#fff/etc. with theme tokens

4. **Add theme toggle** in Account screen

This is a large refactor touching every screen file. Consider whether NativeWind/Tailwind would be appropriate at this point.

Run npx tsc --noEmit from mobile/ after changes. Commit when complete.
```
