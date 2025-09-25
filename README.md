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
- Stores evidence data per-tab
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

Evidence Monitor implements a sophisticated handshake protocol to ensure no evidence is lost during page initialization:

**The Problem**: During page load, the injected script starts immediately but the content script may not be ready to receive messages. Evidence could be lost.

**The Solution**: Queue-based evidence collection with automatic handshake:

```typescript
// In evidence-collector.ts
class EvidenceCollector {
  private isContentScriptReady: boolean = false;
  private pendingEvidence: EvidenceEvent[] = [];
  private readonly maxQueueSize: number = 1000;
  private readonly handshakeTimeout: number = 5000; // 5 seconds

  // Queue evidence until content script is ready
  private sendEvidence(evidence: EvidenceEvent): void {
    if (this.isContentScriptReady) {
      this.transmitEvidence(evidence);
    } else {
      this.queueEvidence(evidence);
    }
  }
}
```

**Handshake Flow**:
1. **Injected Script**: Starts collecting evidence → queues in memory
2. **Content Script**: Loads → broadcasts `CONTENT_SCRIPT_READY` message
3. **Injected Script**: Receives signal → flushes entire queue → switches to real-time mode
4. **Timeout Safety**: 5-second timeout prevents infinite queuing

**Queue Management**:
- **Max Size**: 1000 events (prevents memory exhaustion)
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

Evidence Monitor implements intelligent stack trace analysis:

**Smart Filtering Strategy**:
```typescript
// In stack-trace.ts
private static shouldIncludeFrame(frame: ParsedStackFrame): boolean {
  // 1. Hide OUR extension code (prevent noise)
  const isOurExtension = frame.url.includes('chrome-extension://') &&
    (frame.url.includes('injected.js') ||
     frame.url.includes('content.js'));
  if (isOurExtension) return false;

  // 2. Hide browser internals
  const isBrowserInternal = frame.url.startsWith('chrome://') ||
                           frame.url.startsWith('about:config');
  if (isBrowserInternal) return false;

  // 3. ALLOW suspicious contexts (critical for detection)
  // - Other extensions (potential malware)
  // - Data URLs (suspicious scripts)
  // - Blob URLs (dynamic code)
  // - about:srcdoc (iframe injection)
  return true;
}
```

**Stack Trace Benefits**:
- **Attribution**: Identify which scripts are accessing data
- **Context**: Distinguish legitimate vs suspicious access patterns
- **Evidence Quality**: Clean, readable stack traces in export
- **Performance**: Single capture per evidence (not per frame)

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

Evidence Monitor implements a sophisticated element tracking system:

**Element Registry Pattern**:
```typescript
// In element-registry.ts
class ElementRegistry {
  private elementMap = new WeakMap<Element, string>();
  private idCounter = 0;

  getElementId(element: Element): string {
    let id = this.elementMap.get(element);
    if (!id) {
      id = `elem_${++this.idCounter}`;
      this.elementMap.set(element, id);
    }
    return id;
  }
}
```

**Element Data Prioritization**:
1. **ID attribute** (if present): `<input id="password">`
2. **Name attribute** (fallback): `<input name="username">`
3. **Truncated outerHTML** (last resort): `<input type="password" class="...">`

**Benefits**:
- **Consistent Tracking**: Same element = same ID across evidence
- **Memory Efficient**: WeakMap automatically cleans up dead references
- **Privacy Aware**: Prioritizes semantic identifiers over full DOM content
- **Deduplication Support**: Enables effective duplicate detection

### 6. Recursive Detection Prevention

Evidence Monitor prevents infinite recursion during evidence collection:

**The Problem**: Hooks trigger during evidence collection, causing infinite loops.

**The Solution**: Processing flags and original method preservation:

```typescript
// In each hook implementation
class PropertyGetterHooks {
  private static isProcessing = false;

  private static createHook(target: any, propertyName: string) {
    Object.defineProperty(target, propertyName, {
      get: function() {
        // Prevent recursion during evidence processing
        if (PropertyGetterHooks.isProcessing) {
          return originalDescriptor.get!.call(this);
        }

        PropertyGetterHooks.isProcessing = true;
        try {
          // Collect evidence
          evidenceCollector.createAndSendEvidence(this, propertyName, 'property');
          return originalDescriptor.get!.call(this);
        } finally {
          PropertyGetterHooks.isProcessing = false;
        }
      }
    });
  }
}
```

**Protection Mechanisms**:
- **Processing Flags**: Prevent re-entry during evidence collection
- **Original Method Preservation**: Always call original functionality
- **Try-Finally Blocks**: Ensure flags are cleared even on errors
- **Per-Hook Isolation**: Each hook type has independent protection

## Understanding the Evidence Export

Evidence Monitor exports comprehensive JSON reports containing all surveillance detection data. Here's how to read and analyze the exported files:

### Export File Structure

```json
{
  "metadata": {
    "domain": "example.com",
    "exportedAt": "2025-01-15T14:30:25.123Z",
    "eventCount": 45,
    "recordingStarted": "2025-01-15T14:28:12.456Z",
    "autoExported": false,
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

**Domain & Timing**:
- `domain`: Website where surveillance was detected
- `exportedAt`: When the report was generated
- `recordingStarted`: When monitoring began
- `autoExported`: Whether export was automatic (at 1000 events) or manual

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
