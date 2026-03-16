# Plan 2: History Screen

> **Scope**: New screen — generation history list with search, filter, playback, delete, regenerate
> **Estimate**: 1 session
> **Depends on**: Phase 1 core polish (done)

## Overview

The web History page (`frontend/src/pages/History.tsx`, ~479 lines) shows all past TTS generations with search, filters, playback, and actions. The mobile version will be a new tab or stack screen.

## API contract

**Endpoint:** `GET /api/generations?page=1&per_page=20&search=...&status=...`
**Response type:** `GenerationsResponse` (already in `mobile/lib/types.ts`)

```ts
type Generation = {
  id: string;
  voice_id: string;
  voice_name: string | null;
  text: string;
  audio_path: string;
  duration_seconds: number | null;
  language: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  generation_time_seconds: number | null;
  error_message: string | null;
  created_at: string | null;
};
```

**Delete:** `DELETE /api/generations/{id}`
**Regenerate:** `POST /api/generations/{id}/regenerate` → `RegenerateResponse`

Need to add `RegenerateResponse` to `mobile/lib/types.ts`:
```ts
type RegenerateResponse = {
  voice_id: string;
  text: string;
  language: string;
  redirect_url: string;  // not used on mobile — navigate directly
};
```

## Navigation decision

**Option A: New tab** — Add "History" as 4th tab. Pro: always visible. Con: tab bar gets crowded.
**Option B: Stack screen** — Navigate from Voices or a header button. Pro: clean tabs. Con: less discoverable.

**Recommendation:** Add as 4th tab. The web has it as a top-level route. 4 tabs is standard on mobile.

## Implementation

### 1. Create the screen file

**File:** `mobile/app/(tabs)/history.tsx`

**Features:**
- FlatList of generations with pull-to-refresh
- Search bar (TextInput at top, debounced 300ms)
- Status filter (segmented: All / Completed / Failed / Active)
- Status badges per item (colored dot or text)
- Voice name, text snippet (first 100 chars), timestamp
- Audio playback button (completed items only) using `expo-audio`
- Delete button with Alert confirmation
- Regenerate button → navigate to Generate with voice + text pre-filled
- Pagination: track `page` state, "Load More" at bottom
- Auto-refresh: 5s interval when any items are pending/processing
- Skeleton loading on initial load
- Empty state: "No generations yet — go generate something!"

### 2. Add tab entry

**File:** `mobile/app/(tabs)/_layout.tsx`

Add History tab:
```tsx
<Tabs.Screen name="history" options={{ title: 'History' }} />
```

### 3. Audio playback

Reuse the same `useAudioPlayer` + `apiRedirectUrl` pattern from Generate screen:
```ts
const url = await apiRedirectUrl(`/api/generations/${gen.id}/audio`);
```

### 4. Regenerate flow

On web, regenerate redirects to `/generate?voice=X&text=Y&language=Z`. On mobile:
```ts
router.navigate({
  pathname: '/(tabs)/generate',
  params: { voice: gen.voice_id, text: gen.text, language: gen.language }
});
```
This requires the Generate screen to also accept `text` and `language` params (currently only accepts `voice`).

### 5. Types to add

In `mobile/lib/types.ts`:
```ts
export type RegenerateResponse = {
  voice_id: string;
  text: string;
  language: string;
  redirect_url: string;
};
```

## Web reference

- `frontend/src/pages/History.tsx` — full web implementation (~479 lines)
- Key patterns: debounced search, status filter, pagination, auto-refresh, waveform playback

---

## Session Prompt

```
We're continuing work on the Expo React Native mobile app for our Utter project.

**Context:**
- Worktree: C:\Users\Duncan\Desktop\utter-mobile (branch: feat/mobile-app)
- Mobile app: mobile/ directory (Expo SDK 54, expo-router v6, React 19.1.0)
- The app runs on Expo Go on a physical device, connected to production backend
- Session docs: docs/2026-03-15/ (scaffold + architecture), docs/2026-03-16/ (plans)
- Previous work: Phase 1 fully done (all core screens polished)

**Task: History Screen**

Read docs/2026-03-16/02-history-screen.md for the full plan. Use the /building-native-ui skill for all UI work.

Build the History screen:

1. **Create mobile/app/(tabs)/history.tsx** — new tab screen
   - FlatList of generations with pull-to-refresh
   - Search bar (debounced), status filter (All/Completed/Failed/Active)
   - Status badges, voice name, text snippet, timestamp per row
   - Audio playback on completed items (expo-audio + apiRedirectUrl)
   - Delete with confirmation, regenerate (navigate to Generate with params)
   - Pagination (page-based), auto-refresh when active jobs exist (5s interval)
   - Skeleton loading, empty state
   - Cross-reference frontend/src/pages/History.tsx

2. **Update mobile/app/(tabs)/_layout.tsx** — add History as 4th tab

3. **Update mobile/lib/types.ts** — add RegenerateResponse type

4. **Update mobile/app/(tabs)/generate.tsx** — accept text and language params in addition to voice param (for regenerate navigation)

Run npx tsc --noEmit from mobile/ after each change. Commit when complete.
```
