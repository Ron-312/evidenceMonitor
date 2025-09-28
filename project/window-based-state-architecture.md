# Window-Based State Architecture

## Decision: Simplified Window-Level State Management

**Context:** The domain-based state persistence system introduced complex async chains, race conditions, and broken functionality (start recording button not working, state loss issues).

## Architecture Overview

### Window-Level Shared State
- **Recording Status**: Single on/off state for entire browser window
- **Settings**: Recording mode (console/breakpoint), filters, track events - shared across all tabs
- **Events Collection**: Single array collecting events from all visited URLs during recording session

### Per-URL Export Logic
- Events tagged internally with URL for grouping (not exposed in output)
- Export creates separate JSON files automatically for each URL visited
- Clean event objects without URL/domain metadata pollution

## User Workflow

1. **Start Recording**: User opens window, starts recording (affects all tabs in window)
2. **Browse Multiple Sites**: User visits github.com, twitter.com, stackoverflow.com
3. **Stop & Export**: Single "Export" click creates multiple files:
   ```
   evidence_github.com_2025-09-26_14-30-45.json (15 events)
   evidence_twitter.com_2025-09-26_14-30-45.json (8 events)
   evidence_stackoverflow.com_2025-09-26_14-30-45.json (3 events)
   ```

## Benefits

### User Experience
- **Zero Complexity**: User doesn't need to manage per-domain settings
- **Smart Defaults**: One recording session, automatic organization
- **No Decisions**: Export automatically creates properly organized files
- **User Control**: Smart users can use windows/tabs to control scope

### Technical Benefits
- **Simple State**: Single source of truth, no complex domain mapping
- **Reliable**: No async chains, race conditions, or tab ID mapping issues
- **Clean Data**: Event objects remain pure, no metadata pollution
- **Easy Recovery**: Simple state structure survives service worker restarts

## Implementation Strategy

### State Structure
```javascript
// Global window state
const windowState = {
  recording: false,
  recordingMode: 'console',
  filters: { elementSelector: '', attributeFilters: '', stackKeywordFilter: '' },
  trackEvents: { inputValueAccess: true, inputEvents: true, formSubmit: true, formDataCreation: true },
  events: [
    // Events with internal URL tracking (removed before export)
    { _internalUrl: 'github.com', actionId: 'abc', type: 'input.value/get', ... },
    { _internalUrl: 'twitter.com', actionId: 'def', type: 'form.submit', ... }
  ]
}
```

### Export Logic
```javascript
// Group events by URL
const eventsByUrl = groupBy(events, '_internalUrl')

// Create separate file for each URL
Object.entries(eventsByUrl).forEach(([url, urlEvents]) => {
  const cleanEvents = urlEvents.map(event => omit(event, '_internalUrl'))
  const filename = `evidence_${url}_${timestamp}.json`
  downloadFile(filename, { metadata: {...}, events: cleanEvents })
})
```

## Migration Path

1. **Remove Domain-Based Complexity**: Eliminate `tabDomainMap`, async domain state loading
2. **Simplify Message Handlers**: Direct synchronous state access
3. **Update Export Logic**: Implement multi-file export with URL grouping
4. **Clean Event Objects**: Remove URL/domain from exported data

## User Trust & Control

- **Predictable**: Recording state clearly visible and consistent across tabs
- **Controllable**: Users can open new windows for isolated recording sessions
- **Organized**: Automatic file organization without user complexity
- **Clean**: Pure evidence data without implementation details

This architecture respects user intelligence while providing maximum utility with minimum complexity.