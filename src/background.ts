// Input Evidence Extension - Background Service Worker
// Manages per-tab event storage, settings, and auto-export functionality

/// <reference types="chrome"/>

import {
  EvidenceEvent,
  FilterOptions,
  TrackEventsState,
  TabData,
  HudMessage,
  BackgroundMessage,
  ExportData
} from './shared-types';

class EvidenceManager {
  private tabData: Map<number, TabData>;
  private tabStorageKeys: Map<number, string>; // Track storage keys per tab
  private readonly EVENT_CAP = 2000; // Max events per tab before showing warning

  constructor() {
    this.tabData = new Map();
    this.tabStorageKeys = new Map();
    this.setupMessageHandlers();
    this.setupTabHandlers();
    this.cleanupOldStates();
  }

  private setupMessageHandlers(): void {
    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
      const tabId = sender.tab?.id;
      if (!tabId) return;

      switch (message.type) {
        case 'EVIDENCE_EVENT':
          if (message.event && sender.tab?.url) {
            this.addEvent(tabId, message.event, sender.tab.url);
          }
          break;

        case 'TOGGLE_RECORDING':
          if (sender.tab?.url) {
            this.toggleRecording(tabId, sender.tab.url).then(() => {
              sendResponse({ recording: this.isRecording(tabId) });
            });
            return true; // Keep message channel open for async response
          }
          break;
          
        case 'GET_STATUS':
          if (sender.tab?.url) {
            this.initializeTab(tabId, sender.tab.url).then(() => {
              sendResponse({
                recording: this.isRecording(tabId),
                eventCount: this.getEventCount(tabId),
                atCap: this.isAtCap(tabId),
                recordingMode: this.getRecordingMode(tabId),
                filters: this.getFilters(tabId),
                trackEvents: this.getTrackEvents(tabId)
              });
            });
            return true; // Keep message channel open for async response
          }
          break;
          
        case 'EXPORT_EVENTS':
          this.exportEvents(tabId);
          sendResponse({ exported: true });
          break;
          
        case 'CLEAR_EVENTS':
          this.clearEvents(tabId).then(() => {
            sendResponse({ cleared: true });
          });
          return true; // Keep message channel open for async response
          break;
          
        case 'SET_RECORDING_MODE':
          if (message.recordingMode) {
            this.setRecordingMode(tabId, message.recordingMode).then(() => {
              sendResponse({ recordingMode: message.recordingMode });
            });
            return true; // Keep message channel open for async response
          }
          break;
          
        case 'SET_FILTERS':
          if (message.filters && sender.tab?.url) {
            this.setFilters(tabId, message.filters, sender.tab.url).then(() => {
              sendResponse({ filters: message.filters });
            });
            return true; // Keep message channel open for async response
          }
          break;

        case 'SET_TRACK_EVENTS':
          if (message.trackEvents && sender.tab?.url) {
            this.setTrackEvents(tabId, message.trackEvents, sender.tab.url).then(() => {
              sendResponse({ trackEvents: message.trackEvents });
            });
            return true; // Keep message channel open for async response
          }
          break;
      }
    });
  }

  private setupTabHandlers(): void {
    // Auto-export when tab is closed (if recording was enabled)
    chrome.tabs.onRemoved.addListener((tabId: number) => {
      if (this.tabData.has(tabId) && this.isRecording(tabId)) {
        console.log(`Tab ${tabId} closed with recording enabled - auto-exporting`);
        this.exportEvents(tabId, true); // true = auto-export
      }

      // Clean up tab data and storage key
      this.tabData.delete(tabId);
      this.tabStorageKeys.delete(tabId);
      console.debug(`[Background] Cleaned up tab ${tabId} data and storage key`);
    });
  }

  private async initializeTab(tabId: number, url: string): Promise<void> {
    if (!this.tabData.has(tabId)) {
      const domain = new URL(url).hostname;

      // Try to load existing state for this domain
      const savedState = await this.loadTabState(domain);

      // Use existing storage key for this tab, or generate new one
      let storageKey = this.tabStorageKeys.get(tabId);
      if (!storageKey) {
        storageKey = this.generateStorageKey(domain);
        this.tabStorageKeys.set(tabId, storageKey);
      }

      // Create tab data with saved state or defaults
      const tabData: TabData = {
        events: [],
        recording: savedState?.recording ?? false, // Start disabled by default
        recordingMode: savedState?.recordingMode ?? 'console', // Default to console logging
        domain: domain,
        createdAt: Date.now(),
        filters: savedState?.filters ?? {
          elementSelector: '',
          attributeFilters: '',
          stackKeywordFilter: ''
        },
        trackEvents: savedState?.trackEvents ?? {
          inputValueAccess: true,
          inputEvents: true,
          formSubmit: true,
          formDataCreation: true
        }
      };

      this.tabData.set(tabId, tabData);

      // Save the initial state (with new storage key)
      await this.saveTabState(tabId);

      console.debug(`[Background] Initialized tab ${tabId} for domain ${domain}${savedState ? ' with saved state' : ' with defaults'}`);
    }
  }

  private async addEvent(tabId: number, event: EvidenceEvent, url: string): Promise<void> {
    await this.initializeTab(tabId, url);
    const tabInfo = this.tabData.get(tabId)!;
    
    // Only add if recording is enabled for this tab
    if (!tabInfo.recording) return;
    
    // Add timestamp if not present
    if (!event.start) {
      event.start = performance.now();
    }
    
    tabInfo.events.push(event);
    
    // Check if we hit the cap
    if (tabInfo.events.length >= this.EVENT_CAP) {
      // Send warning to HUD about cap reached
      this.sendToTab(tabId, {
        type: 'HUD_MESSAGE',
        level: 'warning',
        message: `Event cap reached (${this.EVENT_CAP}). Oldest events will be dropped.`
      });
      
      // Remove oldest events (FIFO)
      tabInfo.events = tabInfo.events.slice(-this.EVENT_CAP);
    }
    
    // TODO: Add duplicate detection strategy here
    // Potential approaches:
    // 1. Hash by: type + target.id + first stack frame
    // 2. Hash by: type + target.id + full stack trace
    // 3. Time-based deduplication (same event within 100ms)
    
    // Notify HUD of new event count
    this.sendToTab(tabId, {
      type: 'HUD_UPDATE',
      eventCount: tabInfo.events.length,
      atCap: tabInfo.events.length >= this.EVENT_CAP
    });
  }

  private async toggleRecording(tabId: number, url: string): Promise<void> {
    await this.initializeTab(tabId, url);
    const tabInfo = this.tabData.get(tabId)!;
    tabInfo.recording = !tabInfo.recording;
    
    // Notify HUD of state change
    this.sendToTab(tabId, {
      type: 'HUD_UPDATE',
      recording: tabInfo.recording,
      eventCount: tabInfo.events.length
    });
    
    if (tabInfo.recording) {
      this.sendToTab(tabId, {
        type: 'HUD_MESSAGE',
        level: 'info',
        message: 'Recording started - watching input interactions'
      });
      // Send recording mode to injected script
      this.sendToTab(tabId, {
        type: 'SET_RECORDING_MODE',
        recordingMode: tabInfo.recordingMode
      });
    } else {
      this.sendToTab(tabId, {
        type: 'HUD_MESSAGE',
        level: 'info', 
        message: 'Recording stopped'
      });
    }

    // Always send recording state to injected script
    this.sendToTab(tabId, {
      type: 'SET_RECORDING_STATE',
      recording: tabInfo.recording
    });

    // Save state after recording toggle
    await this.saveTabState(tabId);
  }

  private isRecording(tabId: number): boolean {
    return this.tabData.get(tabId)?.recording || false;
  }

  private getEventCount(tabId: number): number {
    return this.tabData.get(tabId)?.events.length || 0;
  }

  private isAtCap(tabId: number): boolean {
    return this.getEventCount(tabId) >= this.EVENT_CAP;
  }

  private getRecordingMode(tabId: number): 'console' | 'breakpoint' {
    return this.tabData.get(tabId)?.recordingMode || 'console';
  }

  private async setRecordingMode(tabId: number, mode: 'console' | 'breakpoint'): Promise<void> {
    const tabInfo = this.tabData.get(tabId);
    if (tabInfo) {
      tabInfo.recordingMode = mode;
      console.debug(`[Background] Recording mode set to ${mode} for tab ${tabId}`);

      // Always send mode update to injected script (not just when recording)
      this.sendToTab(tabId, {
        type: 'SET_RECORDING_MODE',
        recordingMode: mode
      });

      // Save state after mode change
      await this.saveTabState(tabId);
    }
  }

  private getFilters(tabId: number): FilterOptions {
    return this.tabData.get(tabId)?.filters || {
      elementSelector: '',
      attributeFilters: '',
      stackKeywordFilter: ''
    };
  }

  private async setFilters(tabId: number, filters: FilterOptions, url: string): Promise<void> {
    await this.initializeTab(tabId, url);
    const tabInfo = this.tabData.get(tabId);
    if (tabInfo) {
      tabInfo.filters = filters;
      console.debug(`[Background] Filters updated for tab ${tabId}:`, filters);

      // Send filter updates to injected script
      this.sendToTab(tabId, {
        type: 'SET_FILTERS',
        filters: filters
      });

      // Save state after filter change
      await this.saveTabState(tabId);
    }
  }

  private getTrackEvents(tabId: number): TrackEventsState {
    return this.tabData.get(tabId)?.trackEvents || {
      inputValueAccess: true,
      inputEvents: true,
      formSubmit: true,
      formDataCreation: true
    };
  }

  private async setTrackEvents(tabId: number, trackEvents: TrackEventsState, url: string): Promise<void> {
    await this.initializeTab(tabId, url);
    const tabInfo = this.tabData.get(tabId);
    if (tabInfo) {
      tabInfo.trackEvents = trackEvents;
      console.debug(`[Background] Track Events updated for tab ${tabId}:`, trackEvents);

      // Send track events updates to injected script
      this.sendToTab(tabId, {
        type: 'SET_TRACK_EVENTS',
        trackEvents: trackEvents
      });

      // Save state after track events change
      await this.saveTabState(tabId);
    }
  }

  private async clearEvents(tabId: number): Promise<void> {
    const tabInfo = this.tabData.get(tabId);
    if (tabInfo) {
      tabInfo.events = [];

      // Send HUD update to refresh button states and event count
      this.sendToTab(tabId, {
        type: 'HUD_UPDATE',
        eventCount: 0,
        atCap: false
      });

      this.sendToTab(tabId, {
        type: 'HUD_MESSAGE',
        level: 'info',
        message: 'Events cleared'
      });

      // Save state after clearing events
      await this.saveTabState(tabId);
    }
  }

  private exportEvents(tabId: number, isAutoExport: boolean = false): void {
    const tabInfo = this.tabData.get(tabId);
    if (!tabInfo || tabInfo.events.length === 0) {
      if (!isAutoExport) {
        this.sendToTab(tabId, {
          type: 'HUD_MESSAGE',
          level: 'warning',
          message: 'No events to export'
        });
      }
      return;
    }

    // Generate filename: evidence_google.com_2025-09-01_14-30-45.json
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // 2025-09-01
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // 14-30-45
    const filename = `evidence_${tabInfo.domain}_${dateStr}_${timeStr}.json`;
    
    // Create export data with metadata
    const exportData: ExportData = {
      metadata: {
        domain: tabInfo.domain,
        exportedAt: now.toISOString(),
        eventCount: tabInfo.events.length,
        recordingStarted: new Date(tabInfo.createdAt).toISOString(),
        autoExported: isAutoExport
      },
      events: tabInfo.events
    };

    // Trigger download using data URL (service workers don't support URL.createObjectURL)
    const jsonString = JSON.stringify(exportData, null, 2);
    const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: !isAutoExport // Don't prompt for auto-exports
    }, (_downloadId?: number) => {
      
      if (!isAutoExport) {
        this.sendToTab(tabId, {
          type: 'HUD_MESSAGE',
          level: 'success',
          message: `Exported ${tabInfo.events.length} events to ${filename}`
        });
      }
    });
  }

  // ============================================================================
  // STATE PERSISTENCE METHODS
  // ============================================================================

  private generateStorageKey(domain: string): string {
    return `tab_${domain}`;
  }

  private async saveTabState(tabId: number): Promise<void> {
    const tabInfo = this.tabData.get(tabId);
    const storageKey = this.tabStorageKeys.get(tabId);

    if (!tabInfo || !storageKey) return;

    try {
      const stateToSave = {
        recording: tabInfo.recording,
        recordingMode: tabInfo.recordingMode,
        filters: tabInfo.filters,
        trackEvents: tabInfo.trackEvents,
        domain: tabInfo.domain,
        lastUpdated: Date.now()
      };

      await chrome.storage.local.set({ [storageKey]: stateToSave });
      console.debug(`[Background] Saved state for tab ${tabId} with key ${storageKey}:`, stateToSave);
    } catch (error) {
      console.warn(`[Background] Failed to save state for tab ${tabId}:`, error);
    }
  }

  private async loadTabState(domain: string): Promise<Partial<TabData> | null> {
    try {
      const storageKey = `tab_${domain}`;
      const storage = await chrome.storage.local.get(storageKey);
      const state = storage[storageKey];

      if (state) {
        console.debug(`[Background] Loaded state for domain ${domain}:`, state);
        return state;
      }
      return null;
    } catch (error) {
      console.warn(`[Background] Failed to load state for domain ${domain}:`, error);
      return null;
    }
  }

  private async cleanupOldStates(): Promise<void> {
    try {
      const storage = await chrome.storage.local.get();
      const keys = Object.keys(storage);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

      const keysToRemove = keys
        .filter(key => key.startsWith('tab_'))
        .filter(key => {
          const state = storage[key];
          return state && state.lastUpdated && (now - state.lastUpdated) > maxAge;
        });

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.debug(`[Background] Cleaned up ${keysToRemove.length} old state entries`);
      }
    } catch (error) {
      console.warn('[Background] Failed to cleanup old states:', error);
    }
  }

  private sendToTab(tabId: number, message: HudMessage): void {
    // Send message to content script in specific tab
    chrome.tabs.sendMessage(tabId, message).catch(() => {
      // Tab might be closed or not ready, ignore errors
    });
  }
}

// Initialize the evidence manager
const evidenceManager = new EvidenceManager();

console.log('Input Evidence Extension background service worker initialized');