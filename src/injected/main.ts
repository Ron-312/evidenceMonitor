// Main Injected Script - Entry point and initialization coordinator
// Manages the lifecycle of the surveillance detection system

import { HookManager } from './hook-manager';
import { recordingModeHandler, RecordingMode } from './recording-modes';
import { filterManager, FilterOptions } from './filter-manager';

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
        recordingModeHandler.setMode(mode);
        console.debug(`[InjectedScript] Recording mode set to: ${mode}`);
      } else if (event.data.type === 'SET_RECORDING_STATE') {
        const recording = event.data.recording as boolean;
        recordingModeHandler.setRecording(recording);
        console.debug(`[InjectedScript] Recording state set to: ${recording}`);
      } else if (event.data.type === 'SET_FILTERS') {
        const filters = event.data.filters as FilterOptions;
        filterManager.setFilters(filters);
        console.debug(`[InjectedScript] Filters updated:`, filters);
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