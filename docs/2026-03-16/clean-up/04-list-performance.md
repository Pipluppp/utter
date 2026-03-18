# Plan 04: FlatList Performance

**Severity:** High
**Est:** 1 session
**Files:** `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/history.tsx`, `mobile/app/tasks.tsx`

## Problem

All three list screens share the same performance anti-patterns: inline `renderItem`, inline style objects, double API calls on filter changes, and missing FlatList optimizations. These cause frame drops on mid-range Android devices and unnecessary network traffic.

### 4.1 Inline `renderItem` causes full list re-render (High — all 3 screens)

The `renderItem` callback is defined inline in JSX. Every state change (search keystroke, poll tick, delete action) creates a new function reference, forcing FlatList to re-render every visible cell.

**Fix per screen:**

**Voices (index.tsx):** Extract a `VoiceCard` component wrapped in `React.memo`:

```tsx
const VoiceCard = React.memo(function VoiceCard({
  voice, highlight, onGenerate, onDelete, isDeleting,
}: VoiceCardProps) {
  return (
    <View style={styles.card}>
      {/* ... */}
    </View>
  );
});

// In the parent:
const renderVoice = useCallback(
  ({ item }: { item: Voice }) => (
    <VoiceCard
      voice={item}
      highlight={debouncedSearch}
      onGenerate={handleGenerate}
      onDelete={handleDelete}
      isDeleting={deletingId === item.id}
    />
  ),
  [debouncedSearch, handleGenerate, handleDelete, deletingId],
);
```

**History (history.tsx):** Extract `GenerationCard` with `React.memo`.

**Tasks (tasks.tsx):** Extract `TaskCard` with `React.memo`. Note: `renderTask`'s `useCallback` deps include `getStatusText` which is unstable (fixed in Plan 01). After Plan 01, this will be stable.

### 4.2 Inline style objects recreated every render (High — all 3 screens)

Every `style={{ ... }}` literal inside render creates a new object every render. This is the single most common RN performance anti-pattern.

**Fix:** Extract all styles to `StyleSheet.create` at module level:

```tsx
const styles = StyleSheet.create({
  card: { backgroundColor: '#111', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  // ...
});
```

For dynamic styles (e.g., colors based on status), use a helper that returns a cached style object or use `useMemo`.

### 4.3 Double-fetch on filter/search change (Medium — index.tsx, history.tsx)

When `debouncedSearch` or filter state changes, two effects fire:
1. Effect that resets `page` to 1
2. Effect on `[fetchFn, page]` that calls the fetch function

But `fetchFn` also changes (because it depends on search/filter), so the fetch effect fires **twice** — once for the `fetchFn` dep change and once for the `page` dep change.

**Fix:** Combine into a single effect:

```tsx
useEffect(() => {
  setPage(1);
  fetchVoices(1, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [debouncedSearch, source]);
```

Or use `useRef` for page and remove it from the fetch effect deps.

Also fix `onRefresh` which sets `page(1)` AND calls `fetchVoices(1, false)` — the page setter triggers the other effect, causing a second fetch.

### 4.4 Missing `getItemLayout` (Medium — all 3 screens)

Without `getItemLayout`, FlatList must measure each cell on the main thread during scroll. For uniform-height rows, provide it:

```tsx
getItemLayout={(_, index) => ({
  length: ITEM_HEIGHT,
  offset: ITEM_HEIGHT * index,
  index,
})}
```

If row heights vary (e.g., text wraps), skip this — but ensure `removeClippedSubviews` is set on Android.

### 4.5 `HighlightedText` regex not memoized (Low — index.tsx)

A new `RegExp` is constructed inside the render path for every list item:

```tsx
const regex = new RegExp(`(${escaped})`, 'gi');
```

**Fix:** Memoize the regex upstream and pass it as a prop, or wrap `HighlightedText` in `React.memo`.

### 4.6 history.tsx auto-refresh interval resets every cycle (Critical)

`generations` is in the `useEffect` dependency array for the auto-refresh interval. Every fetch completion changes `generations`, tearing down and recreating the interval. It never reaches a steady 5s cadence.

**Fix:** Use a ref to check for active generations instead of putting the array in deps:

```tsx
const generationsRef = useRef(generations);
generationsRef.current = generations;

useEffect(() => {
  const id = setInterval(() => {
    const hasActive = generationsRef.current.some(
      g => g.status === 'pending' || g.status === 'processing'
    );
    if (hasActive) void fetchGenerations(1, false);
  }, 5000);
  return () => clearInterval(id);
}, [fetchGenerations]);
```

## Implementation order

1. **4.6** — Fix history auto-refresh interval (critical, quick)
2. **4.3** — Fix double-fetch on filter changes (all screens)
3. **4.1** — Extract memoized card components (biggest impact)
4. **4.2** — Extract `StyleSheet.create` (can be done during 4.1)
5. **4.4** — Add `getItemLayout` where feasible
6. **4.5** — Memoize HighlightedText regex

## Acceptance criteria

- [ ] History auto-refresh fires at steady 5s intervals (no teardown/recreate)
- [ ] Filter/search changes cause exactly 1 API call, not 2
- [ ] React DevTools profiler shows memoized row components skip re-render when parent state changes
- [ ] All inline styles extracted to `StyleSheet.create`
- [ ] Scrolling voices list with 40+ items shows no frame drops on mid-range Android
