# Navbar Keyboard Shortcut Styling Improvements Plan (2026-02-05)

> **Scope**: `frontend/src/components/ui/Kbd.tsx` + `frontend/src/styles/index.css` + `frontend/src/app/Layout.tsx`
> **Goal**: Improve the visual appearance of keyboard shortcut indicators (`<kbd>`) in the navbar to match modern design patterns with inset shadows, grayish backgrounds, and better typography contrast.

---

## Current State

### Kbd Component (`Kbd.tsx`)
```tsx
'inline-flex items-center rounded border border-border-strong bg-subtle px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground normal-case'
```

**Issues identified:**
1. Flat appearance - no depth or shadow to give a "key cap" feel
2. Background color (`bg-subtle`) is too close to page background
3. Border is visible but doesn't contribute to the inset/raised look
4. Text color (`text-muted-foreground`) blends in rather than standing out

### Reference Design Analysis
The reference screenshot shows kbd indicators with:
- Grayish/neutral background with more contrast against the page
- Subtle inset shadow giving a "pressed key" or "recessed" appearance
- Clean, monospace typography that stands out

---

## Proposed Changes

### 1) Add Geist Mono as Secondary Font

**Why**: Geist Mono provides excellent legibility at small sizes and has a distinctive, modern appearance that differentiates UI chrome from body content.

**Implementation**:
- Add Geist Mono font to the project (via Google Fonts or local files)
- Define a new CSS variable `--font-mono-ui` for UI-specific monospace text
- Apply to kbd elements and optionally to navbar labels

**CSS (`index.css`)**:
```css
@theme {
  --font-mono-ui:
    "Geist Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
}
```

**Font loading** (add to `index.html` or via CSS `@import`):
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

### 2) Update Kbd Styling with Inset Shadow

**New design tokens** (add to `index.css`):

```css
@theme {
  /* Kbd-specific colors */
  --color-kbd-bg: #e8e8e8;
  --color-kbd-border: #d0d0d0;
  --color-kbd-text: #333333;
  --color-kbd-shadow: rgba(0, 0, 0, 0.08);
}

.dark {
  --color-kbd-bg: #2a2a2a;
  --color-kbd-border: #3a3a3a;
  --color-kbd-text: #cccccc;
  --color-kbd-shadow: rgba(0, 0, 0, 0.25);
}
```

**Updated Kbd component classes**:
```tsx
className={cn(
  'inline-flex items-center justify-center',
  'min-w-[18px] px-1.5 py-0.5',
  'rounded border border-kbd-border bg-kbd-bg',
  'text-[10px] font-medium leading-none text-kbd-text',
  'shadow-[inset_0_-1px_0_rgba(0,0,0,0.1),0_1px_2px_var(--color-kbd-shadow)]',
  'font-[family-name:var(--font-mono-ui)]',
  'normal-case',
  className,
)}
```

**Shadow breakdown**:
- `inset_0_-1px_0` - subtle bottom inset shadow for depth
- `0_1px_2px` - soft outer shadow for lift
- Combined creates the "physical key" appearance

---

### 3) Navbar Text Prominence (Optional Enhancement)

**Goal**: Make navigation labels more prominent using darker text and optionally Geist Mono.

**Current NavItem text**:
```tsx
'text-[12px] uppercase tracking-wide text-muted-foreground'
```

**Proposed NavItem text**:
```tsx
'text-[12px] uppercase tracking-wide text-foreground/80 font-medium'
```

Changes:
- `text-muted-foreground` → `text-foreground/80` (darker, more prominent)
- Add `font-medium` for slightly bolder weight

---

## Implementation Checklist

1. **Add Geist Mono font**
   - Add font link to `index.html`
   - Define `--font-mono-ui` variable in `index.css`

2. **Add kbd design tokens**
   - Add `--color-kbd-bg`, `--color-kbd-border`, `--color-kbd-text`, `--color-kbd-shadow` to light theme
   - Add corresponding dark mode overrides

3. **Update Kbd.tsx component**
   - Apply new background, border, text colors
   - Add inset + outer shadow
   - Apply Geist Mono font family
   - Add `min-w-[18px]` and `justify-center` for consistent sizing

4. **Update navbar text styling** (optional)
   - Update NavItem text color to be more prominent
   - Consider applying Geist Mono to nav labels

5. **Visual QA**
   - Test in light mode
   - Test in dark mode
   - Verify contrast ratios meet WCAG AA (4.5:1 for text)
   - Check hover/focus states still look correct

---

## Visual Comparison

| Aspect | Current | Proposed |
|--------|---------|----------|
| Background | `#fafafa` (subtle) | `#e8e8e8` (kbd-bg) |
| Border | `#999999` (border-strong) | `#d0d0d0` (kbd-border) |
| Text | `#555555` (muted-foreground) | `#333333` (kbd-text) |
| Shadow | None | Inset + outer shadow |
| Font | IBM Plex Mono | Geist Mono |
| Depth | Flat | Raised/inset key cap feel |

---

## Acceptance Criteria

- Kbd elements have a visible "key cap" appearance with shadows
- Background is noticeably grayer than surrounding content
- Text is darker and more legible
- Geist Mono font is applied and rendering correctly
- Dark mode maintains the same design language
- No visual regressions in other components using similar patterns
