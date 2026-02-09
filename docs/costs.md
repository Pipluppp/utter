
# Costs

## Qwen3-TTS Official API (Voice cloning, Voice design, and Speech synthesis)

There are two models:

- qwen3-tts-vc-realtime-2026-01-15 ($0.13 per 10,000 characters; $0.01 per voice)
- qwen3-tts-vd-realtime-2026-01-15 ($0.143353 per 10,000 characters; $0.2 per voice)

Both of them handles two workflows:

- **Creation of a Voice Model** (Provide reference audio/text for cloning, or Description for design)
- **Generation of audio from Voice Model** (Provide the voice model ID and text synthesize to audio)

and from a created voice model, you can use them to call the API again for speech synthesis (audio
generation from text).


> Note that creation of a voice model generates no preview. So once created, we then have to manually call the speech synthesis api (same model different request). Except for the Voice design,
it comes with a preview audio

### Voice clone

Voice cloning and speech synthesis are two distinct but related steps that follow a "create first, then use" workflow:

Create a voice

Call the Create a voice API and upload an audio clip. The system analyzes the audio and creates a custom cloned voice. In this step, you must use the target_model parameter to specify the speech synthesis model that will be used with the created voice.

If you have already created a voice, you can call the Query the voice list API to retrieve it and skip this step.

Use the voice for speech synthesis

Call the speech synthesis API and pass the voice ID obtained in the previous step. The speech synthesis model specified in this step must match the target_model specified during voice creation.

### Voice design

Voice design and speech synthesis are two closely linked but independent steps that follow a "create first, then use" workflow:

Prepare the voice description and preview text for voice design.

Voice description (voice_prompt): Defines the target voice characteristics. For guidance, see "How to write high-quality voice descriptions."

Preview text (preview_text): The text that the preview audio will read aloud, for example, "Hello everyone, welcome to the show."

Call the Create voice API to generate a custom voice and get its name and preview audio.

In this step, you must specify target_model to declare which speech synthesis model will drive the created voice.

Listen to the preview audio to evaluate if it meets your expectations. If it does, proceed. If not, redesign the voice.

If you already have a created voice, which you can verify using the List voices API, you can skip this step and proceed to the next one.

Use the voice for speech synthesis.

Call the speech synthesis API and pass the voice obtained in the previous step. The speech synthesis model used here must match the target_model specified in the previous step.

## Mistral Voxtral transcription

In voice cloning, a user can transcribe their uploaded audio using `voxtral-mini-2602` for $0.003 per minute and also record their audio and do realtiem transcription with `voxtral-mini-transcribe-realtime-2602` for $0.006 per minutes. Since cloning only needs a little
bit of audio, this is basically free.