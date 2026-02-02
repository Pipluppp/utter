/**
 * Utter Voice Clone - Frontend JavaScript
 * Handles dropzone, forms, and audio player
 */

// ============================================================================
// Utility Functions
// ============================================================================

function showError(message) {
  const container = document.getElementById('error-container');
  if (container) {
    container.textContent = message;
    container.classList.remove('hidden', 'success');
    container.classList.add('error');
  }
}

function showSuccess(message) {
  const container = document.getElementById('error-container');
  if (container) {
    container.textContent = message;
    container.classList.remove('hidden', 'error');
    container.classList.add('success');
  }
}

function showInfo(message) {
  const container = document.getElementById('error-container');
  if (container) {
    container.textContent = message;
    container.classList.remove('hidden', 'error', 'success');
    container.classList.add('info');
  }
}

function hideError() {
  const container = document.getElementById('error-container');
  if (container) {
    container.classList.add('hidden');
    container.classList.remove('error', 'success');
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showCloneSuccessModal(voiceData) {
  // Remove any existing modal
  const existingModal = document.getElementById('clone-success-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'clone-success-modal';
  modal.className = 'clone-success-modal';
  modal.innerHTML = `
    <div class="clone-success-content">
      <div class="clone-success-icon">✓</div>
      <h2 class="clone-success-title">Voice Created!</h2>
      <p class="clone-success-name">"${voiceData.name}"</p>
      <p class="clone-success-message">Your voice clone is ready to use.</p>
      <div class="clone-success-actions">
        <a href="/generate?voice=${voiceData.id}" class="btn btn-primary clone-success-btn">
          Generate Speech →
        </a>
        <button type="button" class="btn btn-secondary clone-success-btn" id="clone-another-btn">
          Clone Another Voice
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Animate in
  requestAnimationFrame(() => {
    modal.classList.add('visible');
  });

  // Clone another button resets the form
  document.getElementById('clone-another-btn').addEventListener('click', () => {
    modal.classList.remove('visible');
    setTimeout(() => {
      modal.remove();
      // Reset the form
      const form = document.getElementById('clone-form');
      if (form) form.reset();
      const fileInfo = document.getElementById('file-info');
      if (fileInfo) fileInfo.classList.add('hidden');
      const dropzone = document.getElementById('dropzone');
      if (dropzone) dropzone.classList.remove('has-file');
      const submitBtn = document.getElementById('submit-btn');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.textContent = 'Create Voice Clone';
      }
      const transcriptCounter = document.getElementById('transcript-counter');
      if (transcriptCounter) transcriptCounter.textContent = '0 chars';
      hideError();
    }, 300);
  });
}

// ============================================================================
// Clone Page - Dropzone
// ============================================================================

function initClonePage() {
  const dropzone = document.getElementById('dropzone');
  const audioInput = document.getElementById('audio-input');
  const fileInfo = document.getElementById('file-info');
  const form = document.getElementById('clone-form');
  const submitBtn = document.getElementById('submit-btn');
  const transcriptInput = document.getElementById('transcript');
  const transcriptCounter = document.getElementById('transcript-counter');
  const tryExampleBtn = document.getElementById('try-example-btn');

  if (!dropzone || !audioInput) return;

  let selectedFile = null;

  // Try Example Button
  if (tryExampleBtn) {
    tryExampleBtn.addEventListener('click', async () => {
      hideError();
      tryExampleBtn.disabled = true;
      tryExampleBtn.textContent = 'Loading Example...';

      try {
        // Fetch example text
        const textRes = await fetch('/static/examples/audio_text.txt');
        if (!textRes.ok) throw new Error('Failed to load example text');
        const text = await textRes.text();

        // Fetch example audio
        const audioRes = await fetch('/static/examples/audio.wav');
        if (!audioRes.ok) throw new Error('Failed to load example audio');
        const blob = await audioRes.blob();
        const file = new File([blob], "example_audio.wav", { type: "audio/wav" });

        // Populate form
        document.getElementById('voice-name').value = "Example Voice";
        if (transcriptInput) {
            transcriptInput.value = text;
            transcriptInput.dispatchEvent(new Event('input'));
        }
        
        // Handle file selection
        handleFileSelect(file);
        
        showInfo('Example loaded! Click "Create Voice Clone" to continue.');
      } catch (err) {
        showError('Could not load example: ' + err.message);
      } finally {
        tryExampleBtn.disabled = false;
        tryExampleBtn.textContent = 'Try Example Voice';
      }
    });
  }

  // Transcript character counter
  if (transcriptInput && transcriptCounter) {
    transcriptInput.addEventListener('input', () => {
      transcriptCounter.textContent = `${transcriptInput.value.length} chars`;
    });
  }
  
  // Click to browse
  dropzone.addEventListener('click', () => {
    audioInput.click();
  });
  
  // Drag and drop events
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });
  
  // File input change
  audioInput.addEventListener('change', () => {
    if (audioInput.files.length > 0) {
      handleFileSelect(audioInput.files[0]);
    }
  });
  
  function handleFileSelect(file) {
    hideError();
    
    // Validate file type
    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'];
    const validExtensions = ['.wav', '.mp3', '.m4a'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      showError('File must be WAV, MP3, or M4A');
      return;
    }
    
    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      showError('File size cannot exceed 50MB');
      return;
    }
    
    selectedFile = file;
    
    // Update dropzone appearance
    dropzone.classList.add('has-file');
    
    // Show file info
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileInfo.textContent = `Selected: ${file.name} (${sizeMB} MB)`;
    fileInfo.classList.remove('hidden');
  }
  
  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    if (!selectedFile) {
      showError('Please select an audio file');
      return;
    }

    const voiceName = document.getElementById('voice-name').value.trim();
    if (!voiceName) {
      showError('Please enter a voice name');
      return;
    }

    const transcript = document.getElementById('transcript').value.trim();
    if (!transcript || transcript.length < 10) {
      showError('Please provide a transcript of the reference audio (at least 10 characters)');
      return;
    }

    const language = document.getElementById('language-select').value;

    // Get progress elements
    const progressSection = document.getElementById('clone-progress');
    const progressElapsed = document.getElementById('clone-elapsed');

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('btn-loading');
    
    // Show progress section
    if (progressSection) {
      progressSection.classList.remove('hidden');
    }

    // Start elapsed time counter
    const startTime = Date.now();
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      
      submitBtn.textContent = `Creating... ${timeStr}`;
      if (progressElapsed) {
        progressElapsed.textContent = timeStr;
      }
    };
    
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    try {
      const formData = new FormData();
      formData.append('name', voiceName);
      formData.append('audio', selectedFile);
      formData.append('transcript', transcript);
      formData.append('language', language);
      
      const response = await fetch('/api/clone', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create voice');
      }
      
      // Stop timer
      clearInterval(timerInterval);
      
      // Hide progress section
      if (progressSection) {
        progressSection.classList.add('hidden');
      }

      // Show success modal instead of instant redirect
      showCloneSuccessModal(data);
      
    } catch (error) {
      // Stop timer
      clearInterval(timerInterval);
      
      // Hide progress section
      if (progressSection) {
        progressSection.classList.add('hidden');
      }

      showError(error.message);
      submitBtn.disabled = false;
      submitBtn.classList.remove('btn-loading');
      submitBtn.textContent = 'Create Voice Clone';
    }
  });
}

// ============================================================================
// Generate Page
// ============================================================================

function initGeneratePage() {
  const voiceSelect = document.getElementById('voice-select');
  const textInput = document.getElementById('text-input');
  const charCounter = document.getElementById('char-counter');
  const form = document.getElementById('generate-form');
  const generateBtn = document.getElementById('generate-btn');
  const resultSection = document.getElementById('result-section');
  const audioElement = document.getElementById('audio-element');
  const playBtn = document.getElementById('play-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');

  const timeDisplay = document.getElementById('time-display');
  const downloadBtn = document.getElementById('download-btn');
  
  if (!voiceSelect) return;
  
  // Load voices, then check for active task
  loadVoices().then(() => {
    checkAndRestoreActiveTask();
  });
  
  async function loadVoices() {
    try {
      const response = await fetch('/api/voices');
      const data = await response.json();
      
      voiceSelect.innerHTML = '<option value="">Select a voice...</option>';
      
      if (data.voices.length === 0) {
        voiceSelect.innerHTML = '<option value="">No voices available - clone one first</option>';
        return;
      }
      
      data.voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = voice.name;
        voiceSelect.appendChild(option);
      });
      
      // Pre-select voice from URL param (e.g., /generate?voice=xxx)
      const urlParams = new URLSearchParams(window.location.search);
      const voiceParam = urlParams.get('voice');
      if (voiceParam && voiceSelect.querySelector(`option[value="${voiceParam}"]`)) {
        voiceSelect.value = voiceParam;
      }
      
    } catch (error) {
      console.error('Failed to load voices:', error);
    }
  }

  // Check if returning to page with active task and restore state
  function checkAndRestoreActiveTask() {
    if (!window.taskManager) return;
    
    const task = window.taskManager.getTask('generate');
    if (!task || task.originPage !== '/generate') {
      return;
    }

    // We have a generate task for this page - restore form state
    const formState = task.formState;
    
    if (formState) {
      // Restore form state
      if (formState.voiceId && voiceSelect.querySelector(`option[value="${formState.voiceId}"]`)) {
        voiceSelect.value = formState.voiceId;
      }
      if (formState.text) {
        textInput.value = formState.text;
        textInput.dispatchEvent(new Event('input'));
      }
      const languageSelect = document.getElementById('language-select');
      if (formState.language && languageSelect) {
        languageSelect.value = formState.language;
      }
    }

    // If task is already completed, the taskComplete event will be dispatched by TaskManager
    // after this function returns. The event listener will handle showing the result.
    // We just need to show a brief loading state.
    
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      // Task already done - event will fire shortly, just show brief loading
      generateBtn.disabled = true;
      generateBtn.textContent = 'Loading result...';
      return;
    }

    // Task still in progress - show loading state with timer
    const progressSection = document.getElementById('generation-progress');
    const progressElapsed = document.getElementById('progress-elapsed');
    
    if (progressSection) {
      progressSection.classList.remove('hidden');
    }
    
    generateBtn.disabled = true;
    generateBtn.classList.add('btn-loading');
    generateBtn.textContent = 'Generating...';

    // Start timer from original start time
    const startTime = task.startedAt;
    window._generateTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      
      generateBtn.textContent = `Generating... ${timeStr}`;
      if (progressElapsed) {
        progressElapsed.textContent = timeStr;
      }
    }, 1000);
    
    // Trigger immediate timer update
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    generateBtn.textContent = `Generating... ${timeStr}`;
    if (progressElapsed) {
      progressElapsed.textContent = timeStr;
    }
    
    showInfo('Generation in progress. Result will appear when ready.');
  }
  
  // Character counter
  if (textInput && charCounter) {
    textInput.addEventListener('input', () => {
      const length = textInput.value.length;
      const max = 10000;
      charCounter.textContent = `${length} / ${max}`;

      if (length >= max) {
        charCounter.classList.add('error');
        charCounter.classList.remove('warning');
      } else if (length >= max * 0.9) {
        charCounter.classList.add('warning');
        charCounter.classList.remove('error');
      } else {
        charCounter.classList.remove('warning', 'error');
      }
    });
  }
  
  // Form submission - starts async task and polls for completion
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    // If this is a restored task, clear it first
    if (generateBtn.dataset.isRestored === 'true') {
      if (window.taskManager) {
        window.taskManager.clearTask('generate');
      }
      delete generateBtn.dataset.isRestored;
    }
    
    const voiceId = voiceSelect.value;
    const text = textInput.value.trim();
    const languageSelect = document.getElementById('language-select');
    const language = languageSelect ? languageSelect.value : 'Auto';
    const model = '0.6B';

    if (!voiceId) {
      showError('Please select a voice');
      return;
    }

    if (!text) {
      showError('Please enter text to speak');
      return;
    }

    // Get progress elements
    const progressSection = document.getElementById('generation-progress');
    const progressElapsed = document.getElementById('progress-elapsed');
    const progressStatus = document.getElementById('progress-status');

    // Show loading state
    generateBtn.disabled = true;
    generateBtn.classList.add('btn-loading');
    generateBtn.textContent = 'Generating...';

    // Show progress section
    if (progressSection) {
      progressSection.classList.remove('hidden');
    }

    // Start elapsed time counter on the button
    const startTime = Date.now();
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      
      generateBtn.textContent = `Generating... ${timeStr}`;
      if (progressElapsed) {
        progressElapsed.textContent = timeStr;
      }
    };
    
    updateTimer();
    window._generateTimerInterval = setInterval(updateTimer, 1000);

    try {
      // Step 1: Start the task (returns immediately with task_id)
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_id: voiceId,
          text: text,
          language: language,
          model: model
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to start generation');
      }
      
      // Step 2: Start task tracking with backend task ID
      const textPreview = text.length > 30 ? text.slice(0, 30) + '...' : text;
      if (window.taskManager && data.task_id) {
        const formState = { voiceId, text, language };
        window.taskManager.startTask(
          data.task_id,
          'generate',
          '/generate',
          `Generating "${textPreview}"`,
          formState
        );
      }
      
      // Task manager will poll and dispatch 'taskComplete' event
      // See handleTaskComplete listener below
      
    } catch (error) {
      // Immediate error (validation, network, etc.)
      clearInterval(window._generateTimerInterval);
      window._generateTimerInterval = null;
      
      if (progressSection) {
        progressSection.classList.add('hidden');
      }
      
      generateBtn.disabled = false;
      generateBtn.classList.remove('btn-loading');
      generateBtn.textContent = 'Generate Speech';
      
      showError(error.message);
    }
  });
  
  // Listen for task completion from TaskManager
  window.addEventListener('taskComplete', (e) => {
    const { type, status, result, error, storedTask } = e.detail;

    if (type && type !== 'generate') {
      return;
    }

    if (storedTask && storedTask.originPage !== '/generate') {
      return;
    }
    
    // Clear timer
    if (window._generateTimerInterval) {
      clearInterval(window._generateTimerInterval);
      window._generateTimerInterval = null;
    }
    
    // Hide progress section
    const progressSection = document.getElementById('generation-progress');
    if (progressSection) {
      progressSection.classList.add('hidden');
    }
    
    // Reset button
    generateBtn.disabled = false;
    generateBtn.classList.remove('btn-loading');
    generateBtn.textContent = 'Generate Speech';
    
    if (status === 'completed' && result) {
      // Success! Show audio player
      downloadBtn.href = result.audio_url;
      resultSection.classList.remove('hidden');
      
      // Initialize player
      if (window.initWaveSurferForUtter) {
        window.initWaveSurferForUtter(result.audio_url);
      } else {
        audioElement.src = result.audio_url;
      }
      
      timeDisplay.textContent = '0:00 / 0:00';
      showPlayIcon();
      hideError();
      
    } else if (status === 'failed') {
      // Show error
      showError(error || 'Generation failed. Please try again.');
    } else if (status === 'cancelled') {
      // User cancelled - just show a message
      showError('Generation was cancelled.');
    }
  });
  
  // Listen for task progress updates (detailed Modal status)
  window.addEventListener('taskProgress', (e) => {
    const { type, statusText } = e.detail;
    if (type !== 'generate') return;

    const progressStatus = document.getElementById('progress-status');
    if (!progressStatus) return;

    progressStatus.textContent = statusText || 'Processing...';
  });
  
  // Listen for task cancellation from modal cancel button
  window.addEventListener('taskCancelled', (e) => {
    const { type, storedTask } = e.detail;
    if (type && type !== 'generate') return;
    if (storedTask && storedTask.originPage !== '/generate') {
      return;
    }
    
    // Clear timer
    if (window._generateTimerInterval) {
      clearInterval(window._generateTimerInterval);
      window._generateTimerInterval = null;
    }
    
    // Hide progress section
    const progressSection = document.getElementById('generation-progress');
    if (progressSection) {
      progressSection.classList.add('hidden');
    }
    
    // Reset button
    generateBtn.disabled = false;
    generateBtn.classList.remove('btn-loading');
    generateBtn.textContent = 'Generate Speech';
    
    // Show cancelled message
    showError('Generation was cancelled.');
  });
  
  // Audio player controls
  if (playBtn) {
    let wavesurfer = null;

    const initWaveSurfer = (url) => {
        if (wavesurfer) {
            wavesurfer.destroy();
        }

        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#a0a0a0',
            progressColor: '#111111',
            cursorColor: 'transparent',
            barWidth: 2,
            barGap: 2,
            barRadius: 0,
            height: 48,
            normalize: true,
            url: url,
        });

        // Event listeners
        wavesurfer.on('ready', () => {
             updateTimeDisplay();
             showPlayIcon();
        });

        wavesurfer.on('audioprocess', () => {
            updateTimeDisplay();
        });
        
        wavesurfer.on('seek', () => {
            updateTimeDisplay();
        });

        wavesurfer.on('finish', () => {
            showPlayIcon();
            wavesurfer.stop();
        });

        wavesurfer.on('play', () => showPauseIcon());
        wavesurfer.on('pause', () => showPlayIcon());
    };

    const updateTimeDisplay = () => {
        if (!wavesurfer) return;
        const current = wavesurfer.getCurrentTime();
        const duration = wavesurfer.getDuration();
        timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    };

    // Override the form submit handler to init wavesurfer instead of setting audio element src
    // We need to re-attach the event listener or modify the existing one. 
    // Since I can't easily modify the existing closure without replacing the whole function, 
    // I made the modifications inside initGeneratePage below.
    
    // Play button toggle
    playBtn.addEventListener('click', () => {
        if (wavesurfer) {
            wavesurfer.playPause();
        }
    });

    // We also need to expose initWaveSurfer so the form submit can call it
    // But since this is a self-contained function, let's modify the form submit handler in the block above.
    // Wait, I can't modify the block above from here easily.
    // Let's attach the initWaveSurfer to the DOM element or a global var for simplicity in this specific "replace_file_content" context,
    // OR, better, complete the refactor by overwriting the form submit handler logic as well in the next step. 
    // actually, let's just rewrite the specific parts of initGeneratePage.
    
    window.initWaveSurferForUtter = initWaveSurfer; // Temporary bridge
  }
  
  function showPlayIcon() {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  }
  
  function showPauseIcon() {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  }
}

// ============================================================================
// Initialize on page load
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Detect which page we're on and initialize
  if (document.getElementById('clone-form')) {
    initClonePage();
  }
  
  if (document.getElementById('generate-form')) {
    initGeneratePage();
  }
});
