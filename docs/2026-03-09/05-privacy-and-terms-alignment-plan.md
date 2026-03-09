# Privacy And Terms Alignment Plan

## Goal

Replace the current placeholder legal copy with user-facing privacy and terms text that matches:

1. what Utter actually stores and processes
2. how the Qwen provider is currently used
3. the current prepaid-credit product model

This is a product/legal alignment pass, not formal legal advice.

## Current mismatches

### Privacy page

`frontend/src/pages/Privacy.tsx` is still vague about retention and product behavior.

Problems:

- it does not clearly say that uploaded reference audio and generated audio are stored by Utter
- it does not clearly say that transcripts and generation text are stored in the database
- it promises deletion tooling that does not fully exist yet

### Terms page

`frontend/src/pages/Terms.tsx` still says:

- subscriptions renew monthly unless cancelled

That does not match the current prepaid-pack billing model.

## What Utter actually stores today

Based on the current backend and docs:

- account identity via Supabase Auth
- uploaded reference audio in the private `references` bucket
- generated audio and design preview audio in storage buckets
- clone transcripts in `voices.reference_transcript`
- generation text in `generations.text`
- async task metadata and results in `tasks`
- billing and credit ledger events in Supabase

Relevant code and docs:

- `workers/api/src/routes/clone.ts`
- `workers/api/src/routes/design.ts`
- `workers/api/src/routes/generate.ts`
- `docs/database.md`
- `docs/backend.md`

## Qwen / Alibaba Cloud provider inputs for policy drafting

Research reference set:

- Qwen TTS pricing and supported models:
  - [Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/product-overview/billing-of-model-studio)
  - [Qwen TTS guide](https://www.alibabacloud.com/help/en/model-studio/use-qwen-tts-to-synthesize-speech-from-text-and-synchronously-stream-audio-data)
- Rate-limit and concurrency planning:
  - [Rate limits](https://www.alibabacloud.com/help/en/model-studio/rate-limit)
- Privacy and model-training behavior:
  - [Model Studio privacy notice](https://www.alibabacloud.com/help/en/model-studio/privacy-notice)

Working assumptions from the official docs that should shape the copy:

- API traffic is transmitted over encrypted connections
- Model Studio states that customer API data is not used to train the provider models
- Model Studio states that API content is not retained for provider-side model improvement in the default API path described in the privacy notice

These points should be reflected accurately but conservatively. Do not overclaim beyond the provider's current published language.

## Copy decisions to make

## Privacy page

State clearly:

- what we store
- why we store it
- where it is stored at a high level
- when users can delete it
- what the third-party provider processes on our behalf

Recommended sections:

1. `What you provide`
2. `What Utter stores`
3. `How Qwen processing fits in`
4. `How long we keep data`
5. `How deletion works today`
6. `Acceptable use and abuse review`

## Terms page

State clearly:

- users must have rights to uploaded audio, transcripts, prompts, and usage
- generated output may only be used in lawful ways and not for impersonation, fraud, or harassment
- users keep ownership of their inputs and outputs, while granting Utter a limited license to host, process, store, and transmit them to operate the service
- prepaid packs are one-time purchases, not subscriptions
- credits are consumed by product usage under the published rate card

## Product constraints that must appear

- clone voices are created from user-supplied reference audio and transcript
- design preview audio is stored long enough for the user to review and save it
- generation audio is stored in History until deleted or retention rules are changed
- provider outages and queue delays can affect availability

## Implementation plan

1. Rewrite `frontend/src/pages/Privacy.tsx` around actual data flows.
2. Rewrite `frontend/src/pages/Terms.tsx` around rights, acceptable use, prepaid billing, and service availability.
3. Remove placeholder deletion promises that are not implemented.
4. Add exact support contact or support path only if the product already has one.
5. Review the final wording against the latest Alibaba Cloud Model Studio privacy notice before shipping.

## Acceptance criteria

1. Privacy copy accurately describes the data Utter stores today.
2. Terms copy no longer mentions subscriptions.
3. Both pages explain the limited processing role of the Qwen provider without overclaiming.
4. Both pages align with the actual product rights and storage model.

## Session checklist

- [ ] Rewrite `frontend/src/pages/Privacy.tsx` around current Utter data flows
- [ ] Rewrite `frontend/src/pages/Terms.tsx` around rights, acceptable use, availability, and prepaid billing
- [ ] Remove placeholder promises about deletion tools that do not exist yet
- [ ] Remove subscription wording and replace it with prepaid-pack language
- [ ] Validate wording against the latest cited Qwen/Alibaba Cloud privacy references
- [ ] Keep claims conservative and tied to what the provider publicly states

## Manual verification checklist

- [ ] Privacy page clearly explains what users upload and what Utter stores
- [ ] Privacy page explains the provider-processing relationship without overclaiming
- [ ] Terms page reflects prepaid packs rather than subscriptions
- [ ] Terms page clearly covers rights, misuse, and service availability

## Wording caveats captured during implementation

- Keep provider claims tied to Alibaba Cloud Model Studio's published language only.
- The linked plan reference `billing-of-model-studio` currently returns a 404 on the public help site; use current Qwen TTS docs and in-product billing behavior until a replacement canonical billing URL is confirmed.
- Model Studio privacy notice language distinguishes direct API calls vs Assistant API retention behavior. Utter TTS wording should stay scoped to direct API usage.
- Avoid claiming hard deletion for voice references unless backend deletion behavior is expanded. Current voice deletion is soft-delete at the app DB layer.

## Unresolved product/legal questions

1. Should deleting a voice also hard-delete the associated `references` bucket object immediately?
2. Should there be an explicit retention window for soft-deleted voice rows and reference artifacts?
3. Should Privacy/Terms link to a specific Utter support contact path once finalized?
4. Should we add a dedicated note on cross-region provider processing beyond current high-level wording, based on chosen deployment lane and future region configuration?

## Repo workflow note

Implement this task in the main `utter/` repo directory on a dedicated branch from `main`.

Recommended branch:

- `chore/privacy-terms-alignment`

After local verification:

- merge the branch into `main`
- delete the branch
- start the next task from a fresh branch off updated `main`

## Session prompt

```md
Work only on the privacy-and-terms alignment task for Utter.

Read:
- `AGENTS.md`
- `docs/2026-03-09/00-triage-and-branching.md`
- `docs/2026-03-09/05-privacy-and-terms-alignment-plan.md`

Task:
- Rewrite the Privacy and Terms pages so they match the actual Utter product behavior and current Qwen provider usage.
- Remove placeholder or inaccurate legal/product language.
- Keep the wording user-facing and practical, while staying conservative about provider claims.

Constraints:
- Keep this session scoped to privacy and terms only.
- Assume implementation happens in the main `utter/` repo directory, on a dedicated branch off `main`.
- Do not start pricing, copy, multi-job, skeleton, or visual-language implementation in this session unless a tiny supporting text change is unavoidable.
- This is product/legal alignment, not legal invention. Stay anchored to the cited product behavior and provider docs.

Definition of done:
- Privacy and Terms pages are rewritten.
- Relevant frontend checks are run where possible.
- The plan doc is updated with any wording caveats or unresolved legal/product questions.
- Summarize the exact local review points I should check before moving to the next task in a new chat.
```
