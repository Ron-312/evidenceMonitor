// Main Injected Script - Coordinates surveillance detection system
// Simple version for testing our core infrastructure

import { ElementRegistry } from './element-registry';
import { EvidenceCollector } from './evidence-collector';
import { AddEventListenerHook } from './hooks/addEventListener-hook';

/**
 * Main coordinator for the injected surveillance detection system
 * Initializes all components and manages their lifecycle
 */
class InjectedSurveillanceDetector {
  private elementRegistry: ElementRegistry;
  private evidenceCollector: EvidenceCollector;
  private addEventListenerHook: AddEventListenerHook;
  private isInitialized: boolean = false;

  constructor() {
    console.debug('[InjectedScript] Initializing surveillance detector...');
    
    try {
      // Initialize core components
      this.elementRegistry = new ElementRegistry();
      this.evidenceCollector = new EvidenceCollector(this.elementRegistry);
      
      // Initialize hooks
      this.addEventListenerHook = new AddEventListenerHook(this.evidenceCollector);
      
      this.isInitialized = true;
      console.debug('[InjectedScript] Core components initialized successfully');
      
    } catch (error) {
      console.error('[InjectedScript] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Starts surveillance detection by installing all hooks
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error('Cannot start - initialization failed');
    }

    try {
      console.debug('[InjectedScript] Installing surveillance hooks...');
      
      // Install addEventListener hook
      this.addEventListenerHook.install();
      
      // Send ready signal to content script
      this.notifyReady();
      
      console.debug('[InjectedScript] Surveillance detection active');
      
    } catch (error) {
      console.error('[InjectedScript] Failed to start surveillance detection:', error);
      throw error;
    }
  }

  /**
   * Stops surveillance detection by removing all hooks
   */
  stop(): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      console.debug('[InjectedScript] Removing surveillance hooks...');
      
      // Uninstall hooks
      this.addEventListenerHook.uninstall();
      
      console.debug('[InjectedScript] Surveillance detection stopped');
      
    } catch (error) {
      console.error('[InjectedScript] Error during stop:', error);
    }
  }

  /**
   * Gets system statistics for debugging
   */
  getStats() {
    if (!this.isInitialized) {
      return null;
    }

    return {
      elementRegistry: this.elementRegistry.getStats(),
      evidenceCollector: this.evidenceCollector.getStats()
    };
  }

  /**
   * Notifies content script that injected script is ready
   */
  private notifyReady(): void {
    try {
      window.postMessage({
        type: 'INJECTED_SCRIPT_READY'
      }, '*');
      console.debug('[InjectedScript] Sent ready signal to content script');
    } catch (error) {
      console.error('[InjectedScript] Failed to send ready signal:', error);
    }
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Ensure we only initialize once
if (!(window as any).__REFLECTIZ_INJECTED__) {
  try {
    console.debug('[InjectedScript] Starting Reflectiz surveillance detector...');
    
    const detector = new InjectedSurveillanceDetector();
    detector.start();
    
    // Mark as initialized and expose for debugging
    (window as any).__REFLECTIZ_INJECTED__ = detector;
    
    console.debug('[InjectedScript] Reflectiz surveillance detector running');
    
  } catch (error) {
    console.error('[InjectedScript] Fatal error during initialization:', error);
  }
} else {
  console.debug('[InjectedScript] Already initialized, skipping');
}