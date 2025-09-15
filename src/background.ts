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
  private readonly EVENT_CAP = 2000; // Max events per tab before showing warning

  constructor() {
    this.tabData = new Map();
    this.setupMessageHandlers();
    this.setupTabHandlers();
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
            this.toggleRecording(tabId, sender.tab.url);
            sendResponse({ recording: this.isRecording(tabId) });
          }
          break;
          
        case 'GET_STATUS':
          sendResponse({
            recording: this.isRecording(tabId),
            eventCount: this.getEventCount(tabId),
            atCap: this.isAtCap(tabId),
            recordingMode: this.getRecordingMode(tabId),
            filters: this.getFilters(tabId),
            trackEvents: this.getTrackEvents(tabId)
          });
          break;
          
        case 'EXPORT_EVENTS':
          this.exportEvents(tabId);
          sendResponse({ exported: true });
          break;
          
        case 'CLEAR_EVENTS':
          this.clearEvents(tabId);
          sendResponse({ cleared: true });
          break;
          
        case 'SET_RECORDING_MODE':
          if (message.recordingMode) {
            this.setRecordingMode(tabId, message.recordingMode);
            sendResponse({ recordingMode: message.recordingMode });
          }
          break;
          
        case 'SET_FILTERS':
          if (message.filters && sender.tab?.url) {
            this.setFilters(tabId, message.filters, sender.tab.url);
            sendResponse({ filters: message.filters });
          }
          break;

        case 'SET_TRACK_EVENTS':
          if (message.trackEvents && sender.tab?.url) {
            this.setTrackEvents(tabId, message.trackEvents, sender.tab.url);
            sendResponse({ trackEvents: message.trackEvents });
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
      // Clean up tab data
      this.tabData.delete(tabId);
    });
  }

  private initializeTab(tabId: number, url: string): void {
    if (!this.tabData.has(tabId)) {
      const domain = new URL(url).hostname;
      this.tabData.set(tabId, {
        events: [],
        recording: false, // Start disabled by default
        recordingMode: 'console', // Default to console logging
        domain: domain,
        createdAt: Date.now(),
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
        }
      });
    }
  }

  private addEvent(tabId: number, event: EvidenceEvent, url: string): void {
    this.initializeTab(tabId, url);
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

  private toggleRecording(tabId: number, url: string): void {
    this.initializeTab(tabId, url);
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

  private setRecordingMode(tabId: number, mode: 'console' | 'breakpoint'): void {
    const tabInfo = this.tabData.get(tabId);
    if (tabInfo) {
      tabInfo.recordingMode = mode;
      console.debug(`[Background] Recording mode set to ${mode} for tab ${tabId}`);
      
      // If currently recording, send mode update to injected script
      if (tabInfo.recording) {
        this.sendToTab(tabId, {
          type: 'SET_RECORDING_MODE',
          recordingMode: mode
        });
      }
    }
  }

  private getFilters(tabId: number): FilterOptions {
    return this.tabData.get(tabId)?.filters || {
      elementSelector: '',
      attributeFilters: '',
      stackKeywordFilter: ''
    };
  }

  private setFilters(tabId: number, filters: FilterOptions, url: string): void {
    this.initializeTab(tabId, url);
    const tabInfo = this.tabData.get(tabId);
    if (tabInfo) {
      tabInfo.filters = filters;
      console.debug(`[Background] Filters updated for tab ${tabId}:`, filters);

      // Send filter updates to injected script
      this.sendToTab(tabId, {
        type: 'SET_FILTERS',
        filters: filters
      });
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

  private setTrackEvents(tabId: number, trackEvents: TrackEventsState, url: string): void {
    this.initializeTab(tabId, url);
    const tabInfo = this.tabData.get(tabId);
    if (tabInfo) {
      tabInfo.trackEvents = trackEvents;
      console.debug(`[Background] Track Events updated for tab ${tabId}:`, trackEvents);

      // Send track events updates to injected script
      this.sendToTab(tabId, {
        type: 'SET_TRACK_EVENTS',
        trackEvents: trackEvents
      });
    }
  }

  private clearEvents(tabId: number): void {
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