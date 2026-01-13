# Design System (Source of Truth)

> **Aesthetic**: Gatsby Carbon theme (sharp edges, monospace, dark)  
> **Layout inspiration**: ElevenLabs (simple, focused)  
> **Implementation**: Vanilla HTML/CSS/JS only

---

## Design References

### ElevenLabs UI
- Dark theme (#161616 background)
- Sidebar navigation (left)
- Main content area (center) - text input
- Settings panel (right) - sliders
- Clean, functional, no decoration

### Gatsby Carbon Theme
- **Sharp edges** - `border-radius: 0` everywhere
- **IBM Plex Mono** - Monospace font for everything
- **Dark backgrounds** - Near-black (#161616, #1e1e1e)
- **Uppercase labels** - With letter-spacing
- **Flat design** - No shadows, no gradients
- **Minimal** - Only what's necessary

---

## Core Principles

| Principle | Implementation |
|-----------|---------------|
| **Sharp edges** | `border-radius: 0` everywhere |
| **Monospace font** | IBM Plex Mono for everything |
| **Dark theme** | Near-black backgrounds, light text |
| **Minimal** | Only essential UI elements |
| **Functional** | Focus on the task, no decoration |

---

## Color Palette

```css
:root {
  /* Backgrounds */
  --bg-primary: #161616;      /* Main background */
  --bg-secondary: #1e1e1e;    /* Cards, panels */
  --bg-tertiary: #262626;     /* Hover states, inputs */
  --bg-elevated: #2a2a2a;     /* Dropdowns, modals */
  
  /* Text */
  --text-primary: #f4f4f4;    /* Main text */
  --text-secondary: #a8a8a8;  /* Secondary text, labels */
  --text-muted: #6f6f6f;      /* Hints, disabled */
  
  /* Accent */
  --accent-primary: #0f62fe;  /* Primary buttons, links */
  --accent-hover: #0353e9;    /* Button hover */
  
  /* Borders */
  --border-subtle: #393939;   /* Subtle borders */
  --border-strong: #525252;   /* Input borders */
  
  /* States */
  --success: #24a148;
  --error: #da1e28;
  --warning: #f1c21b;
  
  /* Focus */
  --focus-outline: #ffffff;
}
```

### Color Usage

| Element | Color |
|---------|-------|
| Page background | `--bg-primary` (#161616) |
| Cards/panels | `--bg-secondary` (#1e1e1e) |
| Input fields | `--bg-tertiary` (#262626) |
| Primary text | `--text-primary` (#f4f4f4) |
| Labels/hints | `--text-secondary` (#a8a8a8) |
| Buttons | `--accent-primary` (#0f62fe) |
| Borders | `--border-subtle` (#393939) |

---

## Typography

### Font Stack

```css
:root {
  --font-mono: 'IBM Plex Mono', 'Consolas', 'Monaco', monospace;
}

* {
  font-family: var(--font-mono);
}
```

### Font Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### Type Scale

| Element | Size | Weight | Use |
|---------|------|--------|-----|
| Page title | 24px | 600 | Main headings |
| Section title | 18px | 500 | Card headers |
| Body | 14px | 400 | Default text |
| Label | 12px | 500 | Form labels |
| Helper | 12px | 400 | Hints, captions |

```css
.title-page { font-size: 24px; font-weight: 600; }
.title-section { font-size: 18px; font-weight: 500; }
.text-body { font-size: 14px; font-weight: 400; }
.text-label { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
.text-helper { font-size: 12px; font-weight: 400; color: var(--text-secondary); }
```

---

## Spacing

Use a 4px base unit:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
}
```

| Spacing | Value | Use |
|---------|-------|-----|
| `--space-2` | 8px | Tight spacing (icon gaps) |
| `--space-3` | 12px | Form gaps |
| `--space-4` | 16px | Standard padding |
| `--space-5` | 24px | Section padding |
| `--space-6` | 32px | Large gaps |

---

## Components

### Buttons

```css
.btn {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 500;
  padding: 12px 24px;
  border: none;
  border-radius: 0;           /* Sharp edges! */
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-primary {
  background: var(--accent-primary);
  color: #ffffff;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  background: var(--bg-tertiary);
  color: var(--text-muted);
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-strong);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
}
```

### Visual

```
┌─────────────────────┐     ┌─────────────────────┐
│   Primary Button    │     │  Secondary Button   │
└─────────────────────┘     └─────────────────────┘
     Blue fill                   Border only
     White text                  Light text
```

---

### Inputs

```css
.input {
  font-family: var(--font-mono);
  font-size: 14px;
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 0;           /* Sharp edges! */
  color: var(--text-primary);
  transition: border-color 0.15s;
}

.input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.input::placeholder {
  color: var(--text-muted);
}

.input-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
```

### Textarea

```css
.textarea {
  font-family: var(--font-mono);
  font-size: 14px;
  width: 100%;
  min-height: 200px;
  padding: 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 0;
  color: var(--text-primary);
  resize: vertical;
}
```

---

### Select (Dropdown)

```css
.select {
  font-family: var(--font-mono);
  font-size: 14px;
  width: 100%;
  padding: 12px 16px;
  padding-right: 40px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 0;
  color: var(--text-primary);
  appearance: none;
  background-image: url("data:image/svg+xml,..."); /* Chevron icon */
  background-repeat: no-repeat;
  background-position: right 16px center;
  cursor: pointer;
}
```

---

### File Upload (Dropzone)

```css
.dropzone {
  width: 100%;
  padding: 48px 24px;
  background: var(--bg-secondary);
  border: 2px dashed var(--border-strong);
  border-radius: 0;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.dropzone:hover {
  border-color: var(--accent-primary);
  background: var(--bg-tertiary);
}

.dropzone.dragover {
  border-color: var(--accent-primary);
  background: rgba(15, 98, 254, 0.1);
}

.dropzone-icon {
  font-size: 32px;
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.dropzone-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.dropzone-text strong {
  color: var(--accent-primary);
}
```

---

### Cards/Panels

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 0;
  padding: 24px;
}

.card-title {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 16px;
}
```

---

### Audio Player

Simple, minimal custom player:

```css
.audio-player {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
}

.audio-player-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-primary);
  border: none;
  border-radius: 0;
  color: white;
  cursor: pointer;
}

.audio-player-progress {
  flex: 1;
  height: 4px;
  background: var(--bg-tertiary);
  position: relative;
}

.audio-player-progress-fill {
  height: 100%;
  background: var(--accent-primary);
  width: 0%;
}

.audio-player-time {
  font-size: 12px;
  color: var(--text-secondary);
}
```

---

## Page Layouts

### Clone Page (`/clone`)

```
┌─────────────────────────────────────────────────────────────────┐
│  UTTER                                           [Clone] [Gen]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      CLONE YOUR VOICE                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              📁 Drop audio file here                    │   │
│  │                  or click to browse                     │   │
│  │                                                         │   │
│  │              WAV, MP3, M4A • 10s - 5min                 │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  VOICE NAME                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ My Custom Voice                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   CREATE VOICE CLONE                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Generate Page (`/generate`)

```
┌─────────────────────────────────────────────────────────────────┐
│  UTTER                                           [Clone] [Gen]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                     GENERATE SPEECH                             │
│                                                                 │
│  VOICE                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ My Custom Voice                                       ▼ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  TEXT                                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │ Enter text to speak...                                  │   │
│  │                                                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  0 / 500 characters                                             │
│                                                                 │
│  💡 Use commas for pauses. End sentences with periods.          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   🔊 GENERATE SPEECH                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ▶  ════════════════░░░░░░░  0:05 / 0:12   [Download]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layout CSS

```css
/* Base reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.5;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

/* Main container */
.container {
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 24px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-subtle);
}

.header-logo {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.header-nav {
  display: flex;
  gap: 8px;
}

.header-nav a {
  padding: 8px 16px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-nav a:hover,
.header-nav a.active {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

/* Page title */
.page-title {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 32px;
  text-transform: uppercase;
  letter-spacing: 2px;
}

/* Form groups */
.form-group {
  margin-bottom: 24px;
}

/* Divider */
.divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 32px 0;
}
```

---

## States

### Loading

```css
.btn-loading {
  position: relative;
  color: transparent;
}

.btn-loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Error

```css
.error-message {
  padding: 12px 16px;
  background: rgba(218, 30, 40, 0.1);
  border-left: 3px solid var(--error);
  color: var(--error);
  font-size: 12px;
}
```

### Success

```css
.success-message {
  padding: 12px 16px;
  background: rgba(36, 161, 72, 0.1);
  border-left: 3px solid var(--success);
  color: var(--success);
  font-size: 12px;
}
```

---

## Full CSS File Structure

```
static/
└── css/
    └── style.css
        ├── CSS Variables (colors, spacing, fonts)
        ├── Reset
        ├── Typography utilities
        ├── Layout (container, header)
        ├── Components
        │   ├── Buttons
        │   ├── Inputs
        │   ├── Textarea
        │   ├── Select
        │   ├── Dropzone
        │   ├── Cards
        │   └── Audio player
        └── States (loading, error, success)
```

---

## Icons

Use simple Unicode/emoji icons to avoid dependencies:

| Icon | Use | Symbol |
|------|-----|--------|
| Upload | Dropzone | 📁 or ⬆️ |
| Play | Audio player | ▶ |
| Pause | Audio player | ⏸ |
| Download | Download button | ⬇️ |
| Speaker | Generate button | 🔊 |
| Check | Success | ✓ |
| Error | Error state | ✕ |

Or use inline SVGs for cleaner look:

```html
<!-- Play icon -->
<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <path d="M4 2l10 6-10 6V2z"/>
</svg>

<!-- Download icon -->
<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <path d="M8 12l-4-4h2.5V2h3v6H12L8 12zM2 14h12v2H2v-2z"/>
</svg>
```

---

## Responsive

Keep it simple - single column, mobile-first:

```css
.container {
  max-width: 640px;
  padding: 48px 24px;
}

@media (max-width: 480px) {
  .container {
    padding: 24px 16px;
  }
  
  .page-title {
    font-size: 20px;
  }
}
```

---

## Example HTML Structure

### Clone Page

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clone Voice - Utter</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
  <header class="header">
    <div class="header-logo">UTTER</div>
    <nav class="header-nav">
      <a href="/clone" class="active">Clone</a>
      <a href="/generate">Generate</a>
    </nav>
  </header>
  
  <main class="container">
    <h1 class="page-title">Clone Your Voice</h1>
    
    <form id="clone-form">
      <div class="form-group">
        <div class="dropzone" id="dropzone">
          <div class="dropzone-icon">📁</div>
          <div class="dropzone-text">
            <strong>Drop audio file here</strong> or click to browse
          </div>
          <div class="dropzone-hint">WAV, MP3, M4A • 10 seconds to 5 minutes</div>
        </div>
        <input type="file" id="audio-input" accept=".wav,.mp3,.m4a" hidden>
      </div>
      
      <div class="form-group">
        <label class="input-label">Voice Name</label>
        <input type="text" class="input" id="voice-name" placeholder="My Custom Voice">
      </div>
      
      <button type="submit" class="btn btn-primary" style="width: 100%;">
        Create Voice Clone
      </button>
    </form>
  </main>
  
  <script src="/static/js/app.js"></script>
</body>
</html>
```

---

## Checklist

- [ ] IBM Plex Mono font loaded
- [ ] CSS variables for colors defined
- [ ] `border-radius: 0` on all elements
- [ ] Dark backgrounds (#161616, #1e1e1e)
- [ ] Uppercase labels with letter-spacing
- [ ] Minimal hover states (subtle)
- [ ] No shadows (flat design)
- [ ] No gradients (solid colors only)
