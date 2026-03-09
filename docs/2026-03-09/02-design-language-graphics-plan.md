# Design Language Graphics Plan

## Goal

Integrate a stronger visual language into Utter using custom blob clusters, dotted glyph overlays, and more prominent pixel-display typography, inspired by the `air.dev` aesthetic without copying its exact shapes.

This plan covers:

- landing page visual expansion
- reusable feature graphics for `Clone`, `Design`, and `Generate`
- stronger heading treatment using `Geist Pixel Circle`
- shared decorative components that can be reused across marketing and app pages

## What this task is actually about

This is not a generic "make the landing page prettier" task.

The core objective is to give Utter a reusable graphic language built from:

1. dark background blob clusters
2. brighter foreground gradient blob unions
3. white dotted symbol overlays
4. restrained motion and glow

The provided Figma reference and pasted SVGs are important because they show the exact kind of layered decorative system we want to translate into Utter:

- not screenshots as the only visual identity
- not random abstract gradients
- not one-off hero art that disappears on the rest of the site

The output should feel like a system that can appear:

- in the landing hero
- in the feature sections
- in the closing CTA
- in smaller form on `Clone`, `Design`, and `Generate`

## Design intent

Translate the reference aesthetic, do not reproduce it.

The reference system has four strong traits:

1. dark atmospheric sections with generous vertical spacing
2. repeated organic blob clusters with soft glows
3. dotted icon overlays that communicate function
4. large pixel-display headings that feel like signage

For Utter, the equivalent should feel more voice-and-audio oriented, less like a devtools clone.

## Reference interpretation

The reference graphics all follow the same broad composition pattern:

### Layer 1: background matte cluster

- large dark circles/petals
- low-contrast charcoal fill
- soft inner glow
- acts like a "shadow constellation" behind the main mark

### Layer 2: foreground accent union

- fewer, larger connected blob forms
- cyan/teal/blue radial gradient
- soft luminous interior
- this is the main silhouette users remember

### Layer 3: dotted icon overlay

- bright white dots
- simple symbolic arrangement
- communicates the meaning of each variant

This layered model should stay intact in Utter even if the exact blob geometry changes.

## Direction for Utter

### Core aesthetic

- keep the dark, high-contrast atmosphere
- use soft luminous cyan, teal, and blue gradients as the main accent family
- introduce audio-native forms: waveform dots, radial pulse dots, vocal orbit paths, capsule-like petals, and ring echoes
- keep outlines, spacing, and typography sharp so the organic shapes do not make the UI feel soft or vague

### What not to do

- do not copy the exact `air.dev` flower geometry
- do not use identical dotted icon patterns
- do not turn every section into the same centered ornament block

Utter needs its own family of graphics that share the mood but are recognizably different.

## Translation rules for Utter

The implementation should feel clearly inspired by the reference, but unmistakably adapted for a voice product.

Keep these rules:

- preserve the 3-layer structure
- keep the palette mostly in cyan / teal / deep blue
- use crisp mono/pixel typography against the soft shapes
- make the dotted overlay tell the workflow story

Avoid these mistakes:

- copying the same petal counts and positions from `air.dev`
- using exactly the same review / oversight / delegation glyph concepts
- making the blobs too soft, amorphous, or "liquid"
- making the visuals so busy that the product UI becomes secondary

The final output should feel like:

- audio tooling
- voice synthesis
- signal flow
- playback / capture / shaping

not like:

- flower icons
- AI startup gradient wallpaper
- an `air.dev` reskin

## Product mapping

Each core workflow should get its own visual mark and section treatment.

### Clone

Theme:

- capture
- reference
- waveform memory

Graphic direction:

- clustered blobs with a diagonal waveform-dot spine
- subtle ring echoes behind the form
- denser, more grounded shape language
- should feel like source material being captured and stabilized

### Design

Theme:

- invention
- shaping
- voice sculpting

Graphic direction:

- more symmetrical petal composition
- central dotted lattice or starburst to imply construction
- brighter internal glow than Clone
- should feel like a voice being assembled or sculpted

### Generate

Theme:

- playback
- projection
- output motion

Graphic direction:

- wider horizontal blob shape
- directional dotted path or expanding pulse
- faster, more forward-moving silhouette
- should feel like speech being emitted or projected outward

## Design deliverables

At minimum, this task should produce:

1. one large hero-level graphic for the landing page
2. one distinct graphic variant each for:
   - `Clone`
   - `Design`
   - `Generate`
3. one reusable primitive/component system so these are not all one-off files
4. one typography pass that makes `Geist Pixel Circle` meaningfully visible

The goal is not just to draw shapes. The goal is to land a reusable visual language.

## Where the graphics should appear

## Landing page

### Hero

Add a primary hero art block or split-layout composition that establishes the new visual language immediately.

Recommended:

- keep the current text reveal, but pair it with a large signature `Utter` graphic
- increase hero height and breathing room
- let the hero establish the palette, glow, and dot language for the entire page
- if the page needs to become longer to support this, that is expected and acceptable

### Features section

Each of `Clone`, `Design`, and `Generate` should get:

- its own bespoke graphic
- its own accent emphasis
- a section layout that gives the graphic room to matter

Do not rely only on screenshots. The screenshots should support the product proof, while the graphics carry the emotional identity.

### Additional long-form sections

It is fine to make the landing page longer.

Recommended new sections:

1. `Workflow trio`
   - three large narrative panels for Clone, Design, Generate
2. `Visual proof + product UI`
   - alternate between abstract graphics and real screenshots
3. `Voice system details`
   - explain reusable voices, async jobs, and history with lighter supporting graphics
4. `Closing CTA`
   - large footer graphic with a wider ambient composition

The landing page should feel intentionally art-directed after this task, not like a short utility page with a few screenshots.

## App pages

Add smaller, page-specific hero graphics near the top of:

- `frontend/src/pages/Clone.tsx`
- `frontend/src/pages/Design.tsx`
- `frontend/src/pages/Generate.tsx`

Recommended rule:

- marketing pages use larger expressive graphics
- in-app pages use compact anchored variants of the same family
- app-page graphics should frame the page, not compete with forms and controls

This keeps the app branded without overwhelming task-oriented screens.

## Typography plan

## Geist Pixel Circle

The current app loads:

- `Geist Pixel Square`
- `Geist Pixel Line`

but not `Geist Pixel Circle`.

Implementation should add a third display token for `Geist Pixel Circle` and use it intentionally.

Recommended use:

- landing hero headline or secondary headline accents
- major section headings on the landing page
- occasional page-intro headings for Clone, Design, Generate

Recommended restraint:

- do not replace all UI typography with Circle
- keep body text and dense control labels in the existing mono stack
- use Circle as a display accent, not as the default font for the whole interface

Practical guidance:

- use `Geist Pixel Circle` for major display headings and occasional emphasis
- keep `Geist Pixel Line` or the existing mono stack for denser utility text
- if a heading becomes less readable, back off and use Circle more selectively

The success condition is "more distinctive", not "more decorative everywhere".

## Technical implementation shape

## Shared component family

Create reusable visual primitives under a marketing or decorative component folder.

Recommended additions:

- `BlobClusterGraphic`
- `DottedGlyph`
- `FeatureConstellation`
- `SectionAura`

Then create composed variants:

- `CloneGraphic`
- `DesignGraphic`
- `GenerateGraphic`
- optional `UtterHeroGraphic`

The implementor does not need to match the reference by writing giant raw inline SVG blocks everywhere.

Prefer a small reusable system:

- one base blob cluster component or helper
- one dotted overlay component or helper
- one composition wrapper that can accept variants, size, and emphasis

This will make it easier to use the same system on both marketing and app pages.

## SVG vs CSS split

Recommended approach:

- SVG for exact blob silhouettes, dotted icon paths, and shape composition
- CSS for glow, blur, layering, gradients, and section atmospherics

Reason:

- SVG gives precise, reusable forms without image assets
- CSS handles animation and responsive atmosphere more cleanly

Recommended bias:

- put the actual silhouettes and dot layouts in SVG
- put glow, backdrop, drift, and section atmosphere in CSS
- avoid pushing complex decorative geometry into pure CSS if it makes the shapes harder to control

## Implementation heuristics

If the implementor gets stuck, use these heuristics:

### Start from silhouette first

Get the overall blob composition right before tuning gradients and dots.

### Then add the dotted symbol

The dotted overlay should be simple enough to read at a glance.

### Then tune atmosphere

Glow, shadow, and motion should support the silhouette, not rescue a weak shape.

### Then place it in layout

The page composition matters as much as the graphic itself. Good graphics can still feel weak if the landing section gives them no room.

## Variant system

Build the shapes as a system, not one-off illustrations.

Recommended structure:

- one shared base blob vocabulary
- one shared dot vocabulary
- per-feature composition presets

This makes it easy to create matching large, medium, and compact variants across the landing page and app pages.

## Motion

Use restrained motion only where it adds identity.

Recommended:

- subtle floating drift on blob groups
- slow pulse on internal gradients
- light staggered reveal of dotted overlays

Avoid:

- constant distracting animation near forms
- fast orbit effects that compete with task UI
- flashy entrance motion that makes the app feel gimmicky

## Responsive behavior

Desktop:

- graphics can sit beside or behind the text
- longer landing sections can use asymmetry and overlap

Mobile:

- graphics should collapse into simpler stacked variants
- preserve silhouette and accent glow
- reduce dot density and blur radius to avoid muddy rendering

## File targets

Most likely implementation files:

- `frontend/src/styles/geist-pixel.css`
- `frontend/src/styles/index.css`
- `frontend/src/pages/Landing.tsx`
- `frontend/src/pages/landing/LandingHero.tsx`
- `frontend/src/pages/landing/FeaturesSection.tsx`
- `frontend/src/pages/landing/DemoWall.tsx`
- `frontend/src/pages/landing/PricingSection.tsx`
- `frontend/src/pages/Clone.tsx`
- `frontend/src/pages/Design.tsx`
- `frontend/src/pages/Generate.tsx`

Possible new component location:

- `frontend/src/components/marketing/graphics/`

Possible supporting files:

- shared section wrapper or aura utilities
- a small token block for graphic colors and glow strengths
- a helper file for feature-specific dotted overlay point maps

## Rollout order

1. Add `Geist Pixel Circle` font-face and display token.
2. Create the shared blob/dot graphic primitives.
3. Build one large `UtterHeroGraphic`.
4. Build `Clone`, `Design`, and `Generate` feature graphics.
5. Expand the landing page with longer narrative sections and integrated graphics.
6. Add compact per-page graphic headers for Clone, Design, and Generate.
7. Tune spacing, glow, and responsive behavior last.

## Non-goals

- reproducing the exact `air.dev` SVG paths
- implementing complex autoplay-heavy decorative animation systems
- turning every product surface into a full illustration canvas
- redesigning unrelated account/history/voices pages from scratch unless the new system naturally touches them

## What good looks like

If this task is done well, someone should be able to look at the landing page and say:

- this is much more branded than before
- Clone, Design, and Generate each have their own identity
- the graphics feel related to each other
- the shapes feel inspired by the reference, but not copied from it
- the typography and graphics now feel like one system

## Acceptance criteria

1. Utter has a distinct blob-and-dot graphic language that is clearly inspired by, but not copied from, the reference.
2. Clone, Design, and Generate each have their own recognizable graphic variant.
3. The landing page is longer and visually richer, with graphics integrated into the content structure.
4. `Geist Pixel Circle` is added and used more prominently for display headings.
5. The app pages inherit the same visual family in a lighter, task-safe way.

## Session checklist

- [ ] Add `Geist Pixel Circle` to the frontend font setup and theme tokens
- [ ] Build the shared blob/dot graphic primitives
- [ ] Create a hero-level `Utter` graphic variant
- [ ] Create distinct `Clone`, `Design`, and `Generate` graphic variants
- [ ] Expand the landing page to give the new visual language room to matter
- [ ] Integrate compact graphics into the three core workflow pages
- [ ] Tune responsive behavior so the graphics still read well on mobile
- [ ] Keep the final designs inspired by the reference, not copied from it

## Manual verification checklist

- [ ] Landing page feels substantially more branded and visually distinct
- [ ] Clone, Design, and Generate each have a recognizable visual identity
- [ ] `Geist Pixel Circle` appears intentionally in headings without harming readability
- [ ] Mobile layouts still feel clean and the decorative graphics do not crowd the forms
- [ ] The new visuals work with the existing dark theme and screenshot content

## Session prompt

```md
Work only on the visual-language integration task for Utter.

Read:
- `AGENTS.md`
- `docs/2026-03-09/00-triage-and-branching.md`
- `docs/2026-03-09/02-design-language-graphics-plan.md`

Task:
- Implement the custom blob/dot visual language for the landing page and the core `Clone`, `Design`, and `Generate` pages.
- Add `Geist Pixel Circle` for more prominent display-heading usage.
- Make the landing page longer and more art-directed where needed.

Constraints:
- Be inspired by the `air.dev` reference, but do not copy its exact shapes or icon compositions.
- Keep this session scoped to the visual-language task only.
- Do not start multi-job, skeleton, pricing, or legal work in this session unless a tiny supporting change is unavoidable.
- Preserve usability on the app pages; decorative elements must not interfere with task completion.

Definition of done:
- The new visual system is implemented.
- Relevant frontend checks are run where possible.
- The plan doc is updated with any follow-up polish items.
- Summarize the exact visual and responsive checks I should perform locally before moving to the next task in a new chat.
```
