# Evidence Collector (evidence-collector.ts)

## Overview
The EvidenceCollector serves as the central hub for evidence creation, deduplication, and transmission in the injected script layer. It orchestrates the entire evidence lifecycle from surveillance detection to content script delivery, ensuring reliable communication through a handshake protocol and preventing duplicate evidence through sophisticated deduplication logic.

## Core Functionality

### Purpose
When surveillance hooks detect interactions with form elements, the EvidenceCollector:
1. Creates standardized evidence objects with complete forensic information
2. Applies deduplication logic to prevent noise from repeated identical actions
3. Manages transmission to the content script through a reliable handshake protocol
4. Provides queue management and overflow protection for high-frequency surveillance

### Evidence Flow
```javascript
// Hook detects surveillance action
propertyGetter.getValue() → EvidenceCollector.createAndSendEvidence()
                         ↓
                    Create Evidence Object
                         ↓
                    Check Deduplication
                         ↓
                    Send/Queue Evidence
                         ↓
                    Transmit to Content Script
```

## Key Design Decisions

### 1. Unified Evidence Creation Method
**Decision**: Single `createAndSendEvidence()` method handles all hook types
**Signature**: 
```typescript
createAndSendEvidence(
  element: Element, 
  action: string, 
  hookType: 'property' | 'eventHandler' | 'addEventListener'
): void
```

**Reasoning**:
- Consistent evidence format across all surveillance detection methods
- Centralized deduplication and transmission logic
- Simplified integration for hook classes
- Single point of control for evidence lifecycle

**Alternative Considered**: Separate methods per hook type - rejected for code duplication and inconsistent evidence format

### 2. Element Data Strategy - ID Priority with Fallback
**Decision**: Use `element.id` if available, otherwise truncated `outerHTML`
```typescript
private getElementData(element: Element): string {
  if (element.id) {
    return element.id;
  }
  if (element.outerHTML) {
    return element.outerHTML.substring(0, 300);
  }
  return '[NO_ELEMENT_DATA]';
}
```

**Benefits**:
- Compact evidence for elements with meaningful IDs
- Rich context for anonymous elements through HTML structure
- 300 character limit prevents evidence bloat from large elements
- Graceful degradation with error indicators

**Use Cases**:
```javascript
<input id="email" type="email">           // Data: "email"
<input type="password" class="auth-input"> // Data: "<input type=\"password\" class=\"auth-input\">"
<select><option>...</option></select>      // Data: "<select><option>...</option></select>" (truncated)
```

### 3. Deduplication Strategy - Full Stack Trace Comparison
**Decision**: Include complete stack trace in deduplication key
**Key Format**: `${type}:${targetId}:${stackTrace.join('|')}`

**Example Keys**:
```javascript
// Different call paths to same action = different evidence
"input.value/get:elem123:script.js:45|main.js:67|app.js:23"
"input.value/get:elem123:tracker.js:12|spy.js:89|malware.js:34"

// Same call path within 50ms window = duplicate (ignored)
"input.value/get:elem123:script.js:45|main.js:67|app.js:23"
"input.value/get:elem123:script.js:45|main.js:67|app.js:23"  // Duplicate
```

**Reasoning**:
- Captures different surveillance scripts accessing same element
- Prevents legitimate duplicate filtering due to different call origins
- Essential for forensic analysis - shows multiple attack vectors
- More granular than element+action-only deduplication

**Alternative Considered**: Element + action only - rejected because it would hide multiple scripts surveilling same element

### 4. Handshake Protocol - Reliable Communication Timing
**Decision**: Implement bidirectional handshake with timeout fallback
**Components**:
- Content script sends `CONTENT_SCRIPT_READY` when initialized
- Injected script queues evidence until handshake complete
- 5-second timeout assumes ready if no handshake received
- Flush all queued evidence immediately upon handshake

**Message Flow**:
```
Content Script Load → window.postMessage('CONTENT_SCRIPT_READY')
                                    ↓
Injected Script Receives → Set isContentScriptReady = true
                                    ↓
Flush Pending Queue → Transmit all queued evidence
```

**Edge Cases Handled**:
- **Content script never loads**: Timeout assumes ready after 5 seconds
- **Message lost**: Timeout provides fallback activation
- **Late activation**: Mid-page extension enabling still triggers handshake
- **Multiple ready signals**: Idempotent - only first signal processes queue

### 5. Queue Management - High Frequency Protection
**Decision**: 1000 event queue limit with FIFO overflow protection
**Implementation**:
```typescript
private queueEvidence(evidence: EvidenceEvent): void {
  if (this.pendingEvidence.length >= this.maxQueueSize) {
    this.pendingEvidence.shift(); // Remove oldest
    console.warn(`Queue full, dropped oldest evidence. Queue size: ${this.maxQueueSize}`);
  }
  this.pendingEvidence.push(evidence);
}
```

**Scenarios**:
- **Normal Case**: Evidence queues for <1 second until handshake
- **High Frequency**: Rapid surveillance generates many events quickly
- **Slow Handshake**: Content script delayed, evidence accumulates
- **Memory Protection**: FIFO prevents memory exhaustion

**Queue Size Rationale**:
- Average handshake time: 50-200ms
- High surveillance rate: ~100 events/second in extreme cases
- 1000 events = ~10 seconds of protection
- Memory usage: ~200KB for full queue (acceptable)

### 6. Robust Error Handling - Never Break Surveillance Detection
**Decision**: Comprehensive error boundaries with continuation
**Error Scenarios & Responses**:

#### Evidence Creation Failure
```typescript
try {
  const evidence = this.createEvidence(element, action, hookType);
  // ... continue processing
} catch (error) {
  console.error('[EvidenceCollector] Failed to create evidence:', error);
  return; // Skip this evidence, continue surveillance
}
```

#### Transmission Failure with Recovery
```typescript
try {
  window.postMessage({ type: 'EVIDENCE_EVENT', event: evidence }, '*');
} catch (error) {
  console.error('[EvidenceCollector] Failed to transmit evidence:', error);
  this.queueEvidence(evidence); // Re-queue for retry
}
```

**Design Philosophy**:
- Surveillance detection must never stop due to evidence issues
- Log all errors for debugging but continue operation
- Degrade gracefully - skip problematic evidence, continue with others
- Provide recovery mechanisms where possible

## Technical Implementation Details

### Evidence Object Structure
Every evidence event follows this standardized format:
```typescript
interface EvidenceEvent {
  actionId: string;        // Unique identifier for this action
  type: string;           // Generated evidence type (e.g., "input.value/get")
  start: number;          // performance.now() timestamp
  duration: number;       // Always 0 for surveillance (vs. user actions)
  data: string;           // Element ID or HTML snippet
  target: { id: string }; // ElementRegistry stable ID
  stackTrace: string[];   // Formatted stack frames
}
```

### Action ID Generation - Explorer Compatibility
```typescript
private generateActionId(): string {
  return Math.random().toString(36).substr(2);
}
```
Matches Explorer's exact format for evidence comparison.

### Deduplication Memory Management
- **Map Size Monitoring**: Cleanup triggered when map exceeds 1000 entries
- **Age-Based Cleanup**: Remove entries older than 10x deduplication window (500ms)
- **Performance Impact**: Cleanup runs in background, doesn't block evidence processing

### Communication Protocol
```typescript
// Outbound: Evidence to Content Script
window.postMessage({
  type: 'EVIDENCE_EVENT',
  event: evidenceObject
}, '*');

// Inbound: Ready Signal from Content Script
window.addEventListener('message', (event) => {
  if (event.data.type === 'CONTENT_SCRIPT_READY') {
    this.onContentScriptReady();
  }
});
```

## Performance Considerations

### Memory Usage Patterns
- **Pending Queue**: Up to 1000 events × ~200 bytes = ~200KB maximum
- **Deduplication Map**: Up to 1000 entries × ~100 bytes = ~100KB typical
- **Total Memory**: ~300KB maximum under extreme conditions
- **Cleanup Impact**: Periodic cleanup prevents unbounded growth

### Timing Characteristics
- **Evidence Creation**: <1ms per evidence object
- **Deduplication Check**: O(1) map lookup
- **Queue Operations**: O(1) push/shift operations
- **Transmission**: Non-blocking postMessage
- **Handshake Latency**: 50-200ms typical

### High-Frequency Surveillance Handling
The system handles aggressive surveillance patterns:
- **Rapid Value Reading**: 50ms deduplication window reduces noise
- **Multiple Scripts**: Different stack traces create separate evidence
- **Event Storms**: Queue protection prevents memory exhaustion
- **Background Processing**: Evidence processing never blocks page execution

## Integration with Injected Script Architecture

### Relationship to Other Components
- **ElementRegistry**: Provides stable element IDs for evidence
- **StackTrace Utility**: Supplies formatted forensic stack traces
- **Hook Classes**: Primary consumers of evidence collection service
- **Evidence Config**: Used by hooks to determine monitoring scope

### Usage Pattern in Hook Implementations
```typescript
// In property getter hook
const originalGetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.get!;
Object.defineProperty(HTMLInputElement.prototype, 'value', {
  get: function() {
    const value = originalGetter.call(this);
    
    if (shouldHookElement(this)) {
      evidenceCollector.createAndSendEvidence(this, 'value', 'property');
    }
    
    return value;
  }
});
```

## Debugging and Monitoring

### Built-in Statistics
```typescript
getStats(): { 
  ready: boolean; 
  queueSize: number; 
  deduplicationEntries: number;
  memoryPressure: boolean;
} {
  return {
    ready: this.isContentScriptReady,
    queueSize: this.pendingEvidence.length,
    deduplicationEntries: this.recentEvents.size,
    memoryPressure: this.pendingEvidence.length > this.maxQueueSize * 0.8
  };
}
```

### Debug Output
The collector provides comprehensive logging:
```javascript
console.debug(`[EvidenceCollector] Queued evidence. Queue size: ${this.pendingEvidence.length}`);
console.debug('[EvidenceCollector] Content script ready, flushing pending evidence');
console.warn('[EvidenceCollector] Handshake timeout - assuming content script ready');
console.error('[EvidenceCollector] Failed to create evidence:', error);
```

### Common Troubleshooting Scenarios

#### Issue: Evidence Not Appearing in Background
**Symptoms**: Hooks triggering but no evidence in background storage
**Diagnosis**: Check `getStats().ready` - if false, handshake failed
**Solution**: Verify content script loading and message passing

#### Issue: Duplicate Evidence Despite Deduplication
**Symptoms**: Multiple identical evidence events
**Causes**: Different stack traces for same action, clock skew
**Investigation**: Compare evidence `stackTrace` arrays and timestamps

#### Issue: Memory Warnings in Console
**Symptoms**: Queue full warnings appearing frequently
**Causes**: Very high surveillance frequency, slow content script
**Monitoring**: Use `getStats().memoryPressure` for early warning

## Security and Privacy Considerations

### Information Filtering
- **Extension Filtering**: Stack traces exclude extension internal calls
- **Clean Evidence**: Only page script URLs and function names captured
- **No User Data**: Evidence contains element structure, not input values
- **Minimal Footprint**: Only captures surveillance-related information

### Error Boundaries
- **Isolated Failures**: Individual evidence failures don't break overall system
- **Safe Degradation**: System continues operating with reduced evidence quality
- **No Data Leakage**: Error messages don't expose sensitive information

## Future Enhancement Opportunities

### Advanced Features
- **Evidence Correlation**: Link related evidence events across time
- **Pattern Detection**: Identify common surveillance frameworks
- **Adaptive Deduplication**: Adjust window based on surveillance patterns
- **Batch Processing**: Group evidence transmission for efficiency

### Performance Optimizations
- **Smart Queuing**: Priority-based evidence queuing for important events
- **Background Processing**: Use Web Workers for evidence processing
- **Memory Tuning**: Dynamic queue limits based on available memory
- **Compression**: Compress stack traces for transmission

### Integration Improvements
- **Cross-Frame Correlation**: Link evidence across iframe boundaries
- **Session Persistence**: Maintain evidence across page navigation
- **Real-time Analysis**: Live surveillance pattern detection
- **Export Integration**: Direct evidence export without background storage

---
*Created: 2025-09-09*
*Last Updated: 2025-09-09*