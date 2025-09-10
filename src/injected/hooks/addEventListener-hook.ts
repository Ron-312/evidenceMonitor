// Full addEventListener Hook - Intercepts event listener attachments for surveillance detection
// Monitors DOM form elements (input, select, textarea) for event listener surveillance

import { EvidenceCollector } from '../evidence-collector';
import { shouldHookEventListener } from '../../evidence-config';
import { recordingModeHandler } from '../recording-modes';

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
    
    // Store original method reference
    this.originalAddEventListener = EventTarget.prototype.addEventListener;
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
        // Breakpoint if recording is active AND in breakpoint mode (while malicious script is on call stack)
        if (recordingModeHandler.isCurrentlyRecording() && recordingModeHandler.getMode() === 'breakpoint' && self.shouldMonitorTarget(this, type)) {
          console.log(`🛑 Breakpoint: addEventListener('${type}') on`, this);
          debugger; // eslint-disable-line no-debugger
        }

        // Monitor this addEventListener call for surveillance
        self.monitorAddEventListenerCall(this, type, listener, options);

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
  ): void {
    try {
      // Determine if this addEventListener call should be monitored
      if (!this.shouldMonitorTarget(target, eventType)) {
        return; // Skip monitoring for this target/event combination
      }

      // Handle Elements (form inputs, etc.) only
      if (target instanceof Element) {
        this.evidenceCollector.createAndSendEvidence(
          target,
          eventType,
          'addEventListener'
        );
        return;
      }

      // Log unexpected target types for debugging (non-Elements are ignored)
      console.debug(`[${this.name}] Non-Element EventTarget ignored:`, {
        target: target.constructor.name,
        eventType,
        targetToString: target.toString()
      });

    } catch (error) {
      console.error(`[${this.name}] Error during surveillance monitoring:`, error, {
        context: { 
          targetType: target.constructor.name, 
          eventType,
          hasListener: !!listener
        }
      });
      // Continue silently - never break the page
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