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
  }
};

// Helper functions for evidence detection logic

export function isFormElement(element: Element): boolean {
  return EVIDENCE_CONFIG.formElements.elements.some(tag => 
    element.tagName.toLowerCase() === tag
  );
}


export function shouldHookPropertyGetter(element: Element, propertyName: string): boolean {
  return isFormElement(element) && 
         EVIDENCE_CONFIG.formElements.propertyGetters.includes(propertyName);
}

export function shouldHookEventHandlerSetter(target: any, propertyName: string): boolean {
  // Form element event handler only
  if (target instanceof Element && isFormElement(target)) {
    return EVIDENCE_CONFIG.formElements.eventHandlerSetters.includes(propertyName);
  }
  
  return false;
}

export function shouldHookEventListener(target: any, eventType: string): boolean {
  // Form element addEventListener only
  if (target instanceof Element && isFormElement(target)) {
    return EVIDENCE_CONFIG.formElements.eventListeners.includes(eventType);
  }
  
  return false;
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