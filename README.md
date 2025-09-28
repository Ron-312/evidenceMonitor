# Evidence Monitor

A Chrome extension for surveillance detection and evidence collection on web pages. Evidence Monitor hooks into JavaScript APIs to detect when scripts attempt to access form data, monitor user input, or collect surveillance information.

## Architecture Overview

Evidence Monitor operates across **four distinct execution contexts**, each with specific responsibilities:

1. **Background Service Worker** - Extension lifecycle and data management
2. **Content Script** - Bridge between extension and page, HUD interface
3. **Main World Script** - Early hook installation in page context
4. **Injected Script System** - Deep surveillance detection hooks

## Project Structure

```
Evidence Monitor/
├── src/                           # Source code
│   ├── manifest.json             # Extension manifest
│   ├── assets/                   # Static assets
│   │   ├── styles/hud.css       # HUD styling
│   │   ├── html/popup.html      # Extension popup
│   │   └── icons/               # Extension icons (16px, 48px, 128px)
│   └── scripts/                 # All TypeScript code
│       ├── background.ts        # Service worker - data storage & lifecycle
│       ├── content.ts          # Content script - HUD & messaging bridge
│       ├── main-world-hooks.ts # Main world - early addEventListener hooks
│       ├── shared-types.ts     # Type definitions
│       ├── config/             # Configuration
│       │   └── evidence-config.ts  # Hook configuration (user-editable)
│       ├── state/              # Shared state management
│       │   └── track-events-manager.ts  # Track events state
│       ├── utils/              # Shared utilities
│       │   └── stack-trace.ts  # Stack trace capture
│       └── injected/           # Injected script system
│           ├── main.ts         # Entry point & message handling
│           ├── evidence-collector.ts  # Evidence creation & queuing
│           ├── hook-manager.ts # Hook installation coordinator
│           ├── hooks/          # Surveillance detection hooks
│           │   ├── addEventListener-hook.ts    # Event listener hooks
│           │   ├── event-handler-hooks.ts     # Event handler property hooks
│           │   ├── form-hooks.ts              # Form submission hooks
│           │   └── property-getter-hooks.ts   # Property access hooks
│           ├── state/          # Injected-specific state
│           │   ├── filter-manager.ts          # Evidence filtering
│           │   └── recording-modes-manager.ts # Recording modes
│           └── utils/          # Injected utilities
│               └── element-registry.ts        # DOM element tracking
├── public/                     # Built extension (auto-generated)
│   ├── manifest.json          # Extension manifest (copied)
│   ├── *.css, *.html          # Assets (copied)
│   ├── icons/                 # Icons (copied)
│   ├── background.js          # Compiled service worker
│   ├── content.js            # Compiled content script
│   ├── injected.js           # Bundled injected system
│   ├── main-world-hooks.js   # Compiled main world script
│   └── shared-types.js       # Compiled type definitions
├── package.json              # Build configuration
├── tsconfig.json            # TypeScript configuration
└── README.md               # This documentation
```

## Key Architectural Decisions

### 1. Four-Context Architecture

**Background Service Worker (`background.ts`)**
- Manages extension lifecycle and permissions
- Stores evidence data per-window (shared across tabs in same window)
- Handles data export and persistence
- Coordinates between content scripts across tabs

**Content Script (`content.ts`)**
- Creates and manages the HUD interface
- Acts as messaging bridge between page and extension
- Handles user interactions (recording controls, filters)
- Manages real-time evidence display

**Main World Script (`main-world-hooks.ts`)**
- Runs in page context at `document_start`
- Installs early hooks for `addEventListener` calls
- Critical for catching surveillance before page load completes
- Communicates with injected script via `postMessage`

**Injected Script System (`injected/`)**
- Deep API hooking and surveillance detection
- Evidence collection and deduplication
- Smart filtering and stack trace analysis
- Queue management during page initialization

## Key Files Implementation Details

### Core Extension Files

**`src/scripts/background.ts` - Service Worker**
- **Window-based state management**: Evidence stored per-window, shared across tabs
- **Event cap handling**: 10,000 event limit with automatic overflow management
- **Batch processing**: `EVIDENCE_EVENT_BATCH` for high-volume evidence collection
- **Auto-export functionality**: Automatic export when windows/tabs close with active recording
- **Throttled HUD updates**: 200ms throttling to prevent UI spam during high activity
- **URL grouping**: Exports organized by normalized URL with separate files per domain
- **Deduplication**: Explorer-compatible deduplication algorithm (`type__data__target.id`)

**`src/scripts/content.ts` - Content Script & HUD**
- **Floating HUD interface**: Real-time evidence display with filtering controls
- **Message relay system**: Bridges Background ↔ Content ↔ Injected scripts
- **Handshake coordination**: Manages initialization protocol with injected scripts
- **User interaction handling**: Record/pause, filters, export controls
- **Cross-frame communication**: Handles messaging in iframe contexts
- **State synchronization**: Keeps HUD in sync with background recording state

**`src/scripts/main-world-hooks.ts` - Early Hook Installation**
- **Document start execution**: Runs before page scripts load for zero-miss detection
- **Early addEventListener hooks**: Catches surveillance during page initialization
- **Page context execution**: Runs in main world for maximum API access
- **Communication bridge**: postMessage coordination with injected script system
- **Critical timing**: Prevents surveillance scripts from establishing before detection

### Injected Script System (`src/scripts/injected/`)

**`injected/main.ts` - Entry Point & Coordination**
- **Initialization orchestration**: Coordinates all hook managers and evidence collector
- **Message handling**: Processes postMessage communication with content script
- **Handshake protocol**: Implements queue-to-realtime transition for evidence
- **Hook timing management**: Ensures proper installation order and dependencies
- **Error boundaries**: Handles injection failures gracefully

**`injected/evidence-collector.ts` - Evidence Processing**
- **Queue-based collection**: Buffers evidence during page initialization (3,000 event queue limit)
- **Batch transmission**: Sends evidence in batches of 50 events for optimal performance
- **Handshake implementation**: Zero-loss evidence delivery with 5-second timeout and retry logic
- **Stack trace capture**: High-quality attribution with filtered call stacks
- **Element tracking**: Consistent element identification via registry system
- **Memory management**: Automatic queue overflow protection and batch timeout safety (500ms)

**`injected/hook-manager.ts` - Hook Installation Coordinator**
- **Comprehensive hook installation**: Coordinates all surveillance detection hooks
- **Property getter hooks**: `input.value`, `textarea.value`, `select.value` access detection
- **Event handler hooks**: `onkeydown`, `oninput` property setter monitoring
- **Form submission hooks**: `form.submit()` method and constructor interception
- **addEventListener hooks**: Complete event listener attachment monitoring

### Hook Implementation Files (`src/scripts/injected/hooks/`)

**`hooks/property-getter-hooks.ts`**
- **Value access detection**: Hooks property getters for form elements
- **Stack trace attribution**: Captures calling scripts for each value access
- **Clean architecture design**: Evidence collection doesn't trigger monitored property getters
- **Element registry integration**: Consistent element tracking across evidence types
- **Performance optimization**: Minimal overhead with efficient property descriptor replacement

**`hooks/event-handler-hooks.ts`**
- **Property setter monitoring**: Detects `element.onkeydown = handler` assignments
- **Comprehensive coverage**: Monitors all relevant event handler properties
- **Surveillance pattern detection**: Identifies scripts setting up input monitoring
- **Original functionality preservation**: Maintains normal page behavior

**`hooks/form-hooks.ts`**
- **Form submission detection**: Monitors `form.submit()` method calls
- **FormData constructor hooks**: Detects `new FormData(form)` data collection
- **Automated harvesting detection**: Catches programmatic form submission and serialization
- **Data collection attribution**: Stack traces show which scripts collect form data

*Note: "Programmatic form submission and serialization" means scripts automatically submitting forms or extracting form data without user interaction. Examples: `document.getElementById('loginForm').submit()` (auto-submit) or `new FormData(formElement)` (data extraction). This is different from normal user behavior (clicking submit) and is commonly used by surveillance scripts to harvest sensitive data like passwords and credit card information.*

**`hooks/addEventListener-hook.ts`**
- **Event listener monitoring**: Comprehensive `addEventListener` call detection
- **Filtered monitoring**: Focuses on surveillance-relevant events (keydown, input, change)
- **Early and late hooks**: Coordination with main-world hooks for complete coverage
- **Context preservation**: Maintains proper `this` binding and event behavior

### Utility and State Files

**`src/scripts/utils/stack-trace.ts`**
- **Clean stack trace capture**: Filtered, readable call stacks for evidence attribution
- **Extension code filtering**: Removes our own extension frames to reduce noise
- **Suspicious context preservation**: Keeps other extensions, data URLs, blob URLs
- **Standardized formatting**: `"url:line:col [functionName]"` format for analysis

**`src/scripts/injected/utils/element-registry.ts`**
- **Map-based tracking**: Advanced element identification with collision detection and cleanup
- **Stable synthetic IDs**: Randomized IDs with consistent tracking across multiple evidence events
- **Semantic identifier priority**: Uses `id` → `name` → `outerHTML` fallback hierarchy (evidence-collector.ts)
- **Advanced memory management**: 5,000 element limit with DOM attachment checking and FIFO cleanup

**`src/scripts/state/track-events-manager.ts`**
- **Recording state coordination**: Manages on/off state across all contexts
- **Filter synchronization**: Keeps evidence filtering consistent between HUD and detection
- **Configuration management**: Handles user preferences for evidence types and recording modes

### 2. Messaging Architecture

```
┌─────────────────┐    chrome.runtime    ┌─────────────────┐
│  Background     │ ←─────────────────── │  Content Script │
│  Service Worker │                      │                 │
└─────────────────┘                      └─────────────────┘
                                                   │
                                            window.postMessage
                                                   ↓
                                         ┌─────────────────┐
                                         │  Main World +   │
                                         │  Injected       │
                                         │  Scripts        │
                                         └─────────────────┘
```

**Messages Flow:**
1. **Evidence Events**: `Injected → Content → Background`
2. **Configuration**: `Background → Content → Injected`
3. **Recording Control**: `Content → Background` & `Content → Injected`
4. **Early Hooks**: `Main World → Content` (via postMessage)

### 3. Evidence Collection Pipeline

Evidence Monitor implements a sophisticated evidence collection system:

**Initialization Queue System**
- Evidence is queued during page load before content script is ready
- Handshake protocol ensures no evidence is lost
- Automatic retry mechanism for reliable message delivery

**Hook Installation Strategy**
1. **Main World**: Early `addEventListener` hooks (document_start)
2. **Injected Script**: Comprehensive API hooks (after DOM ready)
3. **Property Getters**: `input.value`, `textarea.value` access
4. **Event Handlers**: `onkeydown`, `oninput` property setters
5. **Form Submission**: `form.submit()` method and events
6. **FormData**: `new FormData()` constructor calls

**Evidence Processing**
- Real-time stack trace capture and filtering
- Element identification and tracking
- Smart deduplication to prevent spam
- Configurable filtering by element, attribute, and stack keywords

## Installation & Build

### Prerequisites
- Node.js (v14+)
- Chrome browser
- TypeScript knowledge for modifications

### Build Process
```bash
# Install dependencies
npm install

# Build extension
npm run build
```

### Development Workflow
```bash
# Clean build
npm run build

# Load unpacked extension from public/ folder in Chrome
# Make changes in src/
# Rebuild and reload extension
```

## Configuration

The main configuration file is `src/scripts/config/evidence-config.ts`. This controls which hooks are active and how evidence is collected:

```typescript
export const EVIDENCE_CONFIG = {
  formElements: {
    elements: ['input', 'select', 'textarea'],
    propertyGetters: ['value', 'nodeValue'],
    eventHandlerSetters: ['onkeydown', 'oninput', 'onchange'],
    eventListeners: ['keydown', 'input', 'change']
  },
  formSubmission: {
    elements: ['form'],
    methods: ['submit'],
    eventListeners: ['submit']
  },
  formDataCreation: {
    constructor: 'FormData'
  }
};
```

**Customization Options:**
- Add/remove monitored HTML elements
- Configure which property getters to hook
- Modify event types to monitor
- Adjust stack trace filtering rules

## Usage

1. **Load Extension**: Install from `public/` folder as unpacked extension
2. **Navigate to Target Site**: Evidence Monitor activates automatically
3. **View HUD**: Real-time evidence display in page overlay
4. **Configure Filters**: Use HUD controls to filter evidence
5. **Export Data**: Use export button to download evidence as JSON
6. **Recording Modes**:
   - **Console Mode**: Evidence logged to browser console
   - **Breakpoint Mode**: Debugger breaks on evidence detection

## Internal Tool Notice

Evidence Monitor is an internal security research tool designed for:
- Web application security testing
- Surveillance detection research
- Privacy analysis of web applications
- Educational purposes in controlled environments

## Technical Deep Dive

### 1. Handshake Protocol & Queue System

Evidence Monitor implements a sophisticated handshake protocol with batching to ensure no evidence is lost during page initialization:

**The Problem**: During page load, the injected script starts immediately but the content script may not be ready to receive messages. Evidence could be lost.

**The Solution**: Queue-based evidence collection with batching and automatic handshake:

```typescript
// In evidence-collector.ts
class EvidenceCollector {
  private isContentScriptReady: boolean = false;
  private pendingEvidence: EvidenceEvent[] = [];
  private readonly maxQueueSize: number = 3000;
  private readonly handshakeTimeout: number = 5000; // 5 seconds

  // Event batching properties
  private eventBatch: EvidenceEvent[] = [];
  private readonly maxBatchSize: number = 50; // Events per batch
  private readonly batchTimeout: number = 500; // 500ms safety timeout

  // Send evidence with batching support
  private sendEvidence(evidence: EvidenceEvent): void {
    if (this.isContentScriptReady) {
      this.addToBatch(evidence);
    } else {
      this.queueEvidence(evidence);
    }
  }
}
```

**Handshake Flow**:
1. **Injected Script**: Starts collecting evidence → queues in memory
2. **Content Script**: Loads → broadcasts `CONTENT_SCRIPT_READY` message
3. **Injected Script**: Receives signal → flushes entire queue in batches → switches to real-time batch mode
4. **Timeout Safety**: 5-second timeout prevents infinite queuing

**Queue Management**:
- **Max Size**: 3,000 events (prevents memory exhaustion)
- **Batch Processing**: 50 events per batch for optimal performance
- **Batch Timeout**: 500ms safety timeout to flush incomplete batches
- **FIFO Processing**: Oldest evidence transmitted first
- **Error Handling**: Failed transmissions re-queued for retry
- **Memory Safety**: Queue cleared after successful handshake

### 2. Evidence Deduplication Strategy

Evidence Monitor implements multi-layer deduplication to prevent spam and noise:

**Layer 1: Real-time Detection Prevention**
```typescript
// Prevent recursive hook calls during evidence collection
if (this.isProcessingEvidence) {
  return originalMethod.apply(this, arguments);
}
this.isProcessingEvidence = true;
```

**Layer 2: Export-time Deduplication**
```typescript
// In background.ts - Explorer-style deduplication
private deduplicateEvents(events: EvidenceEvent[]) {
  const seen = new Set<string>();
  const deduplicated = events.filter(event => {
    const key = `${event.type}-${event.data}-${event.target.id}`;
    if (seen.has(key)) {
      return false; // Skip duplicate
    }
    seen.add(key);
    return true;
  });

  return {
    deduplicated,
    originalCount: events.length,
    duplicatesRemoved: events.length - deduplicated.length
  };
}
```

**Deduplication Logic**:
- **Composite Key**: `type + data + target.id`
- **Example**: Multiple `input.value` accesses on same element = 1 evidence
- **Export Metadata**: Shows original count vs deduplicated count

### 3. Stack Trace Capture & Filtering

Evidence Monitor implements intelligent stack trace analysis with sophisticated filtering:

**Smart Filtering Strategy**:
```typescript
// In stack-trace.ts
private static shouldIncludeFrame(frame: ParsedStackFrame): boolean {
  // 1. Hide OUR extension code (comprehensive filtering)
  const isOurExtension = frame.url.includes('chrome-extension://') &&
    (frame.url.includes('injected.js') ||
     frame.url.includes('content.js') ||
     frame.url.includes('background.js') ||
     frame.url.includes('main-world-hooks.js') ||
     frame.url.includes('shared-types.js'));
  if (isOurExtension) return false;

  // 2. Hide browser internals (enhanced)
  const isBrowserInternal = frame.url.startsWith('about:config') ||
                           frame.url.startsWith('chrome://') ||
                           frame.url.startsWith('edge://') ||
                           frame.url.startsWith('firefox://');
  if (isBrowserInternal) return false;

  // 3. Filter malformed URLs
  if (!frame.url || frame.url.trim() === '' || frame.url === 'null') return false;

  // 4. ALLOW suspicious contexts (critical for detection)
  // - Other extensions (potential malware)
  // - Data URLs (suspicious scripts)
  // - Blob URLs (dynamic code)
  // - about:srcdoc (iframe injection)
  // - about:blank (dynamic iframes)
  return true;
}
```

**Advanced Extension Detection** (Form Hooks):
- **External vs Internal Logic**: Sophisticated detection of extension-triggered vs page-triggered calls
- **Multi-frame Analysis**: Analyzes entire call stack for external code presence
- **Hook-specific Filtering**: Excludes our own hook management frames from analysis

**Stack Trace Benefits**:
- **Attribution**: Identify which scripts are accessing data
- **Context**: Distinguish legitimate vs suspicious access patterns
- **Evidence Quality**: Clean, readable stack traces in export
- **Performance**: Single capture per evidence (not per frame)
- **Malware Detection**: Preserves other extension traces for security analysis

### 4. Hook Installation Timing Strategy

Evidence Monitor uses a carefully orchestrated hook installation strategy:

**Phase 1: Main World Early Hooks (`document_start`)**
```typescript
// main-world-hooks.ts runs at document_start
(function installMainWorldHooks() {
  // Install BEFORE any page scripts load
  const originalAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function(type, listener, options) {
    // Detect surveillance addEventListener calls
    if (isFormElement(this) && isSuspiciousEvent(type)) {
      captureEvidence(this, type, 'addEventListener');
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
})();
```

**Phase 2: Injected Comprehensive Hooks (`document_idle`)**
```typescript
// injected/main.ts - after DOM is ready
class HookManager {
  installAllHooks() {
    // Property getters (input.value access)
    this.propertyGetterHooks.installHooks();

    // Event handler setters (element.onkeydown = handler)
    this.eventHandlerHooks.installHooks();

    // Form submission (form.submit(), FormData constructor)
    this.formHooks.installHooks();

    // Additional addEventListener hooks (comprehensive)
    this.addEventListenerHooks.installHooks();
  }
}
```

**Timing Rationale**:
- **Main World First**: Catches early surveillance (analytics scripts)
- **Injected Second**: Deep API hooking after DOM stabilizes
- **No Race Conditions**: Main world signals injected script when ready
- **Complete Coverage**: Early + comprehensive = no surveillance missed

### 5. Element Identification System

Evidence Monitor implements a sophisticated element tracking system with advanced memory management:

**Element Registry Pattern**:
```typescript
// In element-registry.ts
class ElementRegistry {
  private elementToId: Map<Element, string> = new Map();
  private existingIds: Set<string> = new Set();
  private readonly MAX_ELEMENTS = 5000;
  private cleanupCounter = 0;
  private readonly CLEANUP_INTERVAL = 100;

  getElementId(element: Element): string {
    if (this.elementToId.has(element)) {
      return this.elementToId.get(element)!;
    }

    // Periodic cleanup every 100 calls
    if (++this.cleanupCounter % this.CLEANUP_INTERVAL === 0) {
      this.performCleanup();
    }

    const newId = this.generateUniqueElementId(); // Randomized IDs
    this.elementToId.set(element, newId);
    return newId;
  }
}
```

**Element Data Prioritization** (in evidence-collector.ts):
1. **ID attribute** (if present): `element.id` → `"password"`
2. **Name attribute** (fallback): `element.getAttribute('name')` → `"username"`
3. **Truncated outerHTML** (last resort): `element.outerHTML.substring(0, 300)` → `"<input type=\"password\"..."`
4. **Error handling**: `"[NO_ELEMENT_DATA]"` or `"[ELEMENT_DATA_ERROR]"`

**Advanced Memory Management**:
- **Size Limits**: 5,000 element maximum with automatic cleanup
- **DOM Attachment Checking**: Removes elements no longer in DOM
- **Collision Detection**: Randomized IDs with collision avoidance
- **Memory Pressure Monitoring**: Tracks registry size and warns at 80% capacity
- **FIFO Cleanup**: Removes oldest elements when over limit

**Benefits**:
- **Consistent Tracking**: Same element = same ID across evidence
- **Scalable Design**: Handles large pages with thousands of elements
- **Memory Efficient**: Automatic cleanup prevents memory leaks
- **Privacy Aware**: Prioritizes semantic identifiers over full DOM content
- **Deduplication Support**: Enables effective duplicate detection
- **Performance Optimized**: Periodic cleanup maintains responsiveness

### 6. Recursive Detection Prevention

Evidence Monitor prevents infinite recursion through clean architecture design and sophisticated extension detection:

**The Problem**: Hooks might trigger during evidence collection, causing infinite loops.

**The Solution**: Clean evidence collection design that doesn't trigger monitored APIs:

```typescript
// Clean hook design - evidence collection doesn't trigger hooks
// Property getter hooks (property-getter-hooks.ts)
get: function() {
  // Monitor this property access and get filter decision
  const { shouldProceed } = self.monitorPropertyAccess(this, propertyName);

  // Evidence collection happens here but doesn't trigger property getters
  // Always return the original value - this must never fail
  return originalGetter.call(this);
}

// Form hooks with extension detection (form-hooks.ts)
private isCallFromExtension(stack: string): boolean {
  const stackLines = stack.split('\n');
  let hasExternalFrame = false;

  for (const line of stackLines) {
    // Skip our own hook management frames
    if (line.includes('FormHooks.monitorFormSubmission') ||
        line.includes('documentEventListener')) {
      continue;
    }

    // Check for external (non-extension) frames
    if (line.includes('http://') || line.includes('https://')) {
      hasExternalFrame = true;
    }
  }

  return !hasExternalFrame; // Internal if no external frames found
}

// Evidence collector design (evidence-collector.ts)
createAndSendEvidence(element, action, hookType) {
  // Evidence creation doesn't trigger monitored APIs
  const evidence = this.createEvidence(element, action, hookType);
  const shouldProceed = filterManager.shouldMonitor(element, evidence.stackTrace);

  if (shouldProceed) {
    this.sendEvidence(evidence); // Message passing, not DOM/API manipulation
  }

  return { shouldProceed, evidence };
}
```

**Protection Mechanisms**:
- **Clean Architecture**: Evidence collection itself doesn't trigger monitored APIs
- **Extension Detection**: Sophisticated analysis to identify extension vs. external calls
- **Stack Trace Filtering**: Automatic removal of extension frames from evidence
- **Message-based Collection**: Evidence transmission via postMessage, not DOM manipulation
- **Original Method Preservation**: Always call original functionality without interference
- **Safe Design**: Evidence collector operations isolated from hook triggers

## Understanding the Evidence Export

Evidence Monitor exports comprehensive JSON reports organized by URL with session-based folder structure. Each recording session creates multiple files grouped by domain.

### Export Structure

**Session Folder**: `evidence_session_YYYY-MM-DD_HH-MM-SS/`
- **Multiple files per session**: One file per unique URL visited
- **Organized by domain**: Separate files for different websites
- **Timestamped sessions**: Each export session gets unique folder

### Export File Structure

```json
{
  "metadata": {
    "url": "example.com/login",
    "exportedAt": "2025-01-15T14:30:25.123Z",
    "eventCount": 45,
    "recordingStarted": "2025-01-15T14:28:12.456Z",
    "autoExported": false,
    "windowId": 1234567890,
    "deduplication": {
      "originalCount": 67,
      "deduplicatedCount": 45,
      "duplicatesRemoved": 22
    }
  },
  "events": [ /* Evidence events array */ ]
}
```

### Metadata Analysis

**URL & Timing**:
- `url`: Normalized URL where surveillance was detected (without query params)
- `exportedAt`: When the report was generated
- `recordingStarted`: When monitoring began for this window
- `autoExported`: Whether export was automatic (window/tab close) or manual
- `windowId`: Browser window identifier for correlation

**Deduplication Statistics**:
- `originalCount`: Total surveillance attempts detected
- `deduplicatedCount`: Unique surveillance patterns (final count)
- `duplicatesRemoved`: Spam/repeated attempts filtered out

### Evidence Event Structure

Each surveillance detection event contains:

```json
{
  "actionId": "a8if24iz56",
  "type": "input.value/get",
  "start": 1736944825123.456,
  "duration": 0,
  "data": "password-field",
  "target": {
    "id": "elem_7"
  },
  "stackTrace": [
    "https://example.com/analytics.js:45:12 [trackUserInput]",
    "https://example.com/form-handler.js:123:8 [validateForm]",
    "https://example.com/main.js:67:4"
  ]
}
```

### Field-by-Field Analysis

**actionId**: `"a8if24iz56"`
- Unique identifier for this surveillance attempt
- Used for deduplication and reference
- Format: Random alphanumeric string

**type**: `"input.value/get"`
- **Format**: `element.action/method`
- **Examples**:
  - `input.value/get` = Script accessed input field value
  - `textarea.addEventListener(keydown)` = Script added keydown listener
  - `form.submit/call` = Script called form.submit() method
  - `FormData/constructor` = Script created new FormData object

**start**: `1736944825123.456`
- Timestamp when surveillance was detected
- Format: High-precision Unix timestamp (milliseconds)
- Can be converted to human time: `new Date(1736944825123.456)`

**duration**: `0`
- Always 0 for Evidence Monitor (real-time detection)
- Maintained for compatibility with analysis tools

**data**: `"password-field"`
- Element identification data
- **Priority**: ID attribute → name attribute → truncated HTML
- **Examples**:
  - `"username"` (element has name="username")
  - `"password-field"` (element has id="password-field")
  - `"<input type=\"password\" class=\"form-control\">..."` (fallback)

**target.id**: `"elem_7"`
- Internal element tracking ID
- Consistent across multiple evidence entries for same element
- Used for deduplication and correlation

**stackTrace**: Array of call stack frames
- **Most Important**: First entries show the suspicious script
- **Format**: `URL:line:column [functionName]`
- **Filtered**: Extension code and browser internals removed

### Stack Trace Analysis

The stack trace is the **most critical** part for security analysis:

```json
"stackTrace": [
  "https://suspicious-analytics.com/track.js:89:23 [collectFormData]",
  "https://example.com/legitimate-form.js:45:12 [validateInput]",
  "https://example.com/app.js:123:4 [handleSubmit]"
]
```

**Reading Stack Traces**:
1. **Top Entry**: Direct cause of surveillance
   - `suspicious-analytics.com` = Third-party surveillance
   - Function name `collectFormData` indicates intent
2. **Context Entries**: How the surveillance was triggered
   - Shows legitimate code that was intercepted
3. **Domain Analysis**:
   - Same domain = Potentially legitimate
   - Different domain = Third-party surveillance
   - No domain/data URLs = Injected malicious code

### Common Surveillance Patterns

**Pattern 1: Analytics Tracking**
```json
{
  "type": "input.addEventListener(keydown)",
  "stackTrace": [
    "https://google-analytics.com/analytics.js:456:78 [trackEvent]",
    "https://example.com/tracking-setup.js:23:45"
  ]
}
```
*Interpretation*: Google Analytics monitoring keystroke events

**Pattern 2: Form Data Harvesting**
```json
{
  "type": "input.value/get",
  "data": "credit-card-number",
  "stackTrace": [
    "https://malicious-domain.com/collect.js:12:34 [stealData]"
  ]
}
```
*Interpretation*: Malicious script directly accessing credit card field

**Pattern 3: Legitimate Form Validation**
```json
{
  "type": "input.value/get",
  "data": "email-field",
  "stackTrace": [
    "https://example.com/form-validator.js:89:12 [validateEmail]",
    "https://example.com/main.js:45:67 [onFormSubmit]"
  ]
}
```
*Interpretation*: Same-domain validation (likely legitimate)

### Analysis Workflow

1. **Start with Metadata**: Check deduplication ratio
   - High `duplicatesRemoved` = Potential spam/repeated surveillance
   - Review `eventCount` for surveillance volume

2. **Filter by Type**: Focus on high-risk evidence types
   - `input.value/get` on sensitive fields (password, credit card)
   - `FormData/constructor` = Data collection attempts
   - `form.submit/call` = Form interception

3. **Analyze Stack Traces**: Identify surveillance sources
   - Cross-domain calls = Third-party surveillance
   - Unknown domains = Potential malware
   - Suspicious function names = Clear intent

4. **Correlate Elements**: Group by `target.id`
   - Multiple evidence types on same element = Comprehensive surveillance
   - Track surveillance progression (access → monitor → collect)

5. **Timeline Analysis**: Use `start` timestamps
   - Rapid-fire evidence = Automated surveillance
   - Patterns during user interaction = Behavioral tracking

### Red Flags to Watch For

🚩 **High Priority**:
- Cross-domain access to password/payment fields
- Unknown domains in stack traces
- FormData constructor calls on sensitive forms
- Suspicious function names (collect, steal, track, harvest)

🚩 **Medium Priority**:
- Excessive event listener attachments
- Analytics tracking on sensitive pages
- Data access during non-user interactions

🚩 **Investigation Needed**:
- Same element accessed by multiple domains
- Evidence during page load (before user interaction)
- Obfuscated or minified suspicious code
