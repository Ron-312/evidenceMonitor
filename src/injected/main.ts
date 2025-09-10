// Main Injected Script - Entry point and initialization coordinator
// Manages the lifecycle of the surveillance detection system

import { HookManager } from './hook-manager';
import { recordingModeHandler, RecordingMode } from './recording-modes';

// ============================================================================
// INITIALIZATION
// ============================================================================

// Ensure we only initialize once
if (!(window as any).__REFLECTIZ_INJECTED__) {
  try {
    console.debug('[InjectedScript] Starting Reflectiz surveillance detector...');
    
    // Initialize hook management system
    const hookManager = new HookManager();
    
    // Install all surveillance detection hooks
    hookManager.installAllHooks();
    
    // Signal to content script that we're ready
    hookManager.notifyReady();
    
    // Mark as initialized and expose for debugging
    (window as any).__REFLECTIZ_INJECTED__ = hookManager;
    
    // Set up message listeners for recording mode and state
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
      }
    });
    
    console.debug('[InjectedScript] Reflectiz surveillance detector running');
    
  } catch (error) {
    console.error('[InjectedScript] Fatal error during initialization:', error);
  }
} else {
  console.debug('[InjectedScript] Already initialized, skipping');
}