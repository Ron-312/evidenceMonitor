// Property Getter Hooks - Intercepts property getter calls for surveillance detection
// Monitors value access on form elements to detect scripts reading user input

import { EvidenceCollector } from '../evidence-collector';
import { shouldHookPropertyGetter, EVIDENCE_CONFIG } from '../config/evidence-config';
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
 * Hook for property getter surveillance detection
 * Intercepts property access on form elements to detect surveillance
 */
export class PropertyGetterHooks {
  public readonly name = 'propertyGetters';
  
  private evidenceCollector: EvidenceCollector;
  private originalDescriptors: OriginalPropertyDescriptor[] = [];
  private isHookInstalled: boolean = false;

  constructor(evidenceCollector: EvidenceCollector) {
    this.evidenceCollector = evidenceCollector;
  }

  /**
   * Installs all property getter surveillance detection hooks
   */
  install(): void {
    if (this.isHookInstalled) {
      console.warn(`[${this.name}] Hook already installed, skipping`);
      return;
    }

    try {
      console.debug(`[${this.name}] Installing property getter surveillance hooks...`);

      // Install hooks for form elements only (driven by config)
      this.installFormElementPropertyHooks();

      this.isHookInstalled = true;
      console.debug(`[${this.name}] Property getter surveillance hooks installed successfully`);
    } catch (error) {
      console.error(`[${this.name}] Failed to install hooks:`, error, {
        context: 'Property descriptor replacement'
      });
      throw error; // Hook installation failure should be fatal
    }
  }

  /**
   * Removes all hooks and restores original property descriptors
   */
  uninstall(): void {
    if (!this.isHookInstalled) {
      console.debug(`[${this.name}] Hook not installed, nothing to uninstall`);
      return;
    }

    try {
      console.debug(`[${this.name}] Uninstalling property getter hooks...`);

      // Restore all original property descriptors
      for (const original of this.originalDescriptors) {
        Object.defineProperty(original.target, original.propertyName, original.descriptor);
      }

      this.originalDescriptors = [];
      this.isHookInstalled = false;
      console.debug(`[${this.name}] Property getter hooks uninstalled successfully`);
    } catch (error) {
      console.error(`[${this.name}] Failed to uninstall hooks:`, error, {
        context: 'Property descriptor restoration'
      });
      // Continue anyway - mark as uninstalled
      this.isHookInstalled = false;
    }
  }

  /**
   * Returns whether the hooks are currently installed
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
   * Install hooks for form element property getters (config-driven)
   */
  private installFormElementPropertyHooks(): void {
    const formElements = EVIDENCE_CONFIG.formElements.elements;
    const propertyGetters = EVIDENCE_CONFIG.formElements.propertyGetters;
    
    formElements.forEach(elementName => {
      const prototype = this.getElementPrototype(elementName);
      
      if (!prototype) {
        console.warn(`[${this.name}] No prototype found for element: ${elementName}`);
        return;
      }

      propertyGetters.forEach(propertyName => {
        this.installPropertyHook(
          prototype,
          propertyName,
          `${elementName}.${propertyName} getter`
        );
      });
    });
    
    console.debug(`[${this.name}] Form element property getters hooked`);
  }

  /**
   * Finds a property descriptor by walking up the prototype chain (like Explorer's hookMembers)
   */
  private findPropertyDescriptor(target: any, propertyName: string): PropertyDescriptor | null {
    let current = target;
    while (current) {
      const descriptor = Object.getOwnPropertyDescriptor(current, propertyName);
      if (descriptor) {
        return descriptor;
      }
      current = Object.getPrototypeOf(current);
    }
    return null;
  }

  /**
   * Installs a surveillance hook for a specific property
   */
  private installPropertyHook(target: any, propertyName: string, context: string): void {
    try {
      // Get the original property descriptor, walking up prototype chain like Explorer
      const originalDescriptor = this.findPropertyDescriptor(target, propertyName);
      
      if (!originalDescriptor || !originalDescriptor.get) {
        throw new Error(`No getter found for ${context}`);
      }

      // Store original descriptor for restoration
      this.originalDescriptors.push({
        descriptor: originalDescriptor,
        target,
        propertyName
      });

      const self = this;
      const originalGetter = originalDescriptor.get;

      // Install monitored property getter
      Object.defineProperty(target, propertyName, {
        get: function() {
          // Monitor this property access for surveillance and get filter decision
          const { shouldProceed } = self.monitorPropertyAccess(this, propertyName);

          // Breakpoint if recording is active AND in breakpoint mode AND filters pass
          if (shouldProceed && recordingModeHandler.isCurrentlyRecording() && recordingModeHandler.getMode() === 'breakpoint') {
            console.debug(`🛑 Breakpoint: Property access ${propertyName} on`, this);
            debugger; // eslint-disable-line no-debugger
          }

          // Always return the original value - this must never fail
          return originalGetter.call(this);
        },
        set: originalDescriptor.set, // Preserve original setter if exists
        configurable: true,
        enumerable: originalDescriptor.enumerable
      });

      console.debug(`[${this.name}] Installed hook for ${context}`);
    } catch (error) {
      console.error(`[${this.name}] Failed to install ${context}:`, error);
      throw error;
    }
  }

  /**
   * Monitors property access and creates evidence if surveillance detected
   */
  private monitorPropertyAccess(target: any, propertyName: string): { shouldProceed: boolean } {
    try {
      // Only monitor if this is a surveillance pattern
      if (!this.shouldMonitorPropertyAccess(target, propertyName)) {
        return { shouldProceed: false }; // Skip monitoring for this target/property combination
      }

      // Create evidence for property access surveillance (Elements only)
      if (target instanceof Element) {
        const result = this.evidenceCollector.createAndSendEvidence(
          target,
          propertyName,
          'property'
        );
        return result;
      }

      return { shouldProceed: false };

    } catch (error) {
      console.error(`[${this.name}] Error during property access monitoring:`, error, {
        context: { 
          targetType: target.constructor.name, 
          propertyName,
          hasTarget: !!target
        }
      });
      // Continue silently - never break property access
      return { shouldProceed: false };
    }
  }

  /**
   * Determines if this property access should be monitored for surveillance
   */
  private shouldMonitorPropertyAccess(target: any, propertyName: string): boolean {
    try {
      // Handle Element targets only (form elements with value/nodeValue properties)
      if (target instanceof Element) {
        return shouldHookPropertyGetter(target, propertyName);
      }

      return false;
    } catch (error) {
      console.error(`[${this.name}] Error in shouldMonitorPropertyAccess:`, error, {
        context: { targetType: target.constructor.name, propertyName }
      });
      return false; // Default to not monitoring on errors
    }
  }

}