# Recording Modes Implementation

## Overview
This document details the implementation of recording modes for the Input Evidence Chrome Extension - specifically the addition of "console logging" and "breakpoint debugging" modes to complement the existing "export to file" functionality.

## Problem Statement
The extension originally only supported exporting evidence data to files after recording was complete. For development and debugging purposes, we needed real-time feedback when surveillance is detected:

1. **Console Mode**: Log surveillance events immediately to browser console with detailed context
2. **Breakpoint Mode**: Trigger debugger statements in the malicious script's execution context

## Architecture Decisions

### 1. State Storage Location
**Decision**: Store recording mode in `TabData` interface in background.ts
**Rationale**: 
- Consistent with existing `recording: boolean` state pattern
- Maintains per-tab recording preferences
- Centralized state management in background service worker

**Implementation**:
```typescript
interface TabData {
  events: EvidenceEvent[];
  recording: boolean;
  recordingMode: 'console' | 'breakpoint'; // Added
  domain: string;
  createdAt: number;
}
```

### 2. Mode Communication Flow
**Decision**: Pass mode from background → content script → injected script when recording starts
**Rationale**:
- Mode only needs to be set when recording begins
- Avoids constant mode checking during evidence capture
- Clean separation of concerns

**Implementation Flow**:
1. Background script sends `SET_RECORDING_MODE` message to content script
2. Content script forwards via `window.postMessage()` to injected script
3. Injected script stores mode locally for hook usage

### 3. Console Logging Location
**Decision**: Implement console logging in evidence-collector.ts
**Rationale**:
- Evidence collector has full context (element, action, stack trace)
- Centralized logging logic
- Doesn't interrupt execution flow
- Rich formatting with grouped console output

**Implementation**:
```typescript
// In evidence-collector.ts - createAndSendEvidence()
recordingModeHandler.logEvidence(target, action, hookType, evidenceEvent.stackTrace);
```

### 4. Breakpoint Location
**Decision**: Implement debugger statements directly in individual hooks
**Rationale**:
- **Critical**: Must break while malicious script is on call stack
- Debugger in evidence-collector would be too late (after postMessage)
- Allows inspection of malicious script's variables and context
- Enables stepping through malicious code

**Timing Analysis**:
```
Malicious Script: inputElement.value
                      ↓
Hook Intercepts:  get: function() {
                    if (breakpointMode) debugger; ← BREAK HERE
                    return originalGetter.call(this);
                  }
                      ↓
Evidence Collector: createAndSendEvidence() ← TOO LATE FOR DEBUGGER
```

## Implementation Details

### Background Script Changes
1. Added `recordingMode: 'console' | 'breakpoint'` to TabData interface
2. Default mode set to 'console' in `initializeTab()`
3. Send `SET_RECORDING_MODE` message when recording starts
4. Updated HudMessage interface to include mode field

### Content Script Changes  
1. Added message handler for `SET_RECORDING_MODE`
2. Forward mode to injected script via `window.postMessage()`

### Injected Script Architecture
1. **recording-modes.ts**: New module managing mode state and console logging
   - `RecordingModeHandler` class with mode storage
   - Rich console logging with grouped output
   - Target info formatting (tag#id.class[name])
   - Evidence type generation matching config patterns

2. **main.ts**: Added mode message handling
   - Listen for `SET_RECORDING_MODE` messages
   - Update global `recordingModeHandler` instance

3. **evidence-collector.ts**: Integrated console logging
   - Call `recordingModeHandler.logEvidence()` before sending evidence
   - Provides full context including stack traces

### Console Output Format
```
🔍 Surveillance Detected: input.value/get
  Target: input#password.form-control[name="pwd"]  
  Action: value
  Hook Type: property
  Element: <input id="password" ...>
  Stack Trace:
    1. at HTMLInputElement.get (injected.js:123)
    2. at stealPassword (malicious-script.js:45)
    3. at onSubmit (malicious-script.js:12)
```

## Pending Implementation
- **Debugger statements in hooks**: Need to add breakpoint logic to property-getter-hooks.ts, addEventListener-hook.ts, and event-handler-hooks.ts
- **UI for mode selection**: Radio buttons in HUD for user to choose recording mode
- **Mode persistence**: Consider chrome.storage for mode persistence across page reloads

## Key Benefits
1. **Real-time feedback**: Immediate visibility into surveillance attempts
2. **Debugging capabilities**: Break in malicious script context for analysis  
3. **Rich context**: Full element details and stack traces
4. **Non-invasive**: Console mode doesn't interrupt execution
5. **Developer-friendly**: Grouped console output with clear formatting

## Design Principles Applied
1. **Separation of concerns**: Mode logic isolated in recording-modes.ts
2. **Fail-safe operation**: Console/debugger logic never breaks page functionality
3. **Performance conscious**: Mode checking only during evidence capture
4. **Consistent patterns**: Follows existing message passing architecture
5. **Debugging focused**: Optimized for developer investigation workflows