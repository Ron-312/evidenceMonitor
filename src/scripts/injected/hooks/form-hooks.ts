// Form Hooks - Intercepts form submission and FormData creation for surveillance detection
// Monitors form.submit(), new FormData(), and form submit events to detect surveillance scripts
// Based on Explorer's reference implementation patterns

import { EvidenceCollector } from '../evidence-collector';
import { isFormElement, shouldHookFormSubmission, shouldHookFormDataCreation } from '../../config/evidence-config';
import { recordingModeHandler } from '../state/recording-modes-manager';

/**
 * Stored original property descriptors and functions for restoration
 */
interface OriginalDescriptor {
  target: any;
  propertyName: string;
  descriptor: PropertyDescriptor;
}

interface OriginalFunction {
  target: any;
  functionName: string;
  originalFunction: Function;
}

/**
 * Hook for form submission and FormData creation surveillance detection
 * Based on Explorer's reference implementation patterns
 */
export class FormHooks {
  public readonly name = 'formHooks';

  private evidenceCollector: EvidenceCollector;
  private originalDescriptors: OriginalDescriptor[] = [];
  private originalFunctions: OriginalFunction[] = [];
  private isHookInstalled: boolean = false;
  private documentEventListener: ((event: Event) => void) | null = null;

  constructor(evidenceCollector: EvidenceCollector) {
    this.evidenceCollector = evidenceCollector;
  }

  /**
   * Installs all form surveillance detection hooks
   */
  install(): void {
    if (this.isHookInstalled) {
      console.warn(`[${this.name}] Hook already installed, skipping`);
      return;
    }

    try {
      console.debug(`[${this.name}] Installing form surveillance hooks...`);

      // Install FormData constructor hook (global)
      this.installFormDataConstructorHook();

      // Install HTMLFormElement.prototype.submit hook
      this.installFormSubmitMethodHook();

      // Install document-level submit event listener
      this.installSubmitEventListener();

      this.isHookInstalled = true;
      console.debug(`[${this.name}] Form surveillance hooks installed successfully`);

    } catch (error) {
      console.error(`[${this.name}] Failed to install form hooks:`, error);
      throw error;
    }
  }

  /**
   * Uninstalls all form hooks and restores original behavior
   */
  uninstall(): void {
    if (!this.isHookInstalled) {
      return;
    }

    try {
      console.debug(`[${this.name}] Uninstalling form surveillance hooks...`);

      // Restore original descriptors
      this.originalDescriptors.forEach(({ target, propertyName, descriptor }) => {
        try {
          Object.defineProperty(target, propertyName, descriptor);
        } catch (error) {
          console.warn(`[${this.name}] Failed to restore ${propertyName}:`, error);
        }
      });

      // Restore original functions
      this.originalFunctions.forEach(({ target, functionName, originalFunction }) => {
        try {
          target[functionName] = originalFunction;
        } catch (error) {
          console.warn(`[${this.name}] Failed to restore ${functionName}:`, error);
        }
      });

      // Remove document event listener
      if (this.documentEventListener) {
        document.removeEventListener('submit', this.documentEventListener, true);
        this.documentEventListener = null;
      }

      this.originalDescriptors = [];
      this.originalFunctions = [];
      this.isHookInstalled = false;

      console.debug(`[${this.name}] Form surveillance hooks uninstalled successfully`);
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
   * Install FormData constructor hook - detects form serialization surveillance
   * Based on Explorer's pattern: only report when FormData(formElement) is called
   *
   * Hook mechanism: Replace window.FormData with our version that calls the original
   * Stack trace will show: maliciousScript.js → form-hooks.ts → [native FormData]
   */
  private installFormDataConstructorHook(): void {
    try {
      const originalFormData = window.FormData;
      const self = this;

      // Store original for restoration
      this.originalFunctions.push({
        target: window,
        functionName: 'FormData',
        originalFunction: originalFormData
      });

      // Create hooked FormData constructor
      window.FormData = function(this: FormData, form?: HTMLFormElement, submitter?: HTMLElement) {
        // Call original constructor first to get FormData instance
        const formDataInstance = new originalFormData(form, submitter);

        // Check if this call is from our own extension (prevent recursive detection)
        // We need to check if the CALLER is from extension, not just if extension code is in stack
        const stack = new Error().stack;
        const isFromExtension = stack && self.isCallFromExtension(stack);

        // Only monitor if FormData was created with a form element (matches Explorer)
        // AND config allows FormData creation monitoring
        // AND it's not from our own extension
        if (form && form instanceof HTMLFormElement &&
            shouldHookFormDataCreation('FormData') &&
            !isFromExtension) {
          console.debug(`[${self.name}] FormData constructor called with form:`, form);

          // Generate evidence for each form field (matches Explorer pattern)
          self.monitorFormDataCreation(form, formDataInstance);
        }

        return formDataInstance;
      } as any;

      // Preserve constructor properties to maintain compatibility
      Object.setPrototypeOf(window.FormData, originalFormData);
      window.FormData.prototype = originalFormData.prototype;

      console.debug(`[${this.name}] FormData constructor hook installed`);

    } catch (error) {
      console.error(`[${this.name}] Failed to install FormData constructor hook:`, error);
      throw error;
    }
  }

  /**
   * Install HTMLFormElement.prototype.submit method hook
   * Hook mechanism: Replace form.submit() method on the prototype
   */
  private installFormSubmitMethodHook(): void {
    try {
      const target = HTMLFormElement.prototype;
      const propertyName = 'submit';

      const originalDescriptor = Object.getOwnPropertyDescriptor(target, propertyName);
      if (!originalDescriptor) {
        console.warn(`[${this.name}] No descriptor found for HTMLFormElement.submit`);
        return;
      }

      // Store original descriptor
      this.originalDescriptors.push({
        target,
        propertyName,
        descriptor: originalDescriptor
      });

      const self = this;
      const originalSubmit = originalDescriptor.value;

      // Create hooked submit method
      const hookedSubmit = function(this: HTMLFormElement) {
        console.debug(`[${self.name}] Form.submit() called on:`, this);

        // Monitor form submission if config allows it
        if (shouldHookFormSubmission(this, 'submit')) {
          self.monitorFormSubmission(this, 'method');
        }

        // Call original submit method
        return originalSubmit.call(this);
      };

      // Install hooked method
      Object.defineProperty(target, propertyName, {
        value: hookedSubmit,
        writable: originalDescriptor.writable,
        enumerable: originalDescriptor.enumerable,
        configurable: originalDescriptor.configurable
      });

      console.debug(`[${this.name}] HTMLFormElement.submit hook installed`);

    } catch (error) {
      console.error(`[${this.name}] Failed to install form submit method hook:`, error);
      throw error;
    }
  }

  /**
   * Install document-level submit event listener
   * Hook mechanism: Add event listener to document to catch all form submissions
   */
  private installSubmitEventListener(): void {
    try {
      const self = this;

      this.documentEventListener = function(event: Event) {
        if (event.target instanceof HTMLFormElement) {
          console.debug(`[${self.name}] Form submit event detected:`, event.target);

          // Monitor form submission via event if config allows it
          if (shouldHookFormSubmission(event.target, 'submit')) {
            self.monitorFormSubmission(event.target, 'event');
          }
        }
      };

      // Use capture phase to catch events early
      document.addEventListener('submit', this.documentEventListener, true);

      console.debug(`[${this.name}] Submit event listener installed`);

    } catch (error) {
      console.error(`[${this.name}] Failed to install submit event listener:`, error);
      throw error;
    }
  }

  /**
   * Monitor FormData creation - generate evidence for each form field
   * Matches Explorer's pattern of individual evidence per field
   * Uses Explorer's querySelector pattern: form.querySelector(`[name="${key}"]`)
   */
  private monitorFormDataCreation(form: HTMLFormElement, formData: FormData): void {
    try {
      // Iterate through FormData entries (same as Explorer)
      formData.forEach((value, key) => {
        // Find the form element using Explorer's pattern - only 'name' attribute
        const element = form.querySelector(`[name="${key}"]`) as
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

        if (!element || !isFormElement(element)) {
          return; // Skip if element not found or not a form element we monitor
        }

        console.debug(`[${this.name}] FormData field detected:`, { key, element });

        // Create evidence for this form field
        const result = this.evidenceCollector.createAndSendEvidence(
          element,
          'FormData',
          'property' // Using 'property' as hookType since we're monitoring data access
        );

        // Breakpoint if recording is active AND in breakpoint mode AND filters pass
        if (result.shouldProceed && recordingModeHandler.isCurrentlyRecording() && recordingModeHandler.getMode() === 'breakpoint') {
          // console.log(`🛑 Breakpoint: FormData creation for field ${key} on`, element);
          debugger; // eslint-disable-line no-debugger
        }
      });

    } catch (error) {
      console.error(`[${this.name}] Error monitoring FormData creation:`, error);
      // Don't throw - surveillance detection should never break page functionality
    }
  }

  /**
   * Check if a FormData call originated from extension code vs. external page code
   * This is more precise than checking if extension files appear anywhere in the stack
   */
  private isCallFromExtension(stack: string): boolean {
    try {
      // Split stack into lines and find the original caller (not just immediate frames)
      const stackLines = stack.split('\n');

      // Look through the entire stack to see if there's ANY external (non-extension) frame
      // If we find external code anywhere in the stack, this is triggered by external code
      let hasExternalFrame = false;
      let hasExtensionFrame = false;

      for (let i = 0; i < stackLines.length; i++) {
        const line = stackLines[i];

        // Skip our own hook management frames
        if (line.includes('FormHooks.monitorFormSubmission') ||
            line.includes('documentEventListener') ||
            (line.includes('FormData') && line.includes('form-hooks'))) {
          continue;
        }

        // Check for external (non-extension) frames
        if (line.includes('http://') || line.includes('https://') || line.includes('file://')) {
          hasExternalFrame = true;
        }

        // Check for extension frames (excluding our hook management)
        if (line.includes('chrome-extension://')) {
          hasExtensionFrame = true;
        }
      }

      // If we found external code in the stack, treat this as external-triggered
      if (hasExternalFrame) {
        console.debug(`[${this.name}] External code found in stack - treating as external call`);
        return false;
      }

      // If only extension frames (and no external), it's truly internal
      if (hasExtensionFrame && !hasExternalFrame) {
        console.debug(`[${this.name}] Only extension frames found - treating as internal call`);
        return true;
      }

      // Default to false (external) if we can't determine
      console.debug(`[${this.name}] Could not determine source, defaulting to external`);
      return false;
    } catch (error) {
      console.warn(`[${this.name}] Error parsing stack trace for extension detection:`, error);
      return false;
    }
  }

  /**
   * Monitor form submission - generate evidence for each form field
   * Matches Explorer's pattern with form action URL context
   * Uses Explorer's querySelector pattern: form.querySelector(`[name="${key}"]`)
   */
  private monitorFormSubmission(form: HTMLFormElement, submissionType: 'method' | 'event'): void {
    try {
      console.debug(`[${this.name}] Monitoring form submission (${submissionType}):`, form);

      // Check if this call is from our own extension (prevent recursive detection)
      const stack = new Error().stack;
      const isFromExtension = stack && this.isCallFromExtension(stack);

      if (isFromExtension) {
        console.debug(`[${this.name}] Skipping form submission monitoring - called from extension`);
        return;
      }

      // Create FormData to get all form fields (same approach as Explorer)
      const formData = new FormData(form);
      const formAction = form.action || window.location.href;

      formData.forEach((value, key) => {
        // Find the form element using Explorer's pattern - only 'name' attribute
        const element = form.querySelector(`[name="${key}"]`) as
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

        if (!element || !isFormElement(element)) {
          return; // Skip if element not found or not a form element we monitor
        }

        console.debug(`[${this.name}] Form submission field detected:`, { key, element, formAction });

        // Create evidence for this form field submission
        const action = 'submit'; // Always 'submit' - this is form submission surveillance
        const hookType = submissionType === 'method' ? 'property' : 'eventHandler';

        const result = this.evidenceCollector.createAndSendEvidence(
          element,
          action,
          hookType as 'property' | 'addEventListener'
        );

        // Breakpoint if recording is active AND in breakpoint mode AND filters pass
        if (result.shouldProceed && recordingModeHandler.isCurrentlyRecording() && recordingModeHandler.getMode() === 'breakpoint') {
          // console.log(`🛑 Breakpoint: Form submission (${submissionType}) for field ${key} on`, element);
          debugger; // eslint-disable-line no-debugger
        }
      });

    } catch (error) {
      console.error(`[${this.name}] Error monitoring form submission:`, error);
      // Don't throw - surveillance detection should never break page functionality
    }
  }
}