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

// ============================================================================
// Clone Page - Dropzone
// ============================================================================

function initClonePage() {
  const dropzone = document.getElementById('dropzone');
  const audioInput = document.getElementById('audio-input');
  const fileInfo = document.getElementById('file-info');
  const form = document.getElementById('clone-form');
  const submitBtn = document.getElementById('submit-btn');
  
  if (!dropzone || !audioInput) return;
  
  let selectedFile = null;
  
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
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('btn-loading');
    submitBtn.textContent = 'Creating...';
    
    try {
      const formData = new FormData();
      formData.append('name', voiceName);
      formData.append('audio', selectedFile);
      
      const response = await fetch('/api/clone', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create voice');
      }
      
      // Show success message
      showSuccess(`Voice "${data.name}" created successfully! Redirecting...`);
      submitBtn.textContent = 'Success!';
      
      // Redirect to generate page after a brief delay
      setTimeout(() => {
        window.location.href = '/generate';
      }, 1500);
      
    } catch (error) {
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
  const progressBar = document.getElementById('progress-bar');
  const progressFill = document.getElementById('progress-fill');
  const timeDisplay = document.getElementById('time-display');
  const downloadBtn = document.getElementById('download-btn');
  
  if (!voiceSelect) return;
  
  // Load voices
  loadVoices();
  
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
  
  // Character counter
  if (textInput && charCounter) {
    textInput.addEventListener('input', () => {
      const length = textInput.value.length;
      const max = 500;
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
  
  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    const voiceId = voiceSelect.value;
    const text = textInput.value.trim();
    
    if (!voiceId) {
      showError('Please select a voice');
      return;
    }
    
    if (!text) {
      showError('Please enter text to speak');
      return;
    }
    
    // Show loading state with elapsed time counter
    generateBtn.disabled = true;
    generateBtn.classList.add('btn-loading');
    
    let elapsedSeconds = 0;
    const updateButtonText = () => {
      generateBtn.textContent = `Generating... ${elapsedSeconds}s`;
    };
    updateButtonText();
    
    // Start elapsed time counter
    const timerInterval = setInterval(() => {
      elapsedSeconds++;
      updateButtonText();
    }, 1000);
    
    // Show helpful message for long waits
    showInfo('First generation may take 30-60 seconds while the model warms up.');
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          voice_id: voiceId,
          text: text
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to generate speech');
      }
      
      // Show audio player
      audioElement.src = data.audio_url;
      downloadBtn.href = data.audio_url;
      resultSection.classList.remove('hidden');
      
      // Reset player state
      progressFill.style.width = '0%';
      timeDisplay.textContent = '0:00 / 0:00';
      showPlayIcon();
      
      // Hide the info message on success
      hideError();
      
    } catch (error) {
      showError(error.message);
    } finally {
      clearInterval(timerInterval);
      generateBtn.disabled = false;
      generateBtn.classList.remove('btn-loading');
      generateBtn.textContent = 'Generate Speech';
    }
  });
  
  // Audio player controls
  if (playBtn && audioElement) {
    playBtn.addEventListener('click', () => {
      if (audioElement.paused) {
        audioElement.play();
        showPauseIcon();
      } else {
        audioElement.pause();
        showPlayIcon();
      }
    });
    
    audioElement.addEventListener('timeupdate', () => {
      const current = audioElement.currentTime;
      const duration = audioElement.duration || 0;
      const percent = duration > 0 ? (current / duration) * 100 : 0;
      
      progressFill.style.width = `${percent}%`;
      timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    });
    
    audioElement.addEventListener('ended', () => {
      showPlayIcon();
      progressFill.style.width = '0%';
    });
    
    audioElement.addEventListener('loadedmetadata', () => {
      timeDisplay.textContent = `0:00 / ${formatTime(audioElement.duration)}`;
    });
    
    // Click on progress bar to seek
    if (progressBar) {
      progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioElement.currentTime = percent * audioElement.duration;
      });
    }
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
