# Landing Page Marketing Sections Plan (2026-02-07)

> **Status**: Planning only (no auth gating changes in this doc)  
> **Primary goal**: Make `/` work as a marketing landing page for visitors (and logged-in users) with in-page sections for **Demo**, **Features**, and **Pricing**, while leaving the “real app” routes intact for now.

---

## Why this change

Today the frontend behaves like the full application is available to everyone (clone / generate / design / voices / history, plus pricing/about/etc). We want a clearer separation between:

- **Visitors**: should see a high-converting marketing landing page that explains the product and shows the UI.
- **Logged-in users**: will eventually have full access to the application pages.

We are **not** implementing “visitor vs logged-in” route access control yet. This plan focuses on upgrading the landing page experience so it already reads like a marketing page.

---

## Scope (frontend)

Existing relevant files:

- `frontend/src/pages/Landing.tsx` (current landing page composition)
- `frontend/src/pages/landing/LandingHero.tsx` (hero section; already links to `#demos`)
- `frontend/src/pages/landing/DemoWall.tsx` (demo collage; section id is `demos`)
- `frontend/src/pages/landing/PricingSection.tsx` (compact pricing section used by landing)
- `frontend/src/pages/Pricing.tsx` (full pricing page)
- `frontend/src/app/Layout.tsx` (top header nav)

Likely new files:

- `frontend/src/pages/landing/FeaturesSection.tsx` (new “Features / Workflow” section)
- `frontend/public/feature-media/*` (videos/screenshots for feature showcase)

---

## Non-goals (explicitly out of scope)

- No “logged-in vs visitor” orchestration (no route guards, no auth redirects).
- No backend changes required to ship the landing page update.
- No changes to pricing/billing behavior (only presentation/content reuse).

---

## Deliverables

### 1) Landing page has in-page sections: Demo / Features / Pricing

Target landing structure (in `frontend/src/pages/Landing.tsx`):

1. Hero
2. Demo section (`#demos` or `#demo`)
3. Features section (`#features`) **replacing** the current “How it works”
4. Pricing section (`#pricing`) **using the full pricing content**

Notes:

- Keep the existing `DemoWall` section id (`demos`) for compatibility; optionally add a second alias id (`demo`) if desired.
- Ensure each section has a stable `id` so it can be linked directly.

Acceptance criteria:

- Visiting `/#demos`, `/#features`, and `/#pricing` scrolls to the correct section on load.
- Clicking nav items scrolls smoothly when the user is already on `/`.

---

### 2) Navbar on `/` supports scrolling to Demo / Features / Pricing

Current state: `frontend/src/app/Layout.tsx` shows application nav items (Clone / Generate / Design / Voices / History / Pricing / Account / About) everywhere, including `/`.

Proposed change (still no auth gating):

- When `location.pathname === '/'`, render a marketing nav in the header:
  - `Demo` → `/#demos`
  - `Features` → `/#features`
  - `Pricing` → `/#pricing`
  - Keep a small set of utility links if desired (e.g. `About`, `Account`), but avoid “app-first” nav on the marketing page.
- When `location.pathname !== '/'`, keep the existing application nav as-is.

Implementation notes:

- Prefer `to={{ pathname: '/', hash: '#features' }}` (React Router) or `<a href="/#features">` for cross-route behavior.
- Add a small “hash scroll” helper so deep links work reliably (see Deliverable #5).

Acceptance criteria:

- On `/`, the header shows Demo/Features/Pricing links and they scroll correctly.
- On app routes (e.g. `/clone`), the header stays unchanged.

---

### 3) New “Features / Workflow” section showcasing the UI (media-based)

Replace the current “How it works” 3-step cards on the landing page with a section that shows *how the app looks and works*.

Structure suggestion for `frontend/src/pages/landing/FeaturesSection.tsx`:

- 3 feature blocks (Voice Clone / Generate / Design)
  - Short pitch (1–2 sentences)
  - 3–5 bullet points (what the user does / gets)
  - A media frame (video preferred; screenshot fallback)
  - CTA text/button (optional): “Open Clone”, “Open Generate”, “Open Design” (links can remain, even if gating comes later)

#### Features media placeholders (to be replaced later)

Create placeholders now and swap in real recordings when available:

- `[PLACEHOLDER VIDEO] Voice Clone UI walkthrough (10–20s)`
  - Path: `frontend/public/feature-media/voice-clone.mp4`
  - Poster: `frontend/public/feature-media/voice-clone.jpg`
  - Suggested content: upload clip → name voice → submit → voice appears in list

- `[PLACEHOLDER VIDEO] Generate UI walkthrough (10–20s)`
  - Path: `frontend/public/feature-media/generate.mp4`
  - Poster: `frontend/public/feature-media/generate.jpg`
  - Suggested content: pick voice → paste text → generate → play result

- `[PLACEHOLDER VIDEO] Design UI walkthrough (10–20s)`
  - Path: `frontend/public/feature-media/design.mp4`
  - Poster: `frontend/public/feature-media/design.jpg`
  - Suggested content: prompt voice → generate voice → preview → save

Fallbacks (if videos are not ready yet):

- `frontend/public/feature-media/voice-clone.png`
- `frontend/public/feature-media/generate.png`
- `frontend/public/feature-media/design.png`

Rendering rules:

- If video exists: render a muted, looping, `playsInline` video with a poster.
- Else if screenshot exists: render the screenshot.
- Else: render a styled placeholder card that says “UI preview coming soon”.

Acceptance criteria:

- Features section looks good on mobile + desktop and reads like a product walkthrough.
- Media frames do not shift layout while loading (use a fixed aspect ratio).

---

### 4) Pricing on landing uses the full Pricing page content (not compact)

Current state:

- `frontend/src/pages/landing/PricingSection.tsx` renders a compact `PricingGrid compact`.
- `frontend/src/pages/Pricing.tsx` renders the full pricing page (PricingGrid + credit rates + FAQ).

Goal:

- The landing page should include the full pricing content as a section below Features (the same content as the pricing page), and be scrollable via `/#pricing`.

Recommended approach (avoid duplication):

- Extract a shared `PricingContent` component used by both:
  - `frontend/src/pages/Pricing.tsx` (full page wrapper)
  - Landing page pricing section (embedded)
- Add `id="pricing"` to the landing pricing section wrapper.

What to do with the `/pricing` route:

- Keep `/pricing` for direct linking/SEO and render the same `PricingContent`.
- Optional: add a small note on `/pricing` that the full details also appear on the landing page.

Acceptance criteria:

- Pricing content appears fully on the landing page and on `/pricing`.
- The landing “Pricing” section has `id="pricing"` and is reachable via nav scrolling.

---

### 5) Hash scrolling works (deep links + SPA navigation)

We want links like `/#features` to work in all cases:

- user clicks a nav link while already on `/`
- user navigates from another route to `/#features`
- user refreshes the page on `/#pricing`

Implementation options:

- Add a small effect on the landing page that scrolls to `location.hash` on mount and on hash changes.
- Or add a global “hash scroll” effect in `frontend/src/app/Layout.tsx` (works across the app).

Acceptance criteria:

- `/#demos`, `/#features`, and `/#pricing` reliably scroll after navigation and after refresh.

---

## QA checklist

- `/` looks like a marketing landing page (not an “app dashboard”).
- Header on `/` shows Demo/Features/Pricing and scrolls correctly.
- Features section has working media placeholders and stable layout.
- Pricing section on `/` includes the full content and is reachable via `/#pricing`.
- Mobile layout: sections stack cleanly; media scales correctly; no clipped content.
- Accessibility: headings are hierarchical, links have clear labels, reduced-motion users are respected (avoid forced smooth scrolling).

