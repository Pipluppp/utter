# UX Improvement Plans

> **Date**: 2026-02-02  
> **Focus**: Generation state persistence, time tracking, and marketing-ready about page

---

## Overview

Three main UX pain points to address:

| Issue | User Impact | Priority |
|-------|-------------|----------|
| State loss on navigation | User loses progress when switching pages during generation | 🔴 High |
| No time visibility | User has no sense of how long generation takes | 🟡 Medium |
| Unclear feature marketing | User doesn't understand what Utter offers at a glance | 🟡 Medium |

---

## 1. Generation State Persistence & Global Task Modal

### Problem Diagnosis

**Root Cause**: Utter is a traditional Multi-Page Application (MPA) using Jinja2 templates. Each navigation triggers a full page reload, destroying all JavaScript state.

**Current Behavior:**
```
User starts generation on /generate
         ↓
User clicks "Clone" nav link
         ↓
Full page reload to /clone
         ↓
❌ All JS state lost (fetch promise, UI state, elapsed timer)
         ↓
Backend + Modal.com still processing...
         ↓
User returns to /generate → Fresh page, no result
```

**Why Backend Can't Help Alone:**
- Current `/api/generate` is synchronous — blocks until audio is ready
- No task ID system exists
- No polling/status endpoint

### Solution Architecture

**Two-Phase Approach:**

#### Phase 1: Client-Side State Persistence (Quick Win)

Use `localStorage` to track active tasks across page navigations.

```
┌─────────────────────────────────────────────────────────────┐
│  base.html (all pages)                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  <div id="global-task-modal"> (bottom-right corner)   │  │
│  │    - Shows when task is active                        │  │
│  │    - Persists across page navigations                 │  │
│  │    - Click → navigates back to origin page            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  localStorage:                                              │
│  {                                                          │
│    "utter_active_task": {                                   │
│      "type": "generate" | "clone" | "design",               │
│      "startedAt": 1706832000000,                            │
│      "originPage": "/generate",                             │
│      "description": "Generating speech..."                  │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Limitation**: If user navigates away, fetch is cancelled. Task modal shows "In Progress" but result is lost.

#### Phase 2: Backend Task Queue (Full Solution)

Convert to async task system with polling.

```
POST /api/generate
  → Returns { task_id: "abc123", status: "processing" }

GET /api/tasks/{task_id}
  → Returns { status: "processing" | "completed" | "failed", progress: 0.5, audio_url?: "..." }

Frontend polls every 2s until complete
```

**Recommendation**: Implement Phase 1 first for immediate UX improvement, then Phase 2 for full robustness.

### Task Breakdown

#### Task 1.1: Global Task Modal Component
**File**: `backend/templates/base.html`, `backend/static/css/style.css`

Add persistent modal to base template:
```html
<!-- Global Task Modal (bottom-right) -->
<div id="global-task-modal" class="task-modal hidden">
  <div class="task-modal-content">
    <div class="task-modal-icon">⏳</div>
    <div class="task-modal-info">
      <div class="task-modal-title">Generating...</div>
      <div class="task-modal-time">0:00 elapsed</div>
    </div>
    <button class="task-modal-close" title="View task">→</button>
  </div>
</div>
```

CSS styling:
```css
.task-modal {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  padding: 12px 16px;
  z-index: 1000;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
}

.task-modal:hover {
  transform: translateY(-2px);
  border-color: var(--accent-primary);
}

.task-modal.hidden {
  display: none;
}
```

#### Task 1.2: Task Manager JavaScript Module
**File**: `backend/static/js/task-manager.js` (new file)

```javascript
/**
 * Global Task Manager
 * Persists task state across page navigations using localStorage
 */
class TaskManager {
  constructor() {
    this.STORAGE_KEY = 'utter_active_task';
    this.modal = null;
    this.timerInterval = null;
  }

  init() {
    this.modal = document.getElementById('global-task-modal');
    this.checkActiveTask();
    this.bindEvents();
  }

  startTask(type, originPage, description) {
    const task = {
      type,
      originPage,
      description,
      startedAt: Date.now(),
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(task));
    this.showModal(task);
  }

  completeTask() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.hideModal();
  }

  checkActiveTask() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      const task = JSON.parse(stored);
      // Only show if on different page than origin
      if (window.location.pathname !== task.originPage) {
        this.showModal(task);
      }
    }
  }

  showModal(task) {
    // Update modal content and start timer
  }

  hideModal() {
    // Stop timer and hide
  }
}

window.taskManager = new TaskManager();
document.addEventListener('DOMContentLoaded', () => window.taskManager.init());
```

#### Task 1.3: Integrate with Generate Page
**File**: `backend/static/js/app.js`

Modify `initGeneratePage()`:
```javascript
// Before fetch:
window.taskManager.startTask('generate', '/generate', `Generating "${text.slice(0, 30)}..."`);

// On success/error:
window.taskManager.completeTask();
```

#### Task 1.4: Integrate with Clone Page
**File**: `backend/static/js/app.js`

Modify `initClonePage()`:
```javascript
// Before fetch:
window.taskManager.startTask('clone', '/clone', `Cloning "${voiceName}"`);

// On success/error:
window.taskManager.completeTask();
```

#### Task 1.5: Integrate with Design Page
**File**: `backend/templates/design.html`

Modify inline script for preview generation:
```javascript
// Before fetch:
window.taskManager.startTask('design', '/design', 'Generating voice preview...');

// On success/error:
window.taskManager.completeTask();
```

#### Task 1.6: Handle Page Return (Restore State)
**File**: `backend/static/js/app.js`

When returning to origin page:
```javascript
// On page load, check if we're the origin page with active task
const task = JSON.parse(localStorage.getItem('utter_active_task'));
if (task && window.location.pathname === task.originPage) {
  // Clear task (user is back on origin page)
  localStorage.removeItem('utter_active_task');
  // Optionally show "Task was interrupted" message
}
```

### Acceptance Criteria

- [ ] Global task modal appears in bottom-right when navigating away during generation
- [ ] Modal shows task type icon, description, and elapsed time
- [ ] Clicking modal navigates back to origin page
- [ ] Modal disappears when on origin page
- [ ] Timer continues counting across page navigations
- [ ] Task state persists through browser refresh (within reason)

---

## 2. Live Time Tracking

### Problem

Users wait 30-90+ seconds for generation with no feedback beyond "Generating... Xs" in the button.

### Solution

Enhance the elapsed time display to be more prominent and informative.

### Task Breakdown

#### Task 2.1: Prominent Time Display During Generation
**Files**: `backend/templates/generate.html`, `backend/static/css/style.css`

Add a dedicated progress section that appears during generation:

```html
<div id="generation-progress" class="generation-progress hidden">
  <div class="progress-spinner"></div>
  <div class="progress-info">
    <div class="progress-title">Generating speech...</div>
    <div class="progress-time">
      <span class="progress-elapsed">0:00</span> elapsed
    </div>
    <div class="progress-hint">First generation may take 30-90s (GPU warm-up)</div>
  </div>
</div>
```

```css
.generation-progress {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  margin-top: 24px;
}

.progress-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.progress-elapsed {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.progress-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 4px;
}
```

#### Task 2.2: Update Generate Page JS
**File**: `backend/static/js/app.js`

```javascript
// Show progress section during generation
const progressSection = document.getElementById('generation-progress');
const progressElapsed = progressSection.querySelector('.progress-elapsed');

progressSection.classList.remove('hidden');

const startTime = Date.now();
const updateTimer = () => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  progressElapsed.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
};

const timerInterval = setInterval(updateTimer, 1000);
updateTimer();

// On complete:
clearInterval(timerInterval);
progressSection.classList.add('hidden');
```

#### Task 2.3: Add Time Tracking to Clone Page
**File**: `backend/templates/clone.html`

Similar progress display for voice cloning.

#### Task 2.4: Add Time Tracking to Design Page
**File**: `backend/templates/design.html`

Similar progress display for voice design preview generation.

### Acceptance Criteria

- [ ] Large, visible elapsed time counter during generation
- [ ] Spinner animation indicates activity
- [ ] Helpful hint about expected wait times
- [ ] Timer stops and hides when generation completes
- [ ] Works on Generate, Clone, and Design pages

---

## 3. Marketing About Page & Per-Page Guides

### Problem

1. Current landing page doesn't clearly communicate what Utter offers
2. Users don't understand the three features (Clone, Design, Generate)
3. No guidance on how to use features effectively
4. No expectations set for generation times or model capabilities

### Solution

Create a clean, marketing-style landing page inspired by Vocloner, plus collapsible guides on each feature page.

### Design Reference (Vocloner-inspired)

```
┌─────────────────────────────────────────────────────────────────────┐
│  UTTER                                      Clone  Design  Generate │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Clone Any Voice.                          ┌─────────────────┐     │
│   Design New Ones.                          │   [Waveform     │     │
│   Generate Speech.                          │    Animation]   │     │
│                                             └─────────────────┘     │
│   Powered by Qwen3-TTS. 10 languages.                               │
│   Open-source. Runs on your own GPU.                                │
│                                                                     │
│   [ Get Started → ]                                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│   │  🎤 Clone    │  │  ✨ Design   │  │  ▶ Generate  │              │
│   │              │  │              │  │              │              │
│   │  Upload any  │  │  Describe a  │  │  Type text,  │              │
│   │  voice clip  │  │  voice in    │  │  hear it     │              │
│   │  to clone it │  │  plain text  │  │  spoken      │              │
│   │              │  │              │  │              │              │
│   │  10s-5min    │  │  No audio    │  │  Up to 5000  │              │
│   │  reference   │  │  needed      │  │  characters  │              │
│   └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Expectations                                                      │
│   ────────────                                                      │
│   • First generation: 30-90s (GPU cold start)                       │
│   • Subsequent: ~2.5x audio length                                  │
│   • Best with clear, noise-free reference audio                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Task Breakdown

#### Task 3.1: Redesign Landing Page (index.html)
**File**: `backend/templates/index.html`

Clean, minimal marketing page with:
- Hero section with tagline
- Three feature cards (Clone, Design, Generate)
- Brief expectations/constraints section
- Single CTA button

```html
{% extends "base.html" %}

{% block title %}Utter - AI Voice Cloning & Generation{% endblock %}

{% block content %}
<div class="landing">
  <!-- Hero Section -->
  <section class="hero">
    <h1 class="hero-title">
      Clone Any Voice.<br>
      Design New Ones.<br>
      Generate Speech.
    </h1>
    <p class="hero-subtitle">
      Powered by Qwen3-TTS. 10 languages. Open-source.
    </p>
    <a href="/clone" class="btn btn-lg">Get Started →</a>
  </section>

  <!-- Features Section -->
  <section class="features">
    <div class="feature-card">
      <div class="feature-icon">🎤</div>
      <h3>Clone</h3>
      <p>Upload a voice clip (10s-5min) to create a digital replica.</p>
      <a href="/clone">Clone a voice →</a>
    </div>
    
    <div class="feature-card">
      <div class="feature-icon">✨</div>
      <h3>Design</h3>
      <p>Describe a voice in plain text. No audio upload needed.</p>
      <a href="/design">Design a voice →</a>
    </div>
    
    <div class="feature-card">
      <div class="feature-icon">▶</div>
      <h3>Generate</h3>
      <p>Type up to 5000 characters. Hear it spoken in any voice.</p>
      <a href="/generate">Generate speech →</a>
    </div>
  </section>

  <!-- Expectations Section -->
  <section class="expectations">
    <h2>What to Expect</h2>
    <ul>
      <li><strong>First generation:</strong> 30-90 seconds (GPU warm-up)</li>
      <li><strong>Subsequent:</strong> ~2.5× the audio duration</li>
      <li><strong>Best results:</strong> Clear audio, minimal background noise</li>
      <li><strong>Languages:</strong> English, Chinese, Japanese, Korean, + 6 more</li>
    </ul>
  </section>
</div>
{% endblock %}
```

#### Task 3.2: Landing Page Styles
**File**: `backend/static/css/style.css`

```css
/* Landing Page */
.landing {
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px;
}

.hero {
  text-align: center;
  padding: 64px 0;
}

.hero-title {
  font-size: 2.5rem;
  line-height: 1.2;
  margin-bottom: 16px;
}

.hero-subtitle {
  color: var(--text-secondary);
  font-size: 1.1rem;
  margin-bottom: 32px;
}

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin: 64px 0;
}

.feature-card {
  padding: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  text-align: center;
}

.feature-icon {
  font-size: 2rem;
  margin-bottom: 12px;
}

.feature-card h3 {
  margin-bottom: 8px;
}

.feature-card p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.expectations {
  padding: 32px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
}

.expectations h2 {
  margin-bottom: 16px;
}

.expectations li {
  margin-bottom: 8px;
  color: var(--text-secondary);
}

.expectations strong {
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .features {
    grid-template-columns: 1fr;
  }
}
```

#### Task 3.3: Per-Page Collapsible Guide Component
**File**: `backend/static/js/app.js`, `backend/static/css/style.css`

Create a reusable collapsible guide component:

```html
<details class="page-guide">
  <summary class="page-guide-toggle">
    <span>ℹ️ Tips & Expectations</span>
    <span class="page-guide-chevron">▼</span>
  </summary>
  <div class="page-guide-content">
    <!-- Page-specific content -->
  </div>
</details>
```

```css
.page-guide {
  margin-bottom: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
}

.page-guide-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
}

.page-guide-toggle:hover {
  background: var(--bg-tertiary);
}

.page-guide[open] .page-guide-chevron {
  transform: rotate(180deg);
}

.page-guide-content {
  padding: 16px;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.page-guide-content ul {
  margin: 8px 0;
  padding-left: 20px;
}

.page-guide-content li {
  margin-bottom: 4px;
}
```

#### Task 3.4: Clone Page Guide
**File**: `backend/templates/clone.html`

Add after page title:
```html
<details class="page-guide">
  <summary class="page-guide-toggle">
    <span>ℹ️ Tips for Best Results</span>
    <span class="page-guide-chevron">▼</span>
  </summary>
  <div class="page-guide-content">
    <p><strong>Model:</strong> Qwen3-TTS-12Hz-0.6B-Base</p>
    <ul>
      <li><strong>Audio length:</strong> 10 seconds to 5 minutes</li>
      <li><strong>Quality:</strong> Clear audio with minimal background noise</li>
      <li><strong>Transcript:</strong> Accurate transcript improves voice matching</li>
      <li><strong>Processing time:</strong> 10-30 seconds typically</li>
    </ul>
    <p><strong>Supported formats:</strong> WAV, MP3, M4A (max 50MB)</p>
  </div>
</details>
```

#### Task 3.5: Generate Page Guide
**File**: `backend/templates/generate.html`

Add after page title:
```html
<details class="page-guide">
  <summary class="page-guide-toggle">
    <span>ℹ️ Tips for Best Results</span>
    <span class="page-guide-chevron">▼</span>
  </summary>
  <div class="page-guide-content">
    <p><strong>Model:</strong> Qwen3-TTS-12Hz-0.6B-Base</p>
    <ul>
      <li><strong>Max text:</strong> 5000 characters per generation</li>
      <li><strong>Punctuation:</strong> Use periods for pauses, commas for brief breaks</li>
      <li><strong>First generation:</strong> 30-90 seconds (GPU cold start)</li>
      <li><strong>Subsequent:</strong> ~2.5× the output audio duration</li>
    </ul>
    <p><strong>Example:</strong> 60 seconds of audio ≈ 2.5 minutes to generate</p>
  </div>
</details>
```

#### Task 3.6: Design Page Guide
**File**: `backend/templates/design.html`

Add after subtitle:
```html
<details class="page-guide">
  <summary class="page-guide-toggle">
    <span>ℹ️ Tips for Best Results</span>
    <span class="page-guide-chevron">▼</span>
  </summary>
  <div class="page-guide-content">
    <p><strong>Model:</strong> Qwen3-TTS-12Hz-1.7B-VoiceDesign</p>
    <ul>
      <li><strong>Description:</strong> Be specific about tone, gender, age, accent</li>
      <li><strong>Preview text:</strong> Keep it short (under 500 chars) for faster previews</li>
      <li><strong>Processing time:</strong> 15-45 seconds per preview</li>
      <li><strong>Saving:</strong> Preview audio becomes the reference for long-form generation</li>
    </ul>
    <p><strong>Good descriptions:</strong> "A warm, friendly female voice with a gentle British accent"</p>
  </div>
</details>
```

#### Task 3.7: Update About Page
**File**: `backend/templates/about.html`

Transform into a detailed documentation page (for users who want more info):
```html
{% extends "base.html" %}

{% block title %}About - Utter{% endblock %}

{% block content %}
<h1 class="title-page">About Utter</h1>

<div class="about-content">
  <section class="about-section">
    <h2>The Technology</h2>
    <p>Utter is powered by <strong>Qwen3-TTS</strong>, an open-source text-to-speech model family from Alibaba. We run two models:</p>
    <ul>
      <li><strong>Qwen3-TTS-12Hz-0.6B-Base</strong> — Voice cloning from reference audio</li>
      <li><strong>Qwen3-TTS-12Hz-1.7B-VoiceDesign</strong> — Voice creation from text descriptions</li>
    </ul>
    <p>Models run on Modal.com's serverless GPU infrastructure (NVIDIA A10G).</p>
  </section>

  <section class="about-section">
    <h2>Features</h2>
    <table class="about-table">
      <tr>
        <td><strong>Clone</strong></td>
        <td>Upload 10s-5min audio to create a voice replica</td>
      </tr>
      <tr>
        <td><strong>Design</strong></td>
        <td>Describe a voice in text, no audio needed</td>
      </tr>
      <tr>
        <td><strong>Generate</strong></td>
        <td>Convert up to 5000 characters to speech</td>
      </tr>
    </table>
  </section>

  <section class="about-section">
    <h2>Supported Languages</h2>
    <p>English, Chinese, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian</p>
  </section>

  <section class="about-section">
    <h2>Performance Expectations</h2>
    <ul>
      <li><strong>Cold start:</strong> 30-90 seconds (GPU spin-up)</li>
      <li><strong>Generation speed:</strong> ~2.5× audio duration</li>
      <li><strong>Best results:</strong> Clear reference audio, accurate transcripts</li>
    </ul>
  </section>

  <section class="about-section">
    <h2>Privacy & Ethics</h2>
    <p>Only clone voices you have permission to use. Audio files are stored locally and not shared with third parties.</p>
  </section>
</div>
{% endblock %}
```

### Acceptance Criteria

- [ ] Landing page clearly communicates three features
- [ ] Clean, minimal design inspired by Vocloner
- [ ] Feature cards link to respective pages
- [ ] Expectations section sets realistic timing expectations
- [ ] Each feature page has collapsible guide with model info
- [ ] Guides include processing time estimates
- [ ] About page has detailed documentation for curious users

---

## Implementation Order

### Phase 1: State Persistence + Task Modal (Day 1-2)
1. Task 1.1: Global Task Modal Component
2. Task 1.2: Task Manager JavaScript Module
3. Task 1.3-1.5: Integrate with all pages
4. Task 1.6: Handle page return

### Phase 2: Marketing About Page + Guides (Day 2-3)
1. Task 3.1-3.2: Landing page redesign
2. Task 3.3: Guide component
3. Task 3.4-3.6: Per-page guides
4. Task 3.7: About page update

### Phase 3: Time Tracking Enhancement (Day 3)
1. Task 2.1: Progress display component
2. Task 2.2-2.4: Integrate with all pages

---

## File Changes Summary

| File | Changes |
|------|---------|
| `backend/templates/base.html` | Add global task modal, include task-manager.js |
| `backend/static/js/task-manager.js` | **New file** - Global task state management |
| `backend/static/js/app.js` | Integrate task manager, enhance time display |
| `backend/static/css/style.css` | Task modal styles, landing page styles, guide styles |
| `backend/templates/index.html` | Complete redesign as marketing landing |
| `backend/templates/clone.html` | Add collapsible guide, progress display |
| `backend/templates/generate.html` | Add collapsible guide, progress display |
| `backend/templates/design.html` | Add collapsible guide, progress display |
| `backend/templates/about.html` | Detailed documentation page |

---

## Future Considerations (Phase 2 Backend)

If client-side state persistence proves insufficient:

1. **Add task queue system** (Redis or in-memory)
2. **Async generation endpoint**: `POST /api/generate` → `{ task_id }`
3. **Status polling endpoint**: `GET /api/tasks/{id}` → `{ status, progress, result }`
4. **WebSocket for real-time updates** (optional)

This would allow:
- True background processing
- Progress percentage (if model supports it)
- Result retrieval after page refresh
- Multiple concurrent generations

---

## Notes

- Models used: `Qwen3-TTS-12Hz-0.6B-Base` (clone/generate), `Qwen3-TTS-12Hz-1.7B-VoiceDesign` (design)
- GPU: NVIDIA A10G on Modal.com
- Current generation is synchronous (blocking)
- 2.5× audio duration is approximate based on benchmark results
