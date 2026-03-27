# `/api/languages` audit — remove or inline

## What the endpoint does today

`GET /api/languages` (`workers/api/src/routes/languages.ts`) returns a single JSON blob bundling five concerns:

| Field           | Value                                                                                                                | Source                                   | Static?                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `languages`     | `["Auto","English","Chinese",…,"Russian"]` (11 entries)                                                              | Hardcoded array                          | Yes                                                                                 |
| `default`       | `"Auto"`                                                                                                             | Hardcoded string                         | Yes                                                                                 |
| `provider`      | `"qwen"`                                                                                                             | `getTtsProviderMode()` → `return "qwen"` | Yes                                                                                 |
| `capabilities`  | `{ supports_generate, supports_generate_stream, default_generate_mode, allow_generate_mode_toggle, max_text_chars }` | `getTtsCapabilities()`                   | 4/5 fields are constants; only `max_text_chars` reads `QWEN_MAX_TEXT_CHARS` env var |
| `transcription` | `{ enabled, provider, model }`                                                                                       | `getQwenTranscriptionConfig()`           | `provider`/`model` are effectively constants; `enabled` is derived from env vars    |

## Frontend consumers

Four pages call `useLanguages()` from `frontend/src/features/shared/hooks.ts`:

- **Generate** — `languages` (dropdown), `defaultLanguage`, `provider`, `capabilities.max_text_chars` (character counter)
- **Clone** — `languages` (dropdown), `defaultLanguage`, `transcription.enabled` (show/hide Record tab)
- **Design** — `languages` (dropdown only)
- **About** — `languages` (display list), `loading`

The hook fetches once, caches in a module-level variable, and deduplicates in-flight requests.

## How languages reach the Qwen API

The frontend stores the human-readable name (e.g. `"English"`). Two separate backend mappers convert it for different Qwen endpoints:

1. **Customization** (`qwen_customization.ts` → `toQwenLanguageTag`): `"english" → "en"` — matches Qwen docs `input.language: zh|en|de|it|pt|es|ja|ko|fr|ru`.
2. **Synthesis** (`qwen_synthesis.ts` → `toLanguageType`): `"english" → "English"` — matches Qwen docs `input.language_type: Auto|Chinese|English|…`.

Both mappers are internal to the API worker and do not depend on the `/api/languages` endpoint.

## Qwen API language support (from `docs/qwen-api.md`)

- Voice cloning `input.language`: `zh|en|de|it|pt|es|ja|ko|fr|ru` (10 languages)
- Voice design `input.language`: same 10
- Synthesis `input.language_type`: `Auto, Chinese, English, German, Italian, Portuguese, Spanish, Japanese, Korean, French, Russian` (10 + Auto)

The hardcoded `QWEN_SUPPORTED_LANGUAGES` array matches this exactly. The list is dictated by the Qwen model family and only changes with a new model version (which requires a code deploy anyway).

## Field-by-field verdict

| Field                                     | Keep on server? | Reasoning                                                                                                                                                            |
| ----------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `languages`                               | **No**          | Fixed by Qwen model. Inline on frontend.                                                                                                                             |
| `default`                                 | **No**          | Literal `"Auto"`. Inline.                                                                                                                                            |
| `provider`                                | **No**          | Literal `"qwen"`. Inline.                                                                                                                                            |
| `capabilities.supports_generate`          | **No**          | Always `true`.                                                                                                                                                       |
| `capabilities.supports_generate_stream`   | **No**          | Always `false`.                                                                                                                                                      |
| `capabilities.default_generate_mode`      | **No**          | Always `"task"`.                                                                                                                                                     |
| `capabilities.allow_generate_mode_toggle` | **No**          | Always `false`.                                                                                                                                                      |
| `capabilities.max_text_chars`             | **Weak case**   | Reads env var, but default is 100. Server-side route handlers already enforce the limit regardless of frontend value. Frontend use is purely UX (character counter). |
| `transcription.enabled`                   | **Weak case**   | Derived from `DASHSCOPE_API_KEY` presence + `TRANSCRIPTION_ENABLED` flag. Controls Record tab visibility on Clone page. But this is a deploy-time constant.          |
| `transcription.provider`                  | **No**          | Always `"qwen"`.                                                                                                                                                     |
| `transcription.model`                     | **No**          | Always `"qwen3-asr-flash-2026-02-10"` (or env override, still deploy-time).                                                                                          |

## Recommendation

Delete the `/api/languages` endpoint entirely. Replace with a frontend constant:

```ts
// frontend/src/lib/provider-config.ts
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

export const DEFAULT_LANGUAGE = "Auto";
export const TTS_PROVIDER = "qwen" as const;
export const MAX_TEXT_CHARS = 1000;
export const TRANSCRIPTION_ENABLED = true;
```

If `max_text_chars` or `transcription.enabled` feel too risky to hardcode, keep a minimal `GET /api/config` returning only those two values. But both are deploy-time constants, and the server already enforces text length in the generate/design route handlers.

The server-side default in `workers/api/src/_shared/tts/provider.ts` (`DEFAULT_QWEN_MAX_TEXT_CHARS`) is also set to `1000` to match. The `QWEN_MAX_TEXT_CHARS` env var still works as an override if needed.

## Status: DONE

All cleanup items below have been completed.

## What stays untouched

- `toQwenLanguageTag()` in `qwen_customization.ts` — maps user-facing names to Qwen ISO codes for cloning/design
- `toLanguageType()` in `qwen_synthesis.ts` — maps user-facing names to Qwen title-case strings for synthesis
- `language` columns in `voices` and `generations` tables — store the user-facing name as-is

## Cleanup scope

- Delete `workers/api/src/routes/languages.ts`
- Remove `languagesRoutes` registration from the API worker router
- Delete `useLanguages` hook and `getLanguagesOnce` from `frontend/src/features/shared/hooks.ts`
- Delete `LanguagesResponse` type from `frontend/src/lib/types.ts`
- Update Generate, Clone, Design, About pages to import from `provider-config.ts`
- Create `frontend/src/lib/provider-config.ts` with the inlined constants
