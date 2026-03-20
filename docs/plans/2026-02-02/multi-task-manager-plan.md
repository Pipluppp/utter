# Multi-Task Manager Plan

## Context

The current `TaskManager` class in [task-manager.js](../../backend/static/js/task-manager.js) has a fundamental limitation: **it only tracks a single task at a time**. This causes problems when users:

1. Start a voice generation, then start a voice design
2. Navigate between pages while multiple tasks are running
3. Have tasks from different features competing for the same storage slot

### Current Architecture

```javascript
class TaskManager {
    STORAGE_KEY = 'utter_active_task';  // Single task!
    
    startTask(taskId, type, originPage, description, formState) {
        // Overwrites any existing task!
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(task));
    }
}
```

### Problem Scenarios

1. **User starts Generate → navigates → starts Design**
   - Generate task is overwritten by Design task
   - Generate completes but user never sees result
   - Modal only shows Design task

2. **User dismisses modal**
   - Task is completely cleared (`clearTask()`)
   - No way to recover or see status
   - Progress on origin page is lost

## Goals

1. **Multiple concurrent tasks**: Track Generate, Design, Clone tasks independently
2. **Task persistence**: Dismissing modal should not destroy task state
3. **Unified task list**: Modal can show all active tasks
4. **Per-page restoration**: Each page restores its own task on load

## Technical Approach

### 1. Multi-Task Storage

Change from single task to task-per-type storage:

```javascript
class TaskManager {
    STORAGE_KEY_PREFIX = 'utter_task_';  // utter_task_generate, utter_task_design, etc.
    
    // Task types
    static TASK_TYPES = ['generate', 'design', 'clone'];
    
    getStorageKey(type) {
        return `${this.STORAGE_KEY_PREFIX}${type}`;
    }
    
    /**
     * Start a task of a specific type
     */
    startTask(taskId, type, originPage, description, formState = null) {
        const task = {
            taskId,
            type,
            originPage,
            description,
            formState,
            startedAt: Date.now(),
            status: 'processing',
            dismissed: false,  // Track if user dismissed modal
        };
        
        localStorage.setItem(this.getStorageKey(type), JSON.stringify(task));
        this.startPolling(taskId, type);
    }
    
    /**
     * Get task by type
     */
    getTask(type) {
        const stored = localStorage.getItem(this.getStorageKey(type));
        return stored ? JSON.parse(stored) : null;
    }
    
    /**
     * Get all active tasks
     */
    getAllTasks() {
        const tasks = [];
        for (const type of TaskManager.TASK_TYPES) {
            const task = this.getTask(type);
            if (task && !this.isTaskExpired(task)) {
                tasks.push(task);
            }
        }
        return tasks;
    }
    
    /**
     * Clear task of specific type
     */
    clearTask(type) {
        localStorage.removeItem(this.getStorageKey(type));
        this.stopPolling(type);
    }
}
```

### 2. Multi-Task Modal

The floating modal should show all active tasks, not just one:

```html
<!-- Updated modal in base.html -->
<div id="global-task-modal" class="task-modal hidden">
    <div class="task-modal-list" id="task-modal-list">
        <!-- Dynamically populated -->
    </div>
    <button class="task-modal-collapse" title="Minimize">−</button>
</div>
```

Modal rendering:

```javascript
updateModalUI() {
    const tasks = this.getAllTasks().filter(t => 
        !t.dismissed && 
        t.originPage !== window.location.pathname &&
        t.status !== 'completed'
    );
    
    if (tasks.length === 0) {
        this.hideModal();
        return;
    }
    
    const listEl = document.getElementById('task-modal-list');
    listEl.innerHTML = tasks.map(task => `
        <div class="task-modal-item" data-type="${task.type}">
            <div class="task-modal-icon">${this.getIcon(task.type)}</div>
            <div class="task-modal-info">
                <div class="task-modal-title">${task.description}</div>
                <div class="task-modal-status">${this.getStatusText(task)}</div>
            </div>
            <div class="task-modal-time">${this.getElapsedTime(task)}</div>
            <button class="task-modal-dismiss" data-type="${task.type}">×</button>
        </div>
    `).join('');
    
    this.showModal();
}
```

### 3. Dismiss vs Clear Behavior

**Key change**: Dismissing a task from the modal should NOT clear it:

```javascript
// Dismiss: hide from modal, keep polling, keep state
dismissTask(type) {
    const task = this.getTask(type);
    if (task) {
        task.dismissed = true;
        localStorage.setItem(this.getStorageKey(type), JSON.stringify(task));
    }
    this.updateModalUI();  // Re-render without this task
}

// Clear: actually remove task (used when task completes and user sees result)
clearTask(type) {
    localStorage.removeItem(this.getStorageKey(type));
    this.stopPolling(type);
    this.updateModalUI();
}
```

### 4. Per-Type Polling

Maintain separate polling intervals per task type:

```javascript
class TaskManager {
    pollIntervals = {};  // { generate: intervalId, design: intervalId }
    timerIntervals = {}; // { generate: intervalId, design: intervalId }
    
    startPolling(taskId, type) {
        this.stopPolling(type);
        
        const poll = async () => {
            const task = this.getTask(type);
            if (!task) {
                this.stopPolling(type);
                return;
            }
            
            try {
                const response = await fetch(`/api/tasks/${taskId}`);
                if (!response.ok) {
                    if (response.status === 404) {
                        this.clearTask(type);
                        return;
                    }
                    return;
                }
                
                const taskData = await response.json();
                this.handleTaskUpdate(type, taskData);
            } catch (error) {
                console.error(`Poll error for ${type}:`, error);
            }
        };
        
        poll();
        this.pollIntervals[type] = setInterval(poll, this.pollRate);
    }
    
    stopPolling(type) {
        if (this.pollIntervals[type]) {
            clearInterval(this.pollIntervals[type]);
            delete this.pollIntervals[type];
        }
    }
}
```

### 5. Page-Specific Restoration

Each page checks for its specific task type on load:

```javascript
// In generate page
function checkAndRestoreActiveTask() {
    const task = window.taskManager.getTask('generate');
    if (!task || task.originPage !== '/generate') return;
    
    // Restore form state
    if (task.formState) {
        voiceSelect.value = task.formState.voiceId;
        textInput.value = task.formState.text;
        // etc.
    }
    
    // Show appropriate UI based on status
    if (task.status === 'processing') {
        showGeneratingState(task);
    } else if (task.status === 'completed') {
        // taskComplete event will fire
    }
}

// In design page
function checkAndRestoreActiveTask() {
    const task = window.taskManager.getTask('design');
    if (!task || task.originPage !== '/design') return;
    
    // Similar restoration logic
}
```

### 6. Event Dispatch Per Type

Events should include task type for filtering:

```javascript
handleTaskUpdate(type, taskData) {
    // ... update local storage ...
    
    if (taskData.status === 'completed' || taskData.status === 'failed') {
        const event = new CustomEvent('taskComplete', {
            detail: {
                type,
                taskId: taskData.id,
                status: taskData.status,
                result: taskData.result,
                error: taskData.error,
            }
        });
        window.dispatchEvent(event);
    }
}

// Page listeners filter by type
window.addEventListener('taskComplete', (e) => {
    if (e.detail.type !== 'generate') return;
    // Handle generate completion
});
```

## UI Changes

### Modal Simplification

The modal currently shows redundant info. Simplify to:

```
┌─────────────────────────────────────────────┐
│ ▶ Generating "Hello world..."     1:48  ×   │
│ ✨ Designing voice preview...     0:32  ×   │
└─────────────────────────────────────────────┘
```

Each row:
- Icon (▶ generate, ✨ design, 🎤 clone)
- Short description (truncated)
- Elapsed time (from startedAt, live updating)
- Dismiss button (×)

Click row → navigate to origin page

### On-Page Progress Sync

The generate page's progress section should sync with TaskManager:

```javascript
// Listen for progress updates
window.addEventListener('taskProgress', (e) => {
    if (e.detail.type !== 'generate') return;
    
    const progressStatus = document.getElementById('progress-status');
    if (progressStatus) {
        progressStatus.textContent = e.detail.statusText;
    }
});
```

## Implementation Order

1. **Refactor storage** - Change to per-type keys
2. **Update modal** - Multi-task list UI
3. **Dismiss vs clear** - Separate behaviors
4. **Per-type polling** - Independent poll intervals
5. **Page restoration** - Update each page's restore logic
6. **Event filtering** - Add type to events
7. **UI polish** - Simplified modal, sync progress

## Migration

For users with existing `utter_active_task` in localStorage:

```javascript
init() {
    // Migrate old single-task storage
    const oldTask = localStorage.getItem('utter_active_task');
    if (oldTask) {
        const task = JSON.parse(oldTask);
        if (task.type) {
            localStorage.setItem(this.getStorageKey(task.type), oldTask);
        }
        localStorage.removeItem('utter_active_task');
    }
    
    // Continue with initialization
}
```

## Dependencies

- Coordinates with [task-modal-simplification-plan.md](./task-modal-simplification-plan.md) for UI
- Coordinates with [history-enhancements-plan.md](./history-enhancements-plan.md) for showing in-progress items

## Testing

1. Start Generate → Start Design → verify both tracked
2. Dismiss Generate modal → verify still polls, page shows progress
3. Navigate to Generate page → verify state restored
4. Complete Design → verify Generate unaffected
5. Refresh page → verify both tasks survive
