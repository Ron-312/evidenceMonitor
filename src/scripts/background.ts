// Input Evidence Extension - Background Service Worker
// Manages per-tab event storage, settings, and auto-export functionality

/// <reference types="chrome"/>

import {
  EvidenceEvent,
  FilterOptions,
  TrackEventsState,
  WindowData,
  HudMessage,
  BackgroundMessage,
  ExportData
} from './utils/shared-types';

class EvidenceManager {
  private windowData: Map<number, WindowData>;
  private tabWindowMap: Map<number, number>; // tabId -> windowId mapping
  private readonly EVENT_CAP = 10000; // Max events per window before showing warning

  // HUD update throttling
  private hudUpdateThrottle: Map<number, number> = new Map(); // windowId -> lastUpdateTime
  private readonly hudUpdateInterval: number = 200; // 200ms throttle for HUD updates

  constructor() {
    this.windowData = new Map();
    this.tabWindowMap = new Map();
    this.setupMessageHandlers();
    this.setupTabHandlers();
    this.setupWindowHandlers();
  }

  // URL utility functions
  private normalizeUrlForGrouping(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove query params and hash, keep pathname
      // Decode URI components to preserve Hebrew and other Unicode characters
      let hostname = urlObj.hostname;
      let pathname = urlObj.pathname;

      // Try to decode URI components, but handle errors gracefully
      try {
        hostname = decodeURIComponent(hostname);
        pathname = decodeURIComponent(pathname);
      } catch (decodeError) {
        console.warn('[Background] Failed to decode URI components, using original:', decodeError);
        // Keep original if decoding fails
      }

      return `${hostname}${pathname}`.replace(/\/$/, '');
    } catch (error) {
      console.warn('[Background] Failed to normalize URL:', url, error);
      return 'unknown-url';
    }
  }

  private createFilename(normalizedUrl: string, timestamp: Date): string {
    // Convert URL path to safe filename with Unicode support (including Hebrew)
    const safeName = normalizedUrl
      .replace(/[<>:"/\\|?*]/g, '_')  // Only replace Windows-forbidden characters
      .replace(/[\x00-\x1f]/g, '_')  // Replace control characters (but not Unicode range)
      .replace(/_{2,}/g, '_')         // Collapse multiple underscores
      .replace(/^_|_$/g, '');         // Remove leading/trailing underscores

    const dateStr = timestamp.toISOString().split('T')[0];
    const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `evidence_${safeName}_${dateStr}_${timeStr}.json`;
  }

  // Window ID discovery with fail-fast error handling
  private async getWindowIdFromTab(tabId: number): Promise<number> {
    try {
      // Check cache first
      if (this.tabWindowMap.has(tabId)) {
        return this.tabWindowMap.get(tabId)!;
      }

      // Get fresh tab info
      const tab = await chrome.tabs.get(tabId);
      this.tabWindowMap.set(tabId, tab.windowId);
      return tab.windowId;
    } catch (error) {
      console.error(`[Background] Failed to get window ID for tab ${tabId}:`, error);
      throw new Error(`Cannot determine window for tab ${tabId}`);
    }
  }

  // Initialize window state if it doesn't exist
  private initializeWindow(windowId: number): void {
    if (!this.windowData.has(windowId)) {
      const windowState: WindowData = {
        recording: false,
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
        events: [],
        createdAt: Date.now(),
        tabIds: new Set()
      };
      this.windowData.set(windowId, windowState);
      console.debug(`[Background] Initialized window ${windowId} with default state`);
    }
  }

  // Add tab to window tracking
  private addTabToWindow(windowId: number, tabId: number): void {
    this.initializeWindow(windowId);
    const windowState = this.windowData.get(windowId)!;
    windowState.tabIds.add(tabId);
    this.tabWindowMap.set(tabId, windowId);
  }

  private setupMessageHandlers(): void {
    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
      const tabId = sender.tab?.id;
      if (!tabId) return;

      // All handlers now use window-based state with error handling
      switch (message.type) {
        case 'EVIDENCE_EVENT':
          if (message.event && sender.tab?.url) {
            this.addEvent(tabId, message.event, sender.tab.url).catch(error => {
              console.error('[Background] Failed to add evidence event:', error);
            });
          }
          break;

        case 'EVIDENCE_EVENT_BATCH':
          if (message.events && message.batchSize && sender.tab?.url) {
            console.debug(`[Background] Processing batch of ${message.batchSize} events from tab ${tabId}`);
            this.addEventBatch(tabId, message.events, sender.tab.url).catch(error => {
              console.error('[Background] Failed to add evidence event batch:', error);
            });
          }
          break;

        case 'TOGGLE_RECORDING':
          this.toggleRecording(tabId).then(() => {
            sendResponse({ recording: this.isRecording(tabId) });
          }).catch(error => {
            console.error('[Background] Failed to toggle recording:', error);
            sendResponse({ error: 'Failed to toggle recording' });
          });
          return true;

        case 'GET_STATUS':
          this.getWindowIdFromTab(tabId).then(windowId => {
            this.addTabToWindow(windowId, tabId);
            const windowState = this.windowData.get(windowId)!;

            const statusResponse = {
              recording: windowState.recording,
              eventCount: windowState.events.length,
              atCap: windowState.events.length >= this.EVENT_CAP,
              recordingMode: windowState.recordingMode,
              filters: windowState.filters,
              trackEvents: windowState.trackEvents
            };

            console.debug(`[Background] GET_STATUS response for tab ${tabId}, window ${windowId}:`, statusResponse);
            sendResponse(statusResponse);
          }).catch(error => {
            console.error(`[Background] Failed to get status for tab ${tabId}:`, error);
            sendResponse({
              recording: false,
              eventCount: 0,
              atCap: false,
              recordingMode: 'console',
              filters: { elementSelector: '', attributeFilters: '', stackKeywordFilter: '' },
              trackEvents: { inputValueAccess: true, inputEvents: true, formSubmit: true, formDataCreation: true }
            });
          });
          return true;

        case 'EXPORT_EVENTS':
          this.exportEvents(tabId).catch(error => {
            console.error('[Background] Failed to export events:', error);
            sendResponse({ error: 'Failed to export events' });
          });
          sendResponse({ exported: true });
          break;

        case 'CLEAR_EVENTS':
          this.clearEvents(tabId).then(() => {
            sendResponse({ cleared: true });
          }).catch(error => {
            console.error('[Background] Failed to clear events:', error);
            sendResponse({ error: 'Failed to clear events' });
          });
          return true;

        case 'SET_RECORDING_MODE':
          if (message.recordingMode) {
            this.setRecordingMode(tabId, message.recordingMode).then(() => {
              sendResponse({ recordingMode: message.recordingMode });
            }).catch(error => {
              console.error('[Background] Failed to set recording mode:', error);
              sendResponse({ error: 'Failed to set recording mode' });
            });
            return true;
          }
          break;

        case 'SET_FILTERS':
          if (message.filters) {
            this.setFilters(tabId, message.filters).then(() => {
              sendResponse({ filters: message.filters });
            }).catch(error => {
              console.error('[Background] Failed to set filters:', error);
              sendResponse({ error: 'Failed to set filters' });
            });
            return true;
          }
          break;

        case 'SET_TRACK_EVENTS':
          if (message.trackEvents) {
            this.setTrackEvents(tabId, message.trackEvents).then(() => {
              sendResponse({ trackEvents: message.trackEvents });
            }).catch(error => {
              console.error('[Background] Failed to set track events:', error);
              sendResponse({ error: 'Failed to set track events' });
            });
            return true;
          }
          break;

        case 'GET_EXPORT_PREVIEW':
          this.getExportPreview(tabId).then((preview) => {
            sendResponse({ preview });
          }).catch(error => {
            console.error('[Background] Failed to get export preview:', error);
            sendResponse({ error: 'Failed to get export preview' });
          });
          return true;
      }
    });
  }

  private setupTabHandlers(): void {
    chrome.tabs.onRemoved.addListener((tabId: number) => {
      if (this.tabWindowMap.has(tabId)) {
        const windowId = this.tabWindowMap.get(tabId)!;
        const windowState = this.windowData.get(windowId);

        if (windowState) {
          // Remove tab from window tracking
          windowState.tabIds.delete(tabId);

          // If this was the last tab and recording was active, auto-export
          if (windowState.tabIds.size === 0 && windowState.recording && windowState.events.length > 0) {
            console.log(`Last tab ${tabId} closed with recording enabled - auto-exporting window ${windowId}`);
            this.exportEvents(tabId, true).catch(error => {
              console.error('[Background] Failed to auto-export on tab close:', error);
            });
          }
        }

        this.tabWindowMap.delete(tabId);
        console.debug(`[Background] Cleaned up tab ${tabId} from window ${windowId}`);
      }
    });
  }

  private setupWindowHandlers(): void {
    // Clean up window data when window is closed
    chrome.windows.onRemoved.addListener((windowId: number) => {
      if (this.windowData.has(windowId)) {
        const windowState = this.windowData.get(windowId)!;

        // Auto-export if recording was active
        if (windowState.recording && windowState.events.length > 0) {
          console.log(`Window ${windowId} closed with recording enabled - auto-exporting`);
          // Use any tab from the window for export context
          const anyTabId = Array.from(windowState.tabIds)[0];
          if (anyTabId) {
            this.exportEvents(anyTabId, true).catch(error => {
              console.error('[Background] Failed to auto-export on window close:', error);
            });
          }
        }

        // Clean up all mappings for this window
        for (const tabId of windowState.tabIds) {
          this.tabWindowMap.delete(tabId);
        }

        this.windowData.delete(windowId);
        console.debug(`[Background] Cleaned up window ${windowId} and all associated tabs`);
      }
    });
  }

  // New window-based methods
  private async addEvent(tabId: number, event: EvidenceEvent, url: string): Promise<void> {
    const windowId = await this.getWindowIdFromTab(tabId);
    this.addTabToWindow(windowId, tabId);
    const windowState = this.windowData.get(windowId)!;

    if (!windowState.recording) {
      return;
    }

    if (!event.start) {
      event.start = performance.now();
    }

    // Tag event with normalized URL for grouping during export
    const normalizedUrl = this.normalizeUrlForGrouping(url);
    const taggedEvent: EvidenceEvent = {
      ...event,
      _internalUrl: normalizedUrl
    };

    windowState.events.push(taggedEvent);

    this.handleEventCapAndUpdate(windowId, windowState);
  }

  private async addEventBatch(tabId: number, events: EvidenceEvent[], url: string): Promise<void> {
    const windowId = await this.getWindowIdFromTab(tabId);
    this.addTabToWindow(windowId, tabId);
    const windowState = this.windowData.get(windowId)!;

    if (!windowState.recording) {
      return;
    }

    const normalizedUrl = this.normalizeUrlForGrouping(url);
    const now = performance.now();

    // Process all events in batch
    for (const event of events) {
      if (!event.start) {
        event.start = now;
      }

      // Tag event with normalized URL for grouping during export
      const taggedEvent: EvidenceEvent = {
        ...event,
        _internalUrl: normalizedUrl
      };

      windowState.events.push(taggedEvent);
    }

    this.handleEventCapAndUpdate(windowId, windowState);
  }

  private handleEventCapAndUpdate(windowId: number, windowState: WindowData): void {
    // Handle event cap at window level
    if (windowState.events.length >= this.EVENT_CAP) {
      // Notify all tabs in this window about the cap
      for (const windowTabId of windowState.tabIds) {
        this.sendToTab(windowTabId, {
          type: 'HUD_MESSAGE',
          level: 'warning',
          message: `Event cap reached (${this.EVENT_CAP}). Oldest events will be dropped.`
        });
      }
      windowState.events = windowState.events.slice(-this.EVENT_CAP);
    }

    // Throttled HUD updates
    this.throttledHudUpdate(windowId, windowState);
  }

  private throttledHudUpdate(windowId: number, windowState: WindowData): void {
    const now = Date.now();
    const lastUpdate = this.hudUpdateThrottle.get(windowId) || 0;

    if (now - lastUpdate >= this.hudUpdateInterval) {
      // Update all tabs in this window with new event count
      for (const windowTabId of windowState.tabIds) {
        this.sendToTab(windowTabId, {
          type: 'HUD_UPDATE',
          eventCount: windowState.events.length,
          atCap: windowState.events.length >= this.EVENT_CAP
        });
      }

      this.hudUpdateThrottle.set(windowId, now);
    }
  }

  private async toggleRecording(tabId: number): Promise<void> {
    const windowId = await this.getWindowIdFromTab(tabId);
    this.addTabToWindow(windowId, tabId);
    const windowState = this.windowData.get(windowId)!;

    windowState.recording = !windowState.recording;

    // Update all tabs in this window with new recording state
    for (const windowTabId of windowState.tabIds) {
      this.sendToTab(windowTabId, {
        type: 'HUD_UPDATE',
        recording: windowState.recording,
        eventCount: windowState.events.length
      });

      if (windowState.recording) {
        this.sendToTab(windowTabId, {
          type: 'HUD_MESSAGE',
          level: 'info',
          message: 'Recording started - watching input interactions'
        });
        this.sendToTab(windowTabId, {
          type: 'SET_RECORDING_MODE',
          recordingMode: windowState.recordingMode
        });
      } else {
        this.sendToTab(windowTabId, {
          type: 'HUD_MESSAGE',
          level: 'info',
          message: 'Recording stopped'
        });
      }

      this.sendToTab(windowTabId, {
        type: 'SET_RECORDING_STATE',
        recording: windowState.recording
      });
    }
  }

  private isRecording(tabId: number): boolean {
    const windowId = this.tabWindowMap.get(tabId);
    return this.windowData.get(windowId!)?.recording || false;
  }

  private async setRecordingMode(tabId: number, mode: 'console' | 'breakpoint'): Promise<void> {
    const windowId = await this.getWindowIdFromTab(tabId);
    this.addTabToWindow(windowId, tabId);
    const windowState = this.windowData.get(windowId)!;

    windowState.recordingMode = mode;
    console.debug(`[Background] Recording mode set to ${mode} for window ${windowId}`);

    // Update all tabs in this window
    for (const windowTabId of windowState.tabIds) {
      this.sendToTab(windowTabId, {
        type: 'SET_RECORDING_MODE',
        recordingMode: mode
      });
    }
  }

  private async setFilters(tabId: number, filters: FilterOptions): Promise<void> {
    const windowId = await this.getWindowIdFromTab(tabId);
    this.addTabToWindow(windowId, tabId);
    const windowState = this.windowData.get(windowId)!;

    windowState.filters = filters;
    console.debug(`[Background] Filters updated for window ${windowId}:`, filters);

    // Update all tabs in this window
    for (const windowTabId of windowState.tabIds) {
      this.sendToTab(windowTabId, {
        type: 'SET_FILTERS',
        filters: filters
      });
    }
  }

  private async setTrackEvents(tabId: number, trackEvents: TrackEventsState): Promise<void> {
    const windowId = await this.getWindowIdFromTab(tabId);
    this.addTabToWindow(windowId, tabId);
    const windowState = this.windowData.get(windowId)!;

    windowState.trackEvents = trackEvents;
    console.debug(`[Background] Track Events updated for window ${windowId}:`, trackEvents);

    // Update all tabs in this window
    for (const windowTabId of windowState.tabIds) {
      this.sendToTab(windowTabId, {
        type: 'SET_TRACK_EVENTS',
        trackEvents: trackEvents
      });
    }
  }

  private async clearEvents(tabId: number): Promise<void> {
    const windowId = await this.getWindowIdFromTab(tabId);
    this.addTabToWindow(windowId, tabId);
    const windowState = this.windowData.get(windowId)!;

    windowState.events = [];

    // Update all tabs in this window
    for (const windowTabId of windowState.tabIds) {
      this.sendToTab(windowTabId, {
        type: 'HUD_UPDATE',
        eventCount: 0,
        atCap: false
      });
      this.sendToTab(windowTabId, {
        type: 'HUD_MESSAGE',
        level: 'info',
        message: 'Events cleared'
      });
    }
  }

  // Keep the old method signature but make it forward to new implementation
  // Legacy method - now just ensures window is initialized
  private async initializeTab(tabId: number, url: string): Promise<void> {
    const windowId = await this.getWindowIdFromTab(tabId);
    this.addTabToWindow(windowId, tabId);
    console.debug(`[Background] Initialized tab ${tabId} in window ${windowId}`);
  }





  /**
   * Deduplicates events using Explorer's algorithm
   * Removes duplicate actions with same type + data + target.id
   * Matches Explorer's shrinkPartree behavior
   */
  private deduplicateEvents(events: EvidenceEvent[]): {
    deduplicated: EvidenceEvent[],
    originalCount: number,
    deduplicatedCount: number,
    duplicatesRemoved: number
  } {
    const actionMap = new Set<string>();
    const deduplicatedEvents: EvidenceEvent[] = [];

    for (const event of events) {
      // Explorer format: type__data__target.id
      const key = `${event.type}__${event.data}__${event.target.id}`;

      if (!actionMap.has(key)) {
        actionMap.add(key);
        deduplicatedEvents.push(event);
      }
      // Skip duplicates (matching Explorer's shrinkPartree behavior)
    }

    return {
      deduplicated: deduplicatedEvents,
      originalCount: events.length,
      deduplicatedCount: deduplicatedEvents.length,
      duplicatesRemoved: events.length - deduplicatedEvents.length
    };
  }

  private async exportEvents(tabId: number, isAutoExport: boolean = false): Promise<void> {
    const windowId = await this.getWindowIdFromTab(tabId);
    const windowState = this.windowData.get(windowId);

    if (!windowState || windowState.events.length === 0) {
      if (!isAutoExport) {
        this.sendToTab(tabId, {
          type: 'HUD_MESSAGE',
          level: 'warning',
          message: 'No events to export'
        });
      }
      return;
    }

    // Group events by normalized URL
    const eventsByUrl = new Map<string, EvidenceEvent[]>();
    for (const event of windowState.events) {
      const url = event._internalUrl || 'unknown-url';
      if (!eventsByUrl.has(url)) {
        eventsByUrl.set(url, []);
      }
      eventsByUrl.get(url)!.push(event);
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const sessionFolder = `evidence_session_${dateStr}_${timeStr}`;

    let totalExportedEvents = 0;
    let filesCreated = 0;

    // Create one file per URL
    for (const [normalizedUrl, urlEvents] of eventsByUrl) {
      // Remove _internalUrl from events before export
      const cleanEvents = urlEvents.map(event => {
        const { _internalUrl, ...cleanEvent } = event;
        return cleanEvent;
      });

      const deduplicationResult = this.deduplicateEvents(cleanEvents);
      const filename = this.createFilename(normalizedUrl, now);
      const fullPath = `${sessionFolder}/${filename}`;

      const exportData: ExportData = {
        metadata: {
          url: normalizedUrl,
          exportedAt: now.toISOString(),
          eventCount: deduplicationResult.deduplicatedCount,
          recordingStarted: new Date(windowState.createdAt).toISOString(),
          autoExported: isAutoExport,
          windowId: windowId,
          deduplication: {
            originalCount: deduplicationResult.originalCount,
            deduplicatedCount: deduplicationResult.deduplicatedCount,
            duplicatesRemoved: deduplicationResult.duplicatesRemoved
          }
        },
        events: deduplicationResult.deduplicated
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);

      chrome.downloads.download({
        url: dataUrl,
        filename: fullPath,
        saveAs: !isAutoExport && filesCreated === 0  // Show save dialog only for first file to choose session folder location
      });

      totalExportedEvents += deduplicationResult.deduplicatedCount;
      filesCreated++;
    }

    // Send summary message to all tabs in this window
    if (!isAutoExport) {
      const summaryMessage = filesCreated === 1
        ? `Exported ${totalExportedEvents} events to 1 file in ${sessionFolder}/`
        : `Exported ${totalExportedEvents} events to ${filesCreated} files in ${sessionFolder}/`;

      for (const windowTabId of windowState.tabIds) {
        this.sendToTab(windowTabId, {
          type: 'HUD_MESSAGE',
          level: 'success',
          message: summaryMessage
        });
      }
    }

    console.debug(`[Background] Exported ${totalExportedEvents} events across ${filesCreated} files to ${sessionFolder}/`);
  }

  private async getExportPreview(tabId: number): Promise<{ [url: string]: { eventCount: number; filename: string } }> {
    const windowId = await this.getWindowIdFromTab(tabId);
    const windowState = this.windowData.get(windowId);

    if (!windowState || windowState.events.length === 0) {
      return {};
    }

    // Group events by normalized URL (same logic as export)
    const eventsByUrl = new Map<string, EvidenceEvent[]>();
    for (const event of windowState.events) {
      const url = event._internalUrl || 'unknown-url';
      if (!eventsByUrl.has(url)) {
        eventsByUrl.set(url, []);
      }
      eventsByUrl.get(url)!.push(event);
    }

    const now = new Date();
    const preview: { [url: string]: { eventCount: number; filename: string } } = {};

    // Generate preview for each URL
    for (const [normalizedUrl, urlEvents] of eventsByUrl) {
      // Remove _internalUrl from events for accurate count
      const cleanEvents = urlEvents.map(event => {
        const { _internalUrl, ...cleanEvent } = event;
        return cleanEvent;
      });

      const deduplicationResult = this.deduplicateEvents(cleanEvents);
      const filename = this.createFilename(normalizedUrl, now);

      preview[normalizedUrl] = {
        eventCount: deduplicationResult.deduplicatedCount,
        filename: filename
      };
    }

    return preview;
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