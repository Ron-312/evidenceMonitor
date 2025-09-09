// Input Evidence Extension - Background Service Worker
// Manages per-tab event storage, settings, and auto-export functionality

/// <reference types="chrome"/>

interface EvidenceEvent {
  actionId: string;
  type: string;
  start: number;
  duration: number;
  data: string;
  target: { id: string };
  stackTrace: string[];
}

interface TabData {
  events: EvidenceEvent[];
  recording: boolean;
  domain: string;
  createdAt: number;
}

interface HudMessage {
  type: 'HUD_MESSAGE' | 'HUD_UPDATE';
  level?: 'info' | 'warning' | 'success' | 'error';
  message?: string;
  recording?: boolean;
  eventCount?: number;
  atCap?: boolean;
}

interface BackgroundMessage {
  type: 'EVIDENCE_EVENT' | 'TOGGLE_RECORDING' | 'GET_STATUS' | 'EXPORT_EVENTS' | 'CLEAR_EVENTS';
  event?: EvidenceEvent;
}

interface ExportData {
  metadata: {
    domain: string;
    exportedAt: string;
    eventCount: number;
    recordingStarted: string;
    autoExported: boolean;
  };
  events: EvidenceEvent[];
}

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
            atCap: this.isAtCap(tabId)
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
        domain: domain,
        createdAt: Date.now()
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
    } else {
      this.sendToTab(tabId, {
        type: 'HUD_MESSAGE',
        level: 'info', 
        message: 'Recording stopped'
      });
    }
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

  private clearEvents(tabId: number): void {
    const tabInfo = this.tabData.get(tabId);
    if (tabInfo) {
      tabInfo.events = [];
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

    // Trigger download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: !isAutoExport // Don't prompt for auto-exports
    }, (_downloadId?: number) => {
      URL.revokeObjectURL(url);
      
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