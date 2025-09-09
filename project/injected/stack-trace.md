# Stack Trace Utility (stack-trace.ts)

## Overview
The StackTrace utility class captures and formats JavaScript call stacks to provide forensic evidence of surveillance activities. It transforms raw browser stack traces into Explorer-compatible format, enabling precise identification of scripts performing surveillance actions on form inputs.

## Core Functionality

### Purpose
When surveillance scripts interact with form elements (reading values, attaching listeners), we need to capture the exact call chain to identify which scripts are responsible. The stack trace provides a forensic trail showing the complete execution path from the surveillance action back to its origin.

### Evidence Integration
Every evidence event includes a `stackTrace` array showing the call chain:
```json
{
  "actionId": "abc123",
  "type": "input.value/get",
  "target": { "id": "element123" },
  "stackTrace": [
    "https://cdn.tracker.com/spy.js:45:12 [readInputValue]",
    "https://cdn.tracker.com/main.js:234:8 [collectData]",
    "https://malicious-site.com/script.js:67:3 [harvestForms]"
  ]
}
```

This shows that a script at `harvestForms` called `collectData` which called `readInputValue` to access the input.

## Key Design Decisions

### 1. Stack Capture Method - Error().stack
**Decision**: Use `new Error().stack` for stack capture
**Reasoning**:
- Most reliable cross-browser method
- Captures complete call chain at exact moment
- No side effects (unlike `console.trace()`)
- Available in all modern browsers
- Synchronous operation - no async complications

**Alternative Considered**: `console.trace()` - rejected due to console output and limited access to stack data

### 2. Explorer Format Compatibility
**Decision**: Match Explorer's exact format: `"URL:line:col [functionName]"`
**Examples**:
```
"https://site.com/script.js:45:12 [myFunction]"     // Named function
"https://site.com/script.js:67:8"                  // Anonymous function
"https://cdn.tracker.com/spy.js:123:45 [collectData]"  // Third-party script
```

**Benefits**:
- Direct comparison with Explorer evidence
- Consistent forensic format across tools
- Clear identification of script source and location
- Function name context when available

### 3. Extension Frame Filtering - Security Hygiene
**Decision**: Remove all extension-related frames from stack traces
**Filtered Patterns**:
- `chrome-extension://`
- `moz-extension://`
- `webkit-masked-url://`

**Before Filtering**:
```javascript
"stackTrace": [
  "chrome-extension://abc123/injected.js:45:12 [hookedAddEventListener]",  // Internal
  "chrome-extension://abc123/injected.js:67:8 [captureEvidence]",          // Internal
  "https://malicious-site.com/tracker.js:23:45 [attachSpyware]",           // Target!
  "https://malicious-site.com/main.js:100:12 [setupTracking]"              // Target!
]
```

**After Filtering**:
```javascript
"stackTrace": [
  "https://malicious-site.com/tracker.js:23:45 [attachSpyware]",
  "https://malicious-site.com/main.js:100:12 [setupTracking]"
]
```

**Reasoning**:
- Focus on actual surveillance scripts, not detection mechanism
- Cleaner evidence for analysis
- Prevents confusion about extension vs. page script activity
- Reduces noise in forensic output

### 4. Anonymous Function Handling
**Decision**: Skip meaningless anonymous indicators, show meaningful names only
**Anonymous Patterns Ignored**:
- `<anonymous>`
- `Object.<anonymous>`
- `anonymous`

**Format Rules**:
```javascript
// Stack shows: "at myFunction (https://site.com/script.js:45:12)"
// Output: "https://site.com/script.js:45:12 [myFunction]"

// Stack shows: "at <anonymous> (https://site.com/script.js:45:12)" 
// Output: "https://site.com/script.js:45:12"

// Stack shows: "at https://site.com/script.js:45:12"
// Output: "https://site.com/script.js:45:12"
```

**Reasoning**:
- Anonymous indicators add no forensic value
- Meaningful function names provide context for analysis
- Consistent formatting regardless of minification
- Cleaner evidence output

### 5. Robust Error Handling - Never Break Evidence
**Decision**: Always return usable result, never throw exceptions
**Error Scenarios & Responses**:

#### Stack Capture Failure
```javascript
// If new Error().stack fails or returns null/undefined
return ['[STACK_TRACE_CAPTURE_FAILED]'];
```

#### Parse Failure  
```javascript
// If stack string parsing encounters unexpected format
return ['[STACK_TRACE_PARSE_FAILED]'];
```

#### No Valid Frames
```javascript
// If all frames filtered out (only extension frames)
return ['[NO_VALID_STACK_FRAMES]'];
```

**Reasoning**:
- Stack traces are critical for surveillance detection
- Evidence collection must never break due to stack trace issues
- Error indicators provide debugging information
- Maintains evidence completeness even during failures

## Technical Implementation

### Stack Frame Parsing Strategy
The utility handles multiple browser stack trace formats through pattern matching:

#### Pattern 1: Named Function
```javascript
// Input: "at functionName (https://site.com/script.js:45:12)"
// Regex: /^(.+?)\s+\((.+?):(\d+):(\d+)\)$/
// Output: { url: "https://site.com/script.js", line: 45, column: 12, functionName: "functionName" }
```

#### Pattern 2: Anonymous Function
```javascript
// Input: "at https://site.com/script.js:45:12"  
// Regex: /^(.+?):(\d+):(\d+)$/
// Output: { url: "https://site.com/script.js", line: 45, column: 12 }
```

#### Pattern 3: Eval Context
```javascript
// Input: "at functionName (eval at evalFunction (https://site.com/script.js:45:12))"
// Output: { url: "https://site.com/script.js", line: 45, column: 12, functionName: "functionName [eval]" }
```

### Frame Filtering Logic
1. **Extension Filter**: Remove frames with extension URL patterns
2. **URL Validation**: Only include HTTP/HTTPS/file:// URLs
3. **Anonymous Filter**: Remove meaningless function name patterns
4. **Format Validation**: Ensure line/column numbers are valid integers

### Performance Considerations
- **Lazy Processing**: Parse frames only as needed during filtering
- **Early Exit**: Stop processing once sufficient frames found
- **Minimal Regex**: Simple patterns for fast matching
- **Error Isolation**: Individual frame parse failures don't break entire capture

## Browser Compatibility

### Stack Trace Format Variations
Different browsers produce slightly different stack trace formats:

#### Chrome/Edge
```
Error
    at functionName (https://site.com/script.js:45:12)
    at https://site.com/script.js:67:8
```

#### Firefox  
```
functionName@https://site.com/script.js:45:12
@https://site.com/script.js:67:8
```

#### Safari
```
functionName@https://site.com/script.js:45:12
global code@https://site.com/script.js:67:8
```

### Cross-Browser Handling
The utility normalizes all formats to consistent output:
- Handles different "at" prefixes and separators
- Accommodates various anonymous function indicators
- Processes different URL extraction patterns
- Maintains consistent line/column number parsing

## Integration with Evidence System

### Usage in Hook Classes
```typescript
// In addEventListener hook
const originalAddEventListener = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function(type, listener, options) {
  if (shouldMonitorEvent(this, type)) {
    const evidence = {
      actionId: generateId(),
      type: generateEvidenceType(this, type, 'addEventListener'),
      target: { id: elementRegistry.getElementId(this) },
      stackTrace: StackTrace.capture(),  // ← Capture current call stack
      start: performance.now(),
      duration: 0,
      data: getElementData(this)
    };
    sendEvidence(evidence);
  }
  return originalAddEventListener.call(this, type, listener, options);
};
```

### Stack Trace Quality Factors
- **Call Depth**: Typically captures 5-15 frames depending on page complexity
- **Script Sources**: Mix of first-party, third-party, and CDN scripts
- **Function Context**: Meaningful names in non-minified code, generic names in minified code
- **URL Information**: Complete source file paths for debugging

## Debugging and Troubleshooting

### Debug Output
The utility provides console logging for development:
```javascript
console.debug(`[StackTrace] Captured ${frames.length} frames for context: ${context}`);
console.error('[StackTrace] Failed to capture stack trace:', error);
```

### Common Issues and Solutions

#### Issue: Empty Stack Traces
**Symptoms**: Evidence shows `[NO_VALID_STACK_FRAMES]`
**Causes**: All frames are extension frames (shouldn't happen with proper filtering)
**Solution**: Review extension frame filtering patterns

#### Issue: Parse Failures
**Symptoms**: Evidence shows `[STACK_TRACE_PARSE_FAILED]`
**Causes**: Unexpected browser stack trace format
**Solution**: Add new parsing pattern for the browser/scenario

#### Issue: Missing Function Names
**Symptoms**: All frames show URL only, no `[functionName]`
**Causes**: Minified code, anonymous functions, strict mode
**Solution**: Expected behavior - focus on URL and line information

### Testing Stack Traces
```javascript
// Test utility method
const frames = StackTrace.captureWithContext('addEventListener hook');
// Logs frame count and context for debugging
```

## Security Considerations

### Information Disclosure
- **Extension Filtering**: Prevents leaking extension internal structure
- **Clean Output**: Only shows page script information relevant to surveillance
- **Error Boundaries**: Failures don't expose extension implementation details

### Privacy Protection  
- **No User Data**: Stack traces contain only script URLs and function names
- **Source Focus**: Identifies surveillance scripts without exposing user input content
- **Minimal Footprint**: Only captures what's needed for evidence analysis

## Future Enhancement Opportunities

### Advanced Features
- **Source Map Integration**: Resolve minified stack traces to original source locations
- **Function Signature Detection**: Enhanced function name extraction from minified code
- **Call Chain Analysis**: Detect common surveillance patterns across stack traces
- **Performance Optimization**: Batch stack trace processing for high-frequency events

### Integration Improvements
- **Evidence Correlation**: Link similar stack traces across different evidence events
- **Script Classification**: Automatically categorize first-party vs. third-party surveillance
- **Pattern Recognition**: Identify known surveillance frameworks and techniques

---
*Created: 2025-09-04*
*Last Updated: 2025-09-04*