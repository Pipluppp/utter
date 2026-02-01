/**
 * Task Manager - Backend-Synced Task Tracking
 * 
 * Polls backend /api/tasks/{id} for real-time status updates.
 * Shows persistent modal when navigating away during active task.
 * Dispatches events when tasks complete so pages can update their UI.
 */

class TaskManager {
  constructor() {
    this.STORAGE_KEY = 'utter_active_task';
    this.modal = null;
    this.pollInterval = null;
    this.timerInterval = null;
    this.initialized = false;
    this.pollRate = 1000; // Poll every 1 second
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

    this.modalTitle = this.modal.querySelector('.task-modal-title');
    this.modalTime = this.modal.querySelector('.task-modal-time');
    this.modalIcon = this.modal.querySelector('.task-modal-icon');
    this.modalStatus = this.modal.querySelector('.task-modal-status');

    this.bindEvents();
    this.checkActiveTask();
    this.initialized = true;
  }

  /**
   * Bind modal events
   */
  bindEvents() {
    if (!this.modal) return;

    // Click on modal (not dismiss button) navigates to origin page
    this.modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-modal-dismiss')) {
        e.stopPropagation();
        this.clearTask();
        return;
      }
      
      const task = this.getStoredTask();
      if (task && task.originPage) {
        window.location.href = task.originPage;
      }
    });
    
    // Listen for storage changes from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_KEY) {
        if (e.newValue === null) {
          this.hideModal();
          this.stopPolling();
        } else {
          this.checkActiveTask();
        }
      }
    });
  }

  /**
   * Start a new task and begin polling
   * @param {string} taskId - Backend task ID from /api/generate response
   * @param {string} type - 'generate' | 'clone' | 'design'
   * @param {string} originPage - The page URL where task started
   * @param {string} description - Human-readable task description
   * @param {Object} formState - Form state to preserve for restoration
   */
  startTask(taskId, type, originPage, description, formState = null) {
    const task = {
      taskId,
      type,
      originPage,
      description,
      formState,
      startedAt: Date.now(),
    };
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(task));
    
    // Start polling backend for status
    this.startPolling(taskId);
    
    // Don't show modal on origin page
    this.hideModal();
  }

  /**
   * Get stored task from localStorage
   * @returns {Object|null}
   */
  getStoredTask() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  /**
   * Alias for getStoredTask for backwards compatibility
   */
  getTask() {
    return this.getStoredTask();
  }

  /**
   * Get form state from stored task
   * @returns {Object|null}
   */
  getFormState() {
    const task = this.getStoredTask();
    return task ? task.formState : null;
  }

  /**
   * Clear current task from storage and UI
   */
  clearTask() {
    const task = this.getStoredTask();
    
    // Optionally delete task from backend
    if (task && task.taskId) {
      fetch(`/api/tasks/${task.taskId}`, { method: 'DELETE' }).catch(() => {});
    }
    
    localStorage.removeItem(this.STORAGE_KEY);
    this.hideModal();
    this.stopPolling();
    this.stopTimer();
    
    // Remove completed/failed state classes
    if (this.modal) {
      this.modal.classList.remove('task-complete', 'task-failed');
    }
  }

  /**
   * Alias for clearTask for backwards compatibility
   */
  completeTask() {
    this.clearTask();
  }

  /**
   * Check for active task on page load
   * @returns {Object|null} task if on origin page
   */
  checkActiveTask() {
    const task = this.getStoredTask();
    
    if (!task) {
      this.hideModal();
      return null;
    }

    // Check for stale tasks (over 10 minutes old)
    const maxAge = 10 * 60 * 1000;
    if (Date.now() - task.startedAt > maxAge) {
      this.clearTask();
      return null;
    }

    const currentPath = window.location.pathname;
    
    // If on origin page
    if (currentPath === task.originPage) {
      this.hideModal();
      
      // If task is already completed, dispatch event so page can show result
      if (task.status === 'completed' || task.status === 'failed') {
        // Dispatch event after a short delay to let page JS initialize
        setTimeout(() => {
          const event = new CustomEvent('taskComplete', {
            detail: {
              taskId: task.taskId,
              status: task.status,
              result: task.result,
              error: task.error,
              storedTask: task,
            }
          });
          window.dispatchEvent(event);
          
          // Clear task after page handles it
          setTimeout(() => this.clearTask(), 50);
        }, 100);
      } else {
        // Task still in progress, start polling
        this.startPolling(task.taskId);
      }
      
      return task;
    }

    // On different page, show modal
    this.showModal(task);
    
    // If task not yet complete, keep polling
    if (task.status !== 'completed' && task.status !== 'failed') {
      this.startPolling(task.taskId);
    } else {
      // Task already complete, update modal to show complete state
      if (this.modalStatus) {
        this.modalStatus.textContent = task.status === 'completed' ? 'Complete! Click to view' : 'Failed';
      }
      if (this.modalTime) {
        this.modalTime.textContent = 'Ready';
      }
      this.modal.classList.add(task.status === 'completed' ? 'task-complete' : 'task-failed');
      this.stopTimer();
    }
    
    return null;
  }

  /**
   * Start polling backend for task status
   * @param {string} taskId
   */
  startPolling(taskId) {
    this.stopPolling();
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            // Task not found on backend, clear local state
            this.clearTask();
            return;
          }
          throw new Error('Failed to fetch task status');
        }
        
        const taskData = await response.json();
        this.handleTaskUpdate(taskData);
        
      } catch (error) {
        console.error('Task poll error:', error);
      }
    };
    
    // Initial poll immediately
    poll();
    
    // Continue polling at interval
    this.pollInterval = setInterval(poll, this.pollRate);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Handle task status update from backend
   * @param {Object} taskData - Task data from /api/tasks/{id}
   */
  handleTaskUpdate(taskData) {
    const storedTask = this.getStoredTask();
    if (!storedTask) return;
    
    const status = taskData.status;
    
    // Update modal status text if visible
    if (this.modalStatus && !this.modal.classList.contains('hidden')) {
      const statusText = {
        pending: 'Queued...',
        processing: 'Generating...',
        completed: 'Complete! Click to view',
        failed: 'Failed',
      };
      this.modalStatus.textContent = statusText[status] || status;
      
      // Add visual indicator for completed state
      if (status === 'completed') {
        this.modal.classList.add('task-complete');
        this.stopTimer();
        if (this.modalTime) {
          this.modalTime.textContent = 'Ready';
        }
      } else if (status === 'failed') {
        this.modal.classList.add('task-failed');
      }
    }
    
    // Task finished
    if (status === 'completed' || status === 'failed') {
      this.stopPolling();
      
      // Save result/error to stored task so origin page can use it
      const updatedTask = {
        ...storedTask,
        status: status,
        result: taskData.result,
        error: taskData.error,
        completedAt: Date.now(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedTask));
      
      const currentPath = window.location.pathname;
      
      // If on origin page, dispatch event immediately so page can handle
      if (currentPath === storedTask.originPage) {
        const event = new CustomEvent('taskComplete', {
          detail: {
            taskId: taskData.id,
            status: status,
            result: taskData.result,
            error: taskData.error,
            storedTask: storedTask,
          }
        });
        window.dispatchEvent(event);
        
        // Clear task after page handles it
        setTimeout(() => this.clearTask(), 50);
      }
      // If on different page, keep task in storage so user can navigate back
      // Task will be handled when they return to origin page
    }
  }

  /**
   * Show the task modal with current task info
   * @param {Object} task
   */
  showModal(task) {
    if (!this.modal) return;

    const icons = {
      generate: '▶',
      clone: '🎤',
      design: '✨',
    };
    
    if (this.modalIcon) {
      this.modalIcon.textContent = icons[task.type] || '⏳';
    }

    if (this.modalTitle) {
      this.modalTitle.textContent = task.description || 'Processing...';
    }
    
    if (this.modalStatus) {
      this.modalStatus.textContent = 'Processing...';
    }

    // Start elapsed time display
    this.startTimer(task.startedAt);

    this.modal.classList.remove('hidden');
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
   * @param {number} startedAt - Timestamp when task started
   */
  startTimer(startedAt) {
    this.stopTimer();

    const updateTime = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      
      if (this.modalTime) {
        this.modalTime.textContent = `${mins}:${secs.toString().padStart(2, '0')} elapsed`;
      }
    };

    updateTime();
    this.timerInterval = setInterval(updateTime, 1000);
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
   * Check if there's an active task
   * @returns {boolean}
   */
  hasActiveTask() {
    return this.getStoredTask() !== null;
  }

  /**
   * Check if current page is origin of active task
   * @returns {boolean}
   */
  isOnOriginPage() {
    const task = this.getStoredTask();
    if (!task) return false;
    return window.location.pathname === task.originPage;
  }
}

// Create global instance
window.taskManager = new TaskManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.taskManager.init();
});
