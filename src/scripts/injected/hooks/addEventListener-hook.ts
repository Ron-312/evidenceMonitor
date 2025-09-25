// Full addEventListener Hook - Intercepts event listener attachments for surveillance detection
// Monitors DOM form elements (input, select, textarea) for event listener surveillance

import { EvidenceCollector } from '../evidence-collector';
import { shouldHookEventListener } from '../../config/evidence-config';
import { recordingModeHandler } from '../state/recording-modes-manager';

/**
 * Hook for EventTarget.addEventListener surveillance detection
 * Intercepts all addEventListener calls and creates evidence for monitored events
 */
export class AddEventListenerHook {
  public readonly name = 'addEventListener';
  
  private evidenceCollector: EvidenceCollector;
  private originalAddEventListener: typeof EventTarget.prototype.addEventListener;
  private isHookInstalled: boolean = false;

  constructor(evidenceCollector: EvidenceCollector) {
    this.evidenceCollector = evidenceCollector;

    // Store original method reference - use truly original if main world hook exposed it
    const originalFromMainWorld = (window as any).__ORIGINAL_ADD_EVENT_LISTENER__;
    const currentPrototype = EventTarget.prototype.addEventListener;

    this.originalAddEventListener = originalFromMainWorld || currentPrototype;

    console.debug('[AddEventListenerHook] Constructor - method selection:', {
      hasOriginalFromMainWorld: !!originalFromMainWorld,
      currentPrototypeName: currentPrototype.name || 'anonymous',
      selectedMethod: this.originalAddEventListener.name || 'anonymous',
      isMainWorldHookActive: !!(window as any).__REFLECTIZ_MAIN_WORLD_HOOKS__
    });
  }

  /**
   * Installs the addEventListener surveillance detection hook
   */
  install(): void {
    if (this.isHookInstalled) {
      console.warn(`[${this.name}] Hook already installed, skipping`);
      return;
    }

    try {
      const self = this;
      
      EventTarget.prototype.addEventListener = function(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
      ) {
        // Debug recursive calls with eventType "addEventListener" - persist to JSON
        // if (type === 'addEventListener') {
        //   const debugData = {
        //     actionId: `DEBUG_INJ_RECURSIVE_${Date.now()}`,
        //     type: 'DEBUG.recursiveCall',
        //     start: performance.now(),
        //     duration: 0,
        //     data: `[INJECTED RECURSIVE] addEventListener("${type}") on ${this instanceof Element ? this.tagName : 'non-Element'}`,
        //     target: { id: `debug-${Date.now()}` },
        //     stackTrace: new Error().stack?.split('\n').slice(1, 6) || ['[NO_STACK]']
        //   };

          // // Send via evidence collector for persistence
          // window.postMessage({
          //   type: 'EVIDENCE_EVENT',
          //   event: debugData
          // }, '*');

        //   console.error('[AddEventListenerHook] 🚨 RECURSIVE CALL - logged to JSON');
        // }


        // Monitor this addEventListener call for surveillance and get filter decision
        const { shouldProceed } = self.monitorAddEventListenerCall(this, type, listener, options);

        // Breakpoint if recording is active AND in breakpoint mode AND filters pass
        if (shouldProceed && recordingModeHandler.isCurrentlyRecording() && recordingModeHandler.getMode() === 'breakpoint') {
          console.log(`🛑 Breakpoint: addEventListener('${type}') on`, this);
          debugger; // eslint-disable-line no-debugger
        }

        // Always execute the original addEventListener call
        return self.originalAddEventListener.call(this, type, listener, options);
      };

      this.isHookInstalled = true;
      console.debug(`[${this.name}] Surveillance detection hook installed successfully`);
    } catch (error) {
      console.error(`[${this.name}] Failed to install hook:`, error, { 
        context: 'EventTarget.prototype.addEventListener replacement' 
      });
      throw error; // Hook installation failure should be fatal
    }
  }

  /**
   * Removes the hook and restores original addEventListener functionality
   */
  uninstall(): void {
    if (!this.isHookInstalled) {
      console.debug(`[${this.name}] Hook not installed, nothing to uninstall`);
      return;
    }

    try {
      EventTarget.prototype.addEventListener = this.originalAddEventListener;
      this.isHookInstalled = false;
      console.debug(`[${this.name}] Hook uninstalled successfully`);
    } catch (error) {
      console.error(`[${this.name}] Failed to uninstall hook:`, error, {
        context: 'EventTarget.prototype.addEventListener restoration'
      });
      // Continue anyway - mark as uninstalled
      this.isHookInstalled = false;
    }
  }

  /**
   * Returns whether the hook is currently installed
   */
  isInstalled(): boolean {
    return this.isHookInstalled;
  }

  /**
   * Monitors addEventListener call and creates evidence if surveillance detected
   */
  private monitorAddEventListenerCall(
    target: EventTarget, 
    eventType: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): { shouldProceed: boolean } {
    try {
      // Handle Elements (form inputs, etc.) only
      if (target instanceof Element) {
        // Basic config check - should this element/event be monitored?
        if (!this.shouldMonitorTarget(target, eventType)) {
          return { shouldProceed: false }; // Skip monitoring for this target/event combination
        }

        console.debug('[AddEventListenerHook] Creating evidence for:', {
          eventType: eventType,
          hookType: 'addEventListener',
          targetTag: target.tagName
        });

        const result = this.evidenceCollector.createAndSendEvidence(
          target,
          eventType,
          'addEventListener'
        );
        return result;
      }

      // Log unexpected target types for debugging (non-Elements are ignored)
      console.debug(`[${this.name}] Non-Element EventTarget ignored:`, {
        target: target.constructor.name,
        eventType,
        targetToString: target.toString()
      });

      return { shouldProceed: false };

    } catch (error) {
      console.error(`[${this.name}] Error during surveillance monitoring:`, error, {
        context: { 
          targetType: target.constructor.name, 
          eventType,
          hasListener: !!listener
        }
      });
      // Continue silently - never break the page
      return { shouldProceed: false };
    }
  }

  /**
   * Determines if this addEventListener call should be monitored for surveillance
   */
  private shouldMonitorTarget(target: EventTarget, eventType: string): boolean {
    try {
      // Monitor DOM elements only using form element configuration
      if (target instanceof Element) {
        return shouldHookEventListener(target, eventType);
      }

      // Don't monitor non-Element EventTarget types (window, document, XMLHttpRequest, etc.)
      return false;
    } catch (error) {
      console.error(`[${this.name}] Error in shouldMonitorTarget:`, error, {
        context: { targetType: target.constructor.name, eventType }
      });
      return false; // Default to not monitoring on errors
    }
  }

}