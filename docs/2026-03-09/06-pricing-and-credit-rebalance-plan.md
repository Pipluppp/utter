# Pricing And Credit Rebalance Plan

## Goal

Bring packs, credit constants, and user-facing pricing copy closer to the real Qwen cost base while keeping a modest product margin.

## Current state

Current pack config:

- `workers/api/src/_shared/credits.ts`
- `frontend/src/content/plans.ts`

Current values:

- starter: `$10` for `150,000` credits
- studio: `$25` for `500,000` credits
- generate: `1 credit / character`
- design preview: `5,000` credits after free trials
- clone finalize: `1,000` credits after free trials

## Qwen provider cost inputs

Official references:

- [Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/product-overview/billing-of-model-studio)
- [Qwen TTS guide](https://www.alibabacloud.com/help/en/model-studio/use-qwen-tts-to-synthesize-speech-from-text-and-synchronously-stream-audio-data)

Relevant current prices from the official docs:

- `qwen3-tts-vc-2026-01-22`: `$0.115 / 10K` input characters
- `qwen3-tts-vd-2026-01-26`: `$0.115 / 10K` input characters
- `qwen-voice-design`: `$0.20` per voice
- `qwen-voice-enrollment`: `$0.01` per voice

Utter currently uses:

- `qwen3-tts-vc-2026-01-22` for cloned voices
- `qwen3-tts-vd-2026-01-26` for designed voices

From `workers/api/src/_shared/tts/provider.ts`.

## Useful operating conversion

Current code estimates speech duration as roughly:

- `375 characters ~= 1 minute of audio`

From `workers/api/src/routes/generate.ts`.

That means:

- `10,000` characters ~= `26.7` minutes
- `100,000` characters ~= `266.7` minutes ~= `4.4` hours

## Current pack economics

### Current starter pack

- pack: `150,000` credits for `$10`
- included characters: `150,000`
- estimated audio: `400` minutes ~= `6.7` hours
- provider cost: `150,000 / 10,000 * 0.115 = $1.725`
- gross margin dollars: `$8.275`
- gross margin rate: `82.75%`

### Current studio pack

- pack: `500,000` credits for `$25`
- included characters: `500,000`
- estimated audio: `1,333.3` minutes ~= `22.2` hours
- provider cost: `500,000 / 10,000 * 0.115 = $5.75`
- gross margin dollars: `$19.25`
- gross margin rate: `77.0%`

These packs are much richer in margin than needed for the current product goal.

## Recommended rebalance

## Proposed packs

Recommended baseline:

- starter: `$5` for `250,000` credits
- studio: `$18` for `1,000,000` credits

Why this shape:

- it matches the user's preferred dollar range better than the current packs
- it keeps `1 credit = 1 character`
- it lowers markup meaningfully without collapsing margin
- it makes the larger pack materially better value without becoming extreme

### Proposed starter economics

- `250,000` characters
- estimated audio: `666.7` minutes ~= `11.1` hours
- provider cost: `$2.875`
- gross margin dollars: `$2.125`
- gross margin rate: `42.5%`

### Proposed studio economics

- `1,000,000` characters
- estimated audio: `2,666.7` minutes ~= `44.4` hours
- provider cost: `$11.50`
- gross margin dollars: `$6.50`
- gross margin rate: `36.1%`

## Flat-credit operations

### Clone finalize

Provider cost:

- `qwen-voice-enrollment`: `$0.01` per voice

Current setting:

- `1,000` credits

Assessment:

- this is already broadly reasonable if pack pricing is lowered
- at the proposed `$5 / 250k` pack, `1,000` credits is worth `$0.02`
- at the proposed `$18 / 1M` pack, `1,000` credits is worth `$0.018`

Recommendation:

- keep clone finalize at `1,000` credits for now

### Design preview

Provider cost:

- `qwen-voice-design`: `$0.20` per voice

Current setting:

- `5,000` credits

Assessment:

- current design pricing is under-aligned with provider cost
- at the proposed `$5 / 250k` pack, `5,000` credits is only `$0.10` of retail value
- at the proposed `$18 / 1M` pack, `5,000` credits is only `$0.09` of retail value

Recommendation:

- raise design preview to `18,000` credits after the free trials

At the proposed pack values this yields:

- starter-pack retail value: about `$0.36`
- studio-pack retail value: about `$0.324`

That keeps design preview profitable while still inexpensive for users.

## Implementation plan

1. Update `PREPAID_PACKS` in `workers/api/src/_shared/credits.ts`.
2. Update `creditPacks` in `frontend/src/content/plans.ts`.
3. Keep `creditsForGenerateText(text)` as `text.length`.
4. Keep `creditsForCloneTranscript()` at `1,000`.
5. Raise `DESIGN_PREVIEW_FLAT_CREDITS` to `18,000`.
6. Update the frontend rate-card copy and pack blurbs to match the new economics.
7. Recheck Stripe price IDs and product records before shipping.

## Open product questions

1. Do we want the starter pack to be `$4` instead of `$5`? If yes, reduce credits proportionally to keep margins sane.
2. Do we want a larger volume-discount pack later for power users, or keep only two packs for now?
3. Do we want design preview to remain intentionally subsidized, or should it hold the same margin profile as generation?

## Acceptance criteria

1. Pack prices are in the desired friendlier range.
2. Pack sizes still map cleanly to character-based generation.
3. Clone and design flat-credit costs align with the actual provider cost base.
4. Backend constants, frontend copy, and billing configuration all match.

## Session checklist

- [ ] Update backend prepaid pack constants
- [ ] Update frontend pack definitions and pricing copy
- [ ] Keep `1 credit = 1 character` for generation unless a deliberate change is made
- [ ] Keep or update clone finalize credits according to the plan decision
- [ ] Raise design preview credits to the chosen new value
- [ ] Update rate-card text and pack blurbs to match the new economics
- [ ] Recheck Stripe product/price mapping assumptions before calling the task done

## Manual verification checklist

- [ ] Credits page shows the new pack prices and credit amounts
- [ ] Rate-card text matches the new constants
- [ ] Generate, clone, and design pricing displays are internally consistent
- [ ] Checkout configuration still maps to the intended pack ids and prices

## Session prompt

```md
Work only on the pricing-and-credit rebalance task for Utter.

Read:
- `AGENTS.md`
- `docs/2026-03-09/00-triage-and-branching.md`
- `docs/2026-03-09/06-pricing-and-credit-rebalance-plan.md`

Task:
- Implement the chosen pricing and credit changes across backend constants, frontend plan content, and any related rate-card copy.
- Keep the system internally consistent so pack pricing, credit costs, and displayed descriptions all agree.
- Call out any Stripe or billing configuration that still needs manual follow-through.

Constraints:
- Keep this session scoped to pricing and credits only.
- Do not start legal, copy, multi-job, skeleton, or visual-language implementation in this session unless a tiny supporting text change is unavoidable.
- Preserve explicit calculations and avoid hidden fallback behavior.

Definition of done:
- Backend and frontend pricing constants are aligned.
- Relevant checks are run where possible.
- The plan doc is updated with any final pricing decisions or follow-up items.
- Summarize the exact billing and UI checks I should perform locally before moving to the next task in a new chat.
```
