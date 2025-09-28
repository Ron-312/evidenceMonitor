// Shared Type Definitions - Common interfaces used across content script, background script, and injected scripts
// Consolidates type definitions to avoid duplication and ensure consistency

export interface FilterOptions {
  elementSelector: string;        // CSS selector (e.g., "#myInput, .password")
  attributeFilters: string;       // name=value pairs (e.g., "name=password, type=email")
  stackKeywordFilter: string;     // case-insensitive keyword (e.g., "analytics")
}

export interface TrackEventsState {
  inputValueAccess: boolean;    // Property getter hooks (input.value, textarea.value)
  inputEvents: boolean;         // Event listener hooks (addEventListener)
  formSubmit: boolean;          // Form submission hooks (form.submit(), submit events)
  formDataCreation: boolean;    // FormData constructor hooks (new FormData())
}

export interface EvidenceEvent {
  actionId: string;
  type: string;
  start: number;
  duration: number;
  data: string;
  target: { id: string };
  stackTrace: string[];
  _internalUrl?: string; // Added for URL grouping during export
}

// HUD and Content Script Types
export interface HudState {
  recording: boolean;
  eventCount: number;
  atCap: boolean;
  recordingMode: 'console' | 'breakpoint';
  filters: FilterOptions;
  trackEvents: TrackEventsState;
  theme: 'dark' | 'light';
  minimized: boolean;
}

// Background Script Types
export interface WindowData {
  recording: boolean;
  recordingMode: 'console' | 'breakpoint';
  filters: FilterOptions;
  trackEvents: TrackEventsState;
  events: EvidenceEvent[]; // All events from all tabs in this window, URL-tagged
  createdAt: number;
  tabIds: Set<number>; // Active tabs in this window
}

// Legacy interface - kept for compatibility during migration
export interface TabData {
  events: EvidenceEvent[];
  recording: boolean;
  recordingMode: 'console' | 'breakpoint';
  domain: string;
  createdAt: number;
  filters: FilterOptions;
  trackEvents: TrackEventsState;
}

export interface HudMessage {
  type: 'HUD_MESSAGE' | 'HUD_UPDATE' | 'SET_RECORDING_MODE' | 'SET_RECORDING_STATE' | 'SET_FILTERS' | 'SET_TRACK_EVENTS';
  level?: 'info' | 'warning' | 'success' | 'error';
  message?: string;
  recording?: boolean;
  eventCount?: number;
  atCap?: boolean;
  recordingMode?: 'console' | 'breakpoint';
  filters?: FilterOptions;
  trackEvents?: TrackEventsState;
}

export interface BackgroundMessage {
  type: 'EVIDENCE_EVENT' | 'EVIDENCE_EVENT_BATCH' | 'TOGGLE_RECORDING' | 'GET_STATUS' | 'EXPORT_EVENTS' | 'CLEAR_EVENTS' | 'SET_RECORDING_MODE' | 'SET_FILTERS' | 'SET_TRACK_EVENTS' | 'GET_EXPORT_PREVIEW';
  event?: EvidenceEvent;
  events?: EvidenceEvent[]; // For batched events
  batchSize?: number; // Number of events in batch
  recordingMode?: 'console' | 'breakpoint';
  filters?: FilterOptions;
  trackEvents?: TrackEventsState;
}

export interface ExportData {
  metadata: {
    url: string; // Changed from domain to full URL
    exportedAt: string;
    eventCount: number;
    recordingStarted: string;
    autoExported: boolean;
    windowId: number; // Added window ID for context
    deduplication: {
      originalCount: number;
      deduplicatedCount: number;
      duplicatesRemoved: number;
    };
  };
  events: EvidenceEvent[];
}