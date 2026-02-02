/**
 * Task Manager - Backend-Synced Multi-Task Tracking
 *
 * Polls backend /api/tasks/{id} for real-time status updates.
 * Shows persistent modal when navigating away during active tasks.
 * Dispatches events when tasks complete so pages can update their UI.
 */

class TaskManager {
  constructor() {
    this.STORAGE_KEY_PREFIX = 'utter_task_';
    this.LEGACY_STORAGE_KEY = 'utter_active_task';
    this.modal = null;
    this.modalContent = null;
    this.pollIntervals = {};
    this.timerInterval = null;
    this.initialized = false;
    this.pollRate = 1000; // Poll every 1 second
    this.maxTaskAgeMs = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Initialize the task manager
   */
  init() {
    if (this.initialized) return;

    this.modal = document.getElementById('global-task-modal');
    if (!this.modal) {
      console.warn('TaskManager: Modal element not found');
      return;
    }

    this.modalContent = this.modal.querySelector('#task-modal-content');
    if (!this.modalContent) {
      console.warn('TaskManager: Modal content element not found');
      return;
    }

    this.migrateLegacyTask();
    this.bindEvents();
    this.checkActiveTasks();
    this.updateModalUI();
    this.updateTaskBadge();
    this.initialized = true;
  }

  /**
   * Migrate old single-task storage to per-type storage
   */
  migrateLegacyTask() {
    const legacy = localStorage.getItem(this.LEGACY_STORAGE_KEY);
    if (!legacy) return;

    try {
      const task = JSON.parse(legacy);
      if (task && task.type) {
        task.dismissed = false;
        localStorage.setItem(this.getStorageKey(task.type), JSON.stringify(task));
      }
    } catch {
      // ignore malformed legacy data
    }

    localStorage.removeItem(this.LEGACY_STORAGE_KEY);
  }

  /**
   * Bind modal events
   */
  bindEvents() {
    if (!this.modal) return;

    // Click handling for task rows and buttons
    this.modal.addEventListener('click', (e) => {
      const dismissBtn = e.target.closest('.task-dismiss');
      if (dismissBtn) {
        e.stopPropagation();
        this.dismissTask(dismissBtn.dataset.type);
        return;
      }

      const cancelBtn = e.target.closest('.task-cancel');
      if (cancelBtn) {
        e.stopPropagation();
        this.cancelTask(cancelBtn.dataset.type);
        return;
      }

      const item = e.target.closest('.task-item');
      if (!item) return;

      const type = item.dataset.type;
      const task = this.getTask(type);
      if (task && task.originPage) {
        window.location.href = task.originPage;
      }
    });

    // Listen for storage changes from other tabs
    window.addEventListener('storage', (e) => {
      if (!e.key) return;

      if (e.key === this.LEGACY_STORAGE_KEY) {
        this.migrateLegacyTask();
        this.checkActiveTasks();
        this.updateModalUI();
        this.updateTaskBadge();
        return;
      }

      if (!e.key.startsWith(this.STORAGE_KEY_PREFIX)) return;

      const type = e.key.slice(this.STORAGE_KEY_PREFIX.length);
      if (e.newValue === null) {
        this.stopPolling(type);
      } else {
        const task = this.getTask(type);
        if (task && !this.isTerminalStatus(task.status) && task.taskId) {
          this.startPolling(task.taskId, type);
        }
      }

      this.updateModalUI();
      this.updateTaskBadge();
    });
  }

  /**
   * Start a new task and begin polling
   * @param {string|null} taskId - Backend task ID from /api/generate response
   * @param {string} type - 'generate' | 'clone' | 'design'
   * @param {string} originPage - The page URL where task started
   * @param {string} description - Human-readable task description
   * @param {Object} formState - Form state to preserve for restoration
   */
  startTask(taskId, type, originPage, description, formState = null) {
    if (!type) return;

    const task = {
      taskId,
      type,
      originPage,
      description,
      formState,
      startedAt: Date.now(),
      status: 'pending',
      dismissed: false,
    };

    localStorage.setItem(this.getStorageKey(type), JSON.stringify(task));

    if (taskId) {
      this.startPolling(taskId, type);
    }

    this.updateModalUI();
    this.updateTaskBadge();
  }

  /**
   * Get localStorage key for task type
   */
  getStorageKey(type) {
    return `${this.STORAGE_KEY_PREFIX}${type}`;
  }

  /**
   * Get task by type
   */
  getTask(type) {
    if (!type) {
      const tasks = this.getAllTasks();
      return tasks.length > 0 ? tasks[0] : null;
    }

    const stored = localStorage.getItem(this.getStorageKey(type));
    if (!stored) return null;

    try {
      const task = JSON.parse(stored);
      if (!task.status) task.status = 'processing';
      if (task.dismissed === undefined) task.dismissed = false;
      return task;
    } catch {
      return null;
    }
  }

  /**
   * Get all active tasks
   */
  getAllTasks() {
    const tasks = [];

    for (const type of TaskManager.TASK_TYPES) {
      const task = this.getTask(type);
      if (!task) continue;

      if (this.isTaskExpired(task)) {
        this.clearTask(type);
        continue;
      }

      tasks.push(task);
    }

    return tasks.sort((a, b) => a.startedAt - b.startedAt);
  }

  /**
   * Check if a task is expired
   */
  isTaskExpired(task) {
    if (!task.startedAt) return true;
    return Date.now() - task.startedAt > this.maxTaskAgeMs;
  }

  /**
   * Cancel a running task
   * @returns {Promise<boolean>} true if cancelled successfully
   */
  async cancelTask(type) {
    const task = this.getTask(type);
    if (!task || !task.taskId) {
      return false;
    }

    try {
      const response = await fetch(`/api/tasks/${task.taskId}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        const updatedTask = {
          ...task,
          status: 'cancelled',
          error: 'Cancelled by user',
          completedAt: Date.now(),
        };
        localStorage.setItem(this.getStorageKey(type), JSON.stringify(updatedTask));

        this.stopPolling(type);
        this.updateModalUI();
        this.updateTaskBadge();

        const event = new CustomEvent('taskCancelled', {
          detail: { type, taskId: task.taskId, storedTask: updatedTask }
        });
        window.dispatchEvent(event);

        return true;
      }
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }

    return false;
  }

  /**
   * Dismiss a task from the modal without clearing it
   */
  dismissTask(type) {
    const task = this.getTask(type);
    if (!task) return;

    task.dismissed = true;
    localStorage.setItem(this.getStorageKey(type), JSON.stringify(task));
    this.updateModalUI();
    this.updateTaskBadge();
  }

  /**
   * Clear current task from storage and UI
   */
  clearTask(type) {
    if (!type) {
      for (const taskType of TaskManager.TASK_TYPES) {
        this.clearTask(taskType);
      }
      return;
    }

    const task = this.getTask(type);

    if (task && task.taskId) {
      fetch(`/api/tasks/${task.taskId}`, { method: 'DELETE' }).catch(() => {});
    }

    localStorage.removeItem(this.getStorageKey(type));
    this.stopPolling(type);
    this.updateModalUI();
    this.updateTaskBadge();
  }

  /**
   * Alias for clearTask for backwards compatibility
   */
  completeTask(type) {
    this.clearTask(type);
  }

  /**
   * Check for active tasks on page load
   */
  checkActiveTasks() {
    const tasks = this.getAllTasks();
    const currentPath = window.location.pathname;

    tasks.forEach((task) => {
      if (task.originPage === currentPath) {
        if (this.isTerminalStatus(task.status)) {
          setTimeout(() => {
            const event = new CustomEvent('taskComplete', {
              detail: {
                type: task.type,
                taskId: task.taskId,
                status: task.status,
                result: task.result,
                error: task.error,
                storedTask: task,
              }
            });
            window.dispatchEvent(event);
            setTimeout(() => this.clearTask(task.type), 50);
          }, 100);
        } else if (task.taskId) {
          this.startPolling(task.taskId, task.type);
        }
      } else if (!this.isTerminalStatus(task.status) && task.taskId) {
        this.startPolling(task.taskId, task.type);
      }
    });
  }

  /**
   * Start polling backend for task status
   */
  startPolling(taskId, type) {
    this.stopPolling(type);

    const poll = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);

        if (!response.ok) {
          if (response.status === 404) {
            this.clearTask(type);
            return;
          }
          throw new Error('Failed to fetch task status');
        }

        const taskData = await response.json();
        this.handleTaskUpdate(type, taskData);
      } catch (error) {
        console.error(`Task poll error (${type}):`, error);
      }
    };

    poll();
    this.pollIntervals[type] = setInterval(poll, this.pollRate);
  }

  /**
   * Stop polling
   */
  stopPolling(type) {
    if (this.pollIntervals[type]) {
      clearInterval(this.pollIntervals[type]);
      delete this.pollIntervals[type];
    }
  }

  /**
   * Handle task status update from backend
   */
  handleTaskUpdate(type, taskData) {
    const storedTask = this.getTask(type);
    if (!storedTask) return;

    const status = taskData.status;
    const modalStatus = taskData.modal_status;

    const updatedTask = {
      ...storedTask,
      status,
      result: taskData.result,
      error: taskData.error,
    };

    if (this.isTerminalStatus(status)) {
      updatedTask.completedAt = Date.now();
    }

    localStorage.setItem(this.getStorageKey(type), JSON.stringify(updatedTask));

    // Dispatch a progress event so pages can show simple status
    if (!this.isTerminalStatus(status)) {
      const progressEvent = new CustomEvent('taskProgress', {
        detail: {
          type,
          taskId: taskData.id,
          status,
          statusText: this.getStatusText(status, modalStatus),
          elapsedSeconds: Math.floor((Date.now() - storedTask.startedAt) / 1000),
        }
      });
      window.dispatchEvent(progressEvent);
    }

    // Task finished
    if (this.isTerminalStatus(status)) {
      this.stopPolling(type);

      const currentPath = window.location.pathname;
      if (currentPath === storedTask.originPage) {
        const event = new CustomEvent('taskComplete', {
          detail: {
            type,
            taskId: taskData.id,
            status: status,
            result: taskData.result,
            error: taskData.error,
            storedTask: updatedTask,
          }
        });
        window.dispatchEvent(event);
        setTimeout(() => this.clearTask(type), 50);
      }
    }

    this.updateModalUI();
    this.updateTaskBadge();
  }

  /**
   * Show/hide the task modal and render tasks
   */
  updateModalUI() {
    if (!this.modal || !this.modalContent) return;

    const currentPath = window.location.pathname;
    const tasks = this.getAllTasks().filter(
      (task) => !task.dismissed && task.originPage !== currentPath
    );

    if (tasks.length === 0) {
      this.hideModal();
      return;
    }

    this.modalContent.innerHTML = tasks
      .map((task) => this.renderTaskItem(task))
      .join('');

    this.modal.classList.remove('hidden');
    this.startTimer();
  }

  /**
   * Render a single task item
   */
  renderTaskItem(task) {
    const elapsed = this.formatElapsedForTask(task);
    const icon = this.getIcon(task.type);
    const rawDescription = task.description || 'Processing...';
    const description = this.escapeHtml(this.truncate(rawDescription, 32));
    const titleText = this.escapeHtml(rawDescription);
    const cancelButton = this.shouldShowCancel(task)
      ? `<button class="task-cancel" data-type="${task.type}" title="Cancel">Cancel</button>`
      : '';

    return `
      <div class="task-item ${task.status || ''}" data-type="${task.type}" title="${titleText}">
        <span class="task-icon">${icon}</span>
        <span class="task-desc">${description}</span>
        <span class="task-elapsed">${elapsed}</span>
        ${cancelButton}
        <button class="task-dismiss" data-type="${task.type}" title="Dismiss">&times;</button>
      </div>
    `;
  }

  /**
   * Update task badge in the nav
   */
  updateTaskBadge() {
    const badge = document.getElementById('task-badge');
    if (!badge) return;

    const activeCount = this.getAllTasks().filter(
      (task) => !this.isTerminalStatus(task.status)
    ).length;

    if (activeCount > 0) {
      badge.textContent = activeCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  /**
   * Hide the task modal
   */
  hideModal() {
    if (!this.modal) return;
    this.modal.classList.add('hidden');
    this.stopTimer();
  }

  /**
   * Start elapsed time timer
   */
  startTimer() {
    this.stopTimer();

    const updateAllTimers = () => {
      const tasks = this.getAllTasks();
      tasks.forEach((task) => {
        const el = this.modal.querySelector(
          `.task-item[data-type="${task.type}"] .task-elapsed`
        );
        if (el) {
          el.textContent = this.formatElapsedForTask(task);
        }
      });
    };

    updateAllTimers();
    this.timerInterval = setInterval(updateAllTimers, 1000);
  }

  /**
   * Stop elapsed time timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Format elapsed time for in-progress tasks
   */
  formatElapsed(startedAt) {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatElapsedForTask(task) {
    if (task.status === 'completed') return 'Ready';
    if (task.status === 'failed') return 'Failed';
    if (task.status === 'cancelled') return 'Cancelled';
    return this.formatElapsed(task.startedAt);
  }

  /**
   * Helpers
   */
  getIcon(type) {
    const icons = {
      generate: '&#9654;',
      design: '&#10024;',
      clone: '&#127908;',
    };
    return icons[type] || '&#8987;';
  }

  truncate(text, maxLen) {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  }

  escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  shouldShowCancel(task) {
    return task.type === 'generate' && !this.isTerminalStatus(task.status);
  }

  isTerminalStatus(status) {
    return status === 'completed' || status === 'failed' || status === 'cancelled';
  }

  getStatusText(status, modalStatus) {
    if (modalStatus === 'queued' || status === 'pending') {
      return 'Waiting for GPU...';
    }
    if (modalStatus === 'processing' || status === 'processing') {
      return 'Generating...';
    }
    if (modalStatus === 'sending') {
      return 'Starting generation...';
    }
    return 'Processing...';
  }

  /**
   * Check if current page is origin of a task
   */
  isOnOriginPage(type) {
    const task = this.getTask(type);
    if (!task) return false;
    return window.location.pathname === task.originPage;
  }
}

TaskManager.TASK_TYPES = ['generate', 'design', 'clone'];

// Create global instance
window.taskManager = new TaskManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.taskManager.init();
});
