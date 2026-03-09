# Copy Alignment Plan

## Goal

Make the public and in-app text match the actual Qwen-backed product that exists today, including supported languages, queue-backed behavior, and the current feature boundaries.

## Current mismatches

### Landing hero language count

`frontend/src/pages/landing/LandingHero.tsx` currently says:

- `Hear real demos first, then try it yourself. {languages.length} languages supported.`

This is misleading for two reasons:

1. `workers/api/src/routes/languages.ts` currently returns `Auto` plus 14 named languages.
2. Current official Qwen TTS docs for the models in use list 10 supported languages, not 14 plus `Auto`.

### About page wording

`frontend/src/pages/About.tsx` still mixes generic provider phrasing with older assumptions:

- "Some providers require a transcript"
- a languages list that depends on the same mismatched payload

Current runtime is Qwen-only, so copy should stop implying a multi-provider product where that is no longer true.

## Source-of-truth decisions

### Product position

Use this product framing:

- Qwen-powered voice cloning, voice design, and speech generation
- queue-backed generation and design preview
- saved voices and saved generation history
- transcript-guided voice cloning

### Supported languages

The app should stop marketing an inflated language count.

Recommended product wording:

- "Supports 10 Qwen TTS languages"
- optionally add "with Auto as a convenience selector" only if the backend behavior is actually validated for Auto routing

### Constraints to communicate clearly

- voice cloning needs reference audio and transcript
- generate requests are asynchronous and may queue
- design preview is asynchronous and save happens after preview completion
- long text can take longer and is subject to the configured character cap

## Implementation plan

## Phase A: align the payload

Update `workers/api/src/routes/languages.ts` to the validated set supported by the active Qwen models.

Do not let the marketing site infer support from a stale hardcoded list.

## Phase B: update marketing copy

Target files:

- `frontend/src/pages/landing/LandingHero.tsx`
- `frontend/src/pages/About.tsx`
- any related landing feature cards that mention provider or language support

## Phase C: update app copy

Audit copy on:

- `Generate`
- `Clone`
- `Design`
- account rate-card descriptions

The copy should explicitly match:

- Qwen-only provider
- queue-backed async behavior
- transcript requirement for cloning

## Draft copy direction

### Landing hero

Recommended shape:

"Qwen-powered voice cloning, voice design, and speech generation. Start with real demos, then create voices and queue generations in your own workspace."

Short support line:

"Supports 10 Qwen TTS languages."

### About constraints

Recommended shape:

- "Voice cloning requires reference audio and a matching transcript."
- "Generation and design preview run as async jobs and can take longer under load."

## Acceptance criteria

1. Landing and About copy no longer overstate language support.
2. Copy no longer implies a multi-provider runtime.
3. App text reflects queue-backed behavior where relevant.
4. The `/api/languages` payload matches the feature copy.

## Session checklist

- [ ] Update `/api/languages` to the validated supported language set for the active Qwen models
- [ ] Update landing hero copy to match the actual product and supported-language claim
- [ ] Update About page copy to reflect the Qwen-only runtime and transcript requirement
- [ ] Audit key app copy in Clone, Design, Generate, and rate-card surfaces
- [ ] Remove wording that implies a multi-provider runtime
- [ ] Remove wording that overstates language support or feature behavior

## Manual verification checklist

- [ ] Landing hero no longer shows an inflated language count
- [ ] About page no longer uses stale provider-language wording
- [ ] Generate, Clone, and Design copy all match actual workflow behavior
- [ ] `/api/languages` output matches the copy shown in the UI

## Session prompt

```md
Work only on the copy-alignment task for Utter.

Read:
- `AGENTS.md`
- `docs/2026-03-09/00-triage-and-branching.md`
- `docs/2026-03-09/04-copy-alignment-plan.md`

Task:
- Update landing and app copy so it matches the actual Qwen-backed product.
- Align the `/api/languages` payload with the supported-language claim shown in the UI.
- Remove stale wording that still implies a multi-provider system or incorrect feature limits.

Constraints:
- Keep this session scoped to copy and related payload alignment only.
- Do not start pricing, legal, multi-job, skeleton, or visual-language implementation in this session unless a tiny supporting text change is unavoidable.
- Preserve the existing product voice while making claims accurate.

Definition of done:
- Copy and the related language payload are aligned.
- Relevant frontend checks are run where possible.
- The plan doc is updated with any wording decisions or unresolved questions.
- Summarize the exact manual review points I should check locally before moving to the next task in a new chat.
```
