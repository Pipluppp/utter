# UI/UX Task Spec — 2026-02-27

27 tasks. Frontend-only. Ordered by user impact.

---

## State & Notification

These four tasks fix the same root problem: users lose track of background work.
Generation takes 30-120 seconds. Users navigate away. When they come back, the
result is gone. They only find it by checking History. This is the single biggest
UX friction in the app today.

---

### Task 1 — Persist last generation/design result

**The problem**

`Generate.tsx:168` calls `clearTask('generate')` after a 50ms timeout the moment
the completion handler fires. This wipes the task from localStorage and
TaskProvider state. If the user navigates away and returns, the page renders a
blank form — no audio player, no result, no indication that anything happened.

`Design.tsx:242` has the identical pattern: `clearTask('design')` after 50ms.

`TaskProvider.tsx:52` also prunes any task older than 30 minutes via
`MAX_TASK_AGE_MS = 30 * 60 * 1000`, so even if the clear didn't fire, the task
eventually vanishes.

**What exists today**

- `TaskProvider` stores tasks in localStorage keyed by type (`utter:task:generate`,
  `utter:task:design`). One task per type.
- Each task carries `formState` (voice ID, text, language) and `result` (audio URL,
  generation ID, duration).
- On page mount, `Generate.tsx:77-111` restores form fields from `task.formState`.
- The terminal handler (`Generate.tsx:134-169`) resolves the audio URL, sets it in
  component state, then nukes the task.
- After `clearTask`, the resolved `audioUrl` lives only in React state. A page
  navigation destroys it.

**Goal**

After a generation or design preview completes, returning to the page shows the
last result — audio player, form inputs, download button — until the user
explicitly starts a new one.

**Approach**

- Introduce a `lastResult` localStorage key per task type
  (`utter:lastResult:generate`, `utter:lastResult:design`).
- When the terminal handler resolves a completed task, write the result (audio URL,
  form state, completion time) to `lastResult` before calling `clearTask`.
- On page mount, if no active task exists, hydrate from `lastResult` — restore form
  fields and render the audio player.
- Clear `lastResult` when the user clicks "Generate Speech" or "Generate Preview"
  (starting a new task).
- Give `lastResult` a reasonable TTL (e.g. 24 hours) so stale results don't persist
  forever.

**Files to change**

- `frontend/src/pages/Generate.tsx` — write lastResult on completion, read on mount
- `frontend/src/pages/Design.tsx` — same pattern
- `frontend/src/lib/storage.ts` — optional: add TTL-aware read/write helpers

---

### Task 2 — Task completion notification

**The problem**

When a generation finishes while the user is on another page, nothing visible
happens. The TaskDock badge may update, but there's no sound, no browser
notification, no visual pulse. Users routinely don't notice completions and only
discover them by manually checking History.

**What exists today**

- `TaskProvider.tsx:260-317` polls active tasks every 1 second. When a task reaches
  terminal state (`completed`, `failed`, `cancelled`), it updates localStorage and
  dispatches to state. No side effects beyond state mutation.
- `TaskDock.tsx` renders task rows with elapsed time. Completed tasks show "Ready"
  text but no visual distinction from in-progress tasks. No animation, no sound.
- `TaskBadge.tsx` shows an active task count in the nav. It reflects `activeCount`
  from context — once a task completes, the count drops, but there's no "just
  completed" transition.

**Goal**

Users are clearly notified when a task completes, regardless of which page they're
on.

**Approach**

- In `TaskProvider`, when a task transitions to a terminal state, fire a callback.
- Use the browser `Notification` API (with permission request on first generation)
  to show "Generation complete — click to listen" or "Generation failed".
- Play a short audio chime (~200ms, embedded as base64 data URI) on completion.
  Respect user preference — add a `utter:notificationSound` localStorage toggle.
- In `TaskDock`, add a brief highlight animation (border flash or background pulse)
  on newly completed tasks. Use a `justCompleted` flag that auto-clears after 3
  seconds.
- Respect `prefers-reduced-motion` — skip animation, keep sound/notification.

**Files to change**

- `frontend/src/components/tasks/TaskProvider.tsx` — terminal state side effect
- `frontend/src/components/tasks/TaskDock.tsx` — completion highlight animation
- New: notification permission request UI (inline prompt or settings toggle)

---

### Task 3 — TaskDock click-through carries result

**The problem**

`TaskDock.tsx:80-94` wraps each task row in `<NavLink to={task.originPage}>`. When
a user clicks a completed generate task, they navigate to `/generate` — but by that
point `clearTask` has already run (task 1), so the page shows a blank form. The
click leads nowhere useful.

**What exists today**

- Each `StoredTask` has `originPage` (set to `/generate` or `/design` on creation).
- `TaskDock` uses `NavLink` for navigation. No state or params are passed.
- The task's `result` object (containing `audio_url`, `generation_id`, `duration`)
  is available in `StoredTask` until `clearTask` runs.

**Goal**

Clicking a completed task in the TaskDock navigates to the origin page with the
result visible.

**Approach**

- This is largely solved by task 1 (persisting `lastResult`). Once the last result
  survives in localStorage, clicking through to `/generate` will hydrate it.
- Additionally, pass result data via React Router's `state` parameter as a fallback:
  `<NavLink to={task.originPage} state={{ taskResult: task.result }}>`.
- On the Generate/Design page, check `location.state?.taskResult` on mount and use
  it if `lastResult` is empty (covers edge cases where localStorage was cleared).
- After task 1 is implemented, validate that this flow works end-to-end.

**Files to change**

- `frontend/src/components/tasks/TaskDock.tsx` — pass state in NavLink
- `frontend/src/pages/Generate.tsx` — read location.state fallback
- `frontend/src/pages/Design.tsx` — same

**Depends on**: Task 1

---

### Task 4 — Task progress bar in TaskDock

**The problem**

`TaskDock.tsx` shows only elapsed time ("0:32") with no visual indicator of
progress. Users can't tell at a glance whether a task just started, is midway, or
is almost done. The only visual distinction is the text label from
`getStatusText()`: "Waiting for GPU...", "Generating...", etc.

**What exists today**

- `TaskDock.tsx:91-92` renders elapsed time via `formatTaskElapsed(task)`.
- `TaskProvider.tsx:184-194` returns status text based on `task.status` and
  `task.modalStatus` (pending/queued/processing/sending).
- No percentage, no progress bar, no indeterminate animation.

**Goal**

Each task row in the dock has a thin progress bar that gives users a sense of
forward motion.

**Approach**

- Add an indeterminate progress bar (CSS-animated left-to-right shimmer) below each
  task row for `pending`/`processing` states.
- For an estimated progress bar: use typical generation times as heuristics. Store
  `estimatedDurationMs` in task metadata based on text length (rough: 30s for short,
  90s for long). Calculate `elapsed / estimated` as a percentage, capped at 95%
  until actual completion.
- On `completed`: bar fills to 100% with a brief green flash.
- On `failed`/`cancelled`: bar turns red.
- Respect `prefers-reduced-motion` — use static fill instead of shimmer animation.
- Implemented as a `<ProgressBar>` sub-component inside TaskDock, not a standalone
  UI component (this is task-specific).

**Files to change**

- `frontend/src/components/tasks/TaskDock.tsx` — add progress bar per task row
- `frontend/src/styles/index.css` — shimmer keyframes if not using Tailwind animate

---

## New Pages

---

### Task 5 — 404 page

**The problem**

`router.tsx` defines routes for `/`, `/clone`, `/generate`, `/design`, `/voices`,
`/history`, `/auth`, `/about`, `/privacy`, `/terms`, and `/account/*`. There is no
`*` catch-all. Navigating to any undefined path (e.g. `/settings`, `/asdf`,
`/dashboard`) renders a blank white screen — no message, no navigation, no way
back.

**What exists today**

- `frontend/src/app/router.tsx` uses `createBrowserRouter` with `createRoutesFromElements`.
  All routes are explicit. No wildcard fallback.
- The `Layout` component wraps all routes, so the header/footer render — but the
  content area is empty for unmatched paths.

**Goal**

Unmatched URLs show a styled "Page not found" screen with navigation back to the
app.

**Approach**

- Create `frontend/src/pages/NotFound.tsx` — minimal page matching the app's design
  language: "404 — Page not found" heading, brief text, and a "Go home" link.
- Add a `<Route path="*" element={<NotFound />} />` as the last child in the router.
- Keep it inside the `Layout` wrapper so header/footer remain visible.

**Files to change**

- New: `frontend/src/pages/NotFound.tsx`
- `frontend/src/app/router.tsx` — add catch-all route

---

### Task 6 — Forgot password flow

**The problem**

`Auth.tsx` supports email+password sign-in and magic link sign-in. If a user
created an account with a password and forgets it, there is no recovery path. No
"Forgot password?" link exists anywhere. The user is permanently locked out unless
they happen to also try magic link with the same email.

**What exists today**

- `Auth.tsx` has two modes: `password` and `magic_link`, toggled by user.
- Password mode (lines 507-522) renders email + password fields.
- Supabase Auth SDK provides `supabase.auth.resetPasswordForEmail(email)` which
  sends a password reset link — this is never called.
- The auth page has no mention of password reset or recovery.

**Goal**

Users who forget their password can reset it via email.

**Approach**

- Add a "Forgot password?" link below the password field in `Auth.tsx` password
  mode.
- Clicking it shows a compact inline form: email input + "Send reset link" button.
- On submit, call `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
- Show success message: "Check your email for a password reset link."
- The reset link redirects to a `/auth/reset` route (or a query param on `/auth`)
  where the user enters a new password via `supabase.auth.updateUser({ password })`.
- Handle errors (user not found, rate limit) with inline messages.

**Files to change**

- `frontend/src/pages/Auth.tsx` — add forgot password UI + API call
- `frontend/src/app/router.tsx` — add reset callback route if needed
- `frontend/src/lib/supabase.ts` — already initialized, no changes needed

---

### Task 7 — Settings page

**The problem**

`Profile.tsx:225-250` renders two disabled controls ("Default export format" and
"Default language") and a disabled "Delete account" button. These look like broken
features rather than intentionally deferred ones. There's no Settings page in the
account section — preferences and danger zone actions have no home.

**What exists today**

- `AccountLayout.tsx` renders a sidebar with three items: Profile, Credits (Usage),
  Billing. No Settings entry.
- `Profile.tsx` mixes identity fields (name, handle, avatar) with stub preference
  controls and a danger zone. The preferences default to "WAV" and "Auto" but can't
  be changed.
- `router.tsx` has no `/account/settings` route.

**Goal**

A dedicated Settings page that houses user preferences and account danger zone
actions, keeping Profile focused on identity.

**Approach**

- Create `frontend/src/pages/account/Settings.tsx`.
- Move the "Preferences" card and "Danger zone" card from Profile.tsx to Settings.
- Enable the preference dropdowns — store defaults in localStorage initially. If
  backend support is added later, sync via `/api/profile` PATCH.
- For "Delete account": add a confirmation dialog (uses the Dialog component from
  task 9) that explains consequences and requires typing "DELETE" to confirm. Wire
  to `supabase.auth.admin.deleteUser()` or a dedicated edge function.
- Add "Settings" to the AccountLayout sidebar nav, positioned after Billing.
- Clean up Profile.tsx — remove the preferences and danger zone sections.

**Files to change**

- New: `frontend/src/pages/account/Settings.tsx`
- `frontend/src/pages/account/Profile.tsx` — remove preferences + danger zone
- `frontend/src/app/router.tsx` — add `/account/settings` route
- `frontend/src/pages/account/AccountLayout.tsx` — add Settings nav item

---

## New Components

---

### Task 8 — Toast notification system

**The problem**

Every success or error message is a static `<Message>` banner rendered inline on
the page. There are 11 `<Message>` instances across the app. These banners persist
until navigation — there's no transient "Voice deleted!" or "Copied!" feedback.
After destructive actions like delete, the page reloads data but gives no
confirmation beyond the item disappearing.

**What exists today**

- `frontend/src/components/ui/Message.tsx` renders `error`, `success`, or `info`
  variants as block-level alert banners with `role="alert"` and `aria-live`.
- Usage: `Generate.tsx:247`, `Design.tsx:309-310`, `Clone.tsx:563,565`,
  `History.tsx:220`, `Voices.tsx:184`, `Auth.tsx:416,462,467,472`.
- No toast/snackbar component. No notification queue or auto-dismiss.

**Goal**

Transient success/error/info messages appear in a corner, auto-dismiss after a few
seconds, and stack if multiple fire in sequence.

**Approach**

- Create a `ToastProvider` context + `useToast()` hook.
- Toast container renders in a fixed position (bottom-right or top-right), above
  the TaskDock (z-index coordination).
- Each toast: icon + message text + optional dismiss button. Auto-dismiss after 4
  seconds (configurable). Entrance/exit animation (slide in, fade out).
- Variants: `success` (green), `error` (red, longer auto-dismiss: 6s), `info`
  (neutral).
- Accessible: `role="status"`, `aria-live="polite"` for info/success,
  `aria-live="assertive"` for errors.
- Do NOT replace all existing `<Message>` banners — toasts are for transient
  confirmations (delete, save, copy). Persistent form validation errors should
  remain as inline `<Message>` banners.
- Use toasts for: voice deleted, generation deleted, profile saved, clone started,
  link copied.

**Files to change**

- New: `frontend/src/components/ui/Toast.tsx` (component)
- New: `frontend/src/components/ui/ToastProvider.tsx` (context + hook)
- `frontend/src/app/Layout.tsx` or root — wrap with ToastProvider
- Pages that perform delete/save actions — call `useToast().toast()`

---

### Task 9 — Modal / Dialog component

**The problem**

`Voices.tsx:152` calls `confirm('Delete voice "..."?')` and `History.tsx:170` calls
`confirm('Delete generation?')`. The browser's native `confirm()` dialog is
unstyled, blocks the main thread, can't include custom content, and is not
accessible by modern standards.

**What exists today**

- Two `confirm()` calls — both for destructive delete actions.
- No modal, dialog, or overlay component in the UI library.
- `InfoTip.tsx` exists as a popover but is designed for small tooltips, not
  confirmation dialogs.

**Goal**

A reusable `<Dialog>` component for confirmations, warnings, and informational
overlays. Replaces native `confirm()` with a styled, accessible modal.

**Approach**

- Build on the native `<dialog>` HTML element for built-in focus trapping and
  backdrop.
- API: `<Dialog open={boolean} onClose={fn} title={string}>` with children for body
  content and a footer slot for action buttons.
- Focus management: auto-focus the primary action button on open, trap focus within
  dialog, restore focus on close.
- Escape key closes the dialog (native `<dialog>` behavior).
- Backdrop click closes (configurable via `dismissable` prop).
- Accessible: `role="dialog"`, `aria-labelledby` pointing to title,
  `aria-describedby` pointing to body.
- Destructive variant: primary button styled red for delete confirmations.
- Replace `confirm()` in Voices.tsx and History.tsx with the new component.
- Future use: account deletion (task 7), task cancellation, data export
  confirmation.

**Files to change**

- New: `frontend/src/components/ui/Dialog.tsx`
- `frontend/src/pages/Voices.tsx` — replace confirm() with Dialog
- `frontend/src/pages/History.tsx` — replace confirm() with Dialog

---

### Task 10 — Skeleton loader component

**The problem**

Eight locations across the app show bare "Loading..." text while data fetches:

| File | Line | Context |
|------|------|---------|
| `About.tsx` | 74 | Language list |
| `Generate.tsx` | 266 | Voice dropdown |
| `History.tsx` | 254 | Generation list |
| `History.tsx` | 270 | Audio play button |
| `Voices.tsx` | 217 | Voice list |
| `Voices.tsx` | 233 | Preview button |
| `Billing.tsx` | 88 | Status row |
| `Profile.tsx` | 183 | Auth status |

This makes the app feel slow and unfinished. Skeleton loaders (pulsing gray shapes
that match the layout of the content being loaded) create the perception of faster
loading and smoother experience.

**What exists today**

- No skeleton component in `frontend/src/components/ui/`.
- All loading states use conditional text rendering.

**Goal**

A `<Skeleton>` component (pulsing rectangle) and a few composed skeleton layouts
(card skeleton, table row skeleton) that replace "Loading..." text.

**Approach**

- `<Skeleton>` base component: a `<div>` with `animate-pulse bg-muted rounded`
  styling. Props: `width`, `height`, `className` for sizing.
- Composed variants:
  - `<SkeletonCard>` — matches voice/history card layout (title bar + 2 text lines
    + button row).
  - `<SkeletonRow>` — matches table row in Usage/Billing.
  - `<SkeletonText>` — single line of varying width.
- Replace loading states incrementally — start with Voices and History list pages
  (most visible), then Profile and Billing.
- Respect `prefers-reduced-motion` — use static gray instead of pulse animation.

**Files to change**

- New: `frontend/src/components/ui/Skeleton.tsx`
- `frontend/src/pages/Voices.tsx` — skeleton cards while loading
- `frontend/src/pages/History.tsx` — skeleton cards while loading
- `frontend/src/pages/account/Profile.tsx` — skeleton fields while loading
- `frontend/src/pages/account/Billing.tsx` — skeleton rows while loading
- Others as time allows

---

## Page-Level Fixes

---

### Task 11 — Generate: no-voices empty state

**The problem**

`Generate.tsx:256-274` renders the voice `<Select>` dropdown. When the user has
zero voices, the dropdown shows "Select a voice" with no options beneath it. A new
user who just signed up and navigated to `/generate` has no idea they need to clone
or design a voice first. The submit button is disabled but there's no explanation.

**What exists today**

- Voice dropdown: `<option value="">{loadingVoices ? 'Loading...' : 'Select a voice'}</option>`
  followed by `voices?.voices.map(...)`.
- No conditional rendering for empty voice list.
- No link to `/clone` or `/design`.

**Goal**

When the user has no voices, show a clear message with action links instead of (or
alongside) the empty dropdown.

**Approach**

- After voices finish loading, if `voices.voices.length === 0`, render an empty
  state block: "You don't have any voices yet. Clone a voice from audio or design
  one from a description."
- Include two action links/buttons: "Clone a voice" → `/clone`, "Design a voice" →
  `/design`.
- Keep the form visible but disable the voice dropdown (already disabled by
  `canSubmit` check).
- Style consistently with the empty states in Voices.tsx and History.tsx.

**Files to change**

- `frontend/src/pages/Generate.tsx` — add empty state conditional

---

### Task 12 — Clone: upload progress bar

**The problem**

`Clone.tsx:476-484` uploads audio using `fetch()`:

```typescript
const uploadRes = await fetch(upload_url, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': contentTypeForFile(file) },
})
```

`fetch()` provides no upload progress events. For a 50MB file on a slow connection,
the user sees the submit button stuck on "Creating voice clone..." with zero
progress indication. They can't tell if the upload is at 5% or 95%, or if it's
stalled.

**What exists today**

- File validation shows file name and size in MB after selection.
- Submit button text changes to "Creating voice clone..." during submission.
- No progress bar, no percentage, no bytes-transferred indicator.

**Goal**

A progress bar showing upload percentage during the file upload step.

**Approach**

- Replace the `fetch()` upload call with `XMLHttpRequest` to access
  `xhr.upload.onprogress` events.
- Track upload percentage in state (`uploadProgress: number | null`).
- Render a thin progress bar below the submit button (or inline in the progress
  box) during upload.
- Show percentage text: "Uploading... 64%".
- Reset progress to null after upload completes (success or failure).
- Wrap the XHR call in a promise so the rest of the async flow remains unchanged.

**Files to change**

- `frontend/src/pages/Clone.tsx` — replace fetch with XHR for upload, add progress
  state and UI

---

### Task 13 — Clone: mic permission guidance

**The problem**

`Clone.tsx:273` calls `navigator.mediaDevices.getUserMedia({ audio: true })`. The
catch block at lines 345-351 catches all errors with a generic message:

```typescript
catch (e) {
  setRecordingError(e instanceof Error ? e.message : 'Failed to access microphone.')
}
```

When the browser denies mic access (user clicked "Block" or permissions are locked),
the error is a `NotAllowedError` with a cryptic browser-generated message. The user
gets no guidance on how to fix it.

**What exists today**

- Generic error message displayed via `recordingError` state.
- No differentiation between `NotAllowedError` (permission denied),
  `NotFoundError` (no mic hardware), or `NotReadableError` (mic in use by another
  app).

**Goal**

Actionable error messages for common mic failure scenarios.

**Approach**

- Check `e.name` in the catch block:
  - `NotAllowedError` → "Microphone access was blocked. Click the lock/camera icon
    in your browser's address bar and allow microphone access, then try again."
  - `NotFoundError` → "No microphone found. Please connect a microphone and try
    again."
  - `NotReadableError` → "Your microphone is in use by another application. Close
    other apps using the mic and try again."
  - Default → current generic message.
- No external dependencies needed.

**Files to change**

- `frontend/src/pages/Clone.tsx` — expand catch block with error type checks

---

### Task 14 — Design: save retry button

**The problem**

`Design.tsx:154-162` handles auto-save failure after a preview generates:

```typescript
setError(
  `Preview generated, but automatic save failed. ${detail} You can try Generate Preview again.`
)
```

The only recovery is to re-run the entire preview generation (15-45 seconds). The
preview audio is playing in the browser (blob URL), but the voice isn't persisted
to the database. There's no "Try saving again" button — the user must regenerate
from scratch.

**What exists today**

- Preview generates → `saveDesignedVoice()` called automatically.
- On save failure: error message set, `savedVoiceId` stays null.
- The preview audio blob URL is held in component state. It's still playable.
- No retry mechanism.

**Goal**

When auto-save fails, show a "Save voice" button that retries the save call without
re-running the preview generation.

**Approach**

- Track `previewAudioUrl` separately from the save state.
- When auto-save fails, set a `canRetrySave` flag.
- Render a "Save voice" button that calls `saveDesignedVoice()` again with the
  existing preview data.
- On retry success, clear the error and proceed normally.
- If the blob URL has been revoked (unlikely but possible on memory pressure), fall
  back to the existing "try Generate Preview again" message.

**Files to change**

- `frontend/src/pages/Design.tsx` — add retry state + button

---

### Task 15 — Voices: styled delete confirmation

**The problem**

`Voices.tsx:152` uses `confirm('Delete voice "..."?')` — the browser's native
dialog. It's unstyled, blocks the thread, and stands out as the one UI element that
doesn't match the app's design language.

**What exists today**

- `confirm()` call with voice name interpolated into the message.
- On confirm: API delete call, then full voice list reload.
- No custom dialog component (see task 9).

**Goal**

Replace `confirm()` with the Dialog component from task 9.

**Approach**

- Track `deletingVoice: Voice | null` state.
- When user clicks delete, set `deletingVoice` to the voice object.
- Render `<Dialog>` with: "Delete '{voice.name}'?" title, "This will permanently
  delete the voice and its reference audio." body, and "Delete" (destructive) +
  "Cancel" buttons.
- On confirm: run delete API call, close dialog, show toast (task 8).

**Files to change**

- `frontend/src/pages/Voices.tsx` — add dialog state + render

**Depends on**: Task 9 (Dialog component)

---

### Task 16 — History: expandable error messages

**The problem**

`History.tsx` truncates failed generation error messages to 160 characters. Long
error strings (e.g. GPU timeout details, model errors) are cut off with no way to
read the full text. Users can't diagnose what went wrong.

**What exists today**

- Error text rendered with `.slice(0, 160)` truncation.
- No expand/collapse toggle, no tooltip, no "show more" link.

**Goal**

Users can read the full error message when they need to.

**Approach**

- If error text exceeds 160 characters, render the truncated version with a "Show
  more" toggle button.
- Clicking "Show more" expands to full text inline, button changes to "Show less".
- Alternative: use the InfoTip component to show full error on hover/click (lower
  effort, but less accessible on mobile).
- Prefer the inline toggle approach for mobile friendliness.

**Files to change**

- `frontend/src/pages/History.tsx` — add expand/collapse state per generation card

---

### Task 17 — Profile: avatar fallback

**The problem**

`Profile.tsx:169-179` renders the avatar as a plain `<img>` tag:

```tsx
<img src={avatarUrl} alt="" className="size-14 rounded-full object-cover" />
```

If `avatarUrl` points to a broken URL, a dead image icon renders. There's no
`onError` handler, no fallback, no initials placeholder.

**What exists today**

- Avatar shows image if URL is set, "—" dash if empty.
- No error handling on the `<img>` element.

**Goal**

Broken avatar URLs gracefully fall back to initials or a default placeholder.

**Approach**

- Add `onError` handler to `<img>` that sets a `avatarBroken` state flag.
- When broken: render the user's initials (from display_name) or a generic user
  icon SVG instead of the broken image.
- Same fallback used when avatarUrl is empty (replace "—" with initials/icon).

**Files to change**

- `frontend/src/pages/account/Profile.tsx` — add onError handler + fallback render

---

### Task 18 — Profile: password change

**The problem**

Users who signed up with email+password have no way to change their password from
within the app. The Profile page has no password section. Supabase Auth supports
`updateUser({ password })` but it's never called.

**What exists today**

- Profile.tsx shows identity fields (name, handle, avatar) and calls
  `PATCH /api/profile` for those fields.
- No password field, no "Change password" section.
- Supabase client (`frontend/src/lib/supabase.ts`) is initialized and available.

**Goal**

Authenticated users can change their password from the Profile page.

**Approach**

- Add a "Change password" card to Profile.tsx (or Settings.tsx if task 7 is done
  first).
- Fields: "New password" + "Confirm new password".
- On submit: call `supabase.auth.updateUser({ password: newPassword })`.
- Show success toast (task 8) or inline success message.
- Validate: minimum 6 characters (matching signup requirement), passwords match.
- Only show this section for users who signed up with password (not magic-link-only
  users). Check `user.app_metadata.provider === 'email'` or similar.

**Files to change**

- `frontend/src/pages/account/Profile.tsx` (or `Settings.tsx`) — add password
  change card

---

## Visual Polish

---

### Task 19 — Page transitions

**The problem**

Route changes are instant hard cuts. The entire page content swaps with no
animation. This makes navigation feel mechanical rather than designed. The landing
page hero has a polished `TextReveal` animation, which makes the static route
transitions feel inconsistent by comparison.

**What exists today**

- `router.tsx` uses React Router's `createBrowserRouter`. No transition wrapper.
- `package.json` has no animation library (no framer-motion, react-transition-group,
  or similar).
- The only animation in the app is `TextReveal.tsx` (hero text) and
  `animate-spin` on button loading spinners.

**Goal**

Subtle, consistent transition animation between route changes.

**Approach**

- Use CSS-only transitions via React Router's `useNavigation()` hook or a wrapper
  component around `<Outlet>`.
- On route change: fade out current page (opacity 1→0, 100ms), swap content, fade
  in new page (opacity 0→1, 150ms). Total: 250ms.
- Alternative: slide transition (translateY 8px + opacity). Slightly more dynamic.
- Keep it lightweight — no heavy animation library. CSS transitions + a small React
  wrapper are sufficient.
- Respect `prefers-reduced-motion` — skip animation entirely, instant swap.
- Avoid animating the Layout shell (header, footer) — only the content area
  transitions.

**Files to change**

- `frontend/src/app/Layout.tsx` — add transition wrapper around `<Outlet>`
- `frontend/src/styles/index.css` — transition keyframes/classes

---

### Task 20 — List stagger animations

**The problem**

On the Voices and History pages, all cards render simultaneously when data loads.
A grid of 20 cards appearing at once feels abrupt. Staggered entrance (each card
appearing 30-50ms after the previous) creates a more polished, intentional feel.

**What exists today**

- `Voices.tsx` maps over `voices` array and renders cards.
- `History.tsx` maps over `generations` array and renders cards.
- No entrance animation on list items.

**Goal**

Cards fade/slide in with a staggered delay when data first loads or when
pagination changes.

**Approach**

- Use CSS `animation-delay` based on item index: `style={{ animationDelay: '${i * 40}ms' }}`.
- Define a `@keyframes fadeInUp` in index.css: opacity 0→1, translateY 8px→0,
  duration 200ms, ease-out.
- Apply the animation class to each card on mount. Use a key that changes on page
  change to re-trigger.
- Respect `prefers-reduced-motion` — render without animation.
- Cap stagger at ~10 items (400ms max total delay) so the last cards don't feel
  sluggish.

**Files to change**

- `frontend/src/styles/index.css` — add fadeInUp keyframes
- `frontend/src/pages/Voices.tsx` — add stagger delay per card
- `frontend/src/pages/History.tsx` — add stagger delay per card

---

### Task 21 — Landing scroll animations

**The problem**

Below the hero (which has `TextReveal` animation), the DemoWall, FeaturesSection,
and PricingSection appear statically as the user scrolls. The contrast between the
animated hero and the static sections makes the rest of the page feel flat.

**What exists today**

- `LandingHero.tsx` uses `TextReveal` with word-by-word animated reveal.
- `DemoWall.tsx` has CSS transforms (rotation, translate) on cards — but these are
  static, not scroll-triggered.
- `FeaturesSection.tsx` and `PricingSection.tsx` render immediately with no entrance
  animation.

**Goal**

Landing sections animate into view as the user scrolls down.

**Approach**

- Use `IntersectionObserver` to detect when each section enters the viewport.
- On intersection: add a CSS class that triggers a fade-up animation (opacity 0→1,
  translateY 24px→0, duration 400ms, ease-out).
- Create a reusable `<ScrollReveal>` wrapper component that handles the observer
  logic and applies the animation class.
- Wrap each landing section (`DemoWall`, `FeaturesSection`, `PricingSection`) in
  `<ScrollReveal>`.
- Trigger once — don't re-animate on scroll back up.
- Respect `prefers-reduced-motion` — render immediately without animation.

**Files to change**

- New: `frontend/src/components/animation/ScrollReveal.tsx`
- `frontend/src/pages/Landing.tsx` — wrap sections in ScrollReveal
- `frontend/src/styles/index.css` — scroll-reveal keyframes

---

### Task 22 — Dark mode contrast fix

**The problem**

`frontend/src/styles/index.css` defines `--color-faint: #8a8a8a` in dark mode
(line 49) against a `--color-background: #0d0d0d` background. The contrast ratio
is ~5.6:1 — passes WCAG AA for normal text (4.5:1 minimum) but feels washed out
for UI labels, timestamps, and secondary text. Users on lower-quality displays or
in bright environments may struggle to read faint text.

**What exists today**

- Light mode faint: `#888888` on `#ffffff` — contrast 3.5:1 (fails AA, but light
  mode has other cues).
- Dark mode faint: `#8a8a8a` on `#0d0d0d` — contrast 5.6:1 (passes AA but
  borderline).
- `--color-muted-foreground: #b3b3b3` (dark) is a better-contrasting alternative
  but used for different purposes.

**Goal**

Improve dark mode readability of faint text without losing the muted aesthetic.

**Approach**

- Bump `--color-faint` in dark mode from `#8a8a8a` to `#9a9a9a` (contrast ~6.6:1)
  or `#a0a0a0` (~7.0:1).
- Audit all usages of `text-faint` across the app to verify the new value looks
  right in context (timestamps, character counters, secondary labels, elapsed time).
- Also consider bumping light mode faint from `#888888` to `#777777` for better AA
  compliance (contrast 4.5:1+).
- This is a single-line CSS change with visual impact across every page.

**Files to change**

- `frontend/src/styles/index.css` — adjust `--color-faint` values

---

### Task 23 — Mobile card action layout

**The problem**

Both `Voices.tsx` and `History.tsx` use the same button layout pattern:

```html
<div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-self-end">
```

On screens under ~400px, the action buttons (Preview/Generate/Delete for voices,
Play/Download/Regenerate/Delete for history) wrap into 2-3 rows. This looks
cluttered and pushes the card height up significantly.

**What exists today**

- `flex-wrap` causes buttons to wrap when horizontal space runs out.
- Buttons are full-size on all breakpoints.
- No overflow menu, no icon-only mode for small screens.

**Goal**

Action buttons remain usable and tidy on small screens.

**Approach**

- Option A (simpler): On screens below `sm:` (640px), switch buttons to icon-only
  mode (hide text labels, show only icons). Add `title` attributes for
  accessibility. Buttons become ~32px square, fitting on one row.
- Option B: Collapse action buttons into a single "..." overflow menu on mobile
  using a small dropdown. More complex, requires a Dropdown component.
- Recommend Option A for lower effort. Icons already exist as inline SVGs in the
  button markup.

**Files to change**

- `frontend/src/pages/Voices.tsx` — responsive button text visibility
- `frontend/src/pages/History.tsx` — responsive button text visibility

---

## SEO & Marketing

---

### Task 24 — Open Graph + Twitter meta tags

**The problem**

`frontend/index.html` has only 5 meta tags:

```html
<meta charset="UTF-8" />
<link rel="icon" href="/static/favicon.ico" type="image/x-icon" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="Clone a voice and generate speech with Qwen3-TTS" />
<meta name="theme-color" content="#ffffff" />
```

No Open Graph or Twitter Card tags. Sharing the app URL on Twitter, Discord, Slack,
LinkedIn, or iMessage shows a plain text link — no preview card, no image, no
branded title. This is the single highest-impact marketing fix.

**What exists today**

- Title: `<title>Utter</title>`.
- Description meta tag exists but is generic.
- No `og:*` tags, no `twitter:*` tags, no `<link rel="canonical">`.
- No social preview image in `/public`.

**Goal**

Sharing the app URL anywhere produces a branded preview card with title, description,
and image.

**Approach**

- Create a social preview image (1200x630px) — the UTTER brand in pixel font on a
  dark background with tagline. Save to `frontend/public/static/og-image.png`.
- Add to `index.html`:
  ```html
  <meta property="og:title" content="Utter — Voice Cloning & Speech Generation" />
  <meta property="og:description" content="Clone any voice from audio and generate speech with AI." />
  <meta property="og:image" content="https://utter-wheat.vercel.app/static/og-image.png" />
  <meta property="og:url" content="https://utter-wheat.vercel.app" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Utter — Voice Cloning & Speech Generation" />
  <meta name="twitter:description" content="Clone any voice from audio and generate speech with AI." />
  <meta name="twitter:image" content="https://utter-wheat.vercel.app/static/og-image.png" />
  <link rel="canonical" href="https://utter-wheat.vercel.app" />
  ```
- Also add `robots.txt` and `sitemap.xml` to `frontend/public/` (minimal effort,
  meaningful for crawlers).

**Files to change**

- `frontend/index.html` — add meta tags
- New: `frontend/public/static/og-image.png` — social preview image
- New: `frontend/public/robots.txt`
- New: `frontend/public/sitemap.xml`

---

### Task 25 — About page expansion

**The problem**

`About.tsx` is 80 lines — three feature cards ("Clone a Voice", "Design a Voice",
"Generate Speech"), a constraints/tips list, and a dynamic language list. It reads
like a technical README, not a product page. There's no brand story, no personality,
no founder/team mention, no social links.

**What exists today**

- Title "About" centered.
- Intro paragraph: "Utter is an AI-powered voice cloning and speech generation app."
- Three feature cards in a grid.
- "Constraints & Tips" section with bullets (file sizes, durations, char limits).
- "Supported languages" dynamic list.

**Goal**

An About page that tells the product story, builds credibility, and gives visitors
a reason to trust Utter with their time and money.

**Approach**

- Add a "Why Utter" or brand story section — 2-3 paragraphs on the vision (make
  voice cloning accessible, fast, affordable).
- Add a "Built with" / technology section — mention Qwen3-TTS, Supabase, deployed
  on Vercel. Signals competence.
- Add social/contact links (GitHub, Twitter/X, email) with icons.
- Keep the existing constraints section — it's useful for power users.
- Consider a "Roadmap" or "What's coming" subsection to signal active development.
- Match the design language of the Landing page (spacing, typography, cards).

**Files to change**

- `frontend/src/pages/About.tsx` — expand content sections

---

### Task 26 — Footer expansion

**The problem**

`Footer.tsx` is 54 lines — a single row with brand name, tagline, 5 nav links,
"Powered by Qwen3-TTS on Modal", and a copyright line. For a product accepting
payments, this feels thin. Users expect structured footer columns, social icons,
and clear legal links.

**What exists today**

- Brand: "UTTER" in pixel font + "Voice cloning & speech generation."
- Links: Pricing, Account, Privacy, Terms, About.
- Credit: "Powered by Qwen3-TTS on Modal."
- Copyright: "2026 Utter."

**Goal**

A structured footer that reinforces the product brand and provides all expected
SaaS links.

**Approach**

- Restructure into 3-4 columns: Product (Clone, Generate, Design, Pricing), Account
  (Sign in, Profile, Billing), Legal (Privacy, Terms), Connect (social icons).
- Add social media icons (GitHub at minimum, Twitter/X if applicable).
- Keep "Powered by" credit and copyright.
- Maintain dark/light mode compatibility.
- Responsive: columns stack on mobile.

**Files to change**

- `frontend/src/app/Footer.tsx` — restructure layout and add columns

---

### Task 27 — Landing social proof section

**The problem**

The landing page has a DemoWall with 5 audio demos — good for showcasing quality,
but there's no social proof. No testimonials, no user count, no "trusted by"
signals. Visitors have no external validation that the product works or that other
people use it.

**What exists today**

- `Landing.tsx` renders: Hero → DemoWall → FeaturesSection → PricingSection.
- DemoWall has 5 high-quality demo clips (anime, film sources).
- No testimonials, no user metrics, no partner/press logos.

**Goal**

A social proof section that builds trust with new visitors.

**Approach**

- Add a section between FeaturesSection and PricingSection (or between DemoWall and
  FeaturesSection).
- Start with what's available: "X voices cloned" or "X generations created" — pull
  from real data if possible, or use modest rounded numbers.
- Add 2-3 short testimonial quotes. If real testimonials aren't available yet, use
  a "What people are saying" section with placeholder structure that can be filled
  in later. Alternatively, skip testimonials and focus on metrics + feature bullets.
- Keep it concise — a single-row stats bar or a small card grid. Don't overdo it
  for an early product.

**Files to change**

- New: `frontend/src/pages/landing/SocialProof.tsx` (or inline in Landing.tsx)
- `frontend/src/pages/Landing.tsx` — add section to render order
