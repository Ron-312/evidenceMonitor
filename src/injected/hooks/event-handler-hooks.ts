// Event Handler Hooks - Intercepts event handler property setters for surveillance detection
// Monitors event handler assignment (onkeydown, oninput, etc.) to detect surveillance scripts

import { EvidenceCollector } from '../evidence-collector';
import { shouldHookEventHandlerSetter, EVIDENCE_CONFIG } from '../config/evidence-config';
import { recordingModeHandler } from '../state/recording-modes-manager';

/**
 * Stored original property descriptors for restoration
 */
interface OriginalPropertyDescriptor {
  descriptor: PropertyDescriptor;
  target: any;
  propertyName: string;
}

/**
 * Hook for event handler setter surveillance detection
 * Intercepts event handler property assignments to detect surveillance
 */
export class EventHandlerHooks {
  public readonly name = 'eventHandlers';
  
  private evidenceCollector: EvidenceCollector;
  private originalDescriptors: OriginalPropertyDescriptor[] = [];
  private isHookInstalled: boolean = false;

  constructor(evidenceCollector: EvidenceCollector) {
    this.evidenceCollector = evidenceCollector;
  }

  /**
   * Installs all event handler setter surveillance detection hooks
   */
  install(): void {
    if (this.isHookInstalled) {
      console.warn(`[${this.name}] Hook already installed, skipping`);
      return;
    }

    try {
      console.debug(`[${this.name}] Installing event handler setter surveillance hooks...`);

      // Install hooks for form elements only (driven by config)
      this.installFormElementHooks();

      this.isHookInstalled = true;
      console.debug(`[${this.name}] Event handler setter surveillance hooks installed successfully`);

    } catch (error) {
      console.error(`[${this.name}] Failed to install event handler hooks:`, error);
      throw error;
    }
  }

  /**
   * Uninstalls all event handler hooks and restores original descriptors
   */
  uninstall(): void {
    if (!this.isHookInstalled) {
      return;
    }

    try {
      console.debug(`[${this.name}] Uninstalling event handler surveillance hooks...`);
      
      // Restore all original descriptors
      this.originalDescriptors.forEach(({ target, propertyName, descriptor }) => {
        try {
          Object.defineProperty(target, propertyName, descriptor);
        } catch (error) {
          console.warn(`[${this.name}] Failed to restore ${propertyName}:`, error);
        }
      });

      this.originalDescriptors = [];
      this.isHookInstalled = false;
      
      console.debug(`[${this.name}] Event handler surveillance hooks uninstalled successfully`);
    } catch (error) {
      console.error(`[${this.name}] Error during hook uninstallation:`, error);
    }
  }

  /**
   * Returns hook installation status
   */
  isInstalled(): boolean {
    return this.isHookInstalled;
  }

  /**
   * Maps element name from config to its corresponding prototype
   */
  private getElementPrototype(elementName: string): any {
    const prototypeMap: Record<string, any> = {
      'input': HTMLInputElement.prototype,
      'select': HTMLSelectElement.prototype,
      'textarea': HTMLTextAreaElement.prototype
    };
    
    return prototypeMap[elementName];
  }


  /**
   * Install hooks for form element event handlers (config-driven)
   */
  private installFormElementHooks(): void {
    const formElements = EVIDENCE_CONFIG.formElements.elements;
    const formEventHandlers = EVIDENCE_CONFIG.formElements.eventHandlerSetters;
    
    formElements.forEach(elementName => {
      const prototype = this.getElementPrototype(elementName);
      
      if (!prototype) {
        console.warn(`[${this.name}] No prototype found for element: ${elementName}`);
        return;
      }

      formEventHandlers.forEach(handlerName => {
        this.installEventHandlerSetter(prototype, handlerName, elementName);
      });
    });
  }


  /**
   * Installs a surveillance hook for a specific event handler property setter
   */
  private installEventHandlerSetter(target: any, propertyName: string, targetType: string): void {
    try {
      // Get the original property descriptor
      const originalDescriptor = Object.getOwnPropertyDescriptor(target, propertyName) || 
        this.findDescriptorInPrototypeChain(target, propertyName);

      if (!originalDescriptor) {
        console.warn(`[${this.name}] No descriptor found for ${targetType}.${propertyName}, creating fallback`);
        this.createFallbackDescriptor(target, propertyName, targetType);
        return;
      }

      // Store original descriptor for restoration
      this.originalDescriptors.push({
        target,
        propertyName,
        descriptor: originalDescriptor
      });

      // Create reference to this for closure scope
      const self = this;
      const originalSetter = originalDescriptor.set;
      const originalGetter = originalDescriptor.get;

      // Create hooked setter that detects surveillance
      const hookedSetter = function(this: any, handler: any) {
        // Detect surveillance and get filter decision (let evidence collector decide based on filters)
        const { shouldProceed } = (this instanceof Element) 
          ? self.monitorEventHandlerAssignment(this, propertyName, handler)
          : { shouldProceed: false };

        // Breakpoint if recording is active AND in breakpoint mode AND filters pass
        if (shouldProceed && recordingModeHandler.isCurrentlyRecording() && recordingModeHandler.getMode() === 'breakpoint') {
          console.log(`🛑 Breakpoint: Event handler setter ${propertyName} on`, this);
          debugger; // eslint-disable-line no-debugger
        }

        // Call original setter to maintain normal functionality
        if (originalSetter) {
          return originalSetter.call(this, handler);
        } else {
          // Fallback: direct property assignment
          this[`_${propertyName}`] = handler;
          return handler; // Return the assigned value
        }
      };

      // Create getter that preserves original behavior
      const hookedGetter = originalGetter || function(this: any) {
        return this[`_${propertyName}`];
      };

      // Install the hooked property descriptor
      Object.defineProperty(target, propertyName, {
        get: hookedGetter,
        set: hookedSetter,
        configurable: originalDescriptor.configurable !== false,
        enumerable: originalDescriptor.enumerable !== false
      });

      console.debug(`[${this.name}] Hook installed for ${targetType}.${propertyName}`);

    } catch (error) {
      console.error(`[${this.name}] Failed to install hook for ${targetType}.${propertyName}:`, error);
      // Don't throw - we want to continue installing other hooks
    }
  }

  /**
   * Creates a fallback descriptor for event handler properties that don't exist
   */
  private createFallbackDescriptor(target: any, propertyName: string, targetType: string): void {
    try {
      const self = this;
      
      // Store fallback descriptor for restoration (null means we created it)
      this.originalDescriptors.push({
        target,
        propertyName,
        descriptor: null as any // Mark as created by us
      });

      const hookedSetter = function(this: any, handler: any) {
        // Detect surveillance and get filter decision (let evidence collector decide based on filters)
        const { shouldProceed } = (this instanceof Element) 
          ? self.monitorEventHandlerAssignment(this, propertyName, handler)
          : { shouldProceed: false };

        // Breakpoint if recording is active AND in breakpoint mode AND filters pass
        if (shouldProceed && recordingModeHandler.isCurrentlyRecording() && recordingModeHandler.getMode() === 'breakpoint') {
          console.log(`🛑 Breakpoint: Event handler setter ${propertyName} (fallback) on`, this);
          debugger; // eslint-disable-line no-debugger
        }
        this[`_${propertyName}`] = handler;
        return handler; // Return the assigned value
      };

      const hookedGetter = function(this: any) {
        return this[`_${propertyName}`];
      };

      Object.defineProperty(target, propertyName, {
        get: hookedGetter,
        set: hookedSetter,
        configurable: true,
        enumerable: false
      });

      console.debug(`[${this.name}] Fallback hook created for ${targetType}.${propertyName}`);

    } catch (error) {
      console.error(`[${this.name}] Failed to create fallback for ${targetType}.${propertyName}:`, error);
    }
  }

  /**
   * Finds property descriptor by walking up the prototype chain
   */
  private findDescriptorInPrototypeChain(obj: any, propertyName: string): PropertyDescriptor | null {
    let current = obj;
    while (current && current !== Object.prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(current, propertyName);
      if (descriptor) {
        return descriptor;
      }
      current = Object.getPrototypeOf(current);
    }
    return null;
  }

  /**
   * Called when surveillance is detected - script setting event handler property
   */
  private monitorEventHandlerAssignment(target: any, propertyName: string, handler: any): { shouldProceed: boolean } {
    try {
      // Only monitor if handler is actually a function (ignore null/undefined cleanup)
      if (typeof handler !== 'function') {
        return { shouldProceed: false };
      }

      // Basic config check - should this element/property be monitored?
      if (!shouldHookEventHandlerSetter(target, propertyName)) {
        return { shouldProceed: false };
      }

      console.debug(`[${this.name}] Surveillance detected: Event handler assignment ${propertyName} on`, target);

      // Create evidence for event handler assignment (includes filter checks)
      // Remove 'on' prefix from property name: 'onkeydown' -> 'keydown'
      const eventType = propertyName.substring(2);
      
      const result = this.evidenceCollector.createAndSendEvidence(
        target,
        eventType,
        'eventHandler'
      );

      return result;

    } catch (error) {
      console.error(`[${this.name}] Error monitoring event handler assignment:`, error);
      // Don't throw - surveillance detection should never break page functionality
      return { shouldProceed: false };
    }
  }
}