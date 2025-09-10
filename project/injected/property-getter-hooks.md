# Property Getter Hooks (property-getter-hooks.ts)

## Overview
The PropertyGetterHooks class intercepts property getter calls on form elements to detect surveillance scripts that read user input values. It monitors access to properties like `input.value`, `textarea.value`, and `nodeValue` to identify when scripts are stealing user data without explicit user action.

## Core Functionality

### Purpose
When surveillance scripts access form element properties to read user input, the hook:
1. **Intercepts the property getter call** before it executes
2. **Determines if it should be monitored** based on evidence configuration
3. **Creates evidence** for suspicious data access patterns
4. **Always returns the original value** (invisible surveillance detection)

### Surveillance Detection Patterns
```javascript
// Form value access surveillance (monitored)
let password = document.getElementById('password').value;        // ← Detect this
let email = inputElement.value;                                 // ← Detect this
let message = document.querySelector('textarea').value;         // ← Detect this
let selection = selectElement.value;                           // ← Detect this

// Text node content access (monitored)
let textContent = textNode.nodeValue;                          // ← Detect this

// Non-surveillance access (ignored - same origin, user action, etc.)
// Normal form processing, validation, frameworks
```

## Key Design Decisions

### 1. Property Selection - Form Elements + Node Content
**Decision**: Monitor specific high-value properties for data theft detection
**Properties Monitored**:
```typescript
// From evidence-config.ts
propertyGetters: ['value', 'nodeValue']

// Applied to these element types:
- HTMLInputElement.value    // All input types (password, email, text, etc.)
- HTMLTextAreaElement.value // Multi-line text input
- HTMLSelectElement.value   // Dropdown/option selections  
- Node.nodeValue           // Direct text content access
```

**Why These Properties**:
- **`value` properties**: Primary target for form data theft
- **`nodeValue`**: Direct text content access bypass
- **High signal-to-noise**: These are primarily accessed for data extraction
- **Explorer compatibility**: Matches surveillance patterns detected by Explorer

### 2. Implementation Method - Property Descriptor Replacement
**Decision**: Use `Object.defineProperty()` to replace property getters
**Implementation**:
```typescript
// Get original property descriptor
const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

// Replace with monitored version
Object.defineProperty(HTMLInputElement.prototype, 'value', {
  get: function() {
    // Monitor access for surveillance
    monitorPropertyAccess(this, 'value');
    
    // Always return original value
    return originalDescriptor.get.call(this);
  },
  set: originalDescriptor.set, // Preserve original setter
  configurable: true,
  enumerable: originalDescriptor.enumerable
});
```

**Why Property Descriptors**:
- ✅ **Reliable cross-browser** - Standard approach works everywhere
- ✅ **Preserves original behavior** - Maintains exact native functionality
- ✅ **Clean integration** - No prototype pollution or method conflicts
- ✅ **Performance** - Direct property access, no function call overhead

**Alternative Rejected**: Direct prototype modification (`__lookupGetter__`) - deprecated and unreliable

### 3. Single Class Architecture - Unified Hook Management
**Decision**: One class handles all property getter hooks
**Structure**:
```typescript
class PropertyGetterHooks {
  install(): void {
    this.installValuePropertyHooks();  // input.value, textarea.value, select.value
    this.installNodeValueHook();       // Node.nodeValue
  }
  
  private installValuePropertyHooks(): void {
    this.installPropertyHook(HTMLInputElement.prototype, 'value');
    this.installPropertyHook(HTMLTextAreaElement.prototype, 'value');
    this.installPropertyHook(HTMLSelectElement.prototype, 'value');
  }
}
```

**Benefits**:
- ✅ **Centralized management** - All property hooks in one place
- ✅ **Consistent error handling** - Unified approach across all properties
- ✅ **HookManager integration** - Single hook to coordinate
- ✅ **Simplified testing** - One hook to install/test

**Alternative Rejected**: Separate hook classes per property - unnecessary complexity for similar functionality

### 4. Privacy-First Evidence Strategy
**Decision**: Capture surveillance detection, NOT actual user data
**What We Capture**:
```typescript
// Evidence created for: let password = inputElement.value;
{
  type: "input.value/get",           // ← Property access type
  target: { id: "element123" },     // ← Element identifier
  stackTrace: ["script.js:45", ...], // ← Call chain
  data: "password-input"            // ← Element description, NOT password value
}
```

**What We DON'T Capture**:
- ❌ **Actual input values** - Never capture user passwords, emails, etc.
- ❌ **Input content** - No access to what user typed
- ❌ **Sensitive data** - Only surveillance patterns, not data itself

**Why Privacy-First**:
- ✅ **User trust** - Extension never sees sensitive data
- ✅ **Security** - No risk of data leakage from extension
- ✅ **Compliance** - Meets privacy regulations
- ✅ **Focus** - Detect surveillance, not collect data

### 5. Critical Path Protection - Never Break Property Access
**Decision**: Property access is mission-critical - errors must never break getters
**Error Handling Strategy**:
```typescript
get: function() {
  try {
    // Monitor access (can fail silently)
    monitorPropertyAccess(this, 'value');
  } catch (error) {
    // Log but NEVER throw - property access must always work
    console.error('[PropertyGetterHook] Monitoring failed:', error);
  }
  
  // CRITICAL: Always return the original value
  return originalGetter.call(this);
}
```

**Error Categories**:
- **Evidence Creation Errors**: Log and continue - individual evidence lost but detection continues
- **Hook Installation Errors**: Fail fast during startup - if we can't hook, we can't detect
- **Property Access Errors**: Never happen - getter must always work

**Why Critical Protection**:
- ✅ **Page never breaks** - Users can always access form values
- ✅ **Form functionality preserved** - Login, checkout, etc. always work
- ✅ **Silent operation** - Extension presence never detected
- ✅ **Graceful degradation** - Partial failures don't stop surveillance detection

### 6. Node.nodeValue Handling - Parent Element Association
**Decision**: Handle Node.nodeValue by finding parent Element for evidence
**Challenge**: `Node.nodeValue` can be called on text nodes that aren't Elements
**Solution**:
```typescript
private monitorPropertyAccess(target: any, propertyName: string): void {
  if (target instanceof Element) {
    // Direct element access - standard evidence creation
    this.evidenceCollector.createAndSendEvidence(target, propertyName, 'property');
  } 
  else if (target instanceof Node && propertyName === 'nodeValue') {
    // Text node access - find parent element for evidence
    const parentElement = this.findParentElement(target);
    if (parentElement) {
      this.evidenceCollector.createAndSendEvidence(parentElement, 'nodeValue', 'property');
    }
  }
}
```

**Why Parent Element Association**:
- ✅ **Consistent evidence format** - All evidence references Elements
- ✅ **ElementRegistry compatibility** - Can assign stable IDs
- ✅ **Meaningful context** - Shows which form element's content was accessed
- ✅ **Deduplication works** - Same parent element gets same deduplication key

### 7. Restoration Strategy - Simplified Lifecycle
**Decision**: Implement property descriptor restoration for clean uninstalls
**Storage Approach**:
```typescript
interface OriginalPropertyDescriptor {
  descriptor: PropertyDescriptor;
  target: any;
  propertyName: string;
}

private originalDescriptors: OriginalPropertyDescriptor[] = [];
```

**Restoration Process**:
```typescript
uninstall(): void {
  for (const original of this.originalDescriptors) {
    Object.defineProperty(original.target, original.propertyName, original.descriptor);
  }
  this.originalDescriptors = [];
}
```

**When Restoration Happens**:
- **Extension disable/reload** - Clean uninstall prevents broken property access
- **Testing scenarios** - Multiple install/uninstall cycles during development
- **Error recovery** - Fallback to clean state if problems occur

**Benefits**:
- ✅ **Clean extension lifecycle** - Pages work normally after extension disable
- ✅ **Development-friendly** - Easy to test multiple scenarios
- ✅ **Error recovery** - Can restore to working state
- ✅ **Memory management** - Prevents references to dead extension code

## Technical Implementation Details

### Hook Installation Process
```typescript
// For each monitored property:
1. Get original property descriptor
2. Store original for restoration
3. Replace with monitored version that:
   - Calls monitoring function
   - Always returns original value
   - Preserves all original property characteristics
```

### Evidence Flow for Property Access
```
Property accessed → shouldMonitorPropertyAccess() → Create Evidence → Send to Collector
     ↓                        ↓                         ↓              ↓
input.value called    Check evidence config    Element ID +      Queue/Transmit
                                               Stack trace
```

### Deduplication Integration
The hook integrates with EvidenceCollector's deduplication system:
- **Deduplication Key**: `input.value/get:elementId:stackTrace`
- **Time Window**: 50ms for identical property access calls
- **Purpose**: Prevents noise from frameworks/validation that read properties repeatedly

### Performance Considerations
- **Hook Installation**: One-time cost during extension startup
- **Per-Access Overhead**: <0.1ms per property access (property descriptor call)
- **Memory Usage**: Minimal - only original descriptor storage
- **Critical Path**: Getter execution time unchanged (original getter called directly)

## Integration with Extension Architecture

### Relationship to Other Components
- **EvidenceCollector**: Receives evidence from hook, handles deduplication and transmission
- **ElementRegistry**: Accessed via EvidenceCollector for stable element IDs
- **StackTrace**: Automatically captured by EvidenceCollector for forensic context
- **Evidence Config**: Determines which property access calls to monitor

### Configuration Integration
```typescript
// From evidence-config.ts
shouldHookPropertyGetter(element: Element, propertyName: string): boolean {
  return isFormElement(element) && 
         EVIDENCE_CONFIG.formElements.propertyGetters.includes(propertyName);
}

// Applied to:
formElements: {
  elements: ['input', 'select', 'textarea'],
  propertyGetters: ['value', 'nodeValue']
}
```

### Usage in Main Coordinator
```typescript
class InjectedSurveillanceDetector {
  constructor() {
    this.evidenceCollector = new EvidenceCollector(this.elementRegistry);
    this.propertyGetterHooks = new PropertyGetterHooks(this.evidenceCollector);
  }
  
  start(): void {
    this.propertyGetterHooks.install();
  }
}
```

## Browser Compatibility

### Property Descriptor Support
- **Chrome/Edge**: ✅ Full support for Object.defineProperty on prototype
- **Firefox**: ✅ Full support 
- **Safari**: ✅ Full support
- **IE11**: ✅ Supported (if needed)

### Cross-Browser Considerations
- **Property Access Patterns**: Consistent across browsers
- **Descriptor Behavior**: Standard implementation across modern browsers
- **Restoration Process**: Reliable descriptor replacement support

## Security Considerations

### Privacy Protection
- **No Data Collection**: Never captures actual form values or user input
- **Surveillance Detection Only**: Only records that access occurred, not what was accessed
- **Stack Trace Filtering**: Extension frames removed from forensic data

### Stealth Operation
- **Invisible Detection**: Property access behavior unchanged from user perspective
- **No Side Effects**: Original property functionality completely preserved
- **Error Isolation**: Hook failures don't affect form functionality

### Data Minimization
- **Essential Evidence Only**: Captures minimum information needed for surveillance detection
- **No Content Storage**: No form data stored or transmitted
- **Ephemeral Detection**: Evidence created only when surveillance detected

## Testing Strategy

### Test Scenarios to Validate
1. **Form Value Access**: `input.value`, `textarea.value`, `select.value` detection
2. **Node Content Access**: `textNode.nodeValue` detection with parent element association
3. **Property Filtering**: Non-monitored properties ignored (e.g., `input.type`)
4. **Error Handling**: Property access continues working despite evidence creation failures
5. **Installation/Uninstallation**: Clean hook lifecycle management
6. **Performance**: Property access speed unchanged

### Evidence Validation
- **Deduplication**: Rapid repeated access properly deduplicated
- **Element Association**: All evidence correctly associated with form elements
- **Stack Traces**: Complete call chains captured for forensic analysis
- **Privacy**: No actual form values captured in evidence

## Future Enhancement Opportunities

### Advanced Features
- **Dynamic Property Detection**: Monitor additional properties based on threat intelligence
- **Framework Integration**: Enhanced compatibility with React, Vue, Angular property access patterns
- **Performance Optimization**: Selective monitoring based on element sensitivity
- **Cross-Frame Support**: Property access monitoring across iframe boundaries

### Privacy Enhancements
- **Differential Privacy**: Statistical privacy guarantees for evidence data
- **User Control**: Granular user control over which properties to monitor
- **Audit Trail**: Complete transparency about what surveillance is detected

### Integration Improvements
- **Real-Time Analysis**: Live surveillance pattern analysis during property access
- **Threat Correlation**: Link property access patterns across different elements
- **Behavioral Analysis**: Detect unusual property access patterns indicating automation

---
*Created: 2025-09-09*  
*Last Updated: 2025-09-09*  
*Status: ✅ Implemented and Ready for Testing*