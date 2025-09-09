# Background Service Worker (background.ts)

## Overview
The background service worker acts as the central data hub and coordinator for the Input Evidence Chrome Extension. It manages per-tab event storage, handles messaging between components, and provides export functionality.

## Key Decisions Made

### 1. Per-Tab Architecture
**Decision**: Store events and recording state separately for each tab
**Why**: 
- Users may want to record evidence on specific tabs only
- Different tabs may have different domains/contexts
- Prevents cross-tab interference
- Cleaner data organization and export

### 2. In-Memory Storage Only
**Decision**: Keep all events in memory (Map<tabId, TabData>) instead of using chrome.storage
**Why**:
- MVP requirement for local-only processing  
- Faster access for real-time updates
- Automatic cleanup when extension restarts
- No persistence needed for evidence collection use case

### 3. Event Cap with FIFO
**Decision**: Cap events at 2000 per tab, drop oldest when exceeded
**Why**:
- Prevents memory bloat during long recording sessions
- User gets warned via HUD when cap is reached
- FIFO ensures most recent evidence is preserved
- 2000 events provides substantial evidence without performance impact

### 4. Auto-Export on Tab Close
**Decision**: Automatically export JSON when a tab with active recording is closed
**Why**:
- Prevents data loss if user accidentally closes tab
- No user prompt for auto-exports (saveAs: false)
- Ensures evidence is preserved even without explicit export

### 5. Duplicate Detection Placeholder
**Decision**: Leave TODO for duplicate detection, don't implement initially
**Why**:
- MVP focuses on core functionality first
- Need to analyze real-world data patterns before choosing strategy
- Multiple potential approaches need evaluation:
  - Hash by: type + target.id + first stack frame
  - Hash by: type + target.id + full stack trace  
  - Time-based deduplication (same event within 100ms)

### 6. HUD Communication System
**Decision**: Implement bidirectional messaging with HUD for status updates
**Why**:
- Real-time feedback for users (event counts, warnings, status)
- Centralized message handling in background worker
- Clean separation of concerns (HUD = UI, Background = logic)

### 7. Export Filename Format
**Decision**: `evidence_domain_YYYY-MM-DD_HH-MM-SS.json`
**Why**:
- Clear identification of data source (domain)
- Chronological sorting capability
- Avoids filename conflicts for multiple exports
- Professional naming convention

### 8. TypeScript Implementation
**Decision**: Write in TypeScript with proper interfaces and types
**Why**:
- Type safety for Chrome extension APIs
- Better IDE support and error catching
- Consistent with project structure (content.ts)
- Interfaces document expected message formats

## Architecture

### Class Structure: EvidenceManager
- **tabData**: Map<number, TabData> - Per-tab storage
- **EVENT_CAP**: 2000 - Maximum events per tab
- **setupMessageHandlers()**: Handle content script communication
- **setupTabHandlers()**: Handle tab lifecycle events

### Message Types Handled
- `EVIDENCE_EVENT`: Add new evidence to tab buffer
- `TOGGLE_RECORDING`: Enable/disable recording for tab  
- `GET_STATUS`: Return current tab recording state
- `EXPORT_EVENTS`: Download JSON file for tab
- `CLEAR_EVENTS`: Clear tab's event buffer

### Data Structures

#### TabData Interface
```typescript
interface TabData {
  events: EvidenceEvent[];     // Evidence buffer
  recording: boolean;          // Recording state
  domain: string;              // Tab domain
  createdAt: number;           // Timestamp for metadata
}
```

#### Export Format
```json
{
  "metadata": {
    "domain": "example.com",
    "exportedAt": "ISO timestamp",
    "eventCount": 42,
    "recordingStarted": "ISO timestamp", 
    "autoExported": false
  },
  "events": [...]
}
```

## Technical Considerations

### Chrome Extension Permissions Required
- `downloads`: For JSON export functionality
- `activeTab`: For tab-specific messaging
- `scripting`: For content script injection

### Error Handling
- Silent failures for closed/invalid tabs in sendToTab()
- Graceful handling of missing tab data
- URL validation for tab initialization

### Performance Considerations  
- Map-based storage for O(1) tab lookups
- FIFO event trimming to maintain memory bounds
- Lazy tab initialization (only when first event occurs)

## Future Enhancements (Post-MVP)
- Implement chosen duplicate detection strategy
- Add event filtering by selector/type
- Session persistence options
- Bulk export across multiple tabs
- Event replay capabilities

## Integration Points
- **HUD**: Receives status updates and messages
- **Content Script**: Sends evidence events and user commands  
- **Injected Script**: Ultimate source of evidence events (via content script)

---
*Created: 2025-09-01*
*Last Updated: 2025-09-01*