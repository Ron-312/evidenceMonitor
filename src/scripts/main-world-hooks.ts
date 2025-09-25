// Main World Script - Runs in page context to hook EventTarget.prototype.addEventListener
// This script runs with "world": "MAIN" at document_start to catch early addEventListener calls

import { EVIDENCE_CONFIG, isFormElement, generateEvidenceType } from './config/evidence-config';
import { StackTrace } from './utils/stack-trace';

// Simple element ID generator (matches pattern from ElementRegistry)
let elementIdCounter = 0;
const elementIdMap = new WeakMap<Element, string>();

function getElementId(element: Element): string {
  if (!elementIdMap.has(element)) {
    const id = 'mw' + Date.now().toString(36) + (++elementIdCounter).toString(36);
    elementIdMap.set(element, id);
  }
  return elementIdMap.get(element)!;
}

// Use the shared StackTrace utility for consistent stack trace capture
function captureStackTrace(): string[] {
  return StackTrace.capture();
}

// Check if element should be monitored (uses exact config from evidence-config.ts)
function shouldMonitorEventListener(target: EventTarget, eventType: string): boolean {
  // Must be an Element
  if (!(target instanceof Element)) {
    return false;
  }

  // Must be a form element (uses config)
  if (!isFormElement(target)) {
    return false;
  }

  // Must be a monitored event type (uses config)
  if (!EVIDENCE_CONFIG.formElements.eventListeners.includes(eventType)) {
    return false;
  }

  return true;
}

// Generate element data string (matches existing getElementData pattern)
function getElementData(element: Element): string {
  try {
    // Create a simplified representation of the element
    const tagName = element.tagName.toLowerCase();
    const attributes: string[] = [];

    // Add key attributes
    const keyAttrs = ['id', 'class', 'name', 'type', 'value', 'placeholder'];
    for (const attr of keyAttrs) {
      const value = element.getAttribute(attr);
      if (value !== null) {
        attributes.push(`${attr}="${value}"`);
      }
    }

    return `<${tagName}${attributes.length > 0 ? ' ' + attributes.join(' ') : ''}>`;
  } catch (error) {
    return `<${element.tagName.toLowerCase()}>`;
  }
}

// Generate action ID (matches existing generateActionId pattern)
function generateActionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Main addEventListener hook installation
(function installMainWorldHooks() {
  // Ensure we only install once
  if ((window as any).__REFLECTIZ_MAIN_WORLD_HOOKS__) {
    return;
  }

  try {
    console.debug('[MainWorldHooks] Installing addEventListener hook at document_start');

    // Store original method
    const originalAddEventListener = EventTarget.prototype.addEventListener;

    // Expose the original method for injected script to use (prevents recursive calls)
    (window as any).__ORIGINAL_ADD_EVENT_LISTENER__ = originalAddEventListener;

    // Install our hook
    EventTarget.prototype.addEventListener = function(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      // Debug recursive calls in main world hook - persist to JSON
      if (type === 'addEventListener') {
        const debugData = {
          actionId: `DEBUG_MW_RECURSIVE_${Date.now()}`,
          type: 'DEBUG.recursiveCall',
          start: performance.now(),
          duration: 0,
          data: `[MAIN_WORLD RECURSIVE] addEventListener("${type}") on ${this instanceof Element ? this.tagName : 'non-Element'}`,
          target: { id: `debug-${Date.now()}` },
          stackTrace: new Error().stack?.split('\n').slice(1, 6) || ['[NO_STACK]']
        };

        // Send to content script for persistence
        window.postMessage({
          type: 'MAIN_WORLD_EVIDENCE_EVENT',
          event: debugData
        }, '*');

        console.error('[MainWorldHooks] 🚨 MAIN WORLD RECURSIVE CALL - logged to JSON');
      }

      // Check if this should be monitored using exact config logic
      if (shouldMonitorEventListener(this, type)) {
        try {
          // Capture evidence immediately
          const element = this as Element;
          const elementId = getElementId(element);
          const stackTrace = captureStackTrace();
          const elementData = getElementData(element);
          const evidenceType = generateEvidenceType(element, type, 'addEventListener');

          // Create evidence event (matches EvidenceEvent format)
          const evidenceEvent = {
            actionId: generateActionId(),
            type: evidenceType,
            start: performance.now(),
            duration: 0,
            data: `${elementData}`,
            target: { id: elementId },
            stackTrace: stackTrace
          };

          // Send to content script via postMessage
          window.postMessage({
            type: 'MAIN_WORLD_EVIDENCE_EVENT',
            event: evidenceEvent
          }, '*');

          // console.debug('[MainWorldHooks] Sending evidence event:', {
          //   actionId: evidenceEvent.actionId,
          //   type: evidenceEvent.type,
          //   stackTrace: evidenceEvent.stackTrace,
          //   stackFrameCount: evidenceEvent.stackTrace.length
          // });

        } catch (error) {
          console.error('[MainWorldHooks] Error capturing addEventListener evidence:', error);
        }
      }

      // Always call original addEventListener
      return originalAddEventListener.call(this, type, listener, options);
    };

    // Mark as installed
    (window as any).__REFLECTIZ_MAIN_WORLD_HOOKS__ = true;
    console.debug('[MainWorldHooks] addEventListener hook installed successfully');

  } catch (error) {
    console.error('[MainWorldHooks] Failed to install addEventListener hook:', error);
  }
})();