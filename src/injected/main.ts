// Main Injected Script - Entry point and initialization coordinator
// Manages the lifecycle of the surveillance detection system

import { HookManager } from './hook-manager';

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
    
    console.debug('[InjectedScript] Reflectiz surveillance detector running');
    
  } catch (error) {
    console.error('[InjectedScript] Fatal error during initialization:', error);
  }
} else {
  console.debug('[InjectedScript] Already initialized, skipping');
}