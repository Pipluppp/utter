/**
 * Smart Editor Component
 * Handles text chunking, rendering, and interaction.
 */

class SmartEditor {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options; // { onRegenerate, onStitchRequest }
        
        this.text = "";
        this.chunks = []; // [{ id, text, start, end, versions: [], currentVersionIndex: 0 }]
        this.isViewMode = false;
        
        // UI Elements
        this.textarea = null;
        this.viewLayer = null;
        this.contextMenu = null;
        
        this.init();
    }
    
    init() {
        this.container.classList.add('smart-editor-container');
        
        // Textarea (Edit Mode)
        this.textarea = document.createElement('textarea');
        this.textarea.className = 'smart-editor-textarea';
        this.textarea.placeholder = "Enter text to generate speech...";
        this.textarea.addEventListener('input', (e) => {
            this.text = e.target.value;
            // Provide feedback if too long?
        });
        
        // View Layer (Read Mode with Chunks)
        this.viewLayer = document.createElement('div');
        this.viewLayer.className = 'smart-editor-view hidden';
        this.viewLayer.addEventListener('click', (e) => {
             // If clicking blank space, maybe switch to edit?
             if (e.target === this.viewLayer) {
                 // this.switchToEditMode(); 
             }
        });
        
        // Context Menu
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'chunk-context-menu';
        document.body.appendChild(this.contextMenu); // Attach to body for positioning
        
        // Close context menu on click outside
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
        
        this.container.appendChild(this.textarea);
        this.container.appendChild(this.viewLayer);
    }
    
    setText(text) {
        this.text = text;
        this.textarea.value = text;
    }
    
    getText() {
        return this.textarea.value; // Always trust textarea as source of truth
    }
    
    switchToViewMode() {
        this.isViewMode = true;
        this.textarea.classList.add('hidden');
        this.viewLayer.classList.remove('hidden');
        
        // Parse and Render
        this.parseChunks();
        this.renderChunks();
    }
    
    switchToEditMode() {
        this.isViewMode = false;
        this.viewLayer.classList.add('hidden');
        this.textarea.classList.remove('hidden');
        this.textarea.focus();
    }
    
    /**
     * Parse text into chunks (sentences).
     * Populates this.chunks
     */
    parseChunks() {
        const text = this.text;
        if (!text) {
            this.chunks = [];
            return;
        }
        
        // Simple sentence splitting (can be improved)
        // Split by (. ! ?) followed by whitespace or end of string.
        // Or better: use regex with capture.
        
        // Regex to match sentences:
        // [^.!?]+[.!?]+(\s+|$)
        // But let's handle cases without punctuation too.
        
        // Let's use the same logic as backend logic ideally.
        // For now: Regex split.
        
        const regex = /[^.!?]+(?:[.!?]+["']?|$)|\S+/g;
        // This is a rough approximation. 
        
        const matches = text.match(regex) || [text];
        
        // Preserve versions if text is similar? 
        // For MVP, if text changes, we reset versions (hard to track diffs).
        // But if we just switched modes without editing, we should keep IDs.
        
        // Check if text is EXACTLY same as before?
        const joinedOld = this.chunks.map(c => c.text).join("");
        const joinedNew = matches.join(""); // Regex matches may strip whitespace?
        
        // Actually, let's keep it simple: 
        // If text length matches, assume same? No.
        
        // Re-build chunks
        const newChunks = matches.map((t, index) => {
            const cleanText = t.trim();
            // Try to find matching existing chunk?
            const existing = this.chunks.find(c => c.text === cleanText && c.index === index);
            
            return {
                id: existing ? existing.id : `chunk_${Date.now()}_${index}`,
                text: cleanText,
                fullText: t, // includes trailing space
                versions: existing ? existing.versions : [], // [ { url, seed, id } ]
                currentVersionIndex: existing ? existing.currentVersionIndex : -1
            };
        });
        
        this.chunks = newChunks;
    }
    
    renderChunks() {
        this.viewLayer.innerHTML = '';
        
        this.chunks.forEach((chunk, index) => {
            const span = document.createElement('span');
            span.className = 'chunk';
            span.textContent = chunk.fullText || chunk.text + " ";
            span.dataset.id = chunk.id;
            
            // Highlight if it has versions
            if (chunk.versions.length > 0) {
                 span.classList.add('has-audio');
            }
            
            // Events
            span.addEventListener('click', (e) => this.handleChunkClick(e, chunk));
            span.addEventListener('contextmenu', (e) => this.handleChunkContextMenu(e, chunk));
            span.addEventListener('mouseenter', () => span.classList.add('hover'));
            span.addEventListener('mouseleave', () => span.classList.remove('hover'));
            
            this.viewLayer.appendChild(span);
        });
    }
    
    handleChunkClick(e, chunk) {
        // Play audio for this chunk if available?
        // Or select it?
        
        // For now, toggle active state
        document.querySelectorAll('.chunk').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        
        // If we have audio for this chunk, maybe preview it?
        const version = chunk.versions[chunk.currentVersionIndex];
        if (version && window.playAudio) {
             window.playAudio(version.url);
        }
    }
    
    handleChunkContextMenu(e, chunk) {
        e.preventDefault();
        this.showContextMenu(e.pageX, e.pageY, chunk);
        
        // Select chunk
        document.querySelectorAll('.chunk').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
    }
    
    showContextMenu(x, y, chunk) {
        this.contextMenu.innerHTML = '';
        
        // Header
        const header = document.createElement('div');
        header.className = 'ctx-label';
        header.textContent = `Chunk Actions`;
        this.contextMenu.appendChild(header);
        
        // Regenerate Option
        this.addCtxItem('Regenerate', '⚡', () => this.regenerateChunk(chunk));
        
        // Divider
        this.contextMenu.appendChild(document.createElement('div')).className = 'ctx-divider';
        
        // Versions
        if (chunk.versions.length > 0) {
            const vHeader = document.createElement('div');
            vHeader.className = 'ctx-label';
            vHeader.textContent = `Versions (${chunk.versions.length})`;
            this.contextMenu.appendChild(vHeader);
            
            chunk.versions.forEach((v, idx) => {
                const isCurrent = idx === chunk.currentVersionIndex;
                const label = `Version ${idx + 1} ${isCurrent ? '(Active)' : ''}`;
                this.addCtxItem(label, isCurrent ? '🔊' : '▶', () => {
                     // Switch version
                     this.switchVersion(chunk, idx);
                });
            });
        }
        
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.classList.add('visible');
    }
    
    addCtxItem(label, icon, onClick) {
        const item = document.createElement('div');
        item.className = 'ctx-item';
        item.innerHTML = `<span>${icon}</span> <span>${label}</span>`;
        item.addEventListener('click', () => {
            this.hideContextMenu();
            onClick();
        });
        this.contextMenu.appendChild(item);
    }
    
    hideContextMenu() {
        this.contextMenu.classList.remove('visible');
    }
    
    async regenerateChunk(chunk) {
        // 1. Mark UI as loading
        const span = this.viewLayer.querySelector(`[data-id="${chunk.id}"]`);
        if (span) span.classList.add('generating');
        
        try {
            // 2. Call Regen API
            if (this.options.onRegenerate) {
                const result = await this.options.onRegenerate(chunk.text);
                
                // 3. Add to history
                chunk.versions.push({
                    url: result.url,
                    seed: result.seed, // if available
                    timestamp: Date.now()
                });
                
                // 4. Set as current
                chunk.currentVersionIndex = chunk.versions.length - 1;
                
                // 5. Trigger Stitch
                if (this.options.onStitchRequest) {
                    await this.requestStitching();
                }
            }
        } catch (err) {
            console.error("Regen failed", err);
            alert("Regeneration failed");
        } finally {
            if (span) span.classList.remove('generating');
            this.renderChunks(); // Re-render to show new version count
        }
    }
    
    switchVersion(chunk, index) {
        chunk.currentVersionIndex = index;
        if (this.options.onStitchRequest) {
            this.requestStitching();
        }
        this.renderChunks();
    }
    
    async requestStitching() {
        // Gather all current audio URLs
        // If a chunk has no audio (e.g. wasn't regenerated and we only have full audio? 
        // Wait, if we only start with Full Audio, we don't have per-chunk URLs...
        // Problem: We can't stitch "Un-chunked" parts easily.
        
        // Solution:
        // When we do the FIRST generation, we should probably ask backend to return CHUNK URLs too?
        // Or we treat the main generation as "Background".
        // If we regenerate one chunk, we can't stitch it unless we have the others.
        
        // REVISED FLOW:
        // On "Generate", we ask backend for the Full Audio AND the List of Chunk URLs.
        // Backend `generate_speech` should return `chunk_urls` as metadata?
        // OR we just use the backend response.
        
        // Let's assume we have all chunk URLs.
        const audioUrls = this.chunks.map(chunk => {
            if (chunk.currentVersionIndex >= 0) {
                return chunk.versions[chunk.currentVersionIndex].url;
            }
            return null;
        });
        
        if (audioUrls.includes(null)) {
            console.warn("Cannot stitch: missing audio for some chunks");
            return;
        }
        
        await this.options.onStitchRequest(audioUrls);
    }
    
    // Called when initial generation finishes
    setChunkAudios(chunkUrls) {
        // chunkUrls matches the order of text chunks
        if (chunkUrls.length !== this.chunks.length) {
            console.warn("Chunk count mismatch", chunkUrls.length, this.chunks.length);
            // This happens if our JS split differs from Python split.
            // This is a risk.
            // Mitigation: Rely on Backend for chunks?
            // Or just "Assign 1:1" and hope.
            // For MVP: We assigned 1:1.
        }
        
        this.chunks.forEach((chunk, i) => {
            if (chunkUrls[i]) {
                chunk.versions = [{ url: chunkUrls[i], seed: null, timestamp: Date.now() }];
                chunk.currentVersionIndex = 0;
            }
        });
        this.renderChunks();
    }
}
