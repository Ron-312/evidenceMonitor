// Input Evidence Extension - Evidence Configuration
// Matches Explorer surveillance detection hooks exactly

import { trackEventsManager } from '../state/track-events-manager';

export interface EvidenceHooks {
  // Form element hooks (input, select, textarea)
  formElements: {
    elements: string[];
    propertyGetters: string[];
    eventHandlerSetters: string[];
    eventListeners: string[];
  };
  // Form submission surveillance
  formSubmission: {
    elements: string[];
    methods: string[];
    eventListeners: string[];
  };
  // FormData creation surveillance
  formDataCreation: {
    constructor: string;
  };
}

// Evidence configuration matching Explorer exactly
export const EVIDENCE_CONFIG: EvidenceHooks = {
  // HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement hooks
  formElements: {
    elements: ['input', 'select', 'textarea'],

    // Property getters to hook (when scripts READ values)
    propertyGetters: [
      'value',      // Most common - input.value, select.value, textarea.value
      'nodeValue'   // Alternative access pattern - element.nodeValue
    ],

    // Event handler property setters (when scripts SET event handlers)
    eventHandlerSetters: [
      'onkeydown',   // element.onkeydown = handler
      'onkeypress',  // element.onkeypress = handler
      'onkeyup',     // element.onkeyup = handler
      'oninput',     // element.oninput = handler
      'onchange'     // element.onchange = handler
    ],

    // addEventListener calls to monitor
    eventListeners: [
      'keydown',     // element.addEventListener('keydown', handler)
      'keypress',    // element.addEventListener('keypress', handler)
      'keyup',       // element.addEventListener('keyup', handler)
      'input',       // element.addEventListener('input', handler)
      'change'       // element.addEventListener('change', handler)
    ]
  },

  // Form submission surveillance (matches Explorer pattern)
  formSubmission: {
    elements: ['form'],                    // HTMLFormElement
    methods: ['submit'],                   // form.submit() method
    eventListeners: ['submit']             // form.addEventListener('submit', handler)
  },

  // FormData creation surveillance (matches Explorer pattern)
  formDataCreation: {
    constructor: 'FormData'                // new FormData() constructor
  }
};

// Helper functions for evidence detection logic

export function isFormElement(element: Element): boolean {
  return EVIDENCE_CONFIG.formElements.elements.some(tag => 
    element.tagName.toLowerCase() === tag
  );
}


export function shouldHookPropertyGetter(element: Element, propertyName: string): boolean {
  return trackEventsManager.isInputValueAccessEnabled() &&
         isFormElement(element) &&
         EVIDENCE_CONFIG.formElements.propertyGetters.includes(propertyName);
}

export function shouldHookEventHandlerSetter(target: any, propertyName: string): boolean {
  // Form element event handler only
  if (target instanceof Element && isFormElement(target)) {
    return trackEventsManager.isInputEventsEnabled() &&
           EVIDENCE_CONFIG.formElements.eventHandlerSetters.includes(propertyName);
  }

  return false;
}

export function shouldHookEventListener(target: any, eventType: string): boolean {
  // Form element addEventListener only
  if (target instanceof Element && isFormElement(target)) {
    return trackEventsManager.isInputEventsEnabled() &&
           EVIDENCE_CONFIG.formElements.eventListeners.includes(eventType);
  }

  return false;
}

export function shouldHookFormSubmission(target: any, action: string): boolean {
  // Check if this is a form submission we should monitor
  if (target instanceof HTMLFormElement) {
    return trackEventsManager.isFormSubmitEnabled() &&
           EVIDENCE_CONFIG.formSubmission.methods.includes(action);
  }

  return false;
}

export function shouldHookFormDataCreation(constructorName: string): boolean {
  // Check if this is FormData constructor we should monitor
  return trackEventsManager.isFormDataCreationEnabled() &&
         constructorName === EVIDENCE_CONFIG.formDataCreation.constructor;
}

export function generateEvidenceType(target: any, action: string, hookType: 'property' | 'eventHandler' | 'addEventListener'): string {
  let targetName: string;

  if (target instanceof Element) {
    targetName = target.tagName.toLowerCase();
  } else {
    targetName = 'unknown';
  }

  switch (hookType) {
    case 'property':
      return `${targetName}.${action}/get`;
    case 'eventHandler':
      return `${targetName}.${action}/set`;
    case 'addEventListener':
      return `${targetName}.addEventListener(${action})`;
    default:
      return `${targetName}.${action}`;
  }
}