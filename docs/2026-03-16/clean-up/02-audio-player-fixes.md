# Plan 02: AudioPlayerBar Fixes

**Severity:** Critical + High
**Est:** 0.5 session
**Files:** `mobile/components/AudioPlayerBar.tsx`, consumers across all screens

## Problem

The `AudioPlayerBar` component has a render-time side effect that can cause infinite loops, plus UX gaps in seeking and icon rendering.

### 2.1 Side effect in render body (Critical)

`player.seekTo(0)` is called directly in the render function when `status.didJustFinish` is true:

```tsx
function AudioPlayerBarInner({ player, trackWidthRef }) {
  const status = useAudioPlayerStatus(player);
  // ...
  if (status.didJustFinish) {
    player.seekTo(0);  // SIDE EFFECT IN RENDER
  }
```

This can cause:
- Double-seek in React Strict Mode
- Seek during render before the component is committed to the DOM
- Infinite re-render loop if `seekTo` triggers a status update that re-renders with `didJustFinish` still true

**Fix:** Move to a `useEffect`:

```tsx
useEffect(() => {
  if (status.didJustFinish) {
    player.seekTo(0);
  }
}, [status.didJustFinish, player]);
```

### 2.2 Seek bar is tap-only, no drag (Medium)

The seek bar uses `TouchableOpacity.onPress` for seeking. Users can only tap to seek — no drag-to-scrub support. This feels unresponsive compared to native audio players.

**Fix:** Replace with a `PanResponder` or use `react-native-gesture-handler`'s `GestureDetector`:

```tsx
const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => seekToX(e.nativeEvent.locationX),
    onPanResponderMove: (e) => seekToX(e.nativeEvent.locationX),
  })
).current;

// On the track View:
<View {...panResponder.panHandlers} onLayout={onTrackLayout}>
```

### 2.3 Play/pause uses emoji text characters (Low)

```tsx
<Text>{isPlaying ? '❚❚' : '▶'}</Text>
```

Emoji rendering varies across Android manufacturers. Some render `▶` as a colored emoji rather than a monochrome glyph.

**Fix:** Use `@expo/vector-icons` (already available in Expo):

```tsx
import { Ionicons } from '@expo/vector-icons';
<Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color="#fff" />
```

### 2.4 `trackWidthRef` cast is unsafe (Low)

```tsx
(trackWidthRef as React.MutableRefObject<number>).current = e.nativeEvent.layout.width;
```

The prop type is `React.RefObject<number>` but it's force-cast to `MutableRefObject`.

**Fix:** Type the prop as `React.MutableRefObject<number>` directly.

### 2.5 generate.tsx: `player.play()` may fire before loaded (High)

```tsx
useEffect(() => {
  if (audioUri && player) {
    player.play();
  }
}, [audioUri, player]);
```

`player` is recreated by `useAudioPlayer` when `audioUri` changes. The new player may not be loaded yet.

**Fix:** Guard with loaded state:

```tsx
const status = useAudioPlayerStatus(player);
useEffect(() => {
  if (audioUri && player && status.isLoaded) {
    player.play();
  }
}, [audioUri, player, status.isLoaded]);
```

Same pattern applies in `design.tsx`.

## Acceptance criteria

- [ ] No side effects in render body — `seekTo(0)` moved to `useEffect`
- [ ] Drag-to-seek works on the progress bar
- [ ] Play/pause icons render consistently on iOS and Android (vector icons)
- [ ] Auto-play waits for player to be loaded before calling `play()`
- [ ] `trackWidthRef` prop typed correctly without cast
