// Input Evidence Extension - Evidence Configuration
// Matches Explorer surveillance detection hooks exactly

export interface EvidenceHooks {
  // Form element hooks (input, select, textarea)
  formElements: {
    elements: string[];
    propertyGetters: string[];
    eventHandlerSetters: string[];
    eventListeners: string[];
  };
  
  // Global hooks (window, document) 
  globalElements: {
    elements: string[];
    eventHandlerSetters: string[];
    eventListeners: string[];
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
      // TODO: Add 'paste', 'focus', 'blur', 'submit' for expanded surveillance detection
    ]
  },

  // Window and Document hooks (global keylogging detection)
  globalElements: {
    elements: ['window', 'document'],
    
    // Global event handler setters (when scripts monitor ALL typing)
    eventHandlerSetters: [
      'onkeydown',   // window.onkeydown = handler (catches all page typing)
      'onkeypress',  // window.onkeypress = handler  
      'onkeyup'      // window.onkeyup = handler
    ],
    
    // Global addEventListener calls (keylogging surveillance)
    eventListeners: [
      'keydown',     // window.addEventListener('keydown', handler)
      'keypress',    // window.addEventListener('keypress', handler) 
      'keyup'        // window.addEventListener('keyup', handler)
      // TODO: Add 'beforeunload', 'unload' for data exfiltration detection
    ]
  }
};

// Helper functions for evidence detection logic

export function isFormElement(element: Element): boolean {
  return EVIDENCE_CONFIG.formElements.elements.some(tag => 
    element.tagName.toLowerCase() === tag
  );
}

export function isGlobalElement(target: any): boolean {
  return target === window || target === document;
}

export function shouldHookPropertyGetter(element: Element, propertyName: string): boolean {
  return isFormElement(element) && 
         EVIDENCE_CONFIG.formElements.propertyGetters.includes(propertyName);
}

export function shouldHookEventHandlerSetter(target: any, propertyName: string): boolean {
  // Form element event handler
  if (target instanceof Element && isFormElement(target)) {
    return EVIDENCE_CONFIG.formElements.eventHandlerSetters.includes(propertyName);
  }
  
  // Global element event handler  
  if (isGlobalElement(target)) {
    return EVIDENCE_CONFIG.globalElements.eventHandlerSetters.includes(propertyName);
  }
  
  return false;
}

export function shouldHookEventListener(target: any, eventType: string): boolean {
  // Form element addEventListener
  if (target instanceof Element && isFormElement(target)) {
    return EVIDENCE_CONFIG.formElements.eventListeners.includes(eventType);
  }
  
  // Global addEventListener (keylogging detection)
  if (isGlobalElement(target)) {
    return EVIDENCE_CONFIG.globalElements.eventListeners.includes(eventType);
  }
  
  return false;
}

export function generateEvidenceType(target: any, action: string, hookType: 'property' | 'eventHandler' | 'addEventListener'): string {
  let targetName: string;
  
  if (target instanceof Element) {
    targetName = target.tagName.toLowerCase();
  } else if (target === window) {
    targetName = 'window';
  } else if (target === document) {
    targetName = 'document';
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