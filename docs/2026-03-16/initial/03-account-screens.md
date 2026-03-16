# Plan 3: Account Screens — Overview, Credits, Profile

> **Scope**: New screens — account overview, credit balance/purchase, profile management
> **Estimate**: 1 session
> **Depends on**: Phase 1 core polish (done)

## Overview

The web has a full account section with sub-pages: Overview, Credits, Profile, Billing. The mobile version should cover the essentials: credit balance, trial counters, activity log, credit purchase (via browser), and basic profile management.

## API contracts

**Endpoints:**
| Endpoint | Method | Response | Notes |
|----------|--------|----------|-------|
| `/api/me` | GET | `MeResponse` | User + profile data |
| `/api/credits/usage?window_days=90` | GET | `CreditsUsageResponse` | Balance, trials, events, rate card |
| `/api/billing/checkout` | POST | `{ url: string }` | Stripe checkout URL |
| `/api/profile` | POST | `{ profile: ... }` | Update display name |

All response types already exist in `mobile/lib/types.ts`.

## Navigation design

**Approach:** Stack screen accessible from Voices screen header (replace "Sign Out" with a profile icon that opens Account). Account has sub-sections rendered as a ScrollView with sections, not separate screens.

```
Voices header: [+ Clone] [👤]
                              ↓
                    Account (stack screen)
                    ┌──────────────────────┐
                    │ Credit Balance: 847   │
                    │ ──────────────────── │
                    │ Trial Counters       │
                    │ ──────────────────── │
                    │ Quick Actions        │
                    │  [Buy Credits]       │
                    │  [View History]      │
                    │ ──────────────────── │
                    │ Recent Activity      │
                    │  ... events ...      │
                    │ ──────────────────── │
                    │ Rate Card            │
                    │ ──────────────────── │
                    │ Profile              │
                    │  Display Name: [...] │
                    │  Email: read-only    │
                    │  [Save]              │
                    │ ──────────────────── │
                    │ [Sign Out]           │
                    └──────────────────────┘
```

## Implementation

### 1. Create Account screen

**File:** `mobile/app/account.tsx` (stack screen, not a tab)

**Sections:**

**A. Credit Balance**
- Large credit number (prominent display)
- "N credits used in past 90 days" subtitle
- Fetch from `GET /api/credits/usage?window_days=90`

**B. Trial Counters**
- Design previews remaining: `trials.design_remaining`
- Clone finalizations remaining: `trials.clone_remaining`
- Show as simple cards with count

**C. Quick Actions**
- "Buy Credits" button → call `POST /api/billing/checkout` with pack selection, open URL in `expo-web-browser`
- "View History" → navigate to History tab
- Credit pack selection: render 2-3 pack options, user taps one, then "Buy" triggers checkout

**D. Recent Activity**
- List last 10 events from `usage.events`
- Show: operation name, signed amount (+/-), balance after, timestamp
- Color-code: green for credits, red for debits

**E. Rate Card**
- Simple list of actions and costs from `rate_card[]`
- Collapse by default, expandable

**F. Profile**
- Display name: editable TextInput
- Email: read-only (from `MeResponse.user`)
- User ID: read-only, copyable
- Save button → `POST /api/profile` with `{ display_name }`

**G. Sign Out**
- Move sign out button here from Voices header
- Confirm with Alert before signing out

### 2. Register stack screen

**File:** `mobile/app/_layout.tsx`

Add Account screen to the Stack:
```tsx
<Stack.Screen
  name="account"
  options={{
    title: 'Account',
    headerShown: true,
    headerStyle: { backgroundColor: '#000' },
    headerTintColor: '#fff',
  }}
/>
```

### 3. Update Voices header

**File:** `mobile/app/(tabs)/index.tsx`

Replace "Sign Out" button with profile/account icon that navigates to `/account`.

### 4. Stripe checkout (browser-based)

Use `expo-web-browser` (Expo Go compatible):
```ts
import * as WebBrowser from 'expo-web-browser';

const { url } = await apiJson<{ url: string }>('/api/billing/checkout', {
  method: 'POST',
  json: { pack_id: selectedPack },
});
await WebBrowser.openBrowserAsync(url);
```

### 5. Dependencies to add

- `expo-web-browser` — for Stripe checkout (may already be installed)
- No other new deps needed

## Web reference

- `frontend/src/pages/account/Overview.tsx` — dashboard layout
- `frontend/src/pages/account/Credits.tsx` — balance, packs, activity, rate card
- `frontend/src/pages/account/Profile.tsx` — display name editing

---

## Completed

**What was built:**
- `mobile/app/account.tsx` — full Account screen as a modal route (accessible from Voices header profile icon)
- Credit balance display (large typography, 90-day usage summary)
- Free trial counters (design previews remaining, clone finalizations remaining)
- Credit pack purchase: Starter ($2.99 / 30k) and Studio ($9.99 / 120k) with expo-web-browser Stripe checkout
- Recent activity feed (last 10 events, color-coded credits/debits with balance after)
- Collapsible rate card (pricing per action)
- Profile section: display name editing with conditional Save button, email display, user ID with copy-to-clipboard
- Sign out with Alert confirmation
- Pull-to-refresh on the full ScrollView

**Deviations from plan:**
- Implemented as a single ScrollView with all 7 sections rather than separate routes/tabs
- Used `expo-web-browser` for Stripe checkout (deep link return handling via balance refresh)
- Rate card is collapsible (tap to expand) to keep the default view compact

**Commit:** `ff0d774` feat(mobile): add Account screen with credits, trials, checkout, profile

---

## Session Prompt

```
We're continuing work on the Expo React Native mobile app for our Utter project.

**Context:**
- Worktree: C:\Users\Duncan\Desktop\utter-mobile (branch: feat/mobile-app)
- Mobile app: mobile/ directory (Expo SDK 54, expo-router v6, React 19.1.0)
- The app runs on Expo Go on a physical device, connected to production backend
- Session docs: docs/2026-03-15/ (scaffold + architecture), docs/2026-03-16/ (plans)
- Previous work: Phase 1 done, History screen may or may not be done yet

**Task: Account Screens**

Read docs/2026-03-16/03-account-screens.md for the full plan. Use the /building-native-ui skill for all UI work.

Build the Account screen:

1. **Create mobile/app/account.tsx** — single ScrollView screen with sections:
   - Credit balance (large display, usage subtitle)
   - Trial counters (design previews, clone remaining)
   - Credit pack purchase (expo-web-browser → Stripe checkout)
   - Recent activity timeline (events list, color-coded amounts)
   - Rate card (collapsible action/cost list)
   - Profile editing (display name input + save)
   - Sign Out button with confirmation
   - Pull-to-refresh on the whole screen
   - Cross-reference frontend/src/pages/account/Credits.tsx, Overview.tsx, Profile.tsx

2. **Register in mobile/app/_layout.tsx** — add Account as a stack screen

3. **Update mobile/app/(tabs)/index.tsx** — replace Sign Out with account icon in header

API endpoints: GET /api/me, GET /api/credits/usage?window_days=90, POST /api/billing/checkout, POST /api/profile
Types: MeResponse, CreditsUsageResponse (both exist in mobile/lib/types.ts)

Install expo-web-browser if not already present (--legacy-peer-deps). Run npx tsc --noEmit from mobile/ after changes. Commit when complete.

**Post-session docs update (required):**
After the Account screen is done:
1. Update docs/2026-03-15/01-web-parity-plan.md — change all Account features from "Missing (no screen)" to "Done" (or "Partial" with notes)
2. Add a "## Completed" section at the bottom of this plan file with: what was built, any deviations from the plan, and the commit hash(es)
3. Commit the doc updates separately: `docs(mobile): update parity plan after account screens`
```
