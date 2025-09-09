# Evidence Configuration (evidence-config.ts)

## Overview
The evidence configuration file defines exactly what types of surveillance patterns we detect and monitor. It matches Explorer's detection capabilities to ensure parity in evidence collection for comparison purposes.

## Key Decisions Made

### 1. Explorer Parity Strategy
**Decision**: Match Explorer's hooks exactly before adding extensions
**Why**: 
- Enables direct comparison of evidence between tools
- Validates our detection accuracy against known baseline
- Ensures we catch the same surveillance patterns Explorer does
- Provides foundation for expanding detection later

### 2. Two-Tier Surveillance Detection
**Decision**: Separate form-specific and global surveillance monitoring
**Why**:
- **Form Elements** (`input`, `select`, `textarea`): Targeted surveillance of user input fields
- **Global Elements** (`window`, `document`): Broad keylogging/monitoring of all page activity
- Matches Explorer's architecture for comprehensive coverage
- Distinguishes between focused vs. blanket surveillance techniques

### 3. Three Hook Types
**Decision**: Monitor property access, event handler setting, and event listener attachment
**Why**:
- **Property Getters** (`value/get`): Detect when scripts read form values
- **Event Handler Setters** (`onkeydown/set`): Detect when scripts assign event handlers
- **addEventListener** (`addEventListener(keydown)`): Detect when scripts attach event listeners
- Covers all common surveillance attachment methods used by malicious/tracking scripts

### 4. Centralized Helper Functions
**Decision**: Provide detection logic functions in the config file
**Why**:
- `shouldHookPropertyGetter()`: Determines if property access should be monitored
- `shouldHookEventListener()`: Determines if event listener should be monitored  
- `generateEvidenceType()`: Creates standardized evidence type strings
- Keeps detection logic consistent across all hook implementations
- Easier to modify surveillance patterns in one place

## Surveillance Patterns Detected

### Form Element Surveillance
**Elements Monitored**: `input`, `select`, `textarea`

#### Property Access Detection
- `element.value` → Evidence: `input.value/get`
- `element.nodeValue` → Evidence: `input.nodeValue/get`

**Use Case**: Catches scripts reading form values (password theft, data harvesting)

#### Event Handler Assignment Detection  
- `element.onkeydown = handler` → Evidence: `input.onkeydown/set`
- `element.onkeypress = handler` → Evidence: `input.onkeypress/set`
- `element.onkeyup = handler` → Evidence: `input.onkeyup/set`
- `element.oninput = handler` → Evidence: `input.oninput/set`
- `element.onchange = handler` → Evidence: `input.onchange/set`

**Use Case**: Detects scripts setting up keystroke monitoring on form fields

#### Event Listener Attachment Detection
- `element.addEventListener('keydown', handler)` → Evidence: `input.addEventListener(keydown)`
- `element.addEventListener('input', handler)` → Evidence: `input.addEventListener(input)`
- `element.addEventListener('change', handler)` → Evidence: `input.addEventListener(change)`

**Use Case**: Catches modern event listener-based surveillance on forms

### Global Surveillance Detection  
**Elements Monitored**: `window`, `document`

#### Global Event Handler Assignment
- `window.onkeydown = handler` → Evidence: `window.onkeydown/set`
- `document.onkeypress = handler` → Evidence: `document.onkeypress/set`

**Use Case**: Detects scripts monitoring ALL keyboard activity on the page

#### Global Event Listener Attachment
- `window.addEventListener('keydown', handler)` → Evidence: `window.addEventListener(keydown)`
- `document.addEventListener('keyup', handler)` → Evidence: `document.addEventListener(keyup)`

**Use Case**: Catches comprehensive keylogging attempts

## Evidence Type Generation

### Format Pattern
All evidence types follow Explorer's naming convention:
- Property access: `{target}.{property}/get`
- Event handler setting: `{target}.{handler}/set`  
- Event listener: `{target}.addEventListener({event})`

### Examples
```typescript
// Form surveillance
"input.value/get"                    // Script read input value
"textarea.onkeydown/set"            // Script set keydown handler on textarea
"select.addEventListener(change)"    // Script attached change listener to select

// Global surveillance  
"window.onkeydown/set"              // Script monitoring all page typing
"document.addEventListener(keyup)"   // Script listening to all key releases
```

## Configuration Structure

### EvidenceHooks Interface
```typescript
interface EvidenceHooks {
  formElements: {
    elements: string[];           // ['input', 'select', 'textarea']
    propertyGetters: string[];    // ['value', 'nodeValue'] 
    eventHandlerSetters: string[];// ['onkeydown', 'onkeypress', ...]
    eventListeners: string[];     // ['keydown', 'keypress', ...]
  };
  globalElements: {
    elements: string[];           // ['window', 'document']
    eventHandlerSetters: string[];// ['onkeydown', 'onkeypress', 'onkeyup']
    eventListeners: string[];     // ['keydown', 'keypress', 'keyup']
  };
}
```

## Helper Functions

### Detection Functions
- `isFormElement(element)`: Checks if element is a monitored form element
- `isGlobalElement(target)`: Checks if target is window or document
- `shouldHookPropertyGetter(element, property)`: Determines if property access should be monitored
- `shouldHookEventHandlerSetter(target, property)`: Determines if event handler setting should be monitored  
- `shouldHookEventListener(target, event)`: Determines if event listener attachment should be monitored

### Evidence Generation
- `generateEvidenceType(target, action, hookType)`: Creates standardized evidence type string

## Future Enhancements (TODOs)

### Additional Event Types
- `paste`: Clipboard monitoring detection
- `focus`/`blur`: Field focus surveillance  
- `submit`: Form submission monitoring
- `beforeunload`/`unload`: Data exfiltration on page exit

### Expanded Element Coverage
- `contenteditable`: Rich text editor surveillance
- `iframe`: Cross-frame monitoring detection
- Custom form controls and shadow DOM elements

### Advanced Detection Patterns
- File input monitoring (`input[type="file"]`)
- Form serialization surveillance (`FormData` constructor)
- Attribute access monitoring (`getAttribute('value')`)

## Integration Points

### With Background Service Worker
- Configuration imported and used for evidence validation
- Helper functions used to determine what constitutes valid evidence
- Evidence type generation used for consistent labeling

### With Injected Script (Future)
- Detection functions will be used to determine what hooks to install
- Evidence type generation will create consistent evidence records
- Configuration changes will automatically affect hook installation

### With HUD (Future)  
- Configuration could be exposed for user customization
- Detection patterns could be filtered based on user preferences
- Evidence statistics could be grouped by configuration categories

## Technical Considerations

### Performance Impact
- Helper functions designed for fast execution in hot code paths
- Configuration is static - no runtime modifications expected
- Detection logic optimized for minimal overhead during surveillance events

### Extensibility
- New surveillance patterns can be added to arrays without code changes
- Helper functions abstract detection logic for reuse
- Evidence type generation is consistent and predictable

### Explorer Compatibility
- Exact match with Explorer's detection patterns ensures comparable evidence
- Evidence type strings identical to Explorer's format
- Hook coverage matches Explorer's surveillance detection scope

---
*Created: 2025-09-03*  
*Last Updated: 2025-09-03*