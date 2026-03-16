# Mobile App: Web Parity Plan

> **Date**: 2026-03-15
> **Goal**: Bring the mobile app to 1:1 feature parity with the web frontend
> **Reference**: `docs/features.md` (ground truth feature list)

## Current state

The mobile scaffold covers the core happy paths: sign in, list voices, generate speech, design voices, and clone via file upload. The app launches on Expo Go and connects to the production backend.

## Feature gap analysis

### Legend

- Done = implemented and working in the scaffold
- Partial = screen exists but missing functionality
- Missing = no implementation yet

### Authentication

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| Email/password sign in | Yes | Yes | Done |
| Email/password sign up | Yes | Yes | Done |
| Magic link auth | Yes | No | Missing |
| Session persistence | localStorage | SecureStore | Done |
| Auto token refresh | Yes | Yes | Done |
| 401 retry with refresh | Yes | Yes | Done |

### Voices (`/voices`)

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| Voice list (FlatList) | Yes | Yes | Done |
| Source badge (Clone/Designed) | Yes | Yes | Done |
| Search with debounce | Yes | Yes | Done |
| Source filter (All/Clone/Designed) | Yes | Yes | Done |
| Pagination (20 per page) | Yes | Yes | Done |
| Skeleton loading | Yes | Yes | Done |
| Preview audio (waveform) | Yes | No | Missing |
| Generate from voice (navigate) | Yes | Yes | Done |
| Delete voice (confirmation) | Yes | Yes | Done |
| Search token highlighting | Yes | No | Missing |

### Generate (`/generate`)

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| Voice selector | Yes | Yes | Done |
| Language selector | Yes | Yes | Done |
| Text input with char counter | Yes | Yes | Done |
| Generate button with validation | Yes | Yes | Done |
| Task polling | Yes | Yes | Done |
| Active task badge on tab | Yes | Yes | Done |
| Multi-task tracking list | Yes | Yes | Done |
| Task selection UI | Yes | Yes | Done |
| Audio playback on completion | Yes | Yes | Done (expo-audio) |
| Waveform visualization | Yes | No | Missing (needs RN alternative) |
| Download audio | Yes | Yes | Done (Share sheet) |
| Form state persistence | localStorage | No | Missing |
| Voice pre-selection via param | URL params | Yes | Done |
| Elapsed time display | Yes | Yes | Done |

### Design (`/design`)

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| Voice name input | Yes | Yes | Done |
| Description textarea with counter | Yes | Yes | Done |
| Example prompt buttons | Yes | Yes | Done |
| Preview text input | Yes | Yes | Done |
| Language selector | Yes | Yes | Done |
| Generate preview (task) | Yes | Yes | Done |
| Preview audio playback | Yes | Yes | Done |
| Save to library | Yes | Yes | Done |
| Multi-preview tracking | Yes | Yes | Done |

### Clone (`/clone`)

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| File upload (pick from device) | Yes | Yes | Done |
| File validation (size/type) | Yes | Yes | Done (size + duration) |
| Drag-and-drop upload | Yes | N/A | Not applicable on mobile |
| Audio recording | Yes | No | Missing (needs expo-audio recording) |
| Microphone level meter | Yes | No | Missing |
| Recording timer | Yes | No | Missing |
| Waveform preview of recording | Yes | No | Missing |
| Auto-transcription | Yes | No | Missing |
| Voice name input | Yes | Yes | Done |
| Transcript textarea | Yes | Yes | Done |
| Language selector | Yes | Yes | Done |
| 3-step upload (URL, PUT, finalize) | Yes | Yes | Done |
| Example voice loader | Yes | Yes | Done |
| Success modal with navigation | Yes | Yes | Done (Alert + navigate to Generate) |

### History (`/history`)

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| Generation list | Yes | No | Missing (no screen) |
| Search/filter | Yes | No | Missing |
| Status filter | Yes | No | Missing |
| Pagination | Yes | No | Missing |
| Audio playback | Yes | No | Missing |
| Download audio | Yes | No | Missing |
| Regenerate (copy params) | Yes | No | Missing |
| Delete generation | Yes | No | Missing |
| Auto-refresh (5s) | Yes | No | Missing |

### Tasks (`/tasks`)

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| Task list view | Yes | No | Missing (no screen) |
| Status/type filters | Yes | No | Missing |
| Cancel task | Yes | No | Missing |
| Dismiss task | Yes | No | Missing |
| Navigate to source page | Yes | No | Missing |
| Auto-refresh (3s) | Yes | No | Missing |

### Account

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| Account overview | Yes | No | Missing (no screen) |
| Credit balance display | Yes | No | Missing |
| Credit pack purchase (Stripe) | Yes | No | Missing |
| Trial counters | Yes | No | Missing |
| Activity log | Yes | No | Missing |
| Profile management | Yes | No | Missing |
| Pricing info | Yes | No | Missing |

### Cross-cutting

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| Dark theme | Yes | Partial | Dark hardcoded, no light mode toggle |
| Error boundaries | Yes | Yes | Done |
| Skeleton loading states | Yes | Partial | Done on Voices, missing on other screens |
| Pull-to-refresh | N/A | Partial | Done on Voices, missing on other list screens |
| Haptic feedback | N/A | Yes | Done |
| Offline handling | No | No | Neither has it |

---

## Phased implementation plan

### Phase 1: Core polish (next session)

Priority: Make the existing 5 screens production-quality.

1. **Voices screen enhancements**
   - Source badges (Clone/Designed)
   - Pull-to-refresh
   - Delete voice with confirmation (swipe or long-press)
   - Navigate to Generate with voice pre-selected
   - Skeleton loading state
   - Empty state illustration

2. **Generate screen enhancements**
   - Character counter on text input (0/5000)
   - Elapsed time display during task
   - Multi-task tracking list (show recent generations)
   - Download audio (Share sheet on mobile)

3. **Design screen enhancements**
   - Character counters on description (500) and preview text (500)
   - Wire up preview audio playback on task completion
   - Multi-preview tracking

4. **Clone screen enhancements**
   - Audio duration validation
   - Example voice loader button

5. **General**
   - Error boundaries
   - Pull-to-refresh on all list screens
   - Haptic feedback on key actions (submit, success, error)

### Phase 2: Missing screens

Priority: Add the screens that don't exist yet.

1. **History screen** (`app/(tabs)/history.tsx` or new tab)
   - Generation list with status badges
   - Audio playback
   - Search, status filter, pagination
   - Regenerate action (navigate to Generate with params)
   - Delete with confirmation

2. **Account screen** (`app/account.tsx` or nested route)
   - Credit balance display
   - Trial counters (design previews, clone finalizations)
   - Recent activity timeline
   - Link to Stripe checkout (WebBrowser or in-app browser)

3. **Tasks screen** (optional -- could be a modal or sheet instead of tab)
   - Task list with filters
   - Cancel/dismiss actions

### Phase 3: Audio recording

Priority: The most complex mobile feature. Required for full clone parity.

1. **expo-audio recording integration**
   - `useAudioRecorder` hook from expo-audio
   - Microphone permission flow (already configured in app.json)
   - Start/stop/clear recording controls
   - Recording timer display
   - Save recording as file for upload

2. **Audio level visualization**
   - Real-time microphone level meter (RMS)
   - Recording state indicator (pulsing dot, level bars)

3. **Auto-transcription**
   - Upload recorded audio to `/api/transcriptions`
   - Display transcription result in transcript field
   - Loading state during transcription

4. **Mode toggle**
   - Upload vs Record mode (same as web)
   - Unified flow into 3-step clone process

### Phase 4: Audio visualization

Priority: Replace WaveSurfer.js with a React Native equivalent.

1. **Evaluate options**:
   - `react-native-audio-waveform` (native module, may need dev client)
   - Custom `<Canvas>` waveform with `@shopify/react-native-skia`
   - Simple progress bar as MVP (no waveform, just play/pause + time)

2. **Implement playback UI**
   - Play/pause button with progress
   - Time display (current / total)
   - Apply to: Voices preview, Generate result, Design preview, History playback

### Phase 5: Billing and account

Priority: Full account management.

1. **Credit purchase flow**
   - Display credit packs with pricing
   - Open Stripe checkout via `expo-web-browser`
   - Handle checkout return (deep link `utter://` scheme)
   - Refresh balance after purchase

2. **Profile management**
   - Display email
   - Password change (via Supabase)

3. **Usage/activity log**
   - Credit activity timeline
   - Purchases vs usage filter

### Phase 6: Polish and platform conventions

1. **Search and filtering**
   - Voice search with debounce
   - History search
   - Source/status filters with native segmented controls

2. **Pagination**
   - Infinite scroll (FlatList `onEndReached`) instead of page buttons
   - Loading more indicator

3. **Form state persistence**
   - AsyncStorage for Generate/Design form state
   - Restore on app reopen

4. **Keyboard handling**
   - KeyboardAvoidingView on form screens
   - Dismiss keyboard on scroll

5. **Accessibility**
   - VoiceOver/TalkBack labels
   - Minimum touch targets (44pt)
   - Dynamic type support

---

## Complexity estimates

| Phase | Effort | Key risk |
|-------|--------|----------|
| Phase 1: Core polish | Small | None -- straightforward UI work |
| Phase 2: Missing screens | Medium | History screen needs audio playback integration |
| Phase 3: Audio recording | Large | expo-audio recording API maturity, permission edge cases |
| Phase 4: Audio visualization | Medium | May need dev client if using native waveform library |
| Phase 5: Billing | Medium | Stripe deep link return flow on mobile |
| Phase 6: Polish | Medium | Pagination + search patterns are repetitive but time-consuming |
