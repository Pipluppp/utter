# React Aria Migration Map

Comprehensive mapping of every Utter frontend component, page pattern, and interactive
widget to the React Aria component that can replace it. Each section covers what we have
today, what React Aria offers, what changes, and what stays the same.

**Package:** `react-aria-components` (headless — zero shipped CSS, all Tailwind stays)
**Tailwind plugin:** `tailwindcss-react-aria-components` (shorthand `data-*` modifiers)

---

## Table of Contents

1. [UI Primitives](#1-ui-primitives)
2. [Overlays & Tooltips](#2-overlays--tooltips)
3. [Forms & Validation](#3-forms--validation)
4. [Collections & Lists](#4-collections--lists)
5. [Navigation](#5-navigation)
6. [Status & Feedback](#6-status--feedback)
7. [Drag & Drop / File Upload](#7-drag--drop--file-upload)
8. [Page-by-Page Breakdown](#8-page-by-page-breakdown)
9. [Components That Stay Custom](#9-components-that-stay-custom)
10. [Migration Priority](#10-migration-priority)
11. [Installation & Tailwind Setup](#11-installation--tailwind-setup)

---

## 1. UI Primitives

### Button

| | Utter (`ui/Button.tsx`) | React Aria `Button` |
|---|---|---|
| **Element** | `<button>` | `<button>` (or `<a>` with `href`) |
| **Props** | `variant`, `size`, `block`, `loading`, `className` + native button attrs | `onPress`, `isPending`, `isDisabled`, `type`, `form`, `autoFocus` + ARIA props |
| **Loading** | `loading` prop → `aria-busy`, text hidden, spinner overlay | `isPending` → announced to assistive tech, retains focus, `data-pending` attribute |
| **Disabled** | `disabled` prop + Tailwind disabled styles | `isDisabled` + `data-disabled` attribute |
| **Press events** | Native `onClick` | `onPress` normalized across mouse, keyboard, touch, screen readers. Also `onPressStart`, `onPressEnd`, `onPressChange`, `onPressUp`. `PressEvent` includes `pointerType` (mouse/touch/keyboard) |
| **Focus** | `focus-visible:ring-2 focus-visible:ring-ring ...` | `data-focus-visible` attribute — style with `data-[focus-visible]:ring-2 ...` or plugin `focus-visible:ring-2` |
| **Hover** | `hover:bg-foreground/80` etc. | `data-hovered` — style with `data-[hovered]:bg-foreground/80` |
| **Pressed** | No pressed state | `data-pressed` — style with `data-[pressed]:scale-95` etc. |

**What changes:**
- Replace `onClick` handlers with `onPress` (gets normalized cross-device events)
- Replace `loading` prop with `isPending` (gets screen reader announcement for free)
- Replace `disabled` prop with `isDisabled`
- Replace Tailwind pseudo-classes (`hover:`, `focus-visible:`, `disabled:`) with data-attribute selectors or plugin shorthand modifiers

**What stays:**
- All Tailwind class strings (just swap selectors)
- Variant/size logic (keep your own wrapper around React Aria `Button`)
- Block layout, spinner overlay, className merging

**Example migration:**
```tsx
// Before
<Button variant="primary" loading={submitting} onClick={handleSubmit}>
  Clone Voice
</Button>

// After
<Button
  className={buttonStyles({ variant: "primary" })}
  isPending={submitting}
  onPress={handleSubmit}
>
  Clone Voice
</Button>
```

---

### Input

| | Utter (`ui/Input.tsx`) | React Aria `TextField` > `Input` |
|---|---|---|
| **Element** | `<input>` | `<TextField>` wrapper > `<Label>` + `<Input>` + `<Text slot="description">` + `<FieldError>` |
| **Label** | Separate `<Label>` component, manually linked via `htmlFor`/`id` | Auto-linked via ARIA IDs — just nest `<Label>` inside `<TextField>` |
| **Validation** | Manual: check in handler, show `<Message variant="error">` | Built-in: `isRequired`, `isInvalid`, `validate` function, `<FieldError>` auto-linked via `aria-describedby` |
| **States** | `focus-visible:` Tailwind pseudo | `data-focused`, `data-disabled`, `data-invalid` |

**What changes:**
- Wrap Input + Label + error message inside `<TextField>` compound component
- Validation errors automatically wired to input via `aria-describedby`
- Description text (help text) automatically wired via `aria-describedby`

**What stays:**
- All Tailwind styling classes on the `<Input>` element
- `type`, `placeholder`, `autoComplete`, `inputMode` props

---

### Textarea

| | Utter (`ui/Textarea.tsx`) | React Aria `TextField` > `TextArea` |
|---|---|---|
| **Element** | `<textarea>` | `<TextField>` > `<Label>` + `<TextArea>` + `<Text slot="description">` + `<FieldError>` |
| **Behavior** | Identical to Input | Same compound pattern as TextField with Input |

Same migration path as Input. Swap `<Input>` for `<TextArea>` inside `<TextField>`.

---

### Select (native dropdown)

| | Utter (`ui/Select.tsx`) | React Aria `Select` |
|---|---|---|
| **Element** | `<div>` wrapper > `<select>` + `<svg>` chevron | `<Select>` > `<Label>` + `<Button>` > `<SelectValue>` + chevron + `<Popover>` > `<ListBox>` > `<ListBoxItem>` |
| **Keyboard** | Browser-native select behavior | Full ARIA listbox: arrow keys, Home/End, typeahead, Escape |
| **Styling** | `appearance-none` + custom chevron SVG | Fully custom — you control every element's markup and Tailwind classes |
| **Options** | `<option>` children | `<ListBoxItem>` children — can contain icons, descriptions, badges |
| **Sections** | Not supported | `<ListBoxSection>` + `<Header>` for grouped options |
| **Positioning** | Browser-native dropdown | `<Popover>` with automatic flip/offset positioning |

**What changes:**
- Significantly more markup (compound component pattern)
- Full keyboard navigation and screen reader support
- Options can have rich content (not just text)
- Popover auto-positions and flips when near viewport edge
- `data-placeholder` on `<SelectValue>` when no selection

**What stays:**
- The visual appearance (you style each piece with Tailwind)
- Chevron icon (render it inside the `<Button>`)

**Migration note:** This is a bigger change than Button/Input because it replaces a native
`<select>` with a custom listbox. The accessibility win is marginal for simple dropdowns
(native select is already accessible). The main gain is **rich option content** and
**consistent cross-browser styling**. If you just need basic language/voice selection, the
native `<select>` is fine to keep.

---

### Label

| | Utter (`ui/Label.tsx`) | React Aria `Label` |
|---|---|---|
| **Element** | `<label>` with `htmlFor` | `<Label>` — auto-linked when nested inside a field component |
| **Styling** | `mb-2 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground` | Same classes, applied to React Aria `<Label>` |

**What changes:**
- No more manual `htmlFor`/`id` pairing — React Aria handles association automatically
- Works inside `TextField`, `Select`, `NumberField`, `SearchField`, etc.

---

### Kbd

| | Utter (`ui/Kbd.tsx`) | React Aria `Keyboard` |
|---|---|---|
| **Element** | `<kbd>` with `aria-hidden` | `<Keyboard>` renders `<kbd>` |
| **Behavior** | Identical | Identical |

Trivial swap. Keep your Tailwind classes, change the import.

---

### Skeleton

| | Utter (`ui/Skeleton.tsx`) | React Aria |
|---|---|---|
| **Element** | `<div>` with `animate-pulse bg-muted` + `aria-hidden` | No equivalent |

**Keep custom.** React Aria has no skeleton component. Your implementation is simple and correct.

---

### Message (alert/status)

| | Utter (`ui/Message.tsx`) | React Aria |
|---|---|---|
| **Element** | `<div>` with `role="alert"` or `role="status"` + `aria-live` | No direct equivalent |

**Keep custom.** React Aria doesn't ship an alert/message component. Your implementation
already uses correct ARIA live regions. However, for toast-style notifications, React Aria
offers a `Toast` component (see [Status & Feedback](#6-status--feedback)).

---

### GridArt / SVGBlobs / TextReveal / RouteSkeletons

**Keep all custom.** These are decorative/animation components with no library equivalent.
Already correctly marked `aria-hidden` where appropriate.

---

## 2. Overlays & Tooltips

### InfoTip → Popover + Dialog

| | Utter (`ui/InfoTip.tsx`) | React Aria `DialogTrigger` + `Popover` + `Dialog` |
|---|---|---|
| **Trigger** | `<button>` with `aria-expanded`, `aria-controls` | `<Button>` inside `<DialogTrigger>` — ARIA attributes auto-managed |
| **Content** | `<span role="dialog">` absolutely positioned | `<Popover>` with auto-positioning + `<Dialog>` with focus trap |
| **Positioning** | Manual `absolute top-full mt-2` + `left-0`/`right-0` | Automatic: `placement` prop, `offset`, `shouldFlip`, `containerPadding` |
| **Dismiss** | Manual: `pointerdown` listener + Escape key handler | Automatic: click outside, Escape, blur — all built-in |
| **Focus trap** | None — focus can leave the dialog | Built-in focus containment + return focus on close |
| **Close on scroll** | None | Configurable via `shouldCloseOnInteractOutside` |

**What changes:**
- Replace manual event listeners with declarative component composition
- Gains focus trapping (accessibility requirement for dialogs)
- Gains automatic positioning with viewport-aware flipping
- Gains `data-entering`/`data-exiting` for enter/exit animations

**What stays:**
- Visual styling (border, shadow, padding, width constraint)
- Alignment concept (map `align="start"` to `placement="bottom start"`)

**Example migration:**
```tsx
// Before
<InfoTip label="About cloning" align="start">
  <p>Voice cloning creates a copy of...</p>
</InfoTip>

// After
<DialogTrigger>
  <Button aria-label="About cloning" className="inline-flex size-6 ...">i</Button>
  <Popover placement="bottom start" offset={8} className="w-[min(320px,...)] ...">
    <Dialog aria-label="About cloning" className="p-3 text-sm ...">
      <p>Voice cloning creates a copy of...</p>
    </Dialog>
  </Popover>
</DialogTrigger>
```

---

### Clone Success Modal → Modal + Dialog

| | Utter (inline in `Clone.tsx`) | React Aria `DialogTrigger` + `ModalOverlay` + `Modal` + `Dialog` |
|---|---|---|
| **Backdrop** | `fixed inset-0 z-50` div with `bg-black/50 backdrop-blur-sm` | `<ModalOverlay>` with same Tailwind classes |
| **Content** | Centered `<div role="dialog" aria-modal="true" aria-labelledby>` | `<Modal>` > `<Dialog>` — ARIA attributes auto-managed |
| **Focus trap** | Manual `ref` focus on first action | Automatic focus containment + restoration on close |
| **Dismiss** | Escape key handler, backdrop click | `isDismissable` prop — built-in Escape + outside click |
| **Animation** | None | `data-entering`/`data-exiting` for CSS transitions |

**What changes:**
- Replace manual `fixed inset-0` + Escape listener + ref focus with declarative components
- Focus automatically trapped inside modal and restored when closed
- Controlled via `isOpen`/`onOpenChange` props

**What stays:**
- All backdrop and card styling
- Content layout (heading, body, action buttons)

**High-value migration.** The current Clone modal lacks proper focus trapping — keyboard
users can tab behind the modal. React Aria fixes this automatically.

---

### Tooltip (for future use)

React Aria provides `TooltipTrigger` + `Tooltip` for hover/focus tooltips with:
- Configurable delay and warmup behavior
- `data-entering`/`data-exiting` for animations
- Automatic `placement` with viewport flipping
- `OverlayArrow` for pointer arrows

Note: Tooltips are disabled on touch devices by design. For touch-accessible content
(like your current InfoTip), use `Popover` + `Dialog` instead.

---

## 3. Forms & Validation

### Current Pattern

Every form in Utter follows this pattern:
```tsx
<Label htmlFor="voiceName">Voice Name</Label>
<Input id="voiceName" value={name} onChange={e => setName(e.target.value)} />
{error && <Message variant="error">{error}</Message>}
```

Labels are manually linked via `htmlFor`/`id`. Errors are standalone `Message` components
not associated with the input via ARIA.

### React Aria Form Pattern

```tsx
<TextField
  isRequired
  isInvalid={!!error}
  validationBehavior="aria"
>
  <Label>Voice Name</Label>
  <Input className="w-full border border-border ..." />
  <Text slot="description">A recognizable name for your cloned voice</Text>
  <FieldError>{error}</FieldError>
</TextField>
```

**Gains:**
- `<Label>` auto-linked to `<Input>` — no `htmlFor`/`id` needed
- `<FieldError>` auto-linked via `aria-describedby` — screen readers announce errors
- `<Text slot="description">` auto-linked as accessible description
- `isRequired` adds `aria-required`
- `isInvalid` adds `aria-invalid` + `data-invalid` for styling
- `validate` prop for custom validation functions
- `<Form>` component with `validationErrors` for server-side error display
- First invalid field auto-focused on form submission

### Form-Level Validation

```tsx
<Form
  validationErrors={serverErrors}  // { voiceName: "Name already taken" }
  onSubmit={handleSubmit}
>
  <TextField name="voiceName" isRequired>
    <Label>Voice Name</Label>
    <Input />
    <FieldError />  {/* Shows server error or native validation message */}
  </TextField>
  <Button type="submit" isPending={submitting}>Clone Voice</Button>
</Form>
```

### Fields Across the App

| Page | Field | Utter Element | React Aria Component |
|---|---|---|---|
| Clone | Voice Name | `<Input>` | `<TextField>` > `<Input>` |
| Clone | Transcript | `<Textarea>` + char counter | `<TextField>` > `<TextArea>` + `<Text slot="description">` for counter |
| Clone | Language | `<Select>` (native) | `<Select>` or keep native |
| Generate | Voice | `<Select>` (native) | `<Select>` (custom listbox for richer voice display) |
| Generate | Language | `<Select>` (native) | `<Select>` or keep native |
| Generate | Text | `<Textarea>` + char counter | `<TextField>` > `<TextArea>` |
| Design | Voice Name | `<Input>` | `<TextField>` > `<Input>` |
| Design | Description | `<Textarea>` + char counter | `<TextField>` > `<TextArea>` |
| Design | Preview Text | `<Textarea>` + char counter | `<TextField>` > `<TextArea>` |
| Design | Language | `<Select>` (native) | `<Select>` or keep native |
| Auth | Email | `<Input type="email">` | `<TextField type="email">` > `<Input>` |
| Auth | Password | `<Input type="password">` | `<TextField type="password">` > `<Input>` |
| Voices | Search | `<Input>` | `<SearchField>` > `<Input>` + `<Button>` (clear) |
| History | Search | `<Input>` | `<SearchField>` > `<Input>` + `<Button>` (clear) |
| Profile | Password fields | `<Input type="password">` | `<TextField type="password">` > `<Input>` |

---

## 4. Collections & Lists

### Voice Cards (Voices page) → GridList or keep custom

| | Utter (inline in `Voices.tsx`) | React Aria `GridList` |
|---|---|---|
| **Container** | `<div>` grid | `<GridList layout="grid">` with `data-layout` attr |
| **Items** | `<div>` cards with buttons | `<GridListItem>` with interactive children |
| **Selection** | None (action buttons per card) | Optional: `selectionMode="single"` |
| **Keyboard** | Tab through individual buttons | Arrow keys between items, Tab for actions within item |
| **Empty state** | Manual check + fallback UI | `renderEmptyState` prop |

**Assessment:** Voice cards have multiple interactive elements (Generate, Preview, Delete
buttons + WaveformPlayer). React Aria `GridList` works for card grids with selection, but
your cards don't need selection — they need per-card actions. **Keep custom** unless you
want keyboard arrow-key navigation between cards.

---

### Task Rows (Generate/Design task list) → ListBox

| | Utter (inline in `Generate.tsx` / `Design.tsx`) | React Aria `ListBox` |
|---|---|---|
| **Container** | `<div>` with mapped buttons | `<ListBox selectionMode="single">` |
| **Items** | `<button>` per task | `<ListBoxItem>` with `onAction` |
| **Selection** | Manual: `selectedTaskId` state + `onClick` | Built-in: `selectedKeys`, `onSelectionChange`, `data-selected` |
| **Keyboard** | Tab between buttons | Arrow keys, Home/End, typeahead |
| **Active item** | `bg-subtle` on selected | `data-[selected]:bg-subtle` |

**Good candidate.** Task lists are single-select collections — exactly what `ListBox` is
designed for. Gains arrow-key navigation and screen reader announcements.

---

### Activity List (Credits page) → Table

| | Utter (inline in `Credits.tsx`) | React Aria `Table` |
|---|---|---|
| **Container** | `<div>` list | `<Table>` > `<TableHeader>` > `<Column>` + `<TableBody>` > `<Row>` > `<Cell>` |
| **Columns** | Implicit (description, amount, date) | Explicit `<Column>` with `isRowHeader` for primary column |
| **Sorting** | None | `allowsSorting` + `sortDescriptor` + `onSortChange` |
| **Keyboard** | None | Full arrow-key cell navigation, row selection |

**Medium value.** The activity list is simple enough to stay as-is, but if you want
sortable columns or row selection in the future, `Table` is the path.

---

### Task Cards (Tasks page) → ListBox or GridList

Similar to task rows. The Tasks page shows a filtered list of task cards. Could use
`ListBox` for single-select with keyboard navigation, but cards have action buttons
(Cancel, Dismiss) that make `GridList` a better fit (it allows interactive children).

---

## 5. Navigation

### Account Tabs → Tabs

| | Utter (`AccountLayout.tsx`) | React Aria `Tabs` |
|---|---|---|
| **Container** | `<nav>` with `<NavLink>` items | `<Tabs>` > `<TabList>` > `<Tab>` + `<TabPanel>` |
| **Active state** | React Router `NavLink` `isActive` → conditional classes | `data-selected` on active `<Tab>` |
| **Keyboard** | Tab between links | Arrow keys between tabs, Home/End |
| **ARIA** | `<nav>` landmark | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls` |
| **Content** | React Router `<Outlet>` | `<TabPanel>` per tab |

**What changes:**
- Replace `<NavLink>` navigation with ARIA tab pattern
- Arrow-key navigation between tabs (instead of Tab key)
- Tab panels semantically linked to their tabs

**Consideration:** Your account tabs navigate to different routes (`/account`, `/account/profile`,
`/account/credits`). React Aria `Tabs` supports `href` on `<Tab>` for client-side routing
integration. However, this may require coordination with React Router's `<Outlet>`. An
alternative is to keep `NavLink` navigation and add `role="tablist"` / `role="tab"` manually.

---

### Auth Page Tabs → Tabs

| | Utter (`Auth.tsx`) | React Aria `Tabs` |
|---|---|---|
| **Container** | Two buttons toggling `intent` state | `<Tabs selectedKey={intent} onSelectionChange={setIntent}>` |
| **Content** | Same form, different submit behavior | `<TabPanel>` per intent (or shared form with key swap) |

**Good candidate.** The sign-in/sign-up toggle is conceptually tabs — two panels sharing
most UI. React Aria `Tabs` gives proper ARIA semantics and keyboard navigation.

---

### Upload/Record Toggle (Clone page) → ToggleButtonGroup

| | Utter (`Clone.tsx`) | React Aria `ToggleButtonGroup` |
|---|---|---|
| **Container** | `<div>` with two buttons, `aria-pressed` | `<ToggleButtonGroup selectionMode="single" disallowEmptySelection>` |
| **Items** | `<button aria-pressed={mode === "upload"}>` | `<ToggleButton id="upload">` + `<ToggleButton id="record">` |
| **State** | Manual `mode` state + click handlers | `selectedKeys` / `onSelectionChange` |
| **Keyboard** | Tab between buttons | Arrow keys between buttons |

**Good candidate.** Clean swap — gains arrow-key navigation and proper ARIA group semantics.
Also applies to the Original/Clone toggle on `DemoClipCard`.

---

### Filter Toggles (Tasks, History, Credits) → ToggleButtonGroup

All filter button groups (status filters, type filters, activity filters) follow the same
pattern as the Upload/Record toggle. Map each to a `ToggleButtonGroup`.

---

### TopBar Mobile Menu → (keep custom or use Disclosure)

The mobile hamburger menu could use React Aria `Disclosure` for expand/collapse semantics,
but since it's a navigation menu with route links, the current implementation with
Escape-to-close is adequate. Low priority.

---

### Links → Link

| | Utter (React Router `<Link>` / `<NavLink>`) | React Aria `Link` |
|---|---|---|
| **Routing** | React Router handles navigation | React Aria `Link` with `href` — needs router provider integration |
| **ARIA** | Standard `<a>` | Same, plus `data-hovered`, `data-pressed`, `data-focus-visible` |

**Assessment:** React Router's `Link` and `NavLink` are deeply integrated with your routing.
Swapping to React Aria `Link` would require a `RouterProvider` setup. **Low value** unless
you want consistent `data-*` styling attributes on links.

---

## 6. Status & Feedback

### Toast (new — replaces ad-hoc messages)

React Aria provides a `Toast` system:

```tsx
// Create a queue (singleton)
const toastQueue = new ToastQueue({ maxVisibleToasts: 3 });

// Trigger from anywhere
toastQueue.add({ title: "Voice cloned!", description: "Luna is ready to use" }, { timeout: 5000 });

// Render region
<ToastRegion queue={toastQueue}>
  {({ toast }) => (
    <Toast toast={toast} className="border border-border bg-background p-4 shadow-elevated">
      <div slot="title">{toast.content.title}</div>
      <div slot="description">{toast.content.description}</div>
      <Button slot="close">Dismiss</Button>
    </Toast>
  )}
</ToastRegion>
```

**Features:**
- Queue-based: multiple toasts, FIFO ordering
- Auto-dismiss with configurable timeout (minimum 5s recommended)
- Pause timers on hover/focus
- F6 landmark navigation (keyboard users can jump to toast region)
- Focus restoration after last toast dismissed
- `data-entering`/`data-exiting` for CSS animations

**Where to use:**
- Clone success (replace modal for simple confirmations)
- Task completion notifications
- Credit purchase confirmations
- Error notifications (replace some `Message` uses)

---

### ProgressBar (new — for task progress)

| | Utter (task status text) | React Aria `ProgressBar` |
|---|---|---|
| **Current** | Text like "Processing..." or elapsed time | `<ProgressBar isIndeterminate>` or `<ProgressBar value={percent}>` |
| **ARIA** | None | `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |

Useful for task processing indicators. Can be determinate (with percentage) or
indeterminate (spinner/pulse). Render props give `percentage` and `valueText`.

---

## 7. Drag & Drop / File Upload

### File Upload (Clone page) → FileTrigger + DropZone

| | Utter (`Clone.tsx`) | React Aria `FileTrigger` + `DropZone` |
|---|---|---|
| **File picker** | Hidden `<input type="file">` + button click delegation | `<FileTrigger onSelect={files => ...} acceptedFileTypes={[".wav",".mp3",".m4a"]}>` wrapping a `<Button>` |
| **Drop zone** | Manual drag event handlers on styled div | `<DropZone onDrop={e => ...}>` with `data-drop-target` for styling |
| **Validation** | Manual: check size, duration, extension | `acceptedFileTypes` on FileTrigger; manual validation still needed for size/duration |
| **Keyboard** | Tab to hidden input | `<DropZone>` is focusable, keyboard-accessible (Enter/Space to open file dialog) |

**What changes:**
- Replace hidden `<input type="file">` hack with `<FileTrigger>`
- Replace manual drag listeners with `<DropZone>`
- `data-drop-target` attribute for drop-hover styling

**What stays:**
- Size/duration validation logic
- Visual styling of the drop area

**Example migration:**
```tsx
// Before
<input type="file" ref={fileRef} className="hidden" accept=".wav,.mp3,.m4a"
  onChange={e => handleFile(e.target.files?.[0])} />
<button onClick={() => fileRef.current?.click()}>
  Drop a file or click to upload
</button>

// After
<DropZone onDrop={async (e) => {
  const file = e.items.find(i => i.kind === "file");
  if (file) handleFile(await file.getFile());
}} className="data-[drop-target]:border-ring data-[drop-target]:bg-subtle ...">
  <FileTrigger onSelect={files => files?.[0] && handleFile(files[0])}
    acceptedFileTypes={[".wav", ".mp3", ".m4a"]}>
    <Button>Drop a file or click to upload</Button>
  </FileTrigger>
</DropZone>
```

---

## 8. Page-by-Page Breakdown

### Clone Page (`/clone`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Mode toggle (Upload/Record) | Two `<button>` with `aria-pressed` | `ToggleButtonGroup` + `ToggleButton` | Medium |
| File upload + drop zone | Hidden `<input type="file">` + drag listeners | `FileTrigger` + `DropZone` | High |
| Voice Name input | `<Label>` + `<Input>` (manual `htmlFor`) | `<TextField>` > `<Label>` + `<Input>` + `<FieldError>` | Medium |
| Transcript textarea | `<Label>` + `<Textarea>` + char counter | `<TextField>` > `<Label>` + `<TextArea>` + `<Text slot="description">` | Medium |
| Language select | `<Label>` + `<Select>` (native) | Keep native or `<Select>` compound | Low |
| Submit button | `<Button loading>` | `<Button isPending>` | Easy |
| Success modal | Manual `fixed` overlay + `role="dialog"` | `ModalOverlay` + `Modal` + `Dialog` | **High** |
| InfoTip | Custom popover | `DialogTrigger` + `Popover` + `Dialog` | Medium |

**Net gain:** Focus-trapped modal, accessible file drop zone, auto-linked form validation.

---

### Generate Page (`/generate`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Voice select | `<Select>` (native) | `<Select>` compound (show voice preview in options) | Medium |
| Language select | `<Select>` (native) | Keep native or `<Select>` compound | Low |
| Text textarea | `<Label>` + `<Textarea>` + char counter | `<TextField>` > `<TextArea>` | Medium |
| Submit button | `<Button loading>` | `<Button isPending>` | Easy |
| Task list | `<button>` list with manual selection | `<ListBox selectionMode="single">` | Medium |
| Audio player | WaveformPlayer | Keep custom | — |
| InfoTip | Custom popover | `Popover` + `Dialog` | Medium |

**Net gain:** Keyboard-navigable task list, richer voice selector.

---

### Design Page (`/design`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Voice Name input | `<Label>` + `<Input>` | `<TextField>` | Medium |
| Description textarea | `<Label>` + `<Textarea>` + counter | `<TextField>` > `<TextArea>` | Medium |
| Preview Text textarea | `<Label>` + `<Textarea>` + counter | `<TextField>` > `<TextArea>` | Medium |
| Language select | `<Select>` (native) | Keep native | Low |
| Example presets | Three `<button>` elements | Keep custom (or `ToggleButtonGroup` if exclusive) | Low |
| Submit button | `<Button loading>` | `<Button isPending>` | Easy |
| Task list | Same as Generate | `<ListBox>` | Medium |
| Audio player | WaveformPlayer | Keep custom | — |

**Net gain:** Same as Generate — form validation, keyboard task list.

---

### Voices Page (`/voices`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Search input | `<Input>` with debounce | `<SearchField>` (gains clear button + search semantics) | Medium |
| Source filter | `<Select>` (native) | Keep native or `ToggleButtonGroup` | Low |
| Voice cards grid | `<div>` grid with action buttons | Keep custom (too interactive for GridList) | — |
| Pagination | Prev/Next `<button>` + page text | Keep custom (React Aria has no pagination) | — |
| Audio player | WaveformPlayer | Keep custom | — |

**Net gain:** SearchField with clear button and `role="searchbox"` semantics.

---

### History Page (`/history`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Search input | `<Input>` | `<SearchField>` | Medium |
| Status filter | `<Select>` (native) | Keep native or `ToggleButtonGroup` | Low |
| Generation cards | `<div>` list with action buttons | Keep custom | — |
| Pagination | Prev/Next buttons | Keep custom | — |

**Net gain:** Same as Voices — better search field.

---

### Tasks Page (`/tasks`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Status filter buttons | Toggle `<button>` group | `ToggleButtonGroup` | Low |
| Type filter buttons | Toggle `<button>` group | `ToggleButtonGroup` | Low |
| Task cards | `<div>` cards with action buttons | Keep custom (action buttons inside) | — |
| Load More | `<button>` | Keep custom | — |

**Net gain:** Minimal — filter toggles get keyboard arrow navigation.

---

### Auth Page (`/auth`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Intent toggle (Sign in/Sign up) | Two `<button>` toggling state | `<Tabs>` with `<TabPanel>` | Medium |
| Email input | `<Label>` + `<Input type="email">` | `<TextField type="email">` | Medium |
| Password input | `<Label>` + `<Input type="password">` | `<TextField type="password">` | Medium |
| Submit button | `<Button loading>` | `<Button isPending>` | Easy |
| Google OAuth button | `<a>` styled as button | Keep custom | — |
| Error messages | `<Message variant="error">` | Keep custom (or `<FieldError>` per field) | Medium |

**Net gain:** Proper tab semantics, form validation wiring, first-invalid-field focus.

---

### Account Layout (`/account`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Tab navigation | `<NavLink>` items | `<Tabs>` with `href` on `<Tab>` | Medium |
| Account notices | `AccountNotice` component | Keep custom | — |

**Net gain:** Arrow-key tab navigation, ARIA tablist/tab/tabpanel semantics.

---

### Account Credits Page (`/account/credits`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Activity filter | Toggle `<button>` group | `ToggleButtonGroup` | Low |
| Activity list | `<div>` rows | `<Table>` (if sortable wanted) or keep custom | Low |
| Credit pack grid | `PricingGrid` component | Keep custom | — |
| Checkout messages | `AccountNotice` with dismiss | Keep custom (or Toast) | Low |

---

### Account Profile Page (`/account/profile`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Password change form | `<Input type="password">` fields | `<TextField type="password">` | Low |
| Sign out button | `<Button>` | `<Button>` | Trivial |

---

### Landing Page (`/`)

| Widget | Current | React Aria Replacement | Priority |
|---|---|---|---|
| Hero CTA buttons | `<NavLink>` styled as buttons | Keep custom | — |
| Demo Original/Clone toggle | Two `<button>` toggle | `ToggleButtonGroup` | Low |
| Feature section CTAs | `<NavLink>` buttons | Keep custom | — |
| Pricing grid | `PricingGrid` component | Keep custom | — |
| Mock demos | Custom animation components | Keep custom | — |
| Audio players | WaveformPlayer | Keep custom | — |

**Net gain:** Minimal. Landing page is mostly content and animation — not interactive
enough to benefit from React Aria.

---

## 9. Components That Stay Custom

These components have no React Aria equivalent and should remain as-is:

| Component | Why |
|---|---|
| **WaveformPlayer** | Domain-specific audio component using WaveSurfer.js |
| **TaskProvider / TaskDock / TaskBadge** | App-specific state management and UI |
| **GridArt / GridArtSurface** | Decorative SVG art |
| **SVGBlobs** | Decorative shapes |
| **TextReveal** | Animation component |
| **Skeleton / RouteSkeletons** | Simple loading placeholders (React Aria has none) |
| **Message** | Already uses correct ARIA live regions |
| **PricingGrid / PricingContent** | Domain-specific marketing layout |
| **AccountPanel / AccountNotice / AccountEmptyState** | Simple layout wrappers |
| **MockCloneFeature / MockGenerateFeature / MockDesignFeature** | Landing page animations |
| **DemoClipCard / DemoWall** | Landing page demos |
| **Pagination controls** | React Aria has no pagination component |

---

## 10. Migration Priority

### Phase 1 — High Value, Moderate Effort

| Component | Pages Affected | Why First |
|---|---|---|
| `Modal` + `Dialog` | Clone (success modal) | Focus trapping is an accessibility gap today |
| `FileTrigger` + `DropZone` | Clone (file upload) | Replaces fragile hidden-input hack, gains keyboard a11y |
| `Button` (base swap) | Every page | Foundation — every other migration builds on this |
| `Toast` (new) | Global | Replaces scattered ad-hoc success/error messages with queued system |

### Phase 2 — Medium Value, Easy Effort

| Component | Pages Affected | Why |
|---|---|---|
| `TextField` (Input + Label + FieldError) | Clone, Generate, Design, Auth, Profile | Form validation wiring + auto-linked labels |
| `SearchField` | Voices, History | Clear button + search role |
| `ToggleButtonGroup` | Clone (mode toggle), Tasks (filters), Credits (filters), DemoClipCard | Keyboard nav between toggle options |
| `Popover` + `Dialog` | Clone (InfoTip), Generate (InfoTip), Design (InfoTip) | Replaces InfoTip with focus trap + auto-positioning |

### Phase 3 — Incremental Enhancements

| Component | Pages Affected | Why |
|---|---|---|
| `Tabs` | Auth (intent toggle), Account (layout tabs) | Proper ARIA tab semantics + arrow-key nav |
| `ListBox` | Generate (task list), Design (task list) | Keyboard-navigable single-select list |
| `Select` (custom) | Generate (voice picker) | Rich option content (voice previews in dropdown) |
| `ProgressBar` | TaskDock, task cards | Semantic progress indication |

### Phase 4 — Low Priority / Optional

| Component | Pages Affected | Why |
|---|---|---|
| `Switch` | Layout (theme toggle) | Minor: replaces custom toggle button |
| `Separator` | Various | Minor: semantic `<hr>` with ARIA |
| `Disclosure` | PricingContent (FAQ items) | Make FAQ collapsible |
| `Toolbar` | TopBar keyboard shortcuts | Group navigation items with arrow-key nav |
| `Table` | Credits (activity list) | Only if sortable columns needed |

---

## 11. Installation & Tailwind Setup

### Install

```bash
npm install react-aria-components
npm install -D tailwindcss-react-aria-components
```

### Tailwind v4 CSS Setup

In your main CSS file (after `@import "tailwindcss"`):

```css
@import "tailwindcss";
@plugin "tailwindcss-react-aria-components";

/* Your existing theme variables stay as-is */
```

The plugin provides shorthand modifiers so you can write:

```
selected:bg-subtle        instead of  data-[selected]:bg-subtle
pressed:scale-95          instead of  data-[pressed]:scale-95
focus-visible:ring-2      instead of  data-[focus-visible]:ring-2
disabled:opacity-50       instead of  data-[disabled]:opacity-50
pending:cursor-wait       instead of  data-[pending]:cursor-wait
entering:animate-in       instead of  data-[entering]:animate-in
exiting:animate-out       instead of  data-[exiting]:animate-out
drop-target:border-ring   instead of  data-[drop-target]:border-ring
placement-bottom:mt-2     instead of  data-[placement=bottom]:mt-2
```

### React Aria Data Attributes Reference

Every React Aria component exposes state via `data-*` attributes for Tailwind styling:

| Attribute | Components | Meaning |
|---|---|---|
| `data-hovered` | Button, Link, ListBoxItem, Tab, etc. | Pointer hover |
| `data-pressed` | Button, ToggleButton, Tab, etc. | Active press |
| `data-selected` | ToggleButton, ListBoxItem, Tab, Checkbox, Radio | Selected state |
| `data-focus-visible` | All interactive | Keyboard focus (not mouse) |
| `data-focused` | TextField, Select, etc. | Any focus (keyboard or mouse) |
| `data-disabled` | All interactive | Disabled state |
| `data-pending` | Button | Loading/pending state |
| `data-invalid` | TextField, Select, etc. | Validation error |
| `data-placeholder` | SelectValue | No selection yet |
| `data-entering` | Modal, Popover, Tooltip, Toast | Mount animation |
| `data-exiting` | Modal, Popover, Tooltip, Toast | Unmount animation |
| `data-placement` | Popover, Tooltip | Current position (top/bottom/left/right) |
| `data-drop-target` | DropZone, collection items | Drop hover |
| `data-dragging` | Draggable items | Being dragged |
| `data-orientation` | ToggleButtonGroup, Tabs, Slider, etc. | Horizontal/vertical |
| `data-indeterminate` | Checkbox | Indeterminate state |
| `data-empty` | SearchField, ListBox | No content/no results |
| `data-sort-direction` | Table Column | ascending/descending |
| `data-current` | Breadcrumb | Current page |
| `data-expanded` | Disclosure, Tree | Expanded state |

### Render Props Alternative

All components also accept `className` as a function for conditional styling:

```tsx
<Button className={({ isPressed, isPending }) =>
  clsx("px-6 py-3 border", isPressed && "scale-95", isPending && "cursor-wait")
}>
```

---

## Summary

**Total Utter components:** ~30+
**Replaceable by React Aria:** ~15 (Button, Input, Textarea, Select, Label, Kbd, InfoTip,
Clone modal, file upload, search fields, toggle groups, tabs, task lists, toast system)
**Keep custom:** ~15+ (WaveformPlayer, TaskProvider/Dock/Badge, GridArt, SVGBlobs,
TextReveal, Skeleton, Message, PricingGrid, account UI wrappers, landing page components,
pagination)

**Biggest wins:**
1. Modal focus trapping (Clone success dialog)
2. File upload accessibility (FileTrigger + DropZone)
3. Form validation wiring (TextField + FieldError auto-linked)
4. Toast notification system (replacing scattered Message components)
5. Keyboard navigation for collections (ListBox for task lists, ToggleButtonGroup for filters)
