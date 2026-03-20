# Account UI/UX Maturity Plan

## Goal

Make `/account` feel like a mature product surface instead of a developer-facing data dump.

The redesign should:

- show the few things a user actually comes to account for
- remove placeholder or internal-only information
- align layout and copy with the existing Utter shell without making the page feel like an admin dashboard
- stay grounded in the current Worker + Supabase contracts

## Current Ground Truth

### Current frontend structure

- `/account` is auth-protected and currently redirects to `/account/profile`.
- The shell has three left-rail items: `Profile`, `Credits` (`/account/usage`), and `Billing`.
- `Profile` mixes identity editing, auth/session fallback, placeholder preferences, and an unimplemented danger zone.
- `Usage` and `Billing` both depend on the same `useCreditsUsage` hook, but use different windows (`30` vs `90` days).

Relevant files:

- `frontend/src/app/router.tsx`
- `frontend/src/app/RequireAuth.tsx`
- `frontend/src/pages/account/AccountLayout.tsx`
- `frontend/src/pages/account/Profile.tsx`
- `frontend/src/pages/account/Usage.tsx`
- `frontend/src/pages/account/Billing.tsx`
- `frontend/src/pages/hooks.ts`

### Current backend and DB reality

- Identity is split between Supabase Auth and `public.profiles`.
- `profiles` stores: `id`, `handle`, `display_name`, `avatar_url`, `subscription_tier`, `credits_remaining`, `design_trials_remaining`, `clone_trials_remaining`, `created_at`, `updated_at`.
- Email is not stored in `profiles`; it comes from Supabase Auth.
- `/api/profile` only allows editing `handle`, `display_name`, and `avatar_url`.
- Credits source of truth is `profiles.credits_remaining` plus immutable `credit_ledger`.
- `/api/credits/usage` returns `balance`, `plan.tier`, `trials`, `usage`, `rate_card`, and the latest `20` ledger events.
- Billing is prepaid-pack only. Stripe webhook state is stored in `billing_events`, but there is no user-facing billing-events API.
- Current purchase history is reconstructed from `credit_ledger` rows where `operation = 'paid_purchase'`; it is not true invoice history.

Relevant files:

- `workers/api/src/routes/me.ts`
- `workers/api/src/routes/credits.ts`
- `workers/api/src/routes/billing.ts`
- `workers/api/src/_shared/credits.ts`
- `supabase/migrations/20260207190731_initial_schema.sql`
- `supabase/migrations/20260224001500_credits_ledger_foundation.sql`
- `supabase/migrations/20260225100000_credits_trials_and_prepaid_billing.sql`

## What Users Actually Need From Account

Primary jobs:

1. Confirm who is signed in.
2. Edit basic identity fields that matter inside the app.
3. Understand whether they can keep generating now.
4. Buy more credits when needed.
5. Trust recent spending and purchase activity.
6. Sign out safely.

Secondary jobs:

1. See when the account was created.
2. Understand credit pricing rules.
3. Copy an account identifier for support only when needed.

Non-goals for this surface right now:

1. Full generation history. That already belongs on `/history`.
2. Full voice-library management. That already belongs on `/voices`.
3. Task operations history. There is no list API for it.
4. Invoice management, refunds, payment methods, or customer portal. The current backend does not expose these cleanly.

## What Should Be Shown vs Hidden

| Data | Source | Show? | Placement | Notes |
| --- | --- | --- | --- | --- |
| Auth email | Supabase Auth client | Yes | Profile, read-only | Important identity anchor. |
| `display_name` | `profiles` / `/api/profile` | Yes | Profile, editable | Primary editable field. |
| `handle` | `profiles` / `/api/profile` | Yes | Profile, editable | Useful only if used elsewhere in product. Keep, but secondary to display name. |
| `avatar_url` | `profiles` / `/api/profile` | Yes, secondary | Profile | Keep only if continuing URL-based avatar input. If uploader is added later, this should stop being a raw URL field. |
| `credits_remaining` | `/api/credits/usage` | Yes | Overview + Credits | Primary account metric. Do not rely on `/api/me` for display. |
| `design_trials_remaining` | `/api/credits/usage` | Yes, conditional | Overview + Credits | Show only while greater than `0`, or as compact status text. |
| `clone_trials_remaining` | `/api/credits/usage` | Yes, conditional | Overview + Credits | Same rule as design trials. |
| `usage.debited` | `/api/credits/usage` | Yes, secondary | Credits | Useful as a trend, not a hero metric. |
| `credit_ledger` recent events | `/api/credits/usage` | Yes, simplified | Credits | Convert to user-readable activity. Hide internal fields. |
| `rate_card` | `/api/credits/usage` | Yes, but de-emphasized | Credits help accordion | Important, but not primary-page content. |
| Credit packs | static frontend config + checkout API | Yes | Credits | Primary CTA area when balance is low. |
| `created_at` | `/api/me` | Yes, secondary | Profile or Overview | Format as `Member since`. |
| `id` / raw user UUID | `/api/me` | Not by default | Advanced support disclosure | Do not show prominently. |
| `subscription_tier` | `/api/me`, `/api/credits/usage` | Not for now | Hidden | Current product is prepaid-pack oriented; `free` does not add meaningful user value today. |
| `updated_at` | `/api/me` | No | Hidden | Internal bookkeeping. |
| `billing_events` | internal table | No | Hidden | Internal webhook/audit state only. |
| `trial_consumption` | internal table | No | Hidden | Internal accounting. |
| Placeholder preferences (`WAV`, `Auto`) | no real persistence | No | Remove | Do not show until backed by stored settings. |
| Delete account button | no backend route | No | Remove for now | Reintroduce only with a real flow and confirmation UX. |

## Current UX Problems

1. The default account landing is `Profile`, even though balance and billing are the highest-value account concerns.
2. `Usage` and `Billing` duplicate the same balance and trials data with different time windows.
3. The page explains internal implementation details (`Supabase`, `Stripe`) instead of user outcomes.
4. The profile page shows a raw UUID prominently and includes signed-out or magic-link states even though `/account` is already behind `RequireAuth`.
5. Placeholder settings and a disabled danger zone make the product feel unfinished.
6. Billing currently implies more maturity than exists; it is really pack checkout plus partial ledger history.
7. The fixed, table-heavy layouts will age poorly on mobile.

## Recommended Information Architecture

### Recommendation

Move to an overview-first account architecture:

- `/account` -> `Overview`
- `/account/profile` -> `Profile`
- `/account/credits` -> `Credits`

Deprecate:

- `/account/usage`
- `/account/billing`

Reason:

- there is only one real credits/billing data model today
- `Usage` and `Billing` are artificially split
- an overview page gives users a clear first screen
- the route model still leaves room for future `Security` or `Settings` pages

### Navigation model

- Replace the heavy left-rail cards with a lighter segmented tab row or compact side nav.
- Desktop: top-level tabs directly under the account heading.
- Mobile: horizontally scrollable tab pills or stacked section nav.
- Keep deep links in the URL for each major section.

## Proposed Screen Structure

### 1. Overview

Purpose:

- answer "am I ready to keep using the product?" in under 5 seconds

Content order:

1. Account heading + short product-facing subcopy.
2. Primary summary block:
   - current credit balance
   - one-line credit rule (`1 credit = 1 character`)
   - primary CTA: `Buy credits`
3. Compact trial status:
   - show only if either trial counter is above `0`
   - if both are `0`, replace with a quiet status like `Free trials used`
4. Recent account activity:
   - last `3-5` simplified credit events
   - examples: `Bought 150,000 credits`, `Generated speech`, `Used design preview`
5. Quick links:
   - `Edit profile`
   - `View history`
   - `Manage credits`

Do not show here:

- full rate card
- large event tables
- raw IDs
- static `Active` status rows

### 2. Profile

Purpose:

- manage identity, not billing

Show:

- avatar
- display name
- handle
- email as read-only
- member since
- sign out action

Optional advanced disclosure:

- account ID with copy button for support use

Remove from this page:

- signed-out fallback state
- magic-link CTA
- placeholder preferences
- delete account placeholder

UX notes:

- keep one primary action: `Save changes`
- sign out should be secondary and visually separated from the form
- if avatar remains URL-based, label it clearly as an advanced field

### 3. Credits

Purpose:

- make credit state, pricing, and purchase actions trustworthy and easy

Show:

1. Balance header
   - credit balance
   - credit rule
   - refresh action
2. Pack purchase cards
   - starter pack
   - studio pack
   - one clear CTA each
3. Recent activity with filters
   - `All`
   - `Purchases`
   - `Usage`
4. Pricing help
   - rate card behind an accordion or collapsible `How credits work`
5. Checkout return feedback
   - `checkout=success` -> success banner or toast + refresh credits
   - `checkout=cancel` -> neutral banner

Do not imply:

- invoices
- card management
- refunds workflow
- subscription management

Those are not real product capabilities yet.

## Visual Direction

The account area should stay inside Utter's monochrome shell, but the content needs to feel calmer and more product-like.

Implementation direction:

- keep pixel styling for the brand shell, section kickers, and select numeric callouts
- reduce all-caps density inside forms and content tables
- use larger spacing and fewer equal-weight bordered boxes
- treat balance as the single visual hero, not four competing stat cards
- use sentence-case supporting copy
- remove infrastructure-oriented copy from user-facing surfaces

Design tone:

- clean utility
- monochrome editorial
- precise, not retro-novelty

## Copy Direction

Replace copy like:

- `Credits and trial counters are live from Supabase. Prepaid pack checkout runs through Stripe.`

With copy like:

- `Manage your profile, credits, and recent account activity.`

Or:

- `Credits update automatically after purchases and usage.`

General rules:

- speak about user outcomes, not system architecture
- avoid exposing backend implementation names unless needed for trust or support
- keep helper text short and specific

## Mobile and Responsiveness Requirements

1. No wide tables as the default mobile presentation.
2. Credit activity should collapse into stacked rows/cards on small screens.
3. Pack cards should stack cleanly with CTA buttons staying visible without horizontal scroll.
4. Navigation should not rely on a tall empty left rail on tablet/mobile.

## Accessibility and Interaction Requirements

1. Profile inputs should use correct field types and autocomplete where applicable.
2. Use `Intl.NumberFormat` and `Intl.DateTimeFormat` for credits, prices, and timestamps.
3. Success and error feedback should be announced clearly and consistently.
4. Preserve visible focus states already used by the shared UI components.
5. If profile fields can be edited, warn on unsaved changes before navigation.

## What Can Ship Frontend-Only

1. New `/account` overview route.
2. Merge `Usage` + `Billing` into a single `Credits` section/page.
3. Remove placeholder preferences and danger zone from account.
4. Remove signed-out/magic-link logic from the profile page.
5. Reframe activity history using the existing `credit_ledger` response.
6. Handle `checkout=success|cancel` in the frontend.
7. Improve responsive layout and hierarchy.

## What Needs Backend or Product Follow-Up

1. Real billing history beyond the latest `20` ledger events.
2. Invoices, receipts, refunds, and customer portal support.
3. Real persisted account preferences.
4. Delete-account workflow.
5. Any user-facing security/session history beyond current email + sign-out.

## Recommended Implementation Sequence

1. Add the new account IA in routing:
   - `/account` overview
   - `/account/profile`
   - `/account/credits`
2. Build a shared account data layer so overview/profile/credits do not refetch overlapping data independently.
3. Rewrite the account shell navigation and page-level copy.
4. Refactor profile to identity-only.
5. Merge usage and billing into a single credits surface.
6. Add checkout return handling and more polished activity presentation.
7. Remove dead or misleading UI until backend support exists.

## Acceptance Criteria

1. A signed-in user can understand account state from `/account` without opening multiple tabs.
2. Profile only contains identity and session-adjacent actions that are truly supported.
3. Credits and purchases live in one coherent surface instead of duplicated tabs.
4. The UI no longer shows raw internal details by default.
5. The page feels clean on mobile and desktop.
6. Nothing in the account UI implies product capabilities that the backend does not actually support.

## Notes and Risks

1. `docs/database.md` is stale for account and billing. Use the migrations and Worker routes as the implementation source of truth.
2. If future subscription tiers become meaningful, `plan.tier` can graduate into user-facing account state. It should stay hidden for now.
3. If avatar upload is prioritized later, replace the raw `avatar_url` field rather than polishing the URL input too heavily.
