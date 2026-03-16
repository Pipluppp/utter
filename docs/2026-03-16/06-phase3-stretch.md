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

> **Moved to Plan 08** (`08-theme-toggle.md`) — detailed implementation plan with color token definitions, mapping table, and session prompt.

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

**Post-session docs update (required):**
After stretch features are done:
1. Update docs/2026-03-15/01-web-parity-plan.md — change Magic link, form persistence, etc. from "Missing" to "Done"
2. Add a "## Completed" section at the bottom of this plan file with: what was built, any deviations from the plan, and the commit hash(es)
3. Commit the doc updates separately: `docs(mobile): update parity plan after phase 3 stretch`
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

**Post-session docs update (required):**
After theme work is done:
1. Update docs/2026-03-15/01-web-parity-plan.md — change dark theme from "Partial" to "Done"
2. Add a "## Completed" section at the bottom of this plan file with: what was built, any deviations from the plan, and the commit hash(es)
3. Commit the doc updates separately: `docs(mobile): update parity plan after theme system`
```

## Completed

### Magic link authentication (Task 1)

**What was built:**
- Added `signInWithOtp` method to AuthProvider context
- Deep link handler in AuthProvider using `expo-linking` — handles both implicit grant (hash fragment with `access_token`/`refresh_token`) and PKCE code flow (query param `code`)
- Listens for both cold-start URLs (`getInitialURL`) and foreground URLs (`addEventListener`)
- Redirect URL generated via `Linking.createURL('auth/callback')` — resolves to `utter://auth/callback` in production, `exp://` in Expo Go
- Rewrote sign-in screen with Password / Magic Link mode tabs:
  - Password mode: existing email+password with sign-in/sign-up toggle (unchanged behavior)
  - Magic Link mode: email-only field, "Send Magic Link" button, "Check your email" confirmation state
- URL scheme `utter://` was already configured in app.json

**Note:** Supabase dashboard must have `utter://auth/callback` added to the allowed redirect URLs for magic links to work in production builds.

**Deviations from plan:** None. `expo-linking` was already a dependency; `app.json` already had `scheme: "utter"`.

### Form state persistence (Task 2)

**What was built:**
- Created `mobile/lib/formPersistence.ts` with generic helpers:
  - `loadFormState<T>(key)` — restore from SecureStore
  - `saveFormState(key, state)` — persist to SecureStore
  - `clearFormState(key)` — remove from SecureStore
  - `useDebouncedFormSave(key, delay)` — hook returning a debounced save function (500ms default)
- Generate screen (`generate.tsx`): persists `{ voiceId, language, text }`
  - Restores on mount (skipped if navigation params are present)
  - Validates restored voiceId exists in voice list, restored language exists in language list
  - Clears on successful generation submit
- Design screen (`design.tsx`): persists `{ name, language, text, instruct }`
  - Restores on mount alongside language list load
  - Clears on successful save-to-library (not preview, to allow iteration)

**Deviations from plan:** Design clears on save-to-library instead of preview submission, since the user iterates between previews and shouldn't lose form data mid-workflow.
