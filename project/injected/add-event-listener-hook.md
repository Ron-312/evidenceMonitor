# AddEventListener Hook (addEventListener-hook.ts)

## Overview
The AddEventListenerHook class intercepts all `EventTarget.addEventListener` calls to detect surveillance scripts that monitor user input events. It distinguishes between legitimate event handling and suspicious surveillance patterns by monitoring specific event types on form elements and global objects.

## Core Functionality

### Purpose
When surveillance scripts attach event listeners to form inputs or global objects to capture user typing, the hook:
1. **Intercepts the addEventListener call** before it executes
2. **Determines if it should be monitored** based on evidence configuration
3. **Creates evidence** for suspicious surveillance patterns
4. **Always allows the original call** to proceed (invisible surveillance detection)

### Surveillance Detection Patterns
```javascript
// Form element surveillance (monitored)
document.getElementById('password').addEventListener('keydown', captureKeys);
document.querySelector('input[type="email"]').addEventListener('input', logInput);

// Global surveillance (monitored)  
window.addEventListener('keydown', globalKeylogger);
document.addEventListener('keypress', documentKeylogger);

// Non-surveillance events (ignored)
button.addEventListener('click', handleClick);  // Not monitored
window.addEventListener('resize', handleResize); // Not monitored
```

## Key Design Decisions

### 1. Dual Target Support - Elements + Global Objects
**Decision**: Handle both DOM Elements AND global objects (window, document)
**Implementation**:
```typescript
// DOM Elements: Direct evidence creation
if (target instanceof Element) {
  this.evidenceCollector.createAndSendEvidence(target, eventType, 'addEventListener');
}

// Global Objects: Synthetic element creation
if (this.isGlobalObject(target)) {
  const syntheticElement = this.createSyntheticElementForGlobal(target);
  this.evidenceCollector.createAndSendEvidence(syntheticElement, eventType, 'addEventListener');
}
```

**Reasoning**:
- **Form Elements**: Direct surveillance of specific inputs (targeted attacks)
- **Global Objects**: Keylogger-style surveillance catching ALL page typing
- **Unified Evidence Format**: Synthetic elements allow consistent evidence structure

### 2. Synthetic Element Strategy for Global Objects
**Decision**: Create fake DOM elements to represent window/document in evidence
**Implementation**:
```typescript
// For window.addEventListener('keydown', handler)
<div data-synthetic-target="window" id="synthetic-window-target"></div>

// For document.addEventListener('keyup', handler)  
<div data-synthetic-target="document" id="synthetic-document-target"></div>
```

**Benefits**:
- **Consistent Evidence Format**: All evidence uses Element-based structure
- **Clear Identification**: Synthetic attributes distinguish global vs. element surveillance
- **ElementRegistry Compatibility**: Global objects get stable IDs like regular elements
- **Export Compatibility**: Evidence exports work uniformly across all surveillance types

### 3. Configuration-Driven Filtering
**Decision**: Use evidence-config.ts to determine what to monitor
**Form Elements Monitored**:
```typescript
formElements: {
  elements: ['input', 'select', 'textarea'],
  eventListeners: ['keydown', 'keypress', 'keyup', 'input', 'change']
}
```

**Global Elements Monitored**:
```typescript  
globalElements: {
  elements: ['window', 'document'],
  eventListeners: ['keydown', 'keypress', 'keyup']
}
```

**Filtering Logic**:
```typescript
private shouldMonitorTarget(target: EventTarget, eventType: string): boolean {
  // Uses shouldHookEventListener() which handles both form and global elements
  return shouldHookEventListener(target, eventType);
}
```

**Reasoning**:
- **Focused Detection**: Only monitor surveillance-relevant event types
- **Performance**: Skip processing for non-surveillance events (click, scroll, resize)
- **Maintainability**: Configuration changes don't require code changes
- **Explorer Alignment**: Matches surveillance patterns detected by Explorer tool

### 4. Error Handling Philosophy - Never Break the Page
**Decision**: Log all errors but continue silently, never throw exceptions
**Implementation Strategy**:
```typescript
// Evidence creation errors
catch (error) {
  console.error(`[addEventListener] Error during surveillance monitoring:`, error, {
    context: { targetType, eventType, hasListener: !!listener }
  });
  // Continue silently - never break the page
}

// Hook installation errors  
catch (error) {
  console.error(`[addEventListener] Failed to install hook:`, error);
  throw error; // Hook installation failure should be fatal
}
```

**Error Categories**:
- **Evidence Creation Errors**: Continue silently (individual evidence lost but detection continues)
- **Hook Installation Errors**: Fatal (entire surveillance detection broken)
- **Uninstall Errors**: Continue with cleanup (mark as uninstalled anyway)

**Logging Format**:
```typescript
console.error(`[${this.name}] Operation failed:`, error, {
  context: { relevant: 'debugging', info: 'here' }
});
```

### 5. Hook Interface Implementation
**Decision**: Implement standardized hook interface for HookManager compatibility
**Interface Requirements**:
```typescript
interface Hook {
  readonly name: string;        // 'addEventListener'
  install(): void;             // Install surveillance detection
  uninstall(): void;           // Remove surveillance detection  
  isInstalled(): boolean;      // Check installation status
}
```

**State Management**:
```typescript
private isHookInstalled: boolean = false;

install(): void {
  if (this.isHookInstalled) {
    console.warn(`[${this.name}] Hook already installed, skipping`);
    return;
  }
  // ... perform installation
  this.isHookInstalled = true;
}
```

**Benefits**:
- **HookManager Integration**: Enables centralized hook coordination
- **Idempotent Operations**: Multiple install() calls are safe
- **Status Tracking**: Can verify hook status programmatically
- **Error Prevention**: Prevents duplicate installations

## Technical Implementation Details

### Hook Installation Process
```typescript
EventTarget.prototype.addEventListener = function(type, listener, options) {
  // 1. Monitor this call for surveillance
  self.monitorAddEventListenerCall(this, type, listener, options);
  
  // 2. Always execute original call
  return self.originalAddEventListener.call(this, type, listener, options);
};
```

### Evidence Flow
```
addEventListener called → shouldMonitorTarget() → Create Evidence → Send to Collector
     ↓                           ↓                    ↓              ↓
Form/Global element?    Check evidence config    Element ID +    Queue/Transmit
                                                 Stack trace
```

### Deduplication Integration
The hook integrates with EvidenceCollector's deduplication system:
- **Deduplication Key**: `addEventListener/keydown:elementId:stackTrace`
- **Time Window**: 50ms for identical surveillance calls
- **Purpose**: Prevents noise from frameworks making repeated identical calls

## Integration with Extension Architecture

### Relationship to Other Components
- **EvidenceCollector**: Receives evidence from hook, handles deduplication and transmission
- **ElementRegistry**: Accessed via EvidenceCollector for stable element IDs
- **StackTrace**: Automatically captured by EvidenceCollector for forensic context
- **Evidence Config**: Determines which addEventListener calls to monitor

### Usage in Main Coordinator
```typescript
class InjectedSurveillanceDetector {
  constructor() {
    this.elementRegistry = new ElementRegistry();
    this.evidenceCollector = new EvidenceCollector(this.elementRegistry);
    this.addEventListenerHook = new AddEventListenerHook(this.evidenceCollector);
  }
  
  start(): void {
    this.addEventListenerHook.install();
  }
}
```

## Testing and Validation

### Test Scenarios Successfully Validated
1. **Form Element Detection**: ✅ `input.addEventListener('keydown')` creates evidence
2. **Global Object Detection**: ✅ `window.addEventListener('keydown')` creates evidence  
3. **Event Filtering**: ✅ `window.addEventListener('click')` ignored (not monitored)
4. **Hook Interface**: ✅ `isInstalled()`, `install()`, `uninstall()` work correctly
5. **Error Handling**: ✅ Continues silently on evidence creation errors

### Evidence Output Validation
- **Deduplication Working**: `deduplicationEntries: 20` shows evidence created and deduplicated
- **Element Tracking**: `totalElements: 19` shows form elements being tracked
- **Communication Pipeline**: Evidence flows through to background script successfully

### Performance Characteristics
- **Hook Installation**: <1ms one-time cost
- **Per-Call Overhead**: <0.1ms per addEventListener call
- **Memory Usage**: Minimal - only references to original methods
- **Deduplication**: Prevents evidence spam from repeated identical calls

## Security Considerations

### Information Disclosure Prevention
- **No User Data**: Hook captures surveillance patterns, not actual user input
- **Stack Trace Filtering**: Extension frames removed from forensic traces
- **Clean Evidence**: Only surveillance-relevant information captured

### Stealth Operation
- **Invisible Detection**: Page functionality unchanged, surveillance undetectable
- **Error Isolation**: Hook failures don't break page or reveal extension presence
- **Native API Behavior**: Original addEventListener functionality preserved exactly

## Future Enhancement Opportunities

### Advanced Features (Phase 3+)
- **Cross-Frame Detection**: Monitor addEventListener calls in iframes
- **Performance Monitoring**: Track hook execution time and frequency
- **Pattern Recognition**: Detect common surveillance frameworks by call patterns
- **Advanced Filtering**: Dynamic configuration based on detected threats

### Integration Improvements
- **HookManager Coordination**: Centralized installation with other hooks
- **Real-Time Analysis**: Live surveillance pattern detection
- **Enhanced Logging**: Configurable debug levels for different environments

## Browser Compatibility

### Tested Browsers
- **Chrome**: ✅ Full compatibility with EventTarget.prototype modification
- **Edge**: ✅ Same Chromium engine as Chrome
- **Firefox**: Expected compatibility (not yet tested)
- **Safari**: Expected compatibility (not yet tested)

### Cross-Browser Considerations
- **Prototype Modification**: All modern browsers support EventTarget.prototype replacement
- **Stack Trace Format**: StackTrace utility handles browser-specific stack formats
- **Console Logging**: Standard console.error/debug APIs used throughout

---
*Created: 2025-09-09*  
*Last Updated: 2025-09-09*  
*Status: ✅ Complete and Tested*