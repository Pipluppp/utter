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

- starter: `$2.99` for `30,000` credits
- studio: `$9.99` for `120,000` credits

Why this shape:

- it matches the new target dollar points (`$2.99` and `$9.99`)
- it intentionally reduces included characters versus the previous `$10` tier
- it keeps `1 credit = 1 character`
- it keeps a simple 4x credit step-up between packs while the larger pack still gets better value per dollar

### Proposed starter economics

- `30,000` characters
- estimated audio: `80` minutes ~= `1.3` hours
- provider cost: `30,000 / 10,000 * 0.115 = $0.345`
- gross margin dollars: `$2.645`
- gross margin rate: `88.5%`

### Proposed studio economics

- `120,000` characters
- estimated audio: `320` minutes ~= `5.3` hours
- provider cost: `120,000 / 10,000 * 0.115 = $1.38`
- gross margin dollars: `$8.61`
- gross margin rate: `86.2%`

## Flat-credit operations

### Clone finalize

Provider cost:

- `qwen-voice-enrollment`: `$0.01` per voice

Current setting:

- `1,000` credits

Assessment:

- with lower character allowances, `1,000` credits becomes expensive relative to provider cost
- at the proposed `$2.99 / 30k` pack, `1,000` credits is worth about `$0.10`
- at the proposed `$9.99 / 120k` pack, `1,000` credits is worth about `$0.083`

Recommendation:

- lower clone finalize to `200` credits

At the proposed pack values this yields:

- starter-pack retail value: about `$0.02`
- studio-pack retail value: about `$0.017`

This keeps clone finalize above the `$0.01` provider cost while staying user-friendly.

### Design preview

Provider cost:

- `qwen-voice-design`: `$0.20` per voice

Current setting:

- `5,000` credits

Assessment:

- with lower pack credit density, current `5,000` credits becomes relatively expensive for users
- at the proposed `$2.99 / 30k` pack, `5,000` credits is about `$0.50` of retail value
- at the proposed `$9.99 / 120k` pack, `5,000` credits is about `$0.42` of retail value

Recommendation:

- lower design preview to `2,400` credits after the free trials

At the proposed pack values this yields:

- starter-pack retail value: about `$0.239`
- studio-pack retail value: about `$0.20`

That keeps design preview close to the `$0.20` provider cost while still leaving a modest margin.

## Implementation plan

1. Update `PREPAID_PACKS` in `workers/api/src/_shared/credits.ts`.
2. Update `creditPacks` in `frontend/src/content/plans.ts`.
3. Keep `creditsForGenerateText(text)` as `text.length`.
4. Lower `creditsForCloneTranscript()` to `200`.
5. Lower `DESIGN_PREVIEW_FLAT_CREDITS` to `2,400`.
6. Update the frontend rate-card copy and pack blurbs to match the new economics.
7. Recheck Stripe price IDs and product records before shipping.

## Open product questions

1. Do we want to keep the studio pack at `120,000` credits, or round to `100,000` for cleaner messaging?
2. Do we want clone finalize to stay near provider cost (`200` credits), or intentionally keep it higher?
3. Do we want a third volume pack later for power users, or keep only two packs for now?

## Final decisions for this implementation session (2026-03-10)

Chosen values implemented in code:

- starter pack: `pack_30k` -> `$2.99` for `30,000` credits
- studio pack: `pack_120k` -> `$9.99` for `120,000` credits
- generate: keep character-based metering (`creditsForGenerateText(text) = text.length`)
- clone finalize: `200` credits after free trials
- design preview: `2,400` credits after free trials

Stripe env mapping keys were renamed to match the new packs:

- `STRIPE_PRICE_PACK_30K`
- `STRIPE_PRICE_PACK_120K`

Manual follow-through required before shipping:

1. Create/confirm two Stripe Prices that match `$2.99` and `$9.99` one-time credit packs.
2. Set `STRIPE_PRICE_PACK_30K` and `STRIPE_PRICE_PACK_120K` in each Worker environment.
3. Remove or ignore old `STRIPE_PRICE_PACK_150K` / `STRIPE_PRICE_PACK_500K` secrets so operators do not accidentally rely on stale config.
4. Verify webhook events resolve to the new price IDs and grant `30,000` or `120,000` credits respectively.

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
- [ ] Lower design preview credits to the chosen new value
- [ ] Update rate-card text and pack blurbs to match the new economics
- [ ] Recheck Stripe product/price mapping assumptions before calling the task done

## Manual verification checklist

- [ ] Credits page shows the new pack prices and credit amounts
- [ ] Rate-card text matches the new constants
- [ ] Generate, clone, and design pricing displays are internally consistent
- [ ] Checkout configuration still maps to the intended pack ids and prices

## Repo workflow note

Implement this task in the main `utter/` repo directory on a dedicated branch from `main`.

Recommended branch:

- `feature/pricing-credit-rebalance`

After local verification:

- merge the branch into `main`
- delete the branch
- start the next task from a fresh branch off updated `main`

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
- Assume implementation happens in the main `utter/` repo directory, on a dedicated branch off `main`.
- Do not start legal, copy, multi-job, skeleton, or visual-language implementation in this session unless a tiny supporting text change is unavoidable.
- Preserve explicit calculations and avoid hidden fallback behavior.

Definition of done:
- Backend and frontend pricing constants are aligned.
- Relevant checks are run where possible.
- The plan doc is updated with any final pricing decisions or follow-up items.
- Summarize the exact billing and UI checks I should perform locally before moving to the next task in a new chat.
```
