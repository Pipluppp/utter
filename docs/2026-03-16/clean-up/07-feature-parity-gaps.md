# Plan 07: Remaining Feature Parity Gaps

**Severity:** Medium
**Est:** 1-2 sessions
**Files:** Multiple screens + types

## Problem

After the critical/high-severity fixes, these are the remaining web features not yet ported to mobile. None are blockers, but they reduce the mobile experience compared to web.

### 7.1 Voice audio preview on Voices list (High impact)

Web has a waveform-based preview player per voice using `useWaveformListPlayer` and `GET /api/voices/:id/preview`. Mobile has **no audio preview** — users cannot hear a voice without navigating to Generate.

**Fix:** Add an `AudioPlayerBar` to each voice card:

```tsx
// In VoiceCard:
const [previewUri, setPreviewUri] = useState<string | null>(null);

const handlePreview = async () => {
  const uri = await apiRedirectUrl(`/api/voices/${voice.id}/preview`);
  setPreviewUri(uri);
};
```

Use a single shared player instance (like history.tsx does) to avoid creating N players for N voices. When one voice starts playing, stop the previous one.

### 7.2 `model` parameter in generate request (Medium)

Web sends `model: '0.6B'` in the generate POST body. Mobile omits it. The server may default to the correct model, but this should be explicit.

**Fix:** Add `model` to the generate request in `generate.tsx`:

```tsx
const res = await apiJson<{ task_id: string }>('/api/generate', {
  method: 'POST',
  json: { voice_id: voiceId, text, language, model: '0.6B' },
});
```

### 7.3 Voice provider compatibility check (Medium)

Web checks `selectedVoice.tts_provider` against the server's current provider and disables incompatible voices in the Generate dropdown. Mobile ignores this entirely — a user could select an incompatible voice and get a confusing error.

**Fix:**
1. Add `provider_voice_id`, `provider_target_model`, `provider_voice_kind` to the `Voice` type in `lib/types.ts`
2. Fetch capabilities from the languages endpoint (which returns `provider` info on web)
3. Filter or warn about incompatible voices in the voice selector

### 7.4 `cancelled` status filter in History (Low)

Web includes `cancelled` in the history status filter options. Mobile only has: all, completed, failed, pending, processing.

**Fix:** Add `cancelled` to the status filter options array in `history.tsx`.

### 7.5 Transcribe uploaded files in Clone (Medium)

Web shows a manual "Transcribe" button for uploaded files. Mobile only auto-transcribes after recording — uploaded files get no transcription offer.

**Fix:** After a file is uploaded and validated, show a "Transcribe" button that calls `POST /api/transcriptions` with the uploaded audio, same as recording does.

### 7.6 Design save — re-upload audio vs task_id only (Medium)

Web downloads the preview audio as a blob and re-uploads it via `apiForm` (FormData with the audio file) when saving. Mobile sends only `{ task_id, name }` via `apiJson`.

This works if the backend supports saving by task_id lookup. Verify the backend handles both paths. If it does, document the difference. If it doesn't, the save silently fails.

**Fix (if needed):**
```tsx
// Download the preview audio first
const audioUri = await apiRedirectUrl(`/api/tasks/${task.taskId}/audio`);
const audioResponse = await fetch(audioUri);
const audioBlob = await audioResponse.blob();

// Then upload via FormData like web does
const form = new FormData();
form.append('audio', { uri: audioUri, type: 'audio/wav', name: 'preview.wav' } as any);
form.append('name', name);
form.append('task_id', task.taskId);
const res = await apiForm('/api/voices/design', form);
```

### 7.7 Sync types with web (Low)

Missing fields in mobile `types.ts`:
- `BackendTask`: `provider_poll_count`, `modal_elapsed_seconds`, `modal_poll_count`
- `Voice`: `provider_voice_id`, `provider_target_model`, `provider_voice_kind`
- `TaskProvider.getStatusText`: missing `modalStatus` parameter

**Fix:** Copy the missing fields from `frontend/src/lib/types.ts`. Make new fields optional (`?:`) since older API responses won't include them.

### 7.8 Max text chars from server capabilities (Low)

Web reads `capabilities.max_text_chars` from the languages endpoint response (defaults to 10000). Mobile hardcodes `MAX_TEXT_CHARS = 5000`.

**Fix:** Read from the languages response if available, fall back to the hardcoded value:

```tsx
const maxChars = languagesResponse?.capabilities?.max_text_chars ?? 5000;
```

### 7.9 Demo content loading (Low)

Web supports `?demo=<id>` query params to pre-load demo voices and text. Mobile has no demo system. This is low priority but nice for marketing/onboarding.

**Defer** unless there's a specific onboarding flow planned.

## Implementation order (recommended)

1. **7.1** — Voice preview (biggest UX gap)
2. **7.2** — Model parameter (quick fix)
3. **7.5** — Transcribe uploaded files
4. **7.3** — Voice provider compatibility
5. **7.4** — Cancelled status filter (trivial)
6. **7.6** — Verify design save path
7. **7.7** — Type sync
8. **7.8** — Max text chars from server

## Acceptance criteria

- [ ] Users can preview voice audio from the Voices list without leaving the screen
- [ ] Generate request includes `model: '0.6B'`
- [ ] Incompatible voices show a warning or are filtered out
- [ ] Uploaded files in Clone can be transcribed via a manual button
- [ ] Mobile `types.ts` matches web types for all shared API contracts
