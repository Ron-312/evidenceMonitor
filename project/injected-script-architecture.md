# Injected Script Architecture & Technical Challenges

## Project Overview

The **Input Evidence Chrome Extension** is a surveillance detection tool designed to capture evidence of scripts monitoring user input interactions on web pages. The extension operates by:

1. **Detecting surveillance**: Scripts reading form values, attaching event listeners to inputs, monitoring keyboard events
2. **Collecting evidence**: Stack traces, element details, timing information for each surveillance action  
3. **Providing analysis**: Export evidence for comparison with Explorer baseline data

The goal is to identify third-party scripts that are secretly monitoring user typing, form interactions, and data entry - essentially detecting digital surveillance and privacy violations.

## Architecture Components

### Three-Layer System
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Injected      │───▶│   Content       │───▶│   Background    │
│   Script        │    │   Script        │    │   Worker        │
│                 │    │                 │    │                 │
│ • Hook APIs     │    │ • Bridge        │    │ • Store Events  │
│ • Detect Events │    │ • Message Relay │    │ • Export Data   │
│ • Capture Stack │    │ • HUD Updates   │    │ • Manage State  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
     Main World           Isolated World        Service Worker
```

### Data Flow
```
Page Script → Hooked API → Evidence Created → window.postMessage → 
Content Script → chrome.runtime.sendMessage → Background Worker → Storage
```

## Injected Script File Structure

```typescript
src/injected/
├── injected-main.ts              // Entry point, initialization coordinator
├── element-registry.ts           // WeakMap<Element, string> for stable IDs
├── evidence-collector.ts         // Evidence object creation & transmission
├── hook-manager.ts               // Coordinates all hook installations
├── hooks/
│   ├── addEventListener-hook.ts  // EventTarget.prototype.addEventListener
│   ├── property-getter-hooks.ts // HTMLInputElement.value, nodeValue, etc.
│   └── event-handler-hooks.ts   // onkeydown, oninput, onchange setters
└── utils/
    ├── stack-trace.ts           // Stack trace parsing & formatting
    └── dom-observer.ts          // MutationObserver for dynamic content
```

## Technical Challenges & Solutions

### Challenge 1: Content Script Communication Race Condition

#### **Problem Description**
A timing race condition exists between injected script initialization and content script message listener setup:

**Timeline:**
1. Page starts loading (`document_start`)
2. Content script injected and creates injected script element
3. Injected script begins executing and installing hooks
4. **RACE CONDITION WINDOW**: Injected script may start sending evidence before content script message listener is established
5. Content script sets up `window.addEventListener('message')` 
6. Evidence messages sent during gap are lost

#### **Impact**
- Early surveillance detection events may be lost
- Inconsistent evidence collection depending on page load timing
- Reduced reliability of surveillance detection

#### **Solution Options**

##### **Option A: Retry Mechanism with Queue**
```typescript
class EvidenceCollector {
  private evidenceQueue: EvidenceEvent[] = [];
  private sendAttempts: number = 0;
  private maxRetries: number = 5;
  
  sendEvidence(evidence: EvidenceEvent) {
    this.evidenceQueue.push(evidence);
    this.attemptSend();
  }
  
  private attemptSend() {
    window.postMessage({
      type: 'EVIDENCE_EVENT',
      events: this.evidenceQueue
    }, '*');
    
    // Retry logic with exponential backoff
    if (this.sendAttempts < this.maxRetries) {
      setTimeout(() => {
        this.sendAttempts++;
        this.attemptSend();
      }, 100 * Math.pow(2, this.sendAttempts));
    }
  }
}
```

**Pros**: 
- Ensures no evidence is lost
- Self-recovering system
- Handles temporary communication failures

**Cons**:
- Added complexity
- Memory usage for queued events
- Retry overhead

##### **Option B: Handshake Protocol**
```typescript
// Content Script
window.postMessage({ type: 'CONTENT_SCRIPT_READY' }, '*');

// Injected Script  
class EvidenceCollector {
  private isContentScriptReady: boolean = false;
  private pendingEvidence: EvidenceEvent[] = [];
  
  constructor() {
    window.addEventListener('message', (event) => {
      if (event.data.type === 'CONTENT_SCRIPT_READY') {
        this.isContentScriptReady = true;
        this.flushPendingEvidence();
      }
    });
  }
  
  sendEvidence(evidence: EvidenceEvent) {
    if (this.isContentScriptReady) {
      this.transmitImmediately(evidence);
    } else {
      this.pendingEvidence.push(evidence);
    }
  }
}
```

**Pros**:
- Deterministic communication start
- Clean state management
- No lost events

**Cons**:
- Additional handshake overhead
- More complex initialization sequence

##### **Option C: Fire-and-Forget with Chrome Runtime Resilience**
```typescript
class EvidenceCollector {
  sendEvidence(evidence: EvidenceEvent) {
    // Trust chrome runtime to handle communication failures gracefully
    window.postMessage({
      type: 'EVIDENCE_EVENT', 
      event: evidence
    }, '*');
  }
}
```

**Pros**:
- Simplest implementation
- Minimal overhead
- Relies on Chrome's built-in resilience

**Cons**:
- Potential evidence loss during timing gaps
- No guarantee of message delivery
- Less reliable for critical early surveillance detection

#### **✅ APPROVED SOLUTION: Option B (Handshake Protocol)**
The handshake approach provides the best balance of reliability and simplicity. Early surveillance detection is critical for comprehensive evidence collection, making the slight complexity overhead worthwhile.

**Implementation Decision**: Content script sends `CONTENT_SCRIPT_READY` message, injected script queues evidence until ready signal received.

### Challenge 2: Hook Installation Strategy

#### **Problem Description**
Determining the optimal timing and order for installing JavaScript API hooks to maximize surveillance detection coverage.

#### **Installation Timing Options**

##### **✅ APPROVED: Simultaneous Installation**
```typescript
class HookManager {
  initializeAllHooks() {
    // Install all hooks atomically to avoid race conditions
    this.installEventListenerHooks();      // EventTarget.addEventListener
    this.installPropertyGetterHooks();     // input.value, select.value, etc.
    this.installEventHandlerHooks();       // onkeydown, oninput, onchange
    
    // Start monitoring for dynamically added elements
    this.startDOMObserver();
  }
}
```

**Benefits**:
- No timing windows where surveillance can slip through undetected
- Consistent behavior across different page load scenarios
- Atomic operation reduces complexity

##### **Sequential Installation**
Install hooks in priority order based on surveillance frequency:
1. `EventTarget.addEventListener` (highest impact)
2. Property getters (`value`, `nodeValue`) (high frequency)  
3. Event handler setters (`onkeydown`, etc.) (lower frequency)

**Benefits**:
- Prioritizes most critical surveillance vectors
- Allows for partial functionality if installation fails

**Drawbacks**:
- Race condition windows between installations
- More complex error handling

### Challenge 3: High-Frequency Event Deduplication

#### **Problem Description**
Some surveillance patterns generate extremely high-frequency events (e.g., reading `input.value` on every keystroke), which can:
- Overwhelm the evidence collection system
- Generate massive amounts of duplicate evidence
- Impact page performance through excessive message passing

#### **✅ APPROVED: Deduplication Strategy (50ms Window)**
```typescript
class EvidenceCollector {
  private recentEvents: Map<string, number> = new Map();
  private deduplicationWindow: number = 50; // 50ms window
  
  private generateDeduplicationKey(evidence: EvidenceEvent): string {
    return `${evidence.type}:${evidence.target.id}:${evidence.stackTrace[0]}`;
  }
  
  sendEvidence(evidence: EvidenceEvent) {
    const key = this.generateDeduplicationKey(evidence);
    const now = performance.now();
    const lastSent = this.recentEvents.get(key);
    
    if (!lastSent || (now - lastSent) > this.deduplicationWindow) {
      this.recentEvents.set(key, now);
      this.transmitEvidence(evidence);
      
      // Cleanup old entries to prevent memory leaks
      this.cleanupOldEntries(now);
    }
  }
  
  private cleanupOldEntries(currentTime: number) {
    for (const [key, timestamp] of this.recentEvents.entries()) {
      if (currentTime - timestamp > this.deduplicationWindow * 10) {
        this.recentEvents.delete(key);
      }
    }
  }
}
```

**Deduplication Key Components**:
- **Type**: `input.value/get`, `input.addEventListener(keydown)`, etc.
- **Target ID**: Stable element identifier
- **Stack Trace**: First frame to distinguish different calling contexts

**Benefits**:
- Reduces evidence volume by ~90% for high-frequency events
- Maintains unique surveillance patterns
- Prevents performance degradation
- Memory-efficient with automatic cleanup

### Challenge 4: Dynamic Content Monitoring

#### **Problem Description**
Modern web applications frequently create form elements dynamically through JavaScript, AJAX, or framework updates. Static hook installation only covers elements present at page load.

#### **✅ APPROVED: MutationObserver Integration**
```typescript
class DOMObserver {
  private observer: MutationObserver;
  private hookManager: HookManager;
  
  constructor(hookManager: HookManager) {
    this.hookManager = hookManager;
    this.observer = new MutationObserver(this.handleMutations.bind(this));
  }
  
  start() {
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }
  
  private handleMutations(mutations: MutationRecord[]) {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node instanceof Element) {
          this.processNewElement(node);
        }
      });
    });
  }
  
  private processNewElement(element: Element) {
    // Check if element or descendants are form inputs
    const formElements = element.matches('input, select, textarea') 
      ? [element] 
      : Array.from(element.querySelectorAll('input, select, textarea'));
      
    formElements.forEach(formElement => {
      this.hookManager.applyHooksToElement(formElement);
    });
  }
}
```

**Coverage**:
- Single Page Applications (SPAs)
- AJAX-loaded content
- Framework-rendered components (React, Vue, Angular)
- Lazy-loaded forms
- Modal dialogs and popups

## Error Handling & Logging Strategy

### Comprehensive Error Logging
```typescript
class ErrorLogger {
  private static logEvidence(context: string, error: Error, additionalInfo?: any) {
    const errorReport = {
      timestamp: new Date().toISOString(),
      context: context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      url: window.location.href,
      userAgent: navigator.userAgent,
      additionalInfo: additionalInfo
    };
    
    // Send to background worker for debugging
    window.postMessage({
      type: 'ERROR_REPORT',
      report: errorReport
    }, '*');
    
    // Also log to console for development
    console.error('[Input Evidence Extension]', errorReport);
  }
}
```

### Error Scenarios & Handling
1. **Hook Installation Failures**: CSP restrictions, conflicting extensions
2. **Element ID Generation Failures**: Memory constraints, WeakMap issues
3. **Communication Failures**: Content script unavailable, message passing errors
4. **Stack Trace Parsing Failures**: Minified code, unusual error formats
5. **DOM Observer Failures**: Permission issues, performance constraints

Each error scenario includes fallback mechanisms and detailed logging for debugging.

## Implementation Priority

### Phase 1: Core Infrastructure
1. Element registry with stable ID generation
2. Basic evidence collector with handshake protocol
3. EventTarget.addEventListener hook (highest impact)
4. Simple deduplication mechanism

### Phase 2: Complete Hook Coverage  
1. Property getter hooks (value, nodeValue)
2. Event handler setter hooks (onkeydown, etc.)
3. DOM observer for dynamic content
4. Enhanced error handling

### Phase 3: Performance & Reliability
1. Advanced deduplication strategies
2. Comprehensive error recovery
3. Performance optimization
4. Memory leak prevention

## ✅ APPROVED IMPLEMENTATION PLAN

### Build Strategy
- **Single Output**: All TypeScript files compile to one bundled `injected.js`
- **Import Strategy**: Evidence configuration imported from `../evidence-config.ts`
- **Integration**: Content script updated to handle handshake protocol and evidence relay

### Pre-Implementation Requirements

#### 1. Content Script Updates (`src/content.ts`)
- Add handshake protocol: send `CONTENT_SCRIPT_READY` on initialization
- Add evidence relay: listen for `EVIDENCE_EVENT` from injected script
- Forward evidence to background worker via `chrome.runtime.sendMessage`
- Add error handling for failed evidence transmission

#### 2. Manifest Updates (`public/manifest.json`)
- Add `injected.js` to `web_accessible_resources` if not already present
- Verify `all_frames: true` for iframe support
- Confirm `document_start` timing for early injection

#### 3. Build Process Updates
- Configure TypeScript to compile injected files to single `public/injected.js`
- Set up module bundling (webpack/rollup) if needed for imports
- Ensure evidence-config.ts is included in injected bundle

### File Implementation Specifications

#### **`src/injected/injected-main.ts`**
**Purpose**: Entry point and coordination
```typescript
import { HookManager } from './hook-manager';
import { EvidenceCollector } from './evidence-collector';
import { ElementRegistry } from './element-registry';
import { EVIDENCE_CONFIG } from '../evidence-config';

class InjectedMain {
  private hookManager: HookManager;
  private evidenceCollector: EvidenceCollector;
  private elementRegistry: ElementRegistry;
  
  constructor() {
    // Initialize core systems
    // Set up handshake listener
    // Start hook installation
  }
  
  private waitForContentScriptReady(): Promise<void>
  private initializeAllSystems(): void
  private handlePageUnload(): void
}

// Self-executing initialization
new InjectedMain();
```

#### **`src/injected/element-registry.ts`**
**Purpose**: Stable element ID management
```typescript
class ElementRegistry {
  private elementToId: WeakMap<Element, string> = new WeakMap();
  private idCounter: number = 0;
  
  getElementId(element: Element): string {
    // Return existing ID or generate new stable ID
    // Format: base36 random string (e.g., "bydcz1k6q7uimu26")
  }
  
  private generateElementId(): string {
    // Math.random().toString(36).substr(2) approach
  }
  
  hasElementId(element: Element): boolean
  clearRegistry(): void // For cleanup
}
```

#### **`src/injected/evidence-collector.ts`**
**Purpose**: Evidence creation and transmission
```typescript
import { EvidenceEvent } from '../background'; // Type import
import { generateEvidenceType } from '../evidence-config';

class EvidenceCollector {
  private isContentScriptReady: boolean = false;
  private pendingEvidence: EvidenceEvent[] = [];
  private recentEvents: Map<string, number> = new Map();
  private deduplicationWindow: number = 50; // ms
  
  constructor(elementRegistry: ElementRegistry) 
  
  createEvidence(
    element: Element,
    action: string, 
    hookType: 'property' | 'eventHandler' | 'addEventListener'
  ): EvidenceEvent {
    // Generate actionId, capture stack trace, create evidence object
  }
  
  sendEvidence(evidence: EvidenceEvent): void {
    // Deduplication check, queue or transmit immediately
  }
  
  onContentScriptReady(): void // Handle handshake
  private generateDeduplicationKey(evidence: EvidenceEvent): string
  private transmitEvidence(evidence: EvidenceEvent): void
  private flushPendingEvidence(): void
  private cleanupOldEntries(): void
}
```

#### **`src/injected/hook-manager.ts`**
**Purpose**: Coordinate all hook installations
```typescript
import { EVIDENCE_CONFIG } from '../evidence-config';
import { AddEventListenerHook } from './hooks/addEventListener-hook';
import { PropertyGetterHooks } from './hooks/property-getter-hooks';
import { EventHandlerHooks } from './hooks/event-handler-hooks';
import { DOMObserver } from './utils/dom-observer';

class HookManager {
  private addEventListenerHook: AddEventListenerHook;
  private propertyGetterHooks: PropertyGetterHooks;
  private eventHandlerHooks: EventHandlerHooks;
  private domObserver: DOMObserver;
  
  constructor(evidenceCollector: EvidenceCollector, elementRegistry: ElementRegistry)
  
  initializeAllHooks(): void {
    // Install all hooks simultaneously
    // Start DOM observer
    // Set up error handling
  }
  
  applyHooksToElement(element: Element): void // For dynamic content
  private setupGlobalErrorHandling(): void
  cleanup(): void // For page unload
}
```

#### **`src/injected/hooks/addEventListener-hook.ts`**
**Purpose**: EventTarget.addEventListener monitoring
```typescript
class AddEventListenerHook {
  private originalAddEventListener: typeof EventTarget.prototype.addEventListener;
  
  constructor(evidenceCollector: EvidenceCollector, elementRegistry: ElementRegistry)
  
  install(): void {
    // Hook EventTarget.prototype.addEventListener
    // Check shouldHookEventListener() from config
    // Create evidence for monitored events
  }
  
  private createHookedAddEventListener()
  private shouldMonitorEvent(target: any, eventType: string): boolean
  restore(): void // For cleanup
}
```

#### **`src/injected/hooks/property-getter-hooks.ts`**
**Purpose**: Property getter monitoring (value, nodeValue, etc.)
```typescript
class PropertyGetterHooks {
  private originalGetters: Map<string, PropertyDescriptor> = new Map();
  
  constructor(evidenceCollector: EvidenceCollector, elementRegistry: ElementRegistry)
  
  install(): void {
    // Hook HTMLInputElement.prototype.value
    // Hook HTMLSelectElement.prototype.value  
    // Hook HTMLTextAreaElement.prototype.value
    // Hook nodeValue getters
  }
  
  private installPropertyGetter(
    prototype: any, 
    propertyName: string,
    elementType: string
  ): void
  
  private createHookedGetter(original: Function, propertyName: string, elementType: string)
  restore(): void
}
```

#### **`src/injected/hooks/event-handler-hooks.ts`**
**Purpose**: Event handler property setters (onkeydown, oninput, etc.)
```typescript
class EventHandlerHooks {
  private originalSetters: Map<string, PropertyDescriptor> = new Map();
  
  constructor(evidenceCollector: EvidenceCollector, elementRegistry: ElementRegistry)
  
  install(): void {
    // Hook onkeydown, onkeypress, onkeyup, oninput, onchange setters
    // Monitor both form elements and global (window, document)
  }
  
  private installEventHandlerSetter(
    prototype: any,
    handlerName: string,
    targetType: string
  ): void
  
  private createHookedSetter(original: Function, handlerName: string, targetType: string)
  restore(): void
}
```

#### **`src/injected/utils/stack-trace.ts`**
**Purpose**: Stack trace capture and formatting
```typescript
class StackTrace {
  static capture(): string[] {
    // Capture new Error().stack
    // Parse and format as "URL:line:col [funcName]"
    // Handle minified code, source maps if available
    // Filter out extension frames
  }
  
  static parseStackFrame(frame: string): {
    url: string;
    line: number; 
    column: number;
    functionName?: string;
  } | null
  
  static formatFrame(parsed: any): string // Format to Explorer style
  private static cleanStackTrace(frames: string[]): string[]
}
```

#### **`src/injected/utils/dom-observer.ts`**
**Purpose**: Dynamic content monitoring
```typescript
class DOMObserver {
  private observer: MutationObserver | null = null;
  
  constructor(private hookManager: HookManager)
  
  start(): void {
    // Set up MutationObserver on document.body
    // Monitor childList, subtree changes
    // Process new form elements
  }
  
  private handleMutations(mutations: MutationRecord[]): void
  private processNewElement(element: Element): void
  private isFormElement(element: Element): boolean
  stop(): void
  restart(): void
}
```

#### **`src/injected/utils/error-logger.ts`**  
**Purpose**: Comprehensive error handling and reporting
```typescript
class ErrorLogger {
  static logError(context: string, error: Error, additionalInfo?: any): void {
    // Format error report
    // Send to content script for background relay
    // Console logging for development
  }
  
  static logHookFailure(hookType: string, target: string, error: Error): void
  static logCommunicationFailure(message: any, error: Error): void
  private static createErrorReport(context: string, error: Error, info?: any): any
}
```

### Content Script Integration Changes

#### **Updates to `src/content.ts`**
```typescript
// Add to HUD constructor
private setupInjectedScriptCommunication(): void {
  // Listen for injected script messages
  window.addEventListener('message', this.handleInjectedMessage.bind(this));
  
  // Send ready signal to injected script  
  window.postMessage({ type: 'CONTENT_SCRIPT_READY' }, '*');
  
  // Inject the script into page
  this.injectScript();
}

private handleInjectedMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  
  switch (event.data.type) {
    case 'EVIDENCE_EVENT':
      chrome.runtime.sendMessage({
        type: 'EVIDENCE_EVENT',
        event: event.data.event
      });
      break;
    case 'ERROR_REPORT':
      this.handleInjectedError(event.data.report);
      break;
  }
}

private injectScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}
```

---
*Created: 2025-09-04*
*Last Updated: 2025-09-04*