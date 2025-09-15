# Iframe Input Hooking Fix - Technical Decisions

## Problem Description

When recording was active and a new iframe was opened, input elements within that iframe were not being hooked initially. The surveillance hooks would only start working after stopping and restarting the recording. This caused inputs to be missed during the critical initial phase when an iframe loads.

## Root Cause Analysis

Through investigation, we identified multiple interconnected issues:

### 1. Content Security Policy (CSP) Violations
- **Issue**: The extension was injecting inline configuration via `window.__SURVEILLANCE_CONFIG__` as a script tag
- **Impact**: Pages with strict CSP policies (which block `unsafe-inline`) would reject the config injection
- **Evidence**: Console error showing CSP violation: "Refused to execute inline script"

### 2. DOM Timing Issues
- **Issue**: At `document_start`, `document.head` and `document.documentElement` can be null in fresh iframes
- **Impact**: `appendChild()` calls would throw `TypeError: Cannot read properties of null`
- **Evidence**: Console error showing null property access on `appendChild`

### 3. Frame Inclusion Gaps
- **Issue**: Content script wasn't configured to run in `about:blank` and `srcdoc` iframes
- **Impact**: Many dynamically created iframes use these URL schemes and wouldn't get the extension

### 4. State Synchronization Race Conditions
- **Issue**: New iframes might miss the initial `GET_STATUS` response from background script
- **Impact**: Hooks would install with default `recording=false` state until manually toggled

### 5. Message Listener Timing
- **Issue**: In the injected script, hooks were installed before message listeners were set up
- **Impact**: State sync messages from content script could be missed during initialization

## Solution Implementation

### 1. Eliminate CSP Violations
**Decision**: Remove inline configuration injection entirely
- **Implementation**: Removed `window.__SURVEILLANCE_CONFIG__` approach
- **Alternative**: Use `postMessage` communication between content script and injected script
- **Benefits**: No CSP violations, more robust inter-context communication

### 2. Safe DOM Injection
**Decision**: Wait for DOM root elements before script injection
- **Implementation**: Added `waitForDOMRoot()` function that polls for `document.documentElement`
- **Fallback**: Maximum wait time with error handling
- **Benefits**: Prevents null pointer exceptions in fresh iframes

### 3. Comprehensive Frame Coverage  
**Decision**: Add `"match_about_blank": true` to manifest
- **Implementation**: Updated `manifest.json` content script configuration
- **Coverage**: Now includes `about:blank`, `srcdoc`, and other special iframe types
- **Benefits**: Hooks work in dynamically created iframes

### 4. Proactive State Synchronization
**Decision**: Implement immediate state resync after injected script signals ready
- **Implementation**: Added `resyncStateFromBackground()` function
- **Timing**: Called immediately when injected script posts "SURVEILLANCE_READY"
- **Content**: Sends current recording state, mode, and filters
- **Benefits**: Eliminates race conditions, ensures correct initial state

### 5. Correct Message Listener Order
**Decision**: Set up message listeners before signaling ready
- **Implementation**: In `main.ts`, moved `setupContentScriptListener()` before `notifyReady()`
- **Logic**: Listeners must be ready before announcing availability
- **Benefits**: No missed messages during initialization

## Technical Implementation Details

### Content Script Changes (`src/content.ts`)
```typescript
// Safe injection with DOM waiting
async function waitForDOMRoot(timeout = 5000): Promise<void> {
  // Polling implementation for document.documentElement
}

// Immediate state resync after injected script ready
function resyncStateFromBackground(): void {
  // Send current state via postMessage
}
```

### Injected Script Changes (`src/injected/main.ts`)
```typescript
// Message listener setup BEFORE ready signal
function initialize(): void {
  setupContentScriptListener(); // First
  installAllHooks();           // Then hooks
  notifyReady();              // Finally signal ready
}
```

### Manifest Changes (`public/manifest.json`)
```json
{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "all_frames": true,
    "match_about_blank": true,  // Added this
    "run_at": "document_start"
  }]
}
```

## Validation and Testing

### Expected Behavior After Fix
1. **New iframe opens**: Content script injects immediately (even in `about:blank`)
2. **DOM safety**: No null pointer exceptions during injection
3. **CSP compliance**: No inline script violations
4. **Immediate hooking**: Input hooks are active from the moment iframe loads
5. **State accuracy**: Recording state is synchronized immediately, no toggle required

### Test Scenarios
- Regular HTTP/HTTPS iframes
- `about:blank` iframes  
- `srcdoc` iframes
- Pages with strict CSP policies
- Rapid iframe creation/destruction
- Recording state changes during iframe lifecycle

## Risk Assessment and Mitigation

### Risks Identified
- **Performance**: Additional DOM polling could impact load times
- **Compatibility**: `match_about_blank` might have edge cases in some browsers
- **Message ordering**: Race conditions in rapid state changes

### Mitigation Strategies
- **Bounded polling**: 5-second timeout with exponential backoff
- **Graceful fallbacks**: Error handling for all injection steps
- **Atomic operations**: State updates are batched to prevent partial states

## Future Considerations

1. **Monitoring**: Add telemetry to track injection success rates across frame types
2. **Optimization**: Consider using MutationObserver for DOM readiness detection
3. **Extension**: Pattern could be applied to other dynamic content scenarios
4. **Testing**: Automated tests for various iframe creation patterns

This fix ensures reliable input surveillance across all frame types while maintaining security compliance and performance standards.