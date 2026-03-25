export const CLONE_TIPS: string[] = [
  "Upload WAV (16-bit), MP3, or M4A. Use 24 kHz+ mono for best results.",
  "Aim for 10–20 seconds of clear speech. The hard cap is 60 seconds.",
  "Keep the file under 10 MB. Shorter, cleaner samples clone better than long noisy ones.",
  "Use a single speaker with no background music, noise, or overlapping voices.",
  "Short pauses (under 2 seconds) are fine, but avoid long silences.",
  "Speak naturally — no singing, whispering, or exaggerated intonation.",
  "At least 3 seconds of continuous clear speech is required for the clone to work.",
  "Record mode saves a clone-quality WAV and auto-transcribes when you stop.",
];

export const DESIGN_TIPS: string[] = [
  "No reference audio needed — just describe the voice you want in words.",
  'Be specific: say "deep," "crisp," or "fast-paced" — not "nice" or "normal."',
  "Combine multiple dimensions: gender, age, pitch, pace, emotion, and use case.",
  "Voice description (voice_prompt) supports up to 2,048 characters, Chinese and English only.",
  "Preview text and description are each limited to 500 characters in the app.",
  "Be objective, original, and concise. Avoid subjective or flowery language.",
  "Preview runs as a background job — save the one you like to your voice library.",
];

export const GENERATE_TIPS: string[] = [
  "Pick a voice, enter text, then start generation.",
  "Generate runs as a background job, so queued or processing work keeps moving even if you leave the page.",
  "Max input length depends on your plan. Check the character counter below the text field.",
];
