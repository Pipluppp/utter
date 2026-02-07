# Geist Pixel Integration Plan (2026-02-07)

> **Status**: Design plan
> **Goal**: Introduce Geist Pixel as an accent typeface layer in the frontend, used selectively where bitmap texture reinforces the monospace-forward identity without compromising readability.

---

## Why Geist Pixel

Utter's design language is already monospace-forward (IBM Plex Mono body, Geist Mono UI chrome). Geist Pixel extends the Geist family with a bitmap-inspired face built for production — not a novelty. It shares vertical metrics and cap/x-heights with Geist Mono, so it drops in alongside the existing stack without layout breakage.

The font adds visual texture to moments that benefit from it: large display type, brand identity, numeric readouts, and status indicators. It reinforces the "technical instrument" personality without requiring a design overhaul.

### What Geist Pixel is NOT for

- Body text, descriptions, or anything meant to be read in paragraphs
- Form inputs, placeholders, or editable text
- Text below ~12px where bitmap rendering loses clarity
- Anywhere readability is the primary concern over personality

---

## Font overview

**Package**: `geist` (already partially available — Geist Mono is loaded via Google Fonts today, but the Pixel variants require the npm package for self-hosting)

**5 variants** (each a separate font face):

| Variant | CSS Variable | Character |
|---------|-------------|-----------|
| **Square** | `--font-geist-pixel-square` | Default/primary — most readable, clean grid |
| **Grid** | `--font-geist-pixel-grid` | Dotted matrix feel |
| **Circle** | `--font-geist-pixel-circle` | Rounded dot matrix |
| **Triangle** | `--font-geist-pixel-triangle` | Angular, sharp texture |
| **Line** | `--font-geist-pixel-line` | Striped/scan-line feel |

**Specs**: 480 glyphs, 7 stylistic sets, 32 languages, semi-mono horizontal metrics, tabular numerals.

### Variant strategy for Utter

- **Primary**: Geist Pixel Square — used for all standard pixel-font placements (headlines, brand, readouts). Most legible of the five.
- **Accent (optional, future)**: Geist Pixel Grid or Line — reserved for special moments (loading states, generative/animated effects). Not in initial scope.

---

## Installation

### 1. Add the `geist` npm package

```bash
npm i geist
```

This gives access to all Geist font families (Sans, Mono, and all 5 Pixel variants) as self-hosted woff2 files with tree-shakeable imports.

### 2. Register the font in the app entry point

In `frontend/src/main.tsx` (or a dedicated `fonts.ts` file imported by `main.tsx`):

```ts
import "geist/font/pixel/square.css";
```

This registers the `@font-face` for Geist Pixel Square and exposes the CSS variable `--font-geist-pixel-square`.

### 3. Add a Tailwind v4 theme token

In `frontend/src/styles/index.css`, add a new font stack to the `@theme` block:

```css
@theme {
  /* existing */
  --font-mono: "IBM Plex Mono", ui-monospace, /* ... */;
  --font-mono-ui: "Geist Mono", "IBM Plex Mono", /* ... */;

  /* new */
  --font-pixel: "Geist Pixel Square", "Geist Mono", ui-monospace, monospace;
}
```

This creates the Tailwind utility `font-pixel` that can be applied anywhere:

```html
<span class="font-pixel text-2xl uppercase tracking-wide">UTTER</span>
```

The fallback chain (Geist Mono → system monospace) means the layout stays stable even if the pixel font fails to load.

### 4. Remove Google Fonts dependency for Geist Mono (optional cleanup)

Since the `geist` npm package includes Geist Mono as well, the Google Fonts `<link>` for it can be replaced with a local import:

```ts
import "geist/font/mono.css";
```

This reduces external network dependencies and gives consistent versioning. IBM Plex Mono can remain on Google Fonts (it isn't in the `geist` package).

---

## Where to use Geist Pixel

### Tier 1 — High-impact, do first

These are the placements where Geist Pixel makes the strongest visual case. All are display-size or isolated-label contexts where readability is not a concern.

#### 1a. Brand wordmark — "UTTER" in the navigation

**File**: `frontend/src/app/Layout.tsx`
**Current**: `text-[16px] font-semibold tracking-[2px] uppercase` in `font-mono`
**Change**: Add `font-pixel`

The brand wordmark is the single highest-leverage placement. At 16px with wide tracking and uppercase, Geist Pixel Square renders cleanly and gives the logo a distinctive bitmap identity that separates it from the surrounding nav text (which stays in Geist Mono).

#### 1b. Hero headline on landing page

**File**: `frontend/src/pages/landing/LandingHero.tsx`
**Current**: `text-[clamp(34px,6vw,56px)]` responsive headline
**Change**: Add `font-pixel`

This is exactly the "banner" use case Vercel recommends. The hero headline is large, uppercase, and meant to make an impression. Geist Pixel at display sizes reads clearly and adds texture that a standard monospace can't.

#### 1c. Landing page section headers

**Files**: Section components under `frontend/src/pages/landing/`
**Current**: Section titles like "DEMO", "FEATURES", "PRICING" in standard mono
**Change**: Add `font-pixel` to section heading elements

These are short, uppercase, large-text labels — ideal for pixel rendering. Creates visual rhythm between sections.

#### 1d. Page titles on app pages

**Files**: `Clone.tsx`, `Design.tsx`, `Voices.tsx`, `History.tsx`, `Account.tsx`, etc.
**Current**: `text-xl font-semibold uppercase tracking-[2px]`
**Change**: Add `font-pixel`

Consistent with the nav wordmark and landing headers. Every page gets the same typographic identity at the title level.

---

### Tier 2 — Functional accents

These are smaller, data-oriented contexts where the pixel texture reinforces the "instrument readout" feeling. Apply after Tier 1 is validated visually.

#### 2a. Elapsed time in TaskDock

**File**: `frontend/src/components/tasks/TaskDock.tsx`
**Current**: `text-xs text-muted-foreground` showing `{elapsedLabel}` (e.g. "0:42")
**Change**: Add `font-pixel`

Timers and countdowns are a natural fit for bitmap type. The pixel rendering at small sizes (12px) still works because it's only numeric characters with a colon — minimal glyph complexity.

#### 2b. Task count badge

**File**: `frontend/src/components/tasks/TaskBadge.tsx`
**Current**: `text-[10px]` counter pill
**Change**: Add `font-pixel`

Single-digit or double-digit counters in a pill badge. At 10px this is at the lower limit — test carefully. If it doesn't render cleanly at 10px, bump to 11px or 12px.

#### 2c. Pricing amounts

**File**: `frontend/src/components/marketing/PricingGrid.tsx`
**Current**: `text-2xl font-semibold` (e.g. "$12")
**Change**: Add `font-pixel` to the price amount only (not the plan name or feature list)

Dollar amounts at 24px are well within the readable range. This creates a visual anchor — the price pops out of the card.

#### 2d. Usage stats — numeric values

**File**: `frontend/src/pages/account/Usage.tsx`
**Current**: `text-xl font-semibold` for values like credit counts
**Change**: Add `font-pixel` to the value display (not the labels)

Same rationale as pricing — numeric readouts get the pixel treatment, labels stay in standard mono for clarity.

#### 2e. "Most picked" badge

**File**: `frontend/src/components/marketing/PricingGrid.tsx`
**Current**: `text-[11px] font-semibold uppercase tracking-wide`
**Change**: Add `font-pixel`

Short uppercase label in a badge context — perfect bitmap territory.

---

### Tier 3 — Exploratory / future

These are lower-priority ideas that should only be pursued if Tier 1-2 look cohesive and the team wants to push the pixel aesthetic further.

#### 3a. Footer brand text

**File**: `frontend/src/app/Footer.tsx`
The "UTTER" text in the footer mirrors the nav wordmark and should match it.

#### 3b. Kbd component

**File**: `frontend/src/components/ui/Kbd.tsx`
Keyboard shortcut hints (e.g. `K`, `?`) could use Geist Pixel at their existing 10px size. This is speculative — test rendering quality first. The Kbd component already uses `font-mono-ui` (Geist Mono), and the single-character glyphs may actually look better in pixel.

#### 3c. Loading/progress states

If Utter ever adds visible progress percentages or generation step counters (e.g. "Step 3/5" during TTS), these would be natural Geist Pixel placements.

#### 3d. Error codes / technical metadata

Language codes, file sizes, duration displays — any short technical string that appears as metadata rather than prose.

---

## Where NOT to use Geist Pixel

| Context | Why not |
|---------|---------|
| Body text / descriptions | Paragraph readability requires conventional type |
| Form labels (`<Label>`) | Adjacent to inputs, needs to feel neutral and readable |
| Form inputs / textareas | User-typed text should use the standard body font |
| Button text | Buttons are action-oriented; legibility trumps personality |
| Navigation links | Already small (12px) and need fast scanning |
| Error/success messages | Message component needs clarity, not texture |
| Long feature lists | Bullet-point text in pricing cards, feature sections |

**Rule of thumb**: If the text is longer than ~3 words or the user needs to read it quickly to make a decision, keep it in the standard font stack.

---

## Implementation approach

### Phase 1 — Setup + Brand (small PR)

1. `npm i geist`
2. Import `geist/font/pixel/square.css` in entry point
3. Add `--font-pixel` token to `@theme` block in `index.css`
4. Apply `font-pixel` to the "UTTER" wordmark in Layout.tsx and Footer.tsx
5. Visual QA in both light and dark modes

This is the smallest possible change that validates the font renders correctly in the build pipeline and looks right in the actual product.

### Phase 2 — Display type (landing + page titles)

1. Apply to hero headline in LandingHero.tsx
2. Apply to landing section headers
3. Apply to page titles across app pages
4. Visual QA at all responsive breakpoints (the hero headline scales from 34px to 56px)

### Phase 3 — Functional accents

1. Apply to TaskDock elapsed time
2. Apply to TaskBadge counter
3. Apply to pricing amounts and "Most picked" badge
4. Apply to Usage stat values
5. Careful QA at small sizes (10-12px) — adjust size up if bitmap rendering is muddy

### Phase 4 — Polish + optional cleanup

1. Optionally migrate Geist Mono from Google Fonts to the `geist` npm package for consistency
2. Evaluate Tier 3 placements (Kbd, footer, loading states)
3. Consider adding a second variant (Grid or Line) for special moments if the design warrants it

---

## Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Pixel font looks muddy at small sizes (10-12px) | Only use at 12px+ for multi-character strings; test on actual screens, not just dev tools zoom |
| Overuse dilutes the effect | Strict tier system — pixel font is an accent, not a replacement. Most UI text stays in standard mono |
| Bundle size increase | The `geist` package is tree-shakeable; importing only `pixel/square.css` loads a single woff2 file. Negligible impact |
| Layout shifts from metric differences | Geist Pixel shares vertical metrics with Geist Mono, and the fallback chain preserves layout if the font fails to load |
| Inconsistency across variants if multiple are used | Start with Square only; only introduce a second variant if there's a clear design rationale |

---

## Non-goals

- No changes to the color system, spacing, or layout architecture
- No new components — this is purely a font-family change on existing elements
- No changes to Geist Mono usage in the `--font-mono-ui` stack (it remains the UI chrome font)
- No changes to IBM Plex Mono as the body font

---

*References*:
- [Introducing Geist Pixel — Vercel Blog](https://vercel.com/blog/introducing-geist-pixel)
- `docs/design.md` — Utter design direction
- `frontend/src/styles/index.css` — Font token definitions

*Date*: 2026-02-07
