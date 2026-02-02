# Task Modal Simplification Plan

## Context

The floating task modal (lower-right corner) shows when users navigate away during an active generation. Looking at the screenshot and code in [task-manager.js](../../backend/static/js/task-manager.js) and [base.html](../../backend/templates/base.html), the current modal displays:

### Current Modal Content

```
┌──────────────────────────────────────────────┐
│ GENERATING "...                              │
│ Generating      1:48                         │
│ (long           elapsed                      │
│ task)...                                     │
│ (1m 40s)                                     │
│ ▶ ~15m           [CANCEL] [×]                │
│   remaining                                  │
│                                              │
│ 🔄 Long generation in progress               │
│ Est. ~15 min remaining                       │
└──────────────────────────────────────────────┘
```

### Problems Identified

1. **Redundant timing info**: Shows elapsed time in multiple places
   - "1:48 elapsed" in one section
   - "(1m 40s)" in status text
   - "~15m remaining" calculated estimate
   - "Est. ~15 min remaining" in long-task indicator

2. **Conflicting formats**: Mix of `1:48` and `1m 40s` formats

3. **Too much text**: Status text is overly verbose
   - "Generating (long task)... (1m 40s) ~15m remaining"
   - Should be simple: "Generating..."

4. **Missing after dismiss**: Once dismissed, no way to see task status

5. **Doesn't match page progress**: Modal shows different info than the generate page's progress section

## Goals

1. **Simplify modal display**: One elapsed time, one status, clean layout
2. **Consistent info**: Same data shown in modal and on-page progress
3. **Recover dismissed tasks**: Task list accessible from some UI element
4. **Support multiple tasks**: See [multi-task-manager-plan.md](./multi-task-manager-plan.md)

## Technical Approach

### 1. Simplified Modal HTML

Update [base.html](../../backend/templates/base.html):

```html
<!-- Floating task indicator - minimal by default -->
<div id="global-task-modal" class="task-modal hidden">
    <div class="task-modal-content" id="task-modal-content">
        <!-- Dynamically populated -->
    </div>
</div>
```

### 2. Minimal Task Item Template

Each task shows only essential info:

```javascript
renderTaskItem(task) {
    const elapsed = this.formatElapsed(task.startedAt);
    const icon = { generate: '▶', design: '✨', clone: '🎤' }[task.type];
    const description = this.truncate(task.description, 25);
    
    return `
        <div class="task-item ${task.status}" data-type="${task.type}">
            <span class="task-icon">${icon}</span>
            <span class="task-desc">${description}</span>
            <span class="task-elapsed">${elapsed}</span>
            <button class="task-cancel" data-type="${task.type}" title="Cancel">Cancel</button>
            <button class="task-dismiss" data-type="${task.type}" title="Dismiss">×</button>
        </div>
    `;
}
```

Visual result:

```
┌────────────────────────────────────────────────┐
│ ▶ Generating "Hello..."     1:48  [Cancel] [×] │
└────────────────────────────────────────────────┘
```

Or with multiple tasks:

```
┌────────────────────────────────────────────────┐
│ ▶ Generating "Hello..."     1:48  [Cancel] [×] │
│ ✨ Designing voice...       0:32  [Cancel] [×] │
└────────────────────────────────────────────────┘
```

### 3. Remove Redundant Elements

Remove from modal:
- ❌ Long-task indicator section (redundant)
- ❌ Modal status detailed breakdown
- ❌ Estimated time remaining (unreliable)
- ❌ Poll count display

Keep:
- ✅ Task type icon
- ✅ Short description
- ✅ Single elapsed timer (mm:ss format)
- ✅ Cancel button
- ✅ Dismiss button

### 4. On-Page Progress Section Alignment

The generate page ([generate.html](../../backend/templates/generate.html)) has its own progress section:

```html
<div class="generation-progress hidden" id="generation-progress">
    <div class="progress-spinner"></div>
    <div class="progress-info">
        <div class="progress-title">Generating speech...</div>
        <div class="progress-status" id="progress-status">Connecting to Modal...</div>
        <div class="progress-time">
            <span class="progress-elapsed" id="progress-elapsed">0:00</span>
            <span class="progress-elapsed-label">elapsed</span>
        </div>
        <div class="progress-hint">First generation may take 30–90s while the GPU warms up</div>
    </div>
</div>
```

**Sync the data sources**: Both modal and page should use the same values:

```javascript
// In task-manager.js
handleTaskUpdate(type, taskData) {
    const task = this.getTask(type);
    if (!task) return;
    
    // Determine simple status text
    let statusText = 'Processing...';
    if (taskData.modal_status === 'queued') {
        statusText = 'Waiting for GPU...';
    } else if (taskData.modal_status === 'processing') {
        statusText = 'Generating...';
    }
    
    // Dispatch single progress event with normalized data
    const event = new CustomEvent('taskProgress', {
        detail: {
            type,
            taskId: taskData.id,
            statusText,  // Simple status for display
            elapsedSeconds: Math.floor((Date.now() - task.startedAt) / 1000),
        }
    });
    window.dispatchEvent(event);
}
```

Both modal and page listen to same event:

```javascript
// Page listens for its type
window.addEventListener('taskProgress', (e) => {
    if (e.detail.type !== 'generate') return;
    
    const progressStatus = document.getElementById('progress-status');
    if (progressStatus) {
        progressStatus.textContent = e.detail.statusText;
    }
});

// Modal updates its elapsed time from timer (not event)
```

### 5. Elapsed Time: Single Source

Use task's `startedAt` timestamp as the single source:

```javascript
startTimer() {
    this.stopTimer();
    
    const updateAllTimers = () => {
        const tasks = this.getAllTasks();
        tasks.forEach(task => {
            const el = document.querySelector(`.task-item[data-type="${task.type}"] .task-elapsed`);
            if (el) {
                el.textContent = this.formatElapsed(task.startedAt);
            }
        });
    };
    
    updateAllTimers();
    this.timerInterval = setInterval(updateAllTimers, 1000);
}

formatElapsed(startedAt) {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

### 6. Dismiss Behavior

When user clicks dismiss (×):

```javascript
dismissTask(type) {
    const task = this.getTask(type);
    if (task) {
        task.dismissed = true;
        localStorage.setItem(this.getStorageKey(type), JSON.stringify(task));
    }
    
    // Remove from modal UI
    this.updateModalUI();
    
    // Keep polling - task still running
    // Page will show result when user returns
}
```

### 7. Task Indicator Badge (Optional)

Show a persistent indicator that tasks exist even when modal is dismissed:

```html
<!-- In header nav -->
<a href="/history" class="nav-link">
    History
    <span id="task-badge" class="task-badge hidden">1</span>
</a>
```

```javascript
updateTaskBadge() {
    const activeTasks = this.getAllTasks().filter(t => 
        t.status === 'processing' || t.status === 'pending'
    );
    
    const badge = document.getElementById('task-badge');
    if (badge) {
        if (activeTasks.length > 0) {
            badge.textContent = activeTasks.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}
```

## CSS Updates

Update [style.css](../../backend/static/css/style.css):

```css
/* Simplified task modal */
.task-modal {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--bg);
    border: 1px solid var(--border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-width: 350px;
}

.task-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
}

.task-item:last-child {
    border-bottom: none;
}

.task-item:hover {
    background: var(--bg-subtle);
}

.task-icon {
    font-size: 14px;
    width: 20px;
    text-align: center;
}

.task-desc {
    flex: 1;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.task-elapsed {
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}

.task-cancel,
.task-dismiss {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 12px;
}

.task-cancel:hover {
    color: var(--error);
}

.task-dismiss:hover {
    color: var(--text);
}

/* Task badge in nav */
.task-badge {
    background: var(--accent);
    color: var(--bg);
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 4px;
}
```

## Implementation Order

1. **Update modal HTML** - Simplify structure
2. **Refactor renderModal** - Use minimal template
3. **Remove redundant status** - Single elapsed, simple status text
4. **Sync page progress** - Use taskProgress event
5. **Dismiss behavior** - Keep task, hide from modal
6. **Task badge** - Optional indicator in nav

## Dependencies

- Requires [multi-task-manager-plan.md](./multi-task-manager-plan.md) for multi-task support
- Updates will also need to sync with on-page progress sections

## Testing

1. Verify modal shows single elapsed time (not duplicated)
2. Verify same elapsed shown in modal and page progress
3. Verify dismiss hides from modal but page still shows progress
4. Verify click on task item navigates to origin page
5. Verify cancel button stops generation
