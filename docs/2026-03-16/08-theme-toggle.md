# Plan: Dark/Light Theme Toggle

> **Date**: 2026-03-17
> **Plan**: 08 (continuation of 2026-03-16 plans)
> **Scope**: Replace hardcoded dark colors with a theme system + toggle in Account screen
> **Estimate**: 1–2 sessions (touches every screen file)
> **Depends on**: Audio player component (Plan 07) recommended first, so theme colors can be applied to AudioPlayerBar too
> **Approach**: Simplest path — React context with color tokens, manual replacement of hardcoded values. No NativeWind/Tailwind.

## Problem

The mobile app is hardcoded dark (`#000` backgrounds, `#111` cards, `#fff` text, etc.). The web supports both themes. The parity plan marks this as "Partial — Dark hardcoded, no light mode toggle."

## Design

### ThemeProvider context

A context providing:
- Current theme: `'system' | 'dark' | 'light'`
- Resolved colors object based on the active theme
- `setTheme()` to change preference (persisted to SecureStore)

```tsx
// mobile/providers/ThemeProvider.tsx

const THEME_KEY = 'user_theme_preference';

type ThemeMode = 'system' | 'dark' | 'light';

interface ThemeColors {
  background: string;       // screen background
  surface: string;          // card background
  surfaceHover: string;     // pressed/selected state
  border: string;           // borders and dividers
  text: string;             // primary text
  textSecondary: string;    // secondary/muted text
  textTertiary: string;     // very muted text (timestamps, meta)
  accent: string;           // interactive elements (#0af)
  danger: string;           // destructive actions (#f44)
  success: string;          // success states (#0a0 / #4c6)
  warning: string;          // pending states (#fa0)
  skeleton: string;         // skeleton placeholder bg
  skeletonHighlight: string;// skeleton lighter bar
}

const darkColors: ThemeColors = {
  background: '#000',
  surface: '#111',
  surfaceHover: '#1a1a1a',
  border: '#333',
  text: '#fff',
  textSecondary: '#888',
  textTertiary: '#555',
  accent: '#0af',
  danger: '#f44',
  success: '#0a0',
  warning: '#fa0',
  skeleton: '#111',
  skeletonHighlight: '#222',
};

const lightColors: ThemeColors = {
  background: '#fff',
  surface: '#f5f5f5',
  surfaceHover: '#eee',
  border: '#ddd',
  text: '#111',
  textSecondary: '#666',
  textTertiary: '#999',
  accent: '#07f',
  danger: '#d33',
  success: '#090',
  warning: '#e90',
  skeleton: '#eee',
  skeletonHighlight: '#ddd',
};
```

### `useTheme()` hook

```tsx
const { colors, mode, setTheme } = useTheme();
```

Returns the resolved colors and the setter. Every screen uses `colors.background`, `colors.surface`, etc. instead of hardcoded hex values.

### System theme detection

```tsx
import { useColorScheme } from 'react-native';

const systemScheme = useColorScheme(); // 'light' | 'dark' | null
```

When `mode === 'system'`, resolve to `systemScheme ?? 'dark'`.

### Persistence

Store the user's preference in SecureStore under key `user_theme_preference`. Load on app start. Default to `'system'`.

### Toggle UI

Add a theme selector in the Account screen (between Profile and Sign Out sections):

```
── Theme ──
[ System ]  [ Dark ]  [ Light ]
```

Use the same `SegmentedControl` pattern from the Tasks screen.

## Migration strategy

This is a large change since every screen has hardcoded color values. The approach:

1. **Create ThemeProvider + useTheme hook** (new files)
2. **Wrap the app** in `<ThemeProvider>` in `mobile/app/_layout.tsx`
3. **Add theme toggle** to Account screen
4. **Migrate screens one at a time** — replace hardcoded colors with `colors.*` tokens
   - Start with `_layout.tsx` (tab bar colors)
   - Then each screen: index, generate, design, history, clone, tasks, account, sign-in
   - Then components: Select, AudioPlayerBar, ErrorBoundary

Each screen migration is mechanical: find-and-replace `'#000'` → `colors.background`, `'#111'` → `colors.surface`, etc.

### Color mapping reference

| Hardcoded | Token | Notes |
|-----------|-------|-------|
| `'#000'` | `colors.background` | Screen backgrounds |
| `'#111'` | `colors.surface` | Card backgrounds |
| `'#1a1a1a'` | `colors.surfaceHover` | Selected/pressed states |
| `'#222'` | `colors.skeletonHighlight` | Skeleton bars, secondary buttons |
| `'#333'` | `colors.border` | Borders, dividers |
| `'#fff'` | `colors.text` | Primary text |
| `'#888'` / `'#aaa'` | `colors.textSecondary` | Labels, muted text |
| `'#555'` / `'#666'` | `colors.textTertiary` | Timestamps, meta text |
| `'#0af'` | `colors.accent` | Links, interactive elements |
| `'#f44'` / `'#f66'` | `colors.danger` | Delete buttons, errors |
| `'#0a0'` / `'#4c6'` | `colors.success` | Completed status |
| `'#fa0'` | `colors.warning` | Pending status |

### Status colors special case

The status color maps (`STATUS_COLORS` in history.tsx, `statusColor()` in tasks.tsx) use specific colors per status. These should remain hardcoded but switch between dark/light variants:

```tsx
const STATUS_COLORS_DARK = { completed: '#0a0', failed: '#f44', pending: '#fa0', processing: '#0af', cancelled: '#888' };
const STATUS_COLORS_LIGHT = { completed: '#090', failed: '#d33', pending: '#e90', processing: '#07f', cancelled: '#999' };
```

## Files to modify

- **New**: `mobile/providers/ThemeProvider.tsx`
- **Modify**: `mobile/app/_layout.tsx` — wrap in ThemeProvider, theme tab bar
- **Modify**: `mobile/app/(tabs)/_layout.tsx` — theme tab bar colors
- **Modify**: `mobile/app/(tabs)/index.tsx` — replace hardcoded colors
- **Modify**: `mobile/app/(tabs)/generate.tsx` — replace hardcoded colors
- **Modify**: `mobile/app/(tabs)/design.tsx` — replace hardcoded colors
- **Modify**: `mobile/app/(tabs)/history.tsx` — replace hardcoded colors
- **Modify**: `mobile/app/clone.tsx` — replace hardcoded colors
- **Modify**: `mobile/app/tasks.tsx` — replace hardcoded colors
- **Modify**: `mobile/app/account.tsx` — replace hardcoded colors + add toggle
- **Modify**: `mobile/app/sign-in.tsx` — replace hardcoded colors
- **Modify**: `mobile/components/Select.tsx` — replace hardcoded colors
- **Modify**: `mobile/components/AudioPlayerBar.tsx` — use theme colors (if built)

## Implementation order

1. Create `ThemeProvider` + `useTheme` hook
2. Wrap app in provider
3. Add toggle to Account screen (test switching works)
4. Migrate `_layout.tsx` tab bars
5. Migrate screens one by one (biggest files first: generate → history → design → index → clone → tasks → account → sign-in)
6. Migrate shared components

## Verification

- `npx tsc --noEmit` from `mobile/` — no type errors
- Manual test: toggle between System / Dark / Light in Account screen
- Every screen should look correct in both themes
- Kill and reopen app — theme preference should persist

## Parity plan updates after completion

In `docs/2026-03-15/01-web-parity-plan.md`, change:

| Feature | Current Status | New Status |
|---------|---------------|------------|
| Dark theme | Partial (Dark hardcoded, no light mode toggle) | Done |

---

## Prompt

```
We're continuing work on the Expo React Native mobile app for our Utter project.

**Context:**
- Worktree: C:\Users\Duncan\Desktop\utter-mobile (branch: feat/mobile-app)
- Mobile app: mobile/ directory (Expo SDK 54, expo-router v6, React 19.1.0)
- The app runs on Expo Go on a physical device, connected to production backend
- Session docs: docs/2026-03-16/08-theme-toggle.md (this plan)

**Task: Build theme system with dark/light toggle**

Read docs/2026-03-16/08-theme-toggle.md for the full plan with color mapping tables.

1. **Create `mobile/providers/ThemeProvider.tsx`** — ThemeProvider context with `useTheme()` hook. Supports system/dark/light modes. Persists preference to SecureStore. See the plan for the exact color token definitions (darkColors / lightColors).

2. **Wrap the app** — Add `<ThemeProvider>` in `mobile/app/_layout.tsx` wrapping all children.

3. **Add theme toggle** — In Account screen, add a segmented control (System / Dark / Light) in a new "Theme" section between Pricing and Profile.

4. **Migrate tab bar** — In `mobile/app/(tabs)/_layout.tsx`, replace hardcoded tab bar colors with theme tokens.

5. **Migrate all screens** — Replace hardcoded color hex values with `colors.*` tokens from `useTheme()`. Use the color mapping table in the plan. Migrate in this order: generate → history → design → index → clone → tasks → account → sign-in.

6. **Migrate components** — Replace hardcoded colors in `Select.tsx`, `AudioPlayerBar.tsx` (if it exists), `ErrorBoundary.tsx`.

Use the color mapping reference table in the plan to translate hardcoded values. Run `npx tsc --noEmit` from mobile/ after changes. Commit the provider first, then screen migrations (can batch), then doc updates.

**Post-session docs update (required):**
After all items are done:
1. Update docs/2026-03-15/01-web-parity-plan.md — change "Dark theme" from Partial to Done
2. Add a Completed section to docs/2026-03-16/08-theme-toggle.md
3. Commit the doc updates separately: `docs(mobile): update parity plan after theme toggle`
```
