# Reference Implementation Analysis - Explorer Surveillance Detection

## Overview

This document analyzes the surveillance detection implementation from Explorer's codebase to understand the comprehensive hooks and patterns we need to replicate in our Chrome extension. The reference implementation provides a complete picture of what constitutes "surveillance" and how to detect it systematically.

## Core Architecture Pattern

### **Hook Registration System**
```typescript
// Explorer uses a declarative hook builder system
let hijacker = createBuilder();
hijacker.hookAllEvents();

// Create typed hook objects for different prototypes
let h_HTMLInputElement_prototype = hijacker.object({
    object: HTMLInputElement.prototype,
    name: "input", 
    tags: ["element", "html", "input"]
});
```

**Adaptation for our Extension:**
- Our `HookManager` should coordinate similar hook installations
- Use prototype-level hooking for comprehensive coverage
- Tag-based organization for hook categorization

### **Evidence Reporting Pipeline**
```typescript
let reportFopi = <T>(next, setup, extra?) => {
    let p = CommonReports.memberCall(next, setup, extra);
    Report.data(p);  // Send to background
    return p;
};
```

**Our Implementation:**
- `EvidenceCollector.createAndSendEvidence()` serves this role
- Evidence flows: Hook → Collector → Content Script → Background
- Same structured reporting approach

## Surveillance Detection Categories

### **1. Input Value Access Surveillance**

**Explorer Implementation:**
```typescript
let valuePropertyHook = function (ctx, setup) {
    let next = ctx.next();
    let self = ctx.self;
    
    let reportPayload = prepareValueReportPayload(self, setup, false);
    if (reportPayload) {
        reportFopi(next, setup, reportPayload);
    }
};

let valuePropertyGetHook = {
    get(ctx, setup) {
        valuePropertyHook(ctx, setup);  // Report when .value is READ
    },
    set(ctx, setup) {
        ctx.next();  // Don't report when .value is SET
    }
};

// Apply to form elements
h_HTMLInputElement_prototype.hookMembers({
    value: valuePropertyGetHook,
    nodeValue: valuePropertyGetHook,
});
```

**Key Insights:**
- **Only hook getters, not setters** - We care about scripts READING values, not setting them
- **Target multiple access patterns** - `value`, `nodeValue` properties
- **Element classification** - Password inputs, sensitive inputs, forms with passwords get special tagging

**Our Implementation Needs:**
```typescript
// In PropertyGetterHooks class
installValueGetter(prototype: any, propertyName: string) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
    Object.defineProperty(prototype, propertyName, {
        get: function() {
            // Report surveillance BEFORE returning value
            if (shouldHookPropertyGetter(this, propertyName)) {
                evidenceCollector.createAndSendEvidence(this, propertyName, 'property');
            }
            return originalDescriptor.get.call(this);
        },
        set: originalDescriptor.set,  // Don't hook setters
        configurable: true
    });
}
```

### **2. Event Handler Assignment Surveillance**

**Explorer Implementation:**
```typescript
let valuePropertySetHook = {
    tags: ["events"],
    get(ctx, setup) {
        ctx.next();
    },
    set(ctx, setup) {
        valuePropertyHook(ctx, setup);  // Report when handler is ASSIGNED
    }
};

h_HTMLInputElement_prototype.hookMembers({
    onkeydown: valuePropertySetHook,
    onkeypress: valuePropertySetHook,
    onkeyup: valuePropertySetHook,
    oninput: valuePropertySetHook,
    onchange: valuePropertySetHook
});
```

**Key Insights:**
- **Hook setters, not getters** - Opposite of value access hooks
- **Comprehensive event coverage** - All keyboard and input events
- **Applied to form elements AND global objects** (window, document)

**Our Implementation Needs:**
```typescript
// In EventHandlerHooks class
installEventHandlerSetter(prototype: any, handlerName: string) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(prototype, handlerName);
    Object.defineProperty(prototype, handlerName, {
        get: originalDescriptor?.get || function() { return this[`__${handlerName}__`]; },
        set: function(handler) {
            // Report surveillance when handler is ASSIGNED
            if (shouldHookEventHandlerSetter(this, handlerName)) {
                evidenceCollector.createAndSendEvidence(this, handlerName.slice(2), 'eventHandler');
            }
            return originalDescriptor?.set?.call(this, handler) || (this[`__${handlerName}__`] = handler);
        },
        configurable: true
    });
}
```

### **3. addEventListener Surveillance**

**Explorer Implementation:**
```typescript
h_EventTarget_prototype.hookEventTarget((ctx, setup) => {
    let next = ctx.next();
    Report.data(CommonReports.eventSubscribed(next, next.event, setup.owner));
});

let inputTypeEventHook = (ctx, setup) => {
    let next = ctx.next();
    
    if (isKeyloggingEvent(ctx.event) || isInputValue(ctx.event)) {
        let actionType = `${setup.owner.name}.addEventListener(${ctx.event})`;
        let legacyElementString = getLegacyElementString(self);
        
        // Classify input types
        if (tagName == "INPUT" && typeLower == "password") {
            actionType = actionType + "/password";
        } else if (isFormInput && isSensitiveInput(self)) {
            actionType = actionType + "/sensitive";
        }
        
        Report.data(CommonReports.eventSubscribed(next, next.event, setup.owner, {
            actionType: actionType,
            data: legacyElementString,
            targetElement: snapshot(self),
            forceKeep: true
        }));
    }
};

h_HTMLInputElement_prototype.hookEventTarget(inputTypeEventHook);
```

**Key Insights:**
- **Event type filtering** - Only keylogging events (`keydown`, `keypress`, `keyup`) and input events (`input`, `change`)
- **Element context matters** - Same event on password input vs text input gets different classification
- **Global surveillance detection** - Window/document keylogging is highest priority

**Our Current Implementation Status:**
- ✅ Basic addEventListener hooking exists
- ❌ Missing global element support (window/document)
- ❌ Missing event type classification
- ❌ Missing input type sensitivity detection

### **4. Global Keylogging Detection**

**Explorer Implementation:**
```typescript
function isKeyloggingEvent(event: string) {
    return ["keydown", "keypress", "keyup"].indexOf(event) >= 0;
}

let globalKeyloggingHook = {
    tags: ["events"],
    get: (ctx, owner) => ctx.next(),
    set: (ctx, setup) => {
        let next = ctx.next();
        reportFopi(next, setup, {
            forceKeep: true  // Always keep global keylogging evidence
        });
    }
};

h_window.hookMembers({
    onkeydown: globalKeyloggingHook,
    onkeypress: globalKeyloggingHook, 
    onkeyup: globalKeyloggingHook
})
.hookEventTarget((ctx, setup) => {
    if (isKeyloggingEvent(ctx.event)) {
        Report.data(CommonReports.eventSubscribed(next, next.event, setup.owner, {
            actionType: `${setup.owner.name}.addEventListener(${ctx.event})`,
            forceKeep: true  // Global keylogging always flagged
        }));
    }
});
```

**Critical Insight:**
- **Global keylogging is the highest priority** - `forceKeep: true` means this evidence is never filtered out
- **Two attack vectors** - Direct assignment (`window.onkeydown = handler`) AND addEventListener (`window.addEventListener('keydown', handler)`)
- **Document-level monitoring** - Same hooks applied to `document` object

## Evidence Classification System

### **Input Sensitivity Detection**
```typescript
function prepareValueReportPayload(element, setup?, isSubmitEvent = false) {
    const tagName = element.tagName;
    const typeLower = element.type ? element.type.toLowerCase() : "";
    const isFormInput = tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA";
    
    let actionType = `${setup?.owner.name}.${setup?.prop.name}`;
    
    // Priority classification
    if (element.tagName === "INPUT" && typeLower === "password") {
        actionType += "/password";         // Highest priority
    } else if (isFormInput && isSensitiveInput(element)) {
        actionType += "/sensitive";        // High priority  
    } else if (isFormInput && element.form && element.form.querySelector("input[type=password]")) {
        actionType += "/passwordForm";     // Medium-high priority
    }
    
    return {
        actionType,
        data: legacyElementString,
        targetElement: snapshot(element),
        forceKeep: true
    };
}
```

**Classification Hierarchy:**
1. **`/password`** - Direct password input access
2. **`/sensitive`** - Inputs marked as sensitive (credit cards, SSNs, etc.)  
3. **`/passwordForm`** - Any input in a form that contains a password field
4. **`/global`** - Window/document level surveillance (implicit highest priority)

### **Evidence Data Structure**
```typescript
// Evidence includes:
{
    actionType: "input.value/get/password",     // Classification + action
    data: "input#email.form-control",          // Element selector string
    targetElement: snapshot(element),          // DOM snapshot
    forceKeep: true,                          // Priority flag
    actionId: randomId(),                     // Unique action ID
    start: timestamp,                         // Timing
    stackTrace: [...frames]                   // Call stack
}
```

## Advanced Features We're Missing

### **1. Element Snapshots**
```typescript
const { snapshot } = Spy.require("toybox/element-snapshot");
targetElement: snapshot(element)  // Captures element state
```
**Need:** Element snapshot functionality for evidence

### **2. Form Context Detection**
```typescript
// Check if element is in a form with password fields
element.form && element.form.querySelector("input[type=password]")
```
**Need:** Form relationship analysis

### **3. Dynamic Content Monitoring**
```typescript
function crawlSensitiveInputs(container, actionId, isInitial = false) {
    // Scan for sensitive inputs in dynamically added content
}
```
**Need:** Our DOM Observer implementation

### **4. Stack Trace Filtering**
```typescript
// Filter out extension frames from stack traces
const cleanStackTrace = (frames: string[]): string[]
```
**Current:** ✅ We have this in `stack-trace.ts`

## Implementation Priority Map

### **Phase 1: Critical Missing Hooks**
```typescript
// 1. Property Getter Hooks (CRITICAL)
HTMLInputElement.prototype.value getter     ✅ Evidence Config ❌ Implementation  
HTMLInputElement.prototype.nodeValue getter ✅ Evidence Config ❌ Implementation
HTMLSelectElement.prototype.value getter    ✅ Evidence Config ❌ Implementation  
HTMLTextAreaElement.prototype.value getter  ✅ Evidence Config ❌ Implementation

// 2. Event Handler Setter Hooks (CRITICAL)  
HTMLInputElement.prototype.onkeydown setter  ✅ Evidence Config ❌ Implementation
HTMLInputElement.prototype.oninput setter    ✅ Evidence Config ❌ Implementation
window.onkeydown setter                      ✅ Evidence Config ❌ Implementation
document.onkeydown setter                    ✅ Evidence Config ❌ Implementation

// 3. Global addEventListener (HIGH)
window.addEventListener('keydown')           ❌ Evidence Config ❌ Implementation  
document.addEventListener('keydown')         ❌ Evidence Config ❌ Implementation
```

### **Phase 2: Enhanced Classification**
```typescript
// Input sensitivity detection
isSensitiveInput(element)                   ❌ Implementation
element.form relationship analysis          ❌ Implementation  
Password form detection                     ❌ Implementation
Element snapshot capture                    ❌ Implementation
```

### **Phase 3: Advanced Features**
```typescript
// Form submission surveillance
FormData constructor hooks                  ❌ Implementation
form.submit() monitoring                    ❌ Implementation
Dynamic content crawling                    ❌ Implementation (DOM Observer)
```

## Key Differences from Our Current Implementation

### **1. Global Handler Support Missing**
- **Reference:** Hooks `window.onkeydown` and `window.addEventListener('keydown')`  
- **Our Status:** AddEventListener hook skips global objects
- **Fix:** Update `shouldMonitor()` method to handle global elements

### **2. Property Getter Hooks Missing**
- **Reference:** Comprehensive value access detection
- **Our Status:** No property getter hooks implemented
- **Fix:** Implement `PropertyGetterHooks` class

### **3. Event Handler Setter Hooks Missing**
- **Reference:** Detects `element.onkeydown = handler` assignments
- **Our Status:** No event handler property monitoring
- **Fix:** Implement `EventHandlerHooks` class

### **4. Classification System Basic**
- **Reference:** Password/sensitive/passwordForm classification
- **Our Status:** Basic event type only
- **Fix:** Implement input sensitivity detection

### **5. Evidence Priority System Missing**
- **Reference:** `forceKeep: true` for critical surveillance
- **Our Status:** All evidence treated equally
- **Fix:** Add priority/classification to evidence structure

## Conclusion

The reference implementation shows that comprehensive surveillance detection requires:

1. **Three Hook Types:** addEventListener, property getters, event handler setters
2. **Global Surveillance Detection:** Window/document level monitoring is critical
3. **Input Classification:** Password, sensitive, and form context awareness  
4. **Priority System:** Some surveillance (global keylogging) is always flagged
5. **Element Context:** Form relationships and input types matter

Our current implementation has excellent infrastructure (element registry, evidence collection, deduplication) but is missing the core surveillance detection hooks. The next phase should focus on implementing the missing hook types while maintaining our architectural patterns.