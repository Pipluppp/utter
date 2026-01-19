# Waveform Extension Plan

**Goal**: Extend the `wavesurfer.js` visualization to "Your Voices" (Preview) and "History" (Playback) lists, replacing the simple HTML5 Audio playback.

## Diagnosis & Architecture

### Current State
- **Voices Page**: Dynamically creates `<audio>` element on click. Button toggles Play/Stop.
- **History Page**: Similar logic. Uses inline buttons.
- **Problem**: We cannot simply instantiate `WaveSurfer` for every item in a list of 50+ items (Performance/Memory heavy).

### Proposed Solution: "The Active Player" Pattern (Singleton)
Instead of having a player for every item, we use **one active WaveSurfer instance** that moves or re-initializes when a user clicks "Play".

1.  **UI Layout**:
    - Each card (`.voice-card`, `.history-card`) will have a reserved (or expandable) `<div class="waveform-container"></div>`.
    - Initially empty (height: 0 or hidden).
2.  **Interaction Flow**:
    - User clicks "Play" on Item A.
    - **Manager**:
        - Stops/Destroys any existing WaveSurfer instance.
        - Resets UI of previous Item B (if any).
        - Expands `waveform-container` of Item A.
        - Initializes generic WaveSurfer into Item A's container.
        - Loads audio URL.
        - Plays.
3.  **Aesthetic**:
    - Re-use the "Ribbed / Dot Matrix" styles from `generate.html`.
    - High contrast (Black/Grey).

## Implementation Steps

### 1. Shared Logic (`static/js/waveform-manager.js`)
Create a helper class to manage the single instance.
```javascript
class WaveformManager {
    constructor() {
        this.currentWavesurfer = null;
        this.currentContainer = null;
        this.currentBtn = null;
    }

    play(containerId, audioUrl, playBtn) {
        // 1. Cleanup old
        this.stopAll();

        // 2. UI Setup
        this.currentContainer = document.getElementById(containerId);
        this.currentBtn = playBtn;
        this.currentContainer.classList.remove('hidden');

        // 3. Init WaveSurfer
        this.currentWavesurfer = WaveSurfer.create({
            container: this.currentContainer,
            waveColor: '#a0a0a0',
            progressColor: '#111111',
            cursorColor: 'transparent',
            barWidth: 2,
            barGap: 2,
            height: 48,
            url: audioUrl
        });

        // 4. Events
        this.currentWavesurfer.on('ready', () => this.currentWavesurfer.play());
        this.currentWavesurfer.on('finish', () => this.stopAll());
    }

    stopAll() {
        if (this.currentWavesurfer) {
            this.currentWavesurfer.destroy();
            this.currentWavesurfer = null;
        }
        if (this.currentContainer) {
            this.currentContainer.innerHTML = ''; // Clear div
            this.currentContainer.classList.add('hidden'); // Hide space
        }
        if (this.currentBtn) {
            this.currentBtn.textContent = 'Play'; // Reset text
            this.currentBtn.classList.remove('playing');
        }
    }
}
```

### 2. Frontend Updates

#### [MODIFY] `voices.html`
- Update card template to include `<div id="waveform-${voice.id}" class="waveform-container hidden"></div>`.
- Update click handlers to use `WaveformManager`.

#### [MODIFY] `history.html`
- Update card template to include `<div id="waveform-${gen.id}" class="waveform-container hidden"></div>`.
- Update click handlers to use `WaveformManager`.

#### [MODIFY] `base.html`
- Include `wavesurfer.js` globally or on specific pages.

## Pain Points & Mitigations
- **Layout Shift**: When the waveform appears, the card height will jump.
    - *Mitigation*: CSS `transition: height` for smooth aesthetic, or keep it as an overlay (might be messy). Expanding accordion style is standard.
- **Loading Latency**: WaveSurfer has to fetch the full audio to render peaks.
    - *Mitigation*: Show a small spinner in the container while fetching. Do not block UI.
- **Mobile Lists**: Screen real estate is small.
    - *Mitigation*: Keep height small (48px is fine).

## Verification
- [ ] Go to Voices -> Click Preview -> Waveform expands and plays.
- [ ] Click another voice -> Old one closes, new one opens.
- [ ] Go to History -> Click Play -> Waveform expands and plays.
