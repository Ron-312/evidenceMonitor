// Main Injected Script - Entry point and initialization coordinator
// Manages the lifecycle of the surveillance detection system

import { HookManager } from './hook-manager';
import { recordingModeHandler, RecordingMode } from './state/recording-modes-manager';
import { filterManager } from './state/filter-manager';
import { FilterOptions } from '../utils/shared-types';
import { trackEventsManager } from './../state/track-events-manager';
import { TrackEventsState } from '../utils/shared-types';

// ============================================================================
// INITIALIZATION
// ============================================================================

// Ensure we only initialize once
if (!(window as any).__REFLECTIZ_INJECTED__) {
  try {
    console.debug('[InjectedScript] Starting Reflectiz surveillance detector...');
    
    // Initialize hook management system
    const hookManager = new HookManager();
    
    // Set up message listeners BEFORE installing hooks and signaling ready
    // This ensures we can receive initial state from content script immediately
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      if (event.data.type === 'SET_RECORDING_MODE') {
        const mode = event.data.recordingMode as RecordingMode;
        console.debug(`[InjectedScript] Received SET_RECORDING_MODE:`, {
          newMode: mode,
          currentMode: recordingModeHandler.getMode(),
          isChanging: mode !== recordingModeHandler.getMode()
        });
        recordingModeHandler.setMode(mode);
        console.debug(`[InjectedScript] Recording mode successfully set to: ${mode}`);
      } else if (event.data.type === 'SET_RECORDING_STATE') {
        const recording = event.data.recording as boolean;
        console.debug(`[InjectedScript] Received SET_RECORDING_STATE:`, {
          newState: recording,
          currentState: recordingModeHandler.isCurrentlyRecording(),
          isChanging: recording !== recordingModeHandler.isCurrentlyRecording()
        });
        recordingModeHandler.setRecording(recording);
        console.debug(`[InjectedScript] Recording state successfully set to: ${recording}`);
      } else if (event.data.type === 'SET_FILTERS') {
        const filters = event.data.filters as FilterOptions;
        filterManager.setFilters(filters);
        console.debug(`[InjectedScript] Filters updated:`, filters);
      } else if (event.data.type === 'SET_TRACK_EVENTS') {
        const trackEvents = event.data.trackEvents as TrackEventsState;
        trackEventsManager.setTrackEvents(trackEvents);
        console.debug(`[InjectedScript] Track Events updated:`, trackEvents);
      } else if (event.data.type === 'GET_INJECTED_STATE') {
        // Respond with current state for validation
        const currentState = {
          recordingMode: recordingModeHandler.getMode(),
          recording: recordingModeHandler.isCurrentlyRecording(),
          filters: filterManager.getFilters(),
          trackEvents: trackEventsManager.getTrackEvents()
        };
        console.debug(`[InjectedScript] State requested, responding with:`, currentState);
        window.postMessage({
          type: 'INJECTED_STATE_RESPONSE',
          state: currentState
        }, '*');
      }
    });
    
    // Install all surveillance detection hooks
    hookManager.installAllHooks();
    
    // Signal to content script that we're ready (this triggers state resync)
    hookManager.notifyReady();
    
    // Mark as initialized and expose for debugging
    (window as any).__REFLECTIZ_INJECTED__ = hookManager;
    
    console.debug('[InjectedScript] Reflectiz surveillance detector running');
    
  } catch (error) {
    console.error('[InjectedScript] Fatal error during initialization:', error);
  }
} else {
  console.debug('[InjectedScript] Already initialized, skipping');
}