# Plan 06: UX Polish

**Severity:** Medium
**Est:** 1 session
**Files:** Multiple screens + new utilities

## Problem

Several medium-severity UX issues that affect daily usability but aren't broken: keyboard covering inputs, polling when off-screen, form persistence exceeding storage limits, missing accessibility labels, and the ElapsedTimer interval churn.

### 6.1 No `KeyboardAvoidingView` (Medium — 4 screens)

None of the screens with text inputs handle keyboard avoidance. On iOS, the keyboard covers form inputs at the bottom of the screen. On Android, behavior is unpredictable depending on `windowSoftInputMode`.

**Affected screens:**
- `generate.tsx` — multiline text area at bottom
- `design.tsx` — description + sample text inputs
- `clone.tsx` — name + transcript inputs
- `sign-in.tsx` — email + password inputs
- `account.tsx` — display name input

**Fix:** Wrap `ScrollView` content in `KeyboardAvoidingView`:

```tsx
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
>
  <ScrollView>
    {/* screen content */}
  </ScrollView>
</KeyboardAvoidingView>
```

For screens using `FlatList`, use `FlatList`'s `keyboardShouldPersistTaps="handled"` prop instead.

Also add `returnKeyType="done"` on single-line inputs and `blurOnSubmit={false}` on multiline inputs to improve keyboard dismissal behavior.

### 6.2 Polling continues when screen not focused (Medium — tasks.tsx)

The Tasks screen polls every 3 seconds even when the user navigates away:

```tsx
useEffect(() => {
  if (statusFilter !== 'active') return;
  const id = setInterval(() => { void fetchTasks(); }, 3000);
  return () => clearInterval(id);
}, [fetchTasks, statusFilter]);
```

**Fix:** Gate polling on screen focus using `useIsFocused` from `@react-navigation/native` (available via expo-router):

```tsx
import { useIsFocused } from '@react-navigation/native';

const isFocused = useIsFocused();

useEffect(() => {
  if (statusFilter !== 'active' || !isFocused) return;
  const id = setInterval(() => { void fetchTasks(); }, 3000);
  return () => clearInterval(id);
}, [fetchTasks, statusFilter, isFocused]);
```

### 6.3 SecureStore 2KB limit for form persistence (Medium — generate.tsx, design.tsx)

`formPersistence.ts` uses SecureStore, which has a 2KB value limit on iOS. The Generate screen allows 5000 chars of text — serialized form state can easily exceed 2KB, causing a silent write failure.

**Fix:** Switch form persistence from SecureStore to AsyncStorage:

```bash
npx expo install @react-native-async-storage/async-storage
```

Update `formPersistence.ts`:
```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveFormState<T>(key: string, state: T) {
  await AsyncStorage.setItem(`form_${key}`, JSON.stringify(state));
}

export async function loadFormState<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(`form_${key}`);
  return raw ? JSON.parse(raw) : null;
}
```

### 6.4 `ElapsedTimer` interval churns every second (Medium — generate.tsx, design.tsx)

`ElapsedTimer` takes `startedAt` as a prop. Since the task object is a new reference every poll cycle (every 1s), `startedAt` technically changes identity each render, causing the interval to tear down and recreate every second.

**Fix:** Use a ref for `startedAt`:

```tsx
function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState('');
  const startRef = useRef(startedAt);
  startRef.current = startedAt;

  useEffect(() => {
    const update = () => setElapsed(formatElapsed(Date.now() - startRef.current));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []); // stable — reads startedAt from ref

  return <Text>{elapsed}</Text>;
}
```

### 6.5 No tab bar icons (Medium — `_layout.tsx`)

All four tabs (Voices, Generate, Design, History) show text-only labels with no icons. On both iOS and Android the tab bar is designed for icon + label — text-only tabs look empty/broken and are harder to tap.

**Fix:** Add `tabBarIcon` to each `Tabs.Screen` using `@expo/vector-icons` (bundled with Expo):

```tsx
import { Ionicons } from '@expo/vector-icons';

<Tabs.Screen
  name="index"
  options={{
    title: 'Voices',
    tabBarIcon: ({ color, size }) => <Ionicons name="mic-outline" size={size} color={color} />,
  }}
/>
<Tabs.Screen
  name="generate"
  options={{
    title: 'Generate',
    tabBarIcon: ({ color, size }) => <Ionicons name="volume-high-outline" size={size} color={color} />,
    tabBarBadge: activeCount > 0 ? activeCount : undefined,
  }}
/>
<Tabs.Screen
  name="design"
  options={{
    title: 'Design',
    tabBarIcon: ({ color, size }) => <Ionicons name="color-wand-outline" size={size} color={color} />,
  }}
/>
<Tabs.Screen
  name="history"
  options={{
    title: 'History',
    tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
  }}
/>
```

### 6.6 Voices and Account appear to go to same place (Medium — navigation)

The Voices tab (`index.tsx`) header has a small account button (right side) that pushes `/account`. Because there are no icons and Account is a plain screen (not a modal with distinct presentation), users perceive Voices and Account as the same destination. The account button blends into the header with no visual distinction.

**Fix:**
- Present `/account` as a modal (`presentation: 'modal'` in `_layout.tsx` — already the case for `clone` and `tasks`, but verify `account` matches)
- Give the account header button a recognizable icon (person-circle) instead of plain text
- Consider adding a subtle avatar/initials circle to make it visually distinct

### 6.7 Clone has no standalone tab — only accessible from header button (Medium — navigation)

Clone is a modal triggered from a small "+ Clone" button in the Voices header. Users may not discover it. On web, Clone is a top-level nav item.

**Options (pick one):**
- **A) Add Clone as a 5th tab** with `tabBarIcon` — most discoverable, but 5 tabs is the iOS max
- **B) Keep as modal but add a prominent FAB (floating action button)** on the Voices screen — less tab clutter, still visible
- **C) Keep current approach** but make the header button more prominent (larger, icon + label, accent color)

Recommendation: Option C is the least disruptive. Make the "+ Clone" button visually prominent with an accent background and icon:

```tsx
headerRight: () => (
  <TouchableOpacity
    onPress={() => router.push('/clone')}
    style={{
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginRight: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    }}
  >
    <Ionicons name="add" size={16} color="#000" />
    <Text style={{ color: '#000', fontWeight: '600', fontSize: 13 }}>Clone</Text>
  </TouchableOpacity>
),
```

### 6.8 Missing accessibility labels (Low — all screens)

All `TouchableOpacity` buttons use child `<Text>` for labels but have no `accessibilityLabel` or `accessibilityRole`. Screen readers (TalkBack on Android, VoiceOver on iOS) won't identify them as actionable.

**Fix:** Add to all interactive elements:

```tsx
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel="Delete voice"
  onPress={handleDelete}
>
```

Priority targets: primary action buttons (Generate, Clone, Save, Delete, Play/Pause), navigation buttons, filter toggles.

### 6.9 `_layout.tsx` — Auth gate flash on cold start (Medium)

When the app cold-starts, the loading spinner shows briefly, then the sign-in screen flashes before redirecting to `/(tabs)` for authenticated users.

**Fix:** Use `expo-splash-screen` to hold the splash until auth resolves:

```tsx
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null; // splash screen still visible
  // ... rest of routing logic
}
```

## Implementation order

1. **6.5** — Tab bar icons (most visually obvious gap)
2. **6.7** — Clone button prominence
3. **6.6** — Account navigation distinction
4. **6.4** — ElapsedTimer fix (quick, affects two screens)
5. **6.1** — KeyboardAvoidingView (biggest UX impact)
6. **6.3** — Form persistence migration to AsyncStorage
7. **6.2** — Focus-gated polling
8. **6.9** — Splash screen auth gate
9. **6.8** — Accessibility labels (can be done incrementally)

## Acceptance criteria

- [ ] All 4 tabs have icons from `@expo/vector-icons`
- [ ] Clone button is visually prominent (accent color, icon + label)
- [ ] Account opens as a modal with distinct presentation from Voices
- [ ] Keyboard does not cover text inputs on iOS or Android
- [ ] Tasks screen stops polling when navigated away from
- [ ] Form state persists correctly even with 5000+ char text (AsyncStorage)
- [ ] ElapsedTimer interval is stable (created once, not every second)
- [ ] Primary action buttons have `accessibilityRole="button"` and `accessibilityLabel`
- [ ] No sign-in screen flash for authenticated users on cold start
