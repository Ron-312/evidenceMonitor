interface HudState {
  recording: boolean;
  eventCount: number;
  atCap: boolean;
}

class HUD {
  private hudElement: HTMLDivElement;
  private state: HudState = {
    recording: false,
    eventCount: 0,
    atCap: false
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
      <div class="hud-content">
        <h3>Input Evidence</h3>
        
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
        
        <!-- TODO: Recording Mode Options
             - Radio buttons: Log to Console vs Breakpoint
             - When Breakpoint mode: show debugger; statement on evidence capture
             - When Console mode: console.log() evidence events -->
        
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
  }

  private setupEventHandlers(): void {
    const startBtn = this.hudElement.querySelector('.start-recording') as HTMLButtonElement;
    const stopBtn = this.hudElement.querySelector('.stop-recording') as HTMLButtonElement;
    const exportBtn = this.hudElement.querySelector('.export-data') as HTMLButtonElement;
    const clearBtn = this.hudElement.querySelector('.clear-data') as HTMLButtonElement;

    startBtn?.addEventListener('click', () => this.toggleRecording());
    stopBtn?.addEventListener('click', () => this.toggleRecording());
    exportBtn?.addEventListener('click', () => this.exportData());
    clearBtn?.addEventListener('click', () => this.clearData());
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
      }
    });
  }

  private requestStatus(): void {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response) {
        this.updateState({
          recording: response.recording,
          eventCount: response.eventCount,
          atCap: response.atCap
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
    script.src = chrome.runtime.getURL('injected/main.js');
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
  
  // Initialize HUD
  new HUD();
  
  console.debug('[ContentScript] Content script initialization complete');
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}