import { FilterOptions, TrackEventsState, HudState } from './utils/shared-types';

class HUD {
  private hudElement: HTMLDivElement;
  private state: HudState = {
    recording: false,
    eventCount: 0,
    atCap: false,
    recordingMode: 'console',
    filters: {
      elementSelector: '',
      attributeFilters: '',
      stackKeywordFilter: ''
    },
    trackEvents: {
      inputValueAccess: true,
      inputEvents: true,
      formSubmit: true,
      formDataCreation: true
    },
    theme: 'dark',
    minimized: false
  };

  constructor() {
    console.debug('[HUD] 🎯 HUD constructor called');

    // Check if HUD already exists
    const existingHUD = document.getElementById('evidence-hud-overlay');
    if (existingHUD) {
      console.warn('[HUD] ⚠️ HUD element already exists during constructor! This might cause issues.');
    }

    // Load saved preferences
    try {
      const savedTheme = localStorage.getItem('hud-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        this.state.theme = savedTheme;
      }

      const savedMinimized = localStorage.getItem('hud-minimized');
      if (savedMinimized === 'true' || savedMinimized === 'false') {
        this.state.minimized = savedMinimized === 'true';
      }
    } catch (error) {
      console.warn('[HUD] Failed to load preferences:', error);
    }

    this.hudElement = this.createHUD();
    this.attachHUD();
    this.setupMessageListener();
    this.requestStatus();

    console.debug('[HUD] ✅ HUD constructor complete, element attached to DOM');
  }

  private createHUD(): HTMLDivElement {
    const hud = document.createElement('div');
    hud.id = 'evidence-hud-overlay';
    hud.innerHTML = `
      <div class="hud-header">
        <h3>Input Monitoring</h3>
        <div class="hud-header-controls">
          <button class="minimize-toggle" title="Minimize HUD">−</button>
          <button class="theme-toggle" title="Toggle light/dark theme">🌙</button>
        </div>
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
          <h4 class="recording-mode-header">
            <span>Recording Mode</span>
            <button class="recording-mode-toggle" type="button">▼</button>
          </h4>
          <div class="recording-mode-content" style="display: none;">
            <div class="toggle-switch-container">
              <span class="toggle-label left">Console</span>
              <div class="toggle-switch" data-mode="console">
                <div class="toggle-slider"></div>
              </div>
              <span class="toggle-label right">Breakpoint</span>
            </div>
          </div>
        </div>
        
        <!-- Filter Options Section -->
        <div class="filter-section">
          <h4 class="filter-header">
            <span>Filter Options</span>
            <button class="filter-toggle" type="button">▼</button>
          </h4>
          <div class="filter-content" style="display: none;">
            <div class="filter-option">
              <label for="elementSelector">Element Selector (CSS):</label>
              <input type="text" id="elementSelector" class="element-selector" 
                     placeholder="e.g., #myInput, .password, input[name='secret']">
            </div>
            <div class="filter-option">
              <label for="attributeFilters">Attribute Filters:</label>
              <input type="text" id="attributeFilters" class="attribute-filters" 
                     placeholder="e.g., name=password, type=email">
            </div>
            <div class="filter-option">
              <label for="stackKeywordFilter">Stack Keyword Filter:</label>
              <input type="text" id="stackKeywordFilter" class="stack-keyword-filter" 
                     placeholder="e.g., analytics, tracking">
            </div>
          </div>
        </div>

        <!-- Track Events Section -->
        <div class="track-events-section">
          <h4 class="track-events-header">
            <span>Track Events</span>
            <button class="track-events-toggle" type="button">▼</button>
          </h4>
          <div class="track-events-content" style="display: none;">
            <div class="track-events-option">
              <label>
                <input type="checkbox" class="input-value-access" checked>
                <span>Input Value Access</span>
              </label>
              <div class="track-events-description">Monitor property getters (value, nodeValue)</div>
            </div>
            <div class="track-events-option">
              <label>
                <input type="checkbox" class="input-events" checked>
                <span>Input Events</span>
              </label>
              <div class="track-events-description">Monitor addEventListener calls (keydown, input, change)</div>
            </div>
            <div class="track-events-option">
              <label>
                <input type="checkbox" class="form-submit" checked>
                <span>Form Submit</span>
              </label>
              <div class="track-events-description">Monitor form submission events and handlers</div>
            </div>
            <div class="track-events-option">
              <label>
                <input type="checkbox" class="form-data-creation" checked>
                <span>FormData Creation</span>
              </label>
              <div class="track-events-description">Monitor new FormData() constructor calls</div>
            </div>
          </div>
        </div>
             
        <!-- TODO: Advanced Features
             - Real-time event feed/log display
             - Event filtering by domain/source
             - Stack trace highlighting
             - Export format options (JSON, CSV)
             - Session management (save/load configurations) -->
      </div>

      <!-- Minimized Circle -->
      <div class="hud-minimized" style="display: none;">
        <div class="hud-minimized-circle">
          <div class="hud-minimized-inner"></div>
        </div>
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
    const themeToggle = this.hudElement.querySelector('.theme-toggle') as HTMLButtonElement;
    const minimizeToggle = this.hudElement.querySelector('.minimize-toggle') as HTMLButtonElement;
    const toggleSwitch = this.hudElement.querySelector('.toggle-switch') as HTMLElement;

    startBtn?.addEventListener('click', () => this.toggleRecording());
    stopBtn?.addEventListener('click', () => this.toggleRecording());
    exportBtn?.addEventListener('click', () => this.exportData());
    clearBtn?.addEventListener('click', () => this.clearData());

    // Recording mode toggle switch handler
    toggleSwitch?.addEventListener('click', () => this.onRecordingModeToggle());

    // Theme toggle handler
    themeToggle?.addEventListener('click', () => this.onThemeToggle());

    // Minimize toggle handler
    minimizeToggle?.addEventListener('click', () => this.onMinimizeToggle());

    // Recording mode section handlers
    this.setupRecordingModeHandlers();
    
    // Filter section handlers
    this.setupFilterHandlers();

    // Track Events section handlers
    this.setupTrackEventsHandlers();

    // Minimized circle handlers
    this.setupMinimizedHandlers();
  }

  private setupFilterHandlers(): void {
    const filterHeader = this.hudElement.querySelector('.filter-header') as HTMLElement;
    const filterToggle = this.hudElement.querySelector('.filter-toggle') as HTMLButtonElement;
    const filterContent = this.hudElement.querySelector('.filter-content') as HTMLElement;
    const elementSelectorInput = this.hudElement.querySelector('.element-selector') as HTMLInputElement;
    const attributeFiltersInput = this.hudElement.querySelector('.attribute-filters') as HTMLInputElement;
    const stackKeywordFilterInput = this.hudElement.querySelector('.stack-keyword-filter') as HTMLInputElement;

    // Function to toggle filter section visibility
    const toggleFilter = () => {
      const isVisible = filterContent.style.display !== 'none';
      filterContent.style.display = isVisible ? 'none' : 'block';
      filterToggle.textContent = isVisible ? '▼' : '▲';
    };

    // Make entire header clickable
    filterHeader?.addEventListener('click', toggleFilter);

    // Filter input change handlers
    elementSelectorInput?.addEventListener('input', () => this.onFilterChange());
    attributeFiltersInput?.addEventListener('input', () => this.onFilterChange());
    stackKeywordFilterInput?.addEventListener('input', () => this.onFilterChange());
  }

  private setupTrackEventsHandlers(): void {
    const trackEventsHeader = this.hudElement.querySelector('.track-events-header') as HTMLElement;
    const trackEventsToggle = this.hudElement.querySelector('.track-events-toggle') as HTMLButtonElement;
    const trackEventsContent = this.hudElement.querySelector('.track-events-content') as HTMLElement;
    const inputValueAccessCheckbox = this.hudElement.querySelector('.input-value-access') as HTMLInputElement;
    const inputEventsCheckbox = this.hudElement.querySelector('.input-events') as HTMLInputElement;
    const formSubmitCheckbox = this.hudElement.querySelector('.form-submit') as HTMLInputElement;
    const formDataCreationCheckbox = this.hudElement.querySelector('.form-data-creation') as HTMLInputElement;

    // Function to toggle track events section visibility
    const toggleTrackEvents = () => {
      const isVisible = trackEventsContent.style.display !== 'none';
      trackEventsContent.style.display = isVisible ? 'none' : 'block';
      trackEventsToggle.textContent = isVisible ? '▼' : '▲';
    };

    // Make entire header clickable
    trackEventsHeader?.addEventListener('click', toggleTrackEvents);

    // Track Events checkbox change handlers
    inputValueAccessCheckbox?.addEventListener('change', () => this.onTrackEventsChange());
    inputEventsCheckbox?.addEventListener('change', () => this.onTrackEventsChange());
    formSubmitCheckbox?.addEventListener('change', () => this.onTrackEventsChange());
    formDataCreationCheckbox?.addEventListener('change', () => this.onTrackEventsChange());
  }

  private setupMinimizedHandlers(): void {
    const minimizedCircle = this.hudElement.querySelector('.hud-minimized-circle') as HTMLElement;

    if (!minimizedCircle) return;

    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const DRAG_THRESHOLD = 5; // pixels - minimum movement to consider it a drag

    minimizedCircle.addEventListener('mousedown', (e: MouseEvent) => {
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      const hudRect = this.hudElement.getBoundingClientRect();
      startLeft = hudRect.left;
      startTop = hudRect.top;

      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Check if movement exceeds threshold
      if (!hasMoved && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
        hasMoved = true;
      }

      if (hasMoved) {
        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;

        // Keep minimized circle within viewport bounds
        const circleSize = 50; // Size of the minimized circle
        const maxLeft = window.innerWidth - circleSize;
        const maxTop = window.innerHeight - circleSize;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        this.hudElement.style.left = newLeft + 'px';
        this.hudElement.style.top = newTop + 'px';
        this.hudElement.style.right = 'auto';
      }
    });

    document.addEventListener('mouseup', (e: MouseEvent) => {
      if (isDragging) {
        isDragging = false;

        // If no significant movement occurred, treat it as a click to restore
        if (!hasMoved) {
          this.onMinimizeToggle();
        }

        hasMoved = false;
      }
    });
  }

  private setupRecordingModeHandlers(): void {
    const recordingModeHeader = this.hudElement.querySelector('.recording-mode-header') as HTMLElement;
    const recordingModeToggle = this.hudElement.querySelector('.recording-mode-toggle') as HTMLButtonElement;
    const recordingModeContent = this.hudElement.querySelector('.recording-mode-content') as HTMLElement;

    // Function to toggle recording mode section visibility
    const toggleRecordingMode = () => {
      const isVisible = recordingModeContent.style.display !== 'none';
      recordingModeContent.style.display = isVisible ? 'none' : 'block';
      recordingModeToggle.textContent = isVisible ? '▼' : '▲';
    };

    // Make entire header clickable
    recordingModeHeader?.addEventListener('click', toggleRecordingMode);
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
    console.debug('[HUD] Requesting status from background...');

    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      console.debug('[HUD] Received status response from background:', response);

      if (response) {
        // Check for missing recordingMode and handle explicitly
        let recordingMode = response.recordingMode;
        if (!recordingMode) {
          console.error('[HUD] ❌ CRITICAL: Background returned no recordingMode!', {
            fullResponse: response,
            resettingToConsole: true
          });
          recordingMode = 'console';
        }

        const stateUpdate = {
          recording: response.recording,
          eventCount: response.eventCount,
          atCap: response.atCap,
          recordingMode: recordingMode,
          filters: response.filters || {
            elementSelector: '',
            attributeFilters: '',
            stackKeywordFilter: ''
          },
          trackEvents: response.trackEvents || {
            inputValueAccess: true,
            inputEvents: true,
            formSubmit: true,
            formDataCreation: true
          }
        };

        console.debug('[HUD] About to update state:', {
          originalRecordingMode: response.recordingMode,
          finalRecordingMode: stateUpdate.recordingMode,
          hadToReset: !response.recordingMode
        });

        this.updateState(stateUpdate);
      } else {
        console.warn('[HUD] No response received from background script');
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

  private onThemeToggle(): void {
    const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.updateState({ theme: newTheme });

    // Save theme preference to localStorage
    try {
      localStorage.setItem('hud-theme', newTheme);
    } catch (error) {
      console.warn('[HUD] Failed to save theme preference:', error);
    }
  }

  private onMinimizeToggle(): void {
    const newMinimized = !this.state.minimized;

    // If we're restoring from minimized state, position HUD where minimize button was
    if (this.state.minimized && !newMinimized) {
      this.positionHUDFromMinimized();
    }

    this.updateState({ minimized: newMinimized });

    // Save minimize state to localStorage
    try {
      localStorage.setItem('hud-minimized', newMinimized.toString());
    } catch (error) {
      console.warn('[HUD] Failed to save minimize preference:', error);
    }
  }

  private positionAtBottomRight(): void {
    const rightMargin = 40; // Distance from right edge (moved left)
    const bottomMargin = 20; // Distance from bottom edge
    const circleSize = 50;

    const rightPos = window.innerWidth - circleSize - rightMargin;
    const bottomPos = window.innerHeight - circleSize - bottomMargin;

    this.hudElement.style.left = rightPos + 'px';
    this.hudElement.style.top = bottomPos + 'px';
    this.hudElement.style.right = 'auto';
    this.hudElement.style.bottom = 'auto';
  }

  private positionHUDFromMinimized(): void {
    // Position HUD at the top of the page
    const hudWidth = 350;
    const topMargin = 20; // Distance from top edge
    const rightMargin = 20; // Distance from right edge

    // Position at top-right corner
    const rightPos = window.innerWidth - hudWidth - rightMargin;
    const topPos = topMargin;

    // Ensure it stays within viewport bounds
    const safeX = Math.max(0, Math.min(rightPos, window.innerWidth - hudWidth));
    const safeY = Math.max(0, topPos);

    this.hudElement.style.left = safeX + 'px';
    this.hudElement.style.top = safeY + 'px';
    this.hudElement.style.right = 'auto';
    this.hudElement.style.bottom = 'auto';
  }

  private onRecordingModeToggle(): void {
    console.debug('[HUD] Recording mode toggle clicked');
    const toggleSwitch = this.hudElement.querySelector('.toggle-switch') as HTMLElement;
    const currentMode = toggleSwitch.getAttribute('data-mode') || 'console';
    const newMode = currentMode === 'console' ? 'breakpoint' : 'console';

    console.debug(`[HUD] Toggling from ${currentMode} to ${newMode}`);
    this.updateState({ recordingMode: newMode });

    // Send mode change to background script
    console.debug('[HUD] Sending SET_RECORDING_MODE message to background');
    chrome.runtime.sendMessage({
      type: 'SET_RECORDING_MODE',
      recordingMode: newMode
    });
  }

  private onFilterChange(): void {
    const elementSelectorInput = this.hudElement.querySelector('.element-selector') as HTMLInputElement;
    const attributeFiltersInput = this.hudElement.querySelector('.attribute-filters') as HTMLInputElement;
    const stackKeywordFilterInput = this.hudElement.querySelector('.stack-keyword-filter') as HTMLInputElement;

    const filters: FilterOptions = {
      elementSelector: elementSelectorInput?.value || '',
      attributeFilters: attributeFiltersInput?.value || '',
      stackKeywordFilter: stackKeywordFilterInput?.value || ''
    };

    this.updateState({ filters });

    // Send filter changes to background script
    chrome.runtime.sendMessage({
      type: 'SET_FILTERS',
      filters: filters
    });
  }

  private onTrackEventsChange(): void {
    const inputValueAccessCheckbox = this.hudElement.querySelector('.input-value-access') as HTMLInputElement;
    const inputEventsCheckbox = this.hudElement.querySelector('.input-events') as HTMLInputElement;
    const formSubmitCheckbox = this.hudElement.querySelector('.form-submit') as HTMLInputElement;
    const formDataCreationCheckbox = this.hudElement.querySelector('.form-data-creation') as HTMLInputElement;

    const trackEvents: TrackEventsState = {
      inputValueAccess: inputValueAccessCheckbox?.checked || false,
      inputEvents: inputEventsCheckbox?.checked || false,
      formSubmit: formSubmitCheckbox?.checked || false,
      formDataCreation: formDataCreationCheckbox?.checked || false
    };

    this.updateState({ trackEvents });

    // Send track events changes to background script
    chrome.runtime.sendMessage({
      type: 'SET_TRACK_EVENTS',
      trackEvents: trackEvents
    });
  }

  private updateState(newState: Partial<HudState>): void {
    this.state = { ...this.state, ...newState };
    this.updateUI();
  }

  private updateUI(): void {
    const hudContent = this.hudElement.querySelector('.hud-content') as HTMLElement;
    const hudHeader = this.hudElement.querySelector('.hud-header') as HTMLElement;
    const hudMinimized = this.hudElement.querySelector('.hud-minimized') as HTMLElement;
    const minimizeToggle = this.hudElement.querySelector('.minimize-toggle') as HTMLButtonElement;

    // Handle minimize/restore UI state
    if (this.state.minimized) {
      hudContent.style.display = 'none';
      hudHeader.style.display = 'none';
      hudMinimized.style.display = 'block';
      minimizeToggle.textContent = '□';
      minimizeToggle.title = 'Restore HUD';
      // Adjust container size for minimized state
      this.hudElement.style.width = '50px';
      this.hudElement.style.height = '50px';
      this.hudElement.style.borderRadius = '50%';
      this.hudElement.style.overflow = 'visible';
      this.hudElement.style.background = 'transparent';
      this.hudElement.style.border = 'none';
      this.hudElement.style.boxShadow = 'none';
      // Position at bottom-right
      this.positionAtBottomRight();
    } else {
      hudContent.style.display = 'block';
      hudHeader.style.display = 'flex';
      hudMinimized.style.display = 'none';
      minimizeToggle.textContent = '−';
      minimizeToggle.title = 'Minimize HUD';
      // Restore container size for full state
      this.hudElement.style.width = '350px';
      this.hudElement.style.height = 'auto';
      this.hudElement.style.borderRadius = '8px';
      this.hudElement.style.overflow = 'hidden';
      this.hudElement.style.background = '';
      this.hudElement.style.border = '';
      this.hudElement.style.boxShadow = '';
    }

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

    // Update recording mode toggle switch
    const toggleSwitch = this.hudElement.querySelector('.toggle-switch') as HTMLElement;
    const leftLabel = this.hudElement.querySelector('.toggle-label.left') as HTMLElement;
    const rightLabel = this.hudElement.querySelector('.toggle-label.right') as HTMLElement;
    
    if (toggleSwitch && leftLabel && rightLabel) {
      toggleSwitch.setAttribute('data-mode', this.state.recordingMode);
      
      // Update label active states
      if (this.state.recordingMode === 'console') {
        leftLabel.classList.add('active');
        rightLabel.classList.remove('active');
      } else {
        leftLabel.classList.remove('active');
        rightLabel.classList.add('active');
      }
    }

    // Update filter input values
    const elementSelectorInput = this.hudElement.querySelector('.element-selector') as HTMLInputElement;
    const attributeFiltersInput = this.hudElement.querySelector('.attribute-filters') as HTMLInputElement;
    const stackKeywordFilterInput = this.hudElement.querySelector('.stack-keyword-filter') as HTMLInputElement;

    if (elementSelectorInput) {
      elementSelectorInput.value = this.state.filters.elementSelector;
    }
    if (attributeFiltersInput) {
      attributeFiltersInput.value = this.state.filters.attributeFilters;
    }
    if (stackKeywordFilterInput) {
      stackKeywordFilterInput.value = this.state.filters.stackKeywordFilter;
    }

    // Update track events checkboxes
    const inputValueAccessCheckbox = this.hudElement.querySelector('.input-value-access') as HTMLInputElement;
    const inputEventsCheckbox = this.hudElement.querySelector('.input-events') as HTMLInputElement;
    const formSubmitCheckbox = this.hudElement.querySelector('.form-submit') as HTMLInputElement;
    const formDataCreationCheckbox = this.hudElement.querySelector('.form-data-creation') as HTMLInputElement;

    if (inputValueAccessCheckbox) {
      inputValueAccessCheckbox.checked = this.state.trackEvents.inputValueAccess;
    }
    if (inputEventsCheckbox) {
      inputEventsCheckbox.checked = this.state.trackEvents.inputEvents;
    }
    if (formSubmitCheckbox) {
      formSubmitCheckbox.checked = this.state.trackEvents.formSubmit;
    }
    if (formDataCreationCheckbox) {
      formDataCreationCheckbox.checked = this.state.trackEvents.formDataCreation;
    }

    // Update theme
    this.hudElement.setAttribute('data-theme', this.state.theme);
    const themeToggle = this.hudElement.querySelector('.theme-toggle') as HTMLButtonElement;
    if (themeToggle) {
      themeToggle.textContent = this.state.theme === 'dark' ? '🌙' : '☀️';
      themeToggle.title = this.state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
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
/**
 * Injects surveillance script with complete configuration atomically
 * Eliminates race conditions by ensuring script never starts without full config
 */
function waitForDomRoot(): Promise<HTMLElement> {
  return new Promise((resolve) => {
    const root = (document.head || document.documentElement || document.body) as HTMLElement | null;
    if (root) return resolve(root);
    const observer = new MutationObserver(() => {
      const r = (document.head || document.documentElement || document.body) as HTMLElement | null;
      if (r) {
        observer.disconnect();
        resolve(r);
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

function injectSurveillanceScript(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const root = await waitForDomRoot();
      const surveillanceScript = document.createElement('script');
      surveillanceScript.src = chrome.runtime.getURL('injected.js');
      surveillanceScript.onload = () => {
        console.debug('[ContentScript] Surveillance script loaded');
        surveillanceScript.remove();
        resolve();
      };
      surveillanceScript.onerror = () => reject(new Error('Failed to load injected surveillance script'));
      root.appendChild(surveillanceScript);
    } catch (e) {
      reject(e);
    }
  });
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

    // Handle evidence events from main world script (early addEventListener hooks)
    if (event.data.type === 'MAIN_WORLD_EVIDENCE_EVENT') {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('[ContentScript] Extension context invalidated - cannot send main world evidence');
        return;
      }

      console.debug('[ContentScript] Received main world evidence:', {
        actionId: event.data.event.actionId,
        type: event.data.event.type,
        stackTrace: event.data.event.stackTrace,
        stackFrameCount: event.data.event.stackTrace?.length || 0
      });

      // Forward evidence to background service worker
      chrome.runtime.sendMessage({
        type: 'EVIDENCE_EVENT',
        event: event.data.event
      }).catch((error) => {
        console.error('[ContentScript] Failed to forward main world evidence to background:', error);
      });

      console.debug('[ContentScript] Forwarded main world evidence to background');
    }
    
    // Handle injected script ready signal
    if (event.data.type === 'INJECTED_SCRIPT_READY') {
      console.debug('[ContentScript] Injected script ready, sending handshake');
      // Send ready signal back to injected script
      window.postMessage({ type: 'CONTENT_SCRIPT_READY' }, '*');
      resyncStateFromBackground();
    }
  });
  
  console.debug('[ContentScript] Injected script bridge set up');
}

function resyncStateFromBackground(): void {
  console.debug('[ContentScript] Starting state resync from background...');

  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    console.debug('[ContentScript] Received GET_STATUS response:', response);

    if (!response) {
      console.warn('[ContentScript] No response from background script during resync');
      return;
    }

    // Log what we're about to send to injected script
    console.debug('[ContentScript] About to send to injected script:', {
      filters: response.filters,
      recordingMode: response.recordingMode,
      recording: response.recording,
      trackEvents: response.trackEvents,
      fallbackRecordingMode: response.recordingMode || 'console'
    });

    // Defer slightly so injected main's message listener is definitely installed
    setTimeout(() => {
      // Send filters (safe to use defaults here)
      window.postMessage({ type: 'SET_FILTERS', filters: response.filters || { elementSelector: '', attributeFilters: '', stackKeywordFilter: '' } }, '*');

      // Recording mode - NO FALLBACK, make issues visible
      if (response.recordingMode) {
        console.debug(`[ContentScript] Sending valid recording mode: ${response.recordingMode}`);
        window.postMessage({ type: 'SET_RECORDING_MODE', recordingMode: response.recordingMode }, '*');
      } else {
        console.error('[ContentScript] ❌ CRITICAL: Background returned no recordingMode!', {
          fullResponse: response,
          backgroundMightBeCorrupted: true
        });
        // Force reset to console mode and log the issue
        console.warn('[ContentScript] Force-resetting to console mode due to missing recordingMode');
        window.postMessage({ type: 'SET_RECORDING_MODE', recordingMode: 'console' }, '*');
      }

      // Recording state
      window.postMessage({ type: 'SET_RECORDING_STATE', recording: !!response.recording }, '*');

      // Track events (safe to use defaults here)
      window.postMessage({ type: 'SET_TRACK_EVENTS', trackEvents: response.trackEvents || { inputValueAccess: true, inputEvents: true, formSubmit: true, formDataCreation: true } }, '*');

      console.debug('[ContentScript] State messages sent to injected script');

      // Validate state sync after a longer delay to allow HUD to finish updating
      setTimeout(() => validateStateSync(), 500);
    }, 0);
  });
}

/**
 * Validates that HUD and injected script have synchronized state
 */
function validateStateSync(): void {
  // Get current HUD state
  const hudElement = document.getElementById('evidence-hud-overlay');
  const toggleSwitch = hudElement?.querySelector('.toggle-switch') as HTMLElement;
  const hudRecordingMode = toggleSwitch?.getAttribute('data-mode') || 'unknown';

  console.debug('[ContentScript] Reading HUD state for validation:', {
    hudElementExists: !!hudElement,
    toggleSwitchExists: !!toggleSwitch,
    dataMode: toggleSwitch?.getAttribute('data-mode'),
    resolvedMode: hudRecordingMode
  });

  // Request injected script state via postMessage
  window.postMessage({ type: 'GET_INJECTED_STATE' }, '*');

  // Set up one-time listener for response
  const stateValidator = (event: MessageEvent) => {
    if (event.source !== window || event.data.type !== 'INJECTED_STATE_RESPONSE') return;

    const injectedState = event.data.state;
    console.debug('[ContentScript] State validation:', {
      hudRecordingMode,
      injectedRecordingMode: injectedState.recordingMode,
      injectedRecording: injectedState.recording,
      inSync: hudRecordingMode === injectedState.recordingMode
    });

    if (hudRecordingMode !== injectedState.recordingMode) {
      console.error('[ContentScript] ❌ STATE SYNC ISSUE DETECTED!', {
        hudMode: hudRecordingMode,
        injectedMode: injectedState.recordingMode,
        problem: 'HUD and injected script have different recording modes'
      });
    } else {
      console.debug('[ContentScript] ✅ State is synchronized');
    }

    window.removeEventListener('message', stateValidator);
  };

  window.addEventListener('message', stateValidator);

  // Timeout cleanup
  setTimeout(() => window.removeEventListener('message', stateValidator), 1000);
}

/**
 * Sets up control message forwarding in all frames
 */
function setupControlForwarding(): void {
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'SET_RECORDING_MODE':
        window.postMessage({
          type: 'SET_RECORDING_MODE',
          recordingMode: message.recordingMode
        }, '*');
        break;
      case 'SET_RECORDING_STATE':
        window.postMessage({
          type: 'SET_RECORDING_STATE',
          recording: message.recording
        }, '*');
        break;
      case 'SET_FILTERS':
        window.postMessage({
          type: 'SET_FILTERS',
          filters: message.filters
        }, '*');
        break;
      case 'SET_TRACK_EVENTS':
        window.postMessage({
          type: 'SET_TRACK_EVENTS',
          trackEvents: message.trackEvents
        }, '*');
        break;
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Track if we've already initialized to prevent multiple HUD instances
let isInitialized = false;
let hudInstance: HUD | null = null;

// Initialize everything when DOM is ready
async function initialize(): Promise<void> {
  if (isInitialized) {
    console.warn('[ContentScript] ⚠️ initialize() called multiple times! Skipping to prevent duplicate HUD.');
    return;
  }

  console.debug('[ContentScript] Initializing Reflectiz content script...');

  try {
    // Inject surveillance script with complete config atomically - no race conditions
    await injectSurveillanceScript();

    // Set up communication bridge for evidence collection
    setupInjectedScriptBridge();

    // Forward control messages for runtime config changes only
    setupControlForwarding();

    // Only initialize HUD in the top frame (not in iframes)
    if (window === window.top) {
      // Check if HUD already exists in DOM
      const existingHUD = document.getElementById('evidence-hud-overlay');
      if (existingHUD) {
        console.warn('[ContentScript] ⚠️ HUD element already exists in DOM! Removing old one.');
        existingHUD.remove();
      }

      hudInstance = new HUD();
      console.debug('[ContentScript] ✅ HUD initialized in main frame');
    } else {
      console.debug('[ContentScript] Skipping HUD in iframe');
    }

    isInitialized = true;
    console.debug('[ContentScript] ✅ Content script initialization complete');
  } catch (error) {
    console.error('[ContentScript] Failed to initialize:', error);
    // Continue anyway - some functionality might still work
  }
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}