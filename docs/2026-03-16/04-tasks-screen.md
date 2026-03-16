# Plan 4: Tasks Screen — Job Queue Viewer

> **Scope**: New screen — view all tracked tasks, cancel/dismiss, navigate to source
> **Estimate**: 1 session
> **Depends on**: Phase 1 core polish (done)

## Overview

The web Tasks page (`frontend/src/pages/Tasks.tsx`, ~302 lines) shows all background jobs with filters, live polling, cancel/dismiss, and navigation to the source page. On mobile this works as a bottom sheet or modal rather than a tab, keeping the tab bar clean.

## API contract

**Endpoint:** `GET /api/tasks?status=active&type=all&limit=20&before=...`
**Response type:** `TaskListResponse` (needs adding to `mobile/lib/types.ts`)

```ts
type TaskListStatus = 'active' | 'terminal' | 'all';
type TaskListType = 'all' | 'generate' | 'design_preview';

type BackendTaskListItem = {
  id: string;
  type: TaskType | string;
  status: TaskStatus;
  created_at: string | null;
  completed_at: string | null;
  provider: 'modal' | 'qwen' | string;
  provider_status: string | null;
  generation_id: string | null;
  title: string;
  subtitle: string | null;
  language: string | null;
  voice_name: string | null;
  text_preview: string | null;
  estimated_duration_minutes: number | null;
  origin_page: string;
  supports_cancel: boolean;
  error: string | null;
};

type TaskListResponse = {
  tasks: BackendTaskListItem[];
  status: TaskListStatus;
  type: TaskListType;
  limit: number;
  next_before: string | null;
};
```

**Cancel:** `POST /api/tasks/{id}/cancel`
**Dismiss:** `DELETE /api/tasks/{id}`

## Navigation design

**Approach:** Modal screen, accessible from the tab bar badge or a dedicated "Tasks" button in the tab bar. Since Generate already shows a badge with active count, tapping the badge area or long-pressing could open Tasks. Alternatively, add it as the 5th entity in navigation (but not a tab).

**Recommendation:** Stack modal, like Clone. Accessible via a "View All Tasks" link shown in Generate/Design screens when there are active tasks, or from Account screen quick actions.

```
Generate screen footer (when tasks exist):
  "3 active tasks — View All →"  →  opens /tasks modal

Account screen:
  Quick Actions: [View Tasks]  →  opens /tasks modal
```

## Implementation

### 1. Create Tasks modal screen

**File:** `mobile/app/tasks.tsx` (stack modal, like clone.tsx)

**Features:**
- FlatList of all tasks from `/api/tasks`
- Status filter: segmented control (Active / Recent / All)
- Type filter: segmented control (All / Generate / Design)
- Each task row shows:
  - Title (task description)
  - Status text (with provider status mapping from TaskProvider's `getStatusText`)
  - Subtitle if present
  - Voice name, language if present
  - Text preview (truncated)
  - Created/completed timestamps (relative: "2m ago")
  - Error message if failed
- Actions per task:
  - "Open" → navigate to origin page (Generate or Design tab)
  - "Cancel" → `POST /api/tasks/{id}/cancel` with confirmation
  - "Dismiss" → `DELETE /api/tasks/{id}` (remove from list)
- Live polling: refresh every 3s when viewing Active filter
- Cursor pagination: "Load Older" button using `next_before` cursor
- Pull-to-refresh
- Empty states per filter

### 2. Register modal screen

**File:** `mobile/app/_layout.tsx`

```tsx
<Stack.Screen
  name="tasks"
  options={{
    presentation: 'modal',
    headerShown: true,
    title: 'Tasks',
    headerStyle: { backgroundColor: '#000' },
    headerTintColor: '#fff',
  }}
/>
```

### 3. Add navigation links

**Files:**
- `mobile/app/(tabs)/generate.tsx` — add "View All Tasks" link below task list when > 2 tasks
- `mobile/app/(tabs)/design.tsx` — same pattern

### 4. Types to add

In `mobile/lib/types.ts`:
```ts
export type TaskListStatus = 'active' | 'terminal' | 'all';
export type TaskListType = 'all' | 'generate' | 'design_preview';

export type BackendTaskListItem = {
  id: string;
  type: TaskType | string;
  status: TaskStatus;
  created_at: string | null;
  completed_at: string | null;
  provider: 'modal' | 'qwen' | string;
  provider_status: string | null;
  generation_id: string | null;
  title: string;
  subtitle: string | null;
  language: string | null;
  voice_name: string | null;
  text_preview: string | null;
  estimated_duration_minutes: number | null;
  origin_page: string;
  supports_cancel: boolean;
  error: string | null;
};

export type TaskListResponse = {
  tasks: BackendTaskListItem[];
  status: TaskListStatus;
  type: TaskListType;
  limit: number;
  next_before: string | null;
};
```

## Web reference

- `frontend/src/pages/Tasks.tsx` — full web implementation (~302 lines)
- key patterns: live polling (3s), cursor pagination, status/type filters, cancel/dismiss actions

---

## Session Prompt

```
We're continuing work on the Expo React Native mobile app for our Utter project.

**Context:**
- Worktree: C:\Users\Duncan\Desktop\utter-mobile (branch: feat/mobile-app)
- Mobile app: mobile/ directory (Expo SDK 54, expo-router v6, React 19.1.0)
- The app runs on Expo Go on a physical device, connected to production backend
- Session docs: docs/2026-03-15/ (scaffold + architecture), docs/2026-03-16/ (plans)
- Previous work: Phase 1 done, History and Account screens may already exist

**Task: Tasks Screen**

Read docs/2026-03-16/04-tasks-screen.md for the full plan. Use the /building-native-ui skill for all UI work.

Build the Tasks screen:

1. **Create mobile/app/tasks.tsx** — modal screen (like clone.tsx)
   - FlatList of tasks from GET /api/tasks, with status filter (Active/Recent/All) and type filter (All/Generate/Design)
   - Task rows: title, status text, subtitle, voice name, language, text preview, timestamps, error
   - Actions: Open (navigate to source), Cancel (POST /api/tasks/{id}/cancel), Dismiss (DELETE)
   - Live polling (3s when Active), cursor pagination (Load Older), pull-to-refresh
   - Cross-reference frontend/src/pages/Tasks.tsx

2. **Register in mobile/app/_layout.tsx** — add tasks as modal stack screen

3. **Update mobile/lib/types.ts** — add TaskListStatus, TaskListType, BackendTaskListItem, TaskListResponse

4. **Add navigation links** in generate.tsx and design.tsx — "View All Tasks →" when multiple tasks exist

Run npx tsc --noEmit from mobile/ after changes. Commit when complete.

**Post-session docs update (required):**
After the Tasks screen is done:
1. Update docs/2026-03-15/01-web-parity-plan.md — change all Tasks features from "Missing (no screen)" to "Done"
2. Add a "## Completed" section at the bottom of this plan file with: what was built, any deviations from the plan, and the commit hash(es)
3. Commit the doc updates separately: `docs(mobile): update parity plan after tasks screen`
```
