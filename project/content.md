# Content Script HUD (content.ts)

## Overview
The content script implements the HUD (Heads-Up Display) interface that provides users with recording controls and real-time feedback for evidence collection. It serves as the primary user interface for the Input Evidence Chrome Extension, displaying on every webpage to allow surveillance monitoring control.

## Key Decisions Made

### 1. Chrome Extension Convention Adherence
**Decision**: Keep filename as `content.ts` instead of renaming to `HUD.ts`
**Why**: 
- Maintains Chrome extension standard naming conventions
- Easier to explain to team leaders and other developers
- Consistent with extension documentation and tutorials
- Clear role identification as a content script in manifest.json

### 2. HUD Class Architecture
**Decision**: Single `HUD` class with state management and UI control
**Why**:
- Encapsulates all HUD functionality in one cohesive unit
- Clear separation of concerns (UI, state, messaging)
- Easy to maintain and extend with additional features
- Provides reactive UI updates based on state changes

### 3. Local State Management
**Decision**: Use `HudState` interface with local state tracking
**Why**:
- Enables immediate UI responsiveness without waiting for background worker
- Provides optimistic updates for better user experience  
- Maintains consistency between background state and UI display
- Simplifies debugging and state inspection

### 4. Button State Logic
**Decision**: Implement smart button enabling/disabling based on application state
**Why**:
- **Start/Stop Recording**: Mutually exclusive based on recording status
- **Export/Clear Data**: Disabled when no events exist to prevent empty operations
- Provides clear visual feedback about available actions
- Prevents user errors and improves UX

### 5. Message-Driven Architecture
**Decision**: Use Chrome runtime messaging for all background communication
**Why**:
- Decouples HUD from background worker implementation
- Enables real-time updates from background (event counts, warnings)
- Supports future multi-tab coordination if needed
- Follows Chrome extension best practices

## HUD Interface Components

### Status Display Section
```html
<div class="status-section">
  <div class="recording-status">Not Recording / Recording...</div>
  <div class="event-count">Events captured: 0</div>
</div>
```

**Functionality**:
- **Recording Status**: Visual indicator with color coding (green = recording, gray = stopped)
- **Event Count**: Real-time display of captured evidence events
- **Cap Warning**: Shows "(at cap - oldest events dropped)" when 2000 event limit reached

### Basic Controls Section  
```html
<div class="controls-section">
  <button class="start-recording">Start Recording</button>
  <button class="stop-recording" disabled>Stop Recording</button>
  <button class="export-data" disabled>Export Data</button>
  <button class="clear-data" disabled>Clear Data</button>
</div>
```

**Button Logic**:
- **Start Recording**: Enabled only when not recording
- **Stop Recording**: Enabled only when actively recording
- **Export Data**: Enabled only when events exist (eventCount > 0)
- **Clear Data**: Enabled only when events exist (eventCount > 0)

### Message Display System
```html
<div class="message-display" style="display: none;"></div>
```

**Features**:
- Displays feedback messages from background worker
- Color-coded by message level (info, warning, success, error)
- Auto-hide after 3 seconds for non-intrusive UX
- Shows recording start/stop confirmations, export status, warnings

## State Management

### HudState Interface
```typescript
interface HudState {
  recording: boolean;    // Current recording status
  eventCount: number;    // Number of captured events
  atCap: boolean;        // Whether event cap (2000) has been reached
}
```

### State Synchronization Flow
1. **Initialization**: HUD requests current status from background worker
2. **User Actions**: Button clicks send messages to background worker
3. **Background Updates**: Background sends `HUD_UPDATE` messages when state changes
4. **Real-time Updates**: HUD immediately reflects new state in UI

## Communication Protocol

### Messages Sent to Background
- `GET_STATUS`: Request current recording state and event count
- `TOGGLE_RECORDING`: Start or stop evidence recording
- `EXPORT_EVENTS`: Trigger JSON export download
- `CLEAR_EVENTS`: Clear all captured events for current tab

### Messages Received from Background
- `HUD_UPDATE`: State changes (recording status, event count, cap status)
- `HUD_MESSAGE`: User feedback messages (info, warnings, confirmations)

## TODO Features (Future Implementation)

### Recording Mode Options
```html
<!-- TODO: Recording Mode Options
     - Radio buttons: Log to Console vs Breakpoint
     - When Breakpoint mode: show debugger; statement on evidence capture
     - When Console mode: console.log() evidence events -->
```
**Purpose**: Allow users to choose between passive logging or active debugging when evidence is captured

### Filter Options Section
```html  
<!-- TODO: Filter Options Section  
     - Element Selector input: CSS selector to limit monitoring (e.g., "#myInput, .password")
     - Attribute Filter: name/value pairs to filter elements by attributes
     - Stack Keyword Filter: only track if stack trace contains specified keyword -->
```
**Purpose**: Enable targeted surveillance detection for specific elements or scripts

### Track Events Checkboxes
```html
<!-- TODO: Track Events Checkboxes
     - Input Value Access: Monitor property getters (value, nodeValue)
     - Input Events: Monitor addEventListener calls (keydown, keyup, input, change)  
     - Form Submit: Monitor form submission events and handlers
     - FormData Creation: Monitor new FormData() constructor calls -->
```
**Purpose**: Granular control over which types of surveillance to detect and record

### Advanced Features
```html
<!-- TODO: Advanced Features
     - Real-time event feed/log display
     - Event filtering by domain/source
     - Stack trace highlighting
     - Export format options (JSON, CSV)
     - Session management (save/load configurations) -->
```
**Purpose**: Professional-grade features for detailed analysis and workflow optimization

## Technical Implementation Details

### DOM Injection Strategy
- HUD element injected into `document.body` with high z-index overlay
- Uses `evidence-hud-overlay` ID to avoid conflicts with page content
- CSS classes follow BEM-style naming for maintainability

### Event Handling
- Event delegation with query selectors for button interactions
- Async Chrome runtime messaging with response handling
- Error handling for closed tabs and messaging failures

### Performance Considerations
- Minimal DOM manipulation - updates only when state changes
- Efficient message passing - only sends necessary data
- Auto-hide messages prevent UI clutter
- Local state caching reduces background worker requests

### Cross-Frame Compatibility
- Runs in all frames due to `all_frames: true` in manifest
- Each frame gets independent HUD instance
- Background worker handles per-tab coordination

## Integration Points

### With Background Service Worker
- **State Synchronization**: HUD reflects background worker's recording state
- **Event Updates**: Real-time count updates as evidence is captured  
- **Message Relay**: Background sends user feedback through HUD display
- **Export Coordination**: HUD triggers export, background handles file generation

### With Future Injected Script
- **Evidence Pipeline**: Injected script → Content script → Background worker
- **Status Updates**: HUD shows activity from injected script surveillance detection
- **Error Reporting**: HUD displays issues with hook installation or evidence collection

### With Chrome Extension APIs
- **Runtime Messaging**: Primary communication mechanism with background
- **Tab Management**: HUD operates per-tab with independent state
- **DOM Integration**: Safe injection without interfering with page functionality

## Debugging and Testing

### Development Features
- **State Inspection**: HudState object accessible for debugging
- **Message Logging**: Chrome runtime messages visible in DevTools
- **UI Feedback**: All actions provide immediate visual confirmation

### Testing Scenarios
1. **Basic Controls**: Verify all buttons work correctly
2. **State Management**: Test recording start/stop cycles
3. **Export Functionality**: Ensure data export triggers properly
4. **Message Handling**: Verify background communication works
5. **Button States**: Check disabled/enabled logic correctness
6. **Cross-Frame**: Test HUD in iframes and main frame

## Future Enhancements

### UI/UX Improvements
- Draggable HUD positioning for user customization
- Collapsible/expandable interface to reduce screen real estate
- Theme options (dark/light mode) for different user preferences
- Keyboard shortcuts for quick recording toggle

### Advanced Analytics
- Evidence event timeline visualization
- Surveillance pattern detection and alerting
- Comparison tools for before/after scenarios
- Integration with security analysis workflows

### Enterprise Features
- Multi-tab session coordination
- Centralized configuration management
- Reporting and audit trail generation
- Integration with security information and event management (SIEM) systems

---
*Created: 2025-09-03*
*Last Updated: 2025-09-03*