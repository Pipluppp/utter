# Plan: Audio Player Component (Play/Pause + Progress Bar)

> **Date**: 2026-03-17
> **Plan**: 07 (continuation of 2026-03-16 plans)
> **Scope**: Replace bare "Play" text buttons with a reusable mini audio player across all screens
> **Estimate**: 1 session
> **Depends on**: All screens already have working audio playback via `expo-audio`
> **Approach**: Simplest path — play/pause toggle + linear progress bar + time display. No waveform.

## Problem

The web app shows a WaveSurfer.js waveform player on multiple screens. The mobile app currently has bare "Play" / "Playing..." text buttons with no progress feedback, no pause, no seek, and no duration display. Three items in the parity plan are marked Missing due to this:

- **Voices**: Preview audio (waveform)
- **Generate**: Waveform visualization
- **Clone**: Waveform preview of recording

We're not going to replicate the waveform. Instead, we'll build a simple `<AudioPlayerBar>` component: play/pause button + progress bar + elapsed/total time. This is the easiest path that closes all three parity gaps.

## Current audio playback pattern

Every screen uses the same approach:

```tsx
const [audioUri, setAudioUri] = useState<string | null>(null);
const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

// Play on source change
useEffect(() => {
  if (audioUri && player) player.play();
}, [audioUri, player]);
```

The `useAudioPlayer` hook from `expo-audio` (SDK 54) returns an `AudioPlayer` object with:
- `player.play()` / `player.pause()` — control playback
- `player.seekTo(seconds)` — seek to a position
- `player.currentTime` — current playback position (seconds)
- `player.duration` — total duration (seconds), available after load
- `player.playing` — boolean, whether currently playing
- `player.addListener('playbackStatusUpdate', callback)` — real-time status updates

## Design

### `AudioPlayerBar` component

A self-contained component that accepts an `AudioPlayer` instance and renders:

```
[ ▶ ]   advancement   0:12 / 0:38
       ████████░░░░░░░░░░░░░░░░░░
```

**Props:**
```tsx
interface AudioPlayerBarProps {
  player: AudioPlayer | null;
  /** Show the bar even when no audio is loaded (disabled state) */
  showEmpty?: boolean;
}
```

**Behavior:**
- Tap the play/pause icon to toggle playback
- Progress bar shows `currentTime / duration` as a filled proportion
- Tap on the progress bar to seek (use `onLayout` + `onTouchEnd` for position calculation)
- Time labels: `m:ss / m:ss` format
- When audio finishes (reaches end), reset to paused state at 0:00
- When `player` is null or audio hasn't loaded, show disabled/empty state

**Visual spec (dark theme):**
- Container: `backgroundColor: '#1a1a1a'`, `borderRadius: 8`, `padding: 12`
- Play/pause: white icon text (`▶` / `❚❚`), 28x28 touch area
- Progress track: `backgroundColor: '#333'`, `height: 4`, `borderRadius: 2`
- Progress fill: `backgroundColor: '#0af'`, animates with playback
- Time text: `color: '#888'`, `fontSize: 11`, monospace feel via `fontVariant: ['tabular-nums']`

### File location

`mobile/components/AudioPlayerBar.tsx`

## Integration points (4 screens)

### 1. Voices screen (`index.tsx`) — voice preview

Currently there's no audio preview on voice cards. The web has a preview player on each voice.

**Implementation:**
- Add a "Preview" button to each voice card (next to Generate / Delete)
- On press, fetch the voice's preview audio URL: `GET /api/voices/{id}/preview` — check if this endpoint exists, or use the voice's `preview_url` field if available
- Set `audioUri` → the `useAudioPlayer` hook picks it up
- Render `<AudioPlayerBar player={player} />` below the voice card's metadata when that voice is the active preview
- Only one voice previews at a time (setting a new URI stops the previous)

**Key question**: Does the API provide a voice preview audio URL? Check the `Voice` type. If the voice model has `preview_url` or similar, use it. If not, this feature requires a backend endpoint and should be deferred — add a "Preview not available" note in the plan.

**Fallback if no preview URL exists**: Skip the Voices preview player for now. Mark it as "Missing (no backend endpoint)" in the parity plan. The other 3 screens all have audio and will get the player.

### 2. Generate screen (`generate.tsx`) — completed generation playback

Currently: bare "Play" / "Playing..." button in the task list.

**Implementation:**
- When a completed task is selected (`selectedTaskId`), show `<AudioPlayerBar>` above the task list or inside the selected task card
- Replace the current "Play" button text with the player bar
- Keep the "Share" button alongside (not inside the player)
- The existing `playGeneration` callback sets `audioUri` which feeds `useAudioPlayer` — wire the player instance to `<AudioPlayerBar>`

### 3. Design screen (`design.tsx`) — preview playback

Currently: "Play Again" text button in the "Preview Ready" card.

**Implementation:**
- Replace the "Play Again" button with `<AudioPlayerBar player={player} />`
- Keep the "Save Voice" button alongside
- The existing `handlePlayPreview` does `player.seekTo(0); player.play()` — the AudioPlayerBar handles this internally now

### 4. History screen (`history.tsx`) — generation playback

Currently: bare "Play" / "Playing..." button per generation card.

**Implementation:**
- When a generation is playing (`playingId === gen.id`), show `<AudioPlayerBar>` in that card replacing the Play button
- Other cards retain the "Play" text button to initiate playback
- The existing `handlePlay` sets `audioUri` → feeds `useAudioPlayer`

### 5. Clone screen (`clone.tsx`) — recording preview (stretch)

Currently: no playback of the recorded audio before uploading. The recording flow captures audio and immediately proceeds to transcription/upload.

**Implementation (if time permits):**
- After recording stops, show `<AudioPlayerBar>` to let the user review their recording
- Create a temporary player with `useAudioPlayer({ uri: recordingUri })`
- This is lower priority since the recording flow works fine without it

## Implementation order

1. **Build `AudioPlayerBar` component** — self-contained, tested in isolation
2. **Wire into Generate screen** — easiest integration, has clear audio state
3. **Wire into History screen** — similar pattern
4. **Wire into Design screen** — replace "Play Again" button
5. **Wire into Voices screen** — if preview URL exists; skip if not
6. **(Stretch) Wire into Clone screen** — recording preview

## expo-audio listener pattern

```tsx
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';

function AudioPlayerBar({ player }: { player: AudioPlayer | null }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!player) return;

    // Use player properties directly and poll, or use event listener
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      setCurrentTime(status.currentTime);
      setDuration(status.duration);
      setIsPlaying(status.playing);
    });

    return () => sub.remove();
  }, [player]);

  // ... render play/pause + progress bar + time
}
```

**Note**: Verify the exact event shape from expo-audio SDK 54. The listener API may use `player.addListener('playbackStatusUpdate', ...)` or a different event name. Check `expo-audio` docs for the `AudioPlayer` events.

## Verification

- `npx tsc --noEmit` from `mobile/` — no type errors
- Manual test on Expo Go: play audio on Generate, History, Design — verify progress bar advances, pause works, seek works
- Commit per integration point or as a single commit if all done together

## Parity plan updates after completion

In `docs/2026-03-15/01-web-parity-plan.md`, change:

| Feature | Current Status | New Status |
|---------|---------------|------------|
| Voices: Preview audio (waveform) | Missing | Done (play/pause bar) OR Missing (no backend endpoint) |
| Generate: Waveform visualization | Missing | Done (play/pause progress bar) |
| Clone: Waveform preview of recording | Missing | Done (play/pause progress bar) |

---

## Prompt

```
We're continuing work on the Expo React Native mobile app for our Utter project.

**Context:**
- Worktree: C:\Users\Duncan\Desktop\utter-mobile (branch: feat/mobile-app)
- Mobile app: mobile/ directory (Expo SDK 54, expo-router v6, React 19.1.0)
- The app runs on Expo Go on a physical device, connected to production backend
- Session docs: docs/2026-03-16/07-audio-player-component.md (this plan)

**Task: Build AudioPlayerBar component and integrate across screens**

Read docs/2026-03-16/07-audio-player-component.md for the full plan.

1. **Build `mobile/components/AudioPlayerBar.tsx`** — a reusable play/pause + progress bar + time display component that accepts an `expo-audio` `AudioPlayer` instance. See the plan for the visual spec and behavior.

2. **Integrate into Generate screen** (`generate.tsx`) — replace the "Play" / "Playing..." text button on completed tasks with the AudioPlayerBar. Keep the Share button alongside.

3. **Integrate into History screen** (`history.tsx`) — show AudioPlayerBar in the card of the currently-playing generation. Other cards keep the "Play" text button.

4. **Integrate into Design screen** (`design.tsx`) — replace "Play Again" in the "Preview Ready" card with AudioPlayerBar.

5. **Integrate into Voices screen** (`index.tsx`) — check if the `Voice` type has a `preview_url` or similar field. If yes, add a Preview button + AudioPlayerBar. If not, skip this screen and note it in the commit message.

6. **(Stretch) Clone screen** (`clone.tsx`) — add AudioPlayerBar for recording preview after recording stops, if time permits.

Run `npx tsc --noEmit` from mobile/ after changes. Commit the component first, then integrations together or per-screen.

**Post-session docs update (required):**
After all items are done:
1. Update docs/2026-03-15/01-web-parity-plan.md — change completed features from Missing to Done
2. Add a Completed section to docs/2026-03-16/07-audio-player-component.md
3. Commit the doc updates separately: `docs(mobile): update parity plan after audio player component`
```
