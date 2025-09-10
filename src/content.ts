interface HudState {
  recording: boolean;
  eventCount: number;
  atCap: boolean;
  recordingMode: 'console' | 'breakpoint';
}

class HUD {
  private hudElement: HTMLDivElement;
  private state: HudState = {
    recording: false,
    eventCount: 0,
    atCap: false,
    recordingMode: 'console'
  };

  constructor() {
    this.hudElement = this.createHUD();
    this.attachHUD();
    this.setupMessageListener();
    this.requestStatus();
  }

  private createHUD(): HTMLDivElement {
    const hud = document.createElement('div');
    hud.id = 'evidence-hud-overlay';
    hud.innerHTML = `
      <div class="hud-header">
        <h3>Input Evidence</h3>
      </div>
      <div class="hud-content">
        
        <!-- Status Display -->
        <div class="status-section">
          <div class="recording-status">Not Recording</div>
          <div class="event-count">Events captured: 0</div>
        </div>
        
        <!-- Basic Controls -->
        <div class="controls-section">
          <button class="start-recording">Start Recording</button>
          <button class="stop-recording" disabled>Stop Recording</button>
          <button class="export-data" disabled>Export Data</button>
          <button class="clear-data" disabled>Clear Data</button>
        </div>

        <!-- Message Display -->
        <div class="message-display" style="display: none;"></div>
        
        <!-- Recording Mode Options -->
        <div class="recording-mode-section">
          <h4>Recording Mode</h4>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="recordingMode" value="console" checked>
              <span>Log to Console</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="recordingMode" value="breakpoint">
              <span>Breakpoint (debugger)</span>
            </label>
          </div>
        </div>
        
        <!-- TODO: Filter Options Section  
             - Element Selector input: CSS selector to limit monitoring (e.g., "#myInput, .password")
             - Attribute Filter: name/value pairs to filter elements by attributes
             - Stack Keyword Filter: only track if stack trace contains specified keyword -->
        
        <!-- TODO: Track Events Checkboxes
             - Input Value Access: Monitor property getters (value, nodeValue)
             - Input Events: Monitor addEventListener calls (keydown, keyup, input, change)  
             - Form Submit: Monitor form submission events and handlers
             - FormData Creation: Monitor new FormData() constructor calls -->
             
        <!-- TODO: Advanced Features
             - Real-time event feed/log display
             - Event filtering by domain/source
             - Stack trace highlighting
             - Export format options (JSON, CSV)
             - Session management (save/load configurations) -->
      </div>
    `;
    return hud;
  }

  private attachHUD(): void {
    document.body.appendChild(this.hudElement);
    this.setupEventHandlers();
    this.makeDraggable();
  }

  private setupEventHandlers(): void {
    const startBtn = this.hudElement.querySelector('.start-recording') as HTMLButtonElement;
    const stopBtn = this.hudElement.querySelector('.stop-recording') as HTMLButtonElement;
    const exportBtn = this.hudElement.querySelector('.export-data') as HTMLButtonElement;
    const clearBtn = this.hudElement.querySelector('.clear-data') as HTMLButtonElement;
    const recordingModeRadios = this.hudElement.querySelectorAll('input[name="recordingMode"]') as NodeListOf<HTMLInputElement>;

    startBtn?.addEventListener('click', () => this.toggleRecording());
    stopBtn?.addEventListener('click', () => this.toggleRecording());
    exportBtn?.addEventListener('click', () => this.exportData());
    clearBtn?.addEventListener('click', () => this.clearData());

    // Recording mode radio button handlers
    recordingModeRadios.forEach(radio => {
      radio.addEventListener('change', () => this.onRecordingModeChange());
    });
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'HUD_UPDATE':
          this.updateState({
            recording: message.recording ?? this.state.recording,
            eventCount: message.eventCount ?? this.state.eventCount,
            atCap: message.atCap ?? this.state.atCap
          });
          break;
        case 'HUD_MESSAGE':
          this.showMessage(message.message, message.level || 'info');
          break;
        case 'SET_RECORDING_MODE':
          // Forward recording mode to injected script
          window.postMessage({ 
            type: 'SET_RECORDING_MODE', 
            recordingMode: message.recordingMode 
          }, '*');
          break;
        case 'SET_RECORDING_STATE':
          // Forward recording state to injected script
          window.postMessage({ 
            type: 'SET_RECORDING_STATE', 
            recording: message.recording 
          }, '*');
          break;
      }
    });
  }

  private requestStatus(): void {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response) {
        this.updateState({
          recording: response.recording,
          eventCount: response.eventCount,
          atCap: response.atCap,
          recordingMode: response.recordingMode || 'console'
        });
      }
    });
  }

  private toggleRecording(): void {
    chrome.runtime.sendMessage({ type: 'TOGGLE_RECORDING' }, (response) => {
      if (response) {
        this.updateState({
          ...this.state,
          recording: response.recording
        });
      }
    });
  }

  private exportData(): void {
    chrome.runtime.sendMessage({ type: 'EXPORT_EVENTS' });
  }

  private clearData(): void {
    chrome.runtime.sendMessage({ type: 'CLEAR_EVENTS' });
  }

  private onRecordingModeChange(): void {
    const selectedRadio = this.hudElement.querySelector('input[name="recordingMode"]:checked') as HTMLInputElement;
    if (selectedRadio) {
      const mode = selectedRadio.value as 'console' | 'breakpoint';
      this.updateState({ recordingMode: mode });
      
      // Send mode change to background script
      chrome.runtime.sendMessage({ 
        type: 'SET_RECORDING_MODE', 
        recordingMode: mode 
      });
    }
  }

  private updateState(newState: Partial<HudState>): void {
    this.state = { ...this.state, ...newState };
    this.updateUI();
  }

  private updateUI(): void {
    const recordingStatus = this.hudElement.querySelector('.recording-status') as HTMLElement;
    const eventCount = this.hudElement.querySelector('.event-count') as HTMLElement;
    const startBtn = this.hudElement.querySelector('.start-recording') as HTMLButtonElement;
    const stopBtn = this.hudElement.querySelector('.stop-recording') as HTMLButtonElement;
    const exportBtn = this.hudElement.querySelector('.export-data') as HTMLButtonElement;
    const clearBtn = this.hudElement.querySelector('.clear-data') as HTMLButtonElement;

    // Update status display
    recordingStatus.textContent = this.state.recording ? 'Recording...' : 'Not Recording';
    recordingStatus.style.color = this.state.recording ? '#4CAF50' : '#666';
    
    eventCount.textContent = `Events captured: ${this.state.eventCount}`;
    if (this.state.atCap) {
      eventCount.textContent += ' (at cap - oldest events dropped)';
      eventCount.style.color = '#FF9800';
    } else {
      eventCount.style.color = '#666';
    }

    // Update button states
    startBtn.disabled = this.state.recording;
    stopBtn.disabled = !this.state.recording;
    exportBtn.disabled = this.state.eventCount === 0;
    clearBtn.disabled = this.state.eventCount === 0;

    // Update recording mode radio buttons
    const recordingModeRadio = this.hudElement.querySelector(`input[name="recordingMode"][value="${this.state.recordingMode}"]`) as HTMLInputElement;
    if (recordingModeRadio) {
      recordingModeRadio.checked = true;
    }
  }

  private showMessage(message: string, level: string = 'info'): void {
    const messageDiv = this.hudElement.querySelector('.message-display') as HTMLElement;
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    
    // Style based on level
    messageDiv.className = `message-display message-${level}`;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }

  private makeDraggable(): void {
    const header = this.hudElement.querySelector('.hud-header') as HTMLElement;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    header.addEventListener('mousedown', (e: MouseEvent) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.hudElement.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;
      
      // Keep HUD within viewport bounds
      const hudRect = this.hudElement.getBoundingClientRect();
      const maxLeft = window.innerWidth - hudRect.width;
      const maxTop = window.innerHeight - hudRect.height;
      
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      
      this.hudElement.style.left = newLeft + 'px';
      this.hudElement.style.top = newTop + 'px';
      this.hudElement.style.right = 'auto'; // Remove right positioning
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
}

// ============================================================================
// INJECTED SCRIPT INJECTION AND COMMUNICATION
// ============================================================================

/**
 * Injects the main surveillance detection script into the page's main world
 * This allows us to intercept native APIs that are not accessible from content script
 */
function injectSurveillanceScript(): void {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = () => {
      console.debug('[ContentScript] Injected surveillance script loaded');
      script.remove(); // Clean up after injection
    };
    script.onerror = () => {
      console.error('[ContentScript] Failed to load injected surveillance script');
    };
    
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error('[ContentScript] Failed to inject surveillance script:', error);
  }
}

/**
 * Sets up communication bridge between injected script and background
 */
function setupInjectedScriptBridge(): void {
  // Listen for evidence events from injected script
  window.addEventListener('message', (event) => {
    // Only accept messages from same window
    if (event.source !== window) return;
    
    // Handle evidence events from injected script
    if (event.data.type === 'EVIDENCE_EVENT') {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('[ContentScript] Extension context invalidated - cannot send evidence');
        return;
      }
      
      // Forward evidence to background service worker
      chrome.runtime.sendMessage({
        type: 'EVIDENCE_EVENT',
        event: event.data.event
      }).catch((error) => {
        console.error('[ContentScript] Failed to forward evidence to background:', error);
      });
    }
    
    // Handle injected script ready signal
    if (event.data.type === 'INJECTED_SCRIPT_READY') {
      console.debug('[ContentScript] Injected script ready, sending handshake');
      // Send ready signal back to injected script
      window.postMessage({ type: 'CONTENT_SCRIPT_READY' }, '*');
    }
  });
  
  console.debug('[ContentScript] Injected script bridge set up');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize everything when DOM is ready
function initialize(): void {
  console.debug('[ContentScript] Initializing Reflectiz content script...');
  
  // Inject surveillance detection script into main world
  injectSurveillanceScript();
  
  // Set up communication bridge
  setupInjectedScriptBridge();
  
  // Only initialize HUD in the top frame (not in iframes)
  if (window === window.top) {
    new HUD();
    console.debug('[ContentScript] HUD initialized in main frame');
  } else {
    console.debug('[ContentScript] Skipping HUD in iframe');
  }
  
  console.debug('[ContentScript] Content script initialization complete');
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}