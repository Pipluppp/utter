/**
 * Static provider configuration.
 *
 * These values are dictated by the Qwen model family and product decisions.
 * The language list matches Qwen TTS `input.language_type` values exactly.
 * Update here if Alibaba ships new model versions with additional language support.
 */

export const SUPPORTED_LANGUAGES = [
  "Auto",
  "English",
  "Chinese",
  "Japanese",
  "Korean",
  "French",
  "German",
  "Spanish",
  "Italian",
  "Portuguese",
  "Russian",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE = "Auto";

export const TTS_PROVIDER = "qwen" as const;

/** Product-level cap on synthesis text length (characters). */
export const MAX_TEXT_CHARS = 1000;

/** Whether the transcription feature is available. */
export const TRANSCRIPTION_ENABLED = true;
