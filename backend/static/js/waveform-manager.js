/**
 * WaveformManager
 * Handles a singleton WaveSurfer instance for playing audio across lists (Voices, History).
 * Ensures only one waveform is active at a time to save memory and DOM clutter.
 */
class WaveformManager {
    constructor() {
        this.currentWavesurfer = null;
        this.currentContainer = null;
        this.currentBtn = null;
        this.originalBtnText = '';
        this.loadingSpinner = null;
    }

    /**
     * Play or toggle audio for a specific item.
     * @param {string} containerId - DOM ID of the container for the waveform.
     * @param {string} audioUrl - URL of the audio file.
     * @param {HTMLElement} playBtn - The button that triggered play.
     */
    async play(containerId, audioUrl, playBtn) {
        // If clicking the same button that is currently playing/loading
        if (this.currentBtn === playBtn) {
            if (this.currentWavesurfer && this.currentWavesurfer.isPlaying()) {
                this.currentWavesurfer.pause();
                playBtn.textContent = 'Play';
                playBtn.classList.remove('playing');
                return;
            } else if (this.currentWavesurfer) {
                this.currentWavesurfer.play();
                playBtn.textContent = 'Stop';
                playBtn.classList.add('playing');
                return;
            }
        }

        // 1. Cleanup old
        this.stopAll();

        // 2. UI Setup
        this.currentContainer = document.getElementById(containerId);
        this.currentBtn = playBtn;
        this.originalBtnText = playBtn.textContent || 'Play'; // Backup text (usually 'Preview' or 'Play')
        
        // Show container
        this.currentContainer.classList.remove('hidden');

        // Show loading state on button
        playBtn.textContent = 'Loading...';
        playBtn.disabled = true;

        // 3. Init WaveSurfer
        // We use a small timeout to let the UI expand before rendering (optional, but good for layout)
        try {
            this.currentWavesurfer = WaveSurfer.create({
                container: this.currentContainer,
                waveColor: '#a0a0a0',
                progressColor: '#111111',
                cursorColor: 'transparent',
                barWidth: 2,
                barGap: 2,
                barRadius: 0,
                height: 48,
                normalize: true,
                url: audioUrl
            });

            // 4. Events
            this.currentWavesurfer.on('ready', () => {
                this.currentWavesurfer.play();
                if (this.currentBtn) {
                    this.currentBtn.textContent = 'Stop';
                    this.currentBtn.classList.add('playing');
                    this.currentBtn.disabled = false;
                }
            });

            this.currentWavesurfer.on('finish', () => {
                // When finished, we can either stop or reset.
                // Resetting UI to "Play" state but keeping waveform is usually nice,
                // but the plan says "Stop/Destroy" on new play.
                // For 'finish', let's just reset the button text.
                if (this.currentBtn) {
                    this.currentBtn.textContent = 'Play'; // Or restore original? 'Play' is generally safe.
                    this.currentBtn.classList.remove('playing');
                }
            });

            this.currentWavesurfer.on('error', (e) => {
                console.error('WaveSurfer error:', e);
                this.stopAll();
                alert('Failed to load audio.');
            });

        } catch (err) {
            console.error(err);
            this.stopAll();
        }
    }

    stopAll() {
        // Destroy existing instance
        if (this.currentWavesurfer) {
            this.currentWavesurfer.destroy();
            this.currentWavesurfer = null;
        }

        // Hide container
        if (this.currentContainer) {
            this.currentContainer.innerHTML = ''; // Clear div
            this.currentContainer.classList.add('hidden'); // Hide space
            this.currentContainer = null;
        }

        // Reset button
        if (this.currentBtn) {
            // Restore text if we have it, otherwise default to what it was implicitly (Preview/Play)
            // Ideally we check class or dataset, but 'Play' or 'Preview' is fine.
            // Let's rely on the pages passing the button to specific "Play" or "Preview" text which we can infer
            // from the fact we are resetting.
            // Actually, the original code had 'Preview' for voices and 'Play' for history.
            // A simple heuristic: if it has 'preview-btn' class, revert to 'Preview', else 'Play'.
            if (this.currentBtn.classList.contains('preview-btn')) {
                this.currentBtn.textContent = 'Preview';
            } else {
                this.currentBtn.textContent = 'Play';
            }
            
            this.currentBtn.classList.remove('playing');
            this.currentBtn.disabled = false;
            this.currentBtn = null;
        }
    }
}

// Export global instance
window.waveformManager = new WaveformManager();
