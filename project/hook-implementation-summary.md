# Hook Implementation Summary

## Overview

This document provides a detailed summary of each surveillance detection hook implemented in our Chrome extension. Each hook monitors specific JavaScript APIs to detect when scripts are attempting to access user input data.

---

## 1. Property Getter Hooks (`property-getter-hooks.ts`)

### Purpose
Detects when JavaScript code reads user input values from form fields by intercepting property getter calls.

### What It Monitors
Based on `EVIDENCE_CONFIG.formElements`:

**Elements**:
- `HTMLInputElement` (text, password, email, etc.)
- `HTMLSelectElement` (dropdowns)
- `HTMLTextAreaElement` (multi-line text)

**Properties**:
- `.value` - Primary property for getting user input (`input.value`, `select.value`, `textarea.value`)
- `.nodeValue` - Alternative access pattern for getting element values

### How It Works
1. **Prototype Hooking**: Replaces getter methods on element prototypes:
   - `HTMLInputElement.prototype.value` getter
   - `HTMLSelectElement.prototype.value` getter
   - `HTMLTextAreaElement.prototype.value` getter
   - `.nodeValue` getters on all form elements

2. **Interception**: When JavaScript calls `element.value`, our hook executes first
3. **Evidence Creation**: Creates evidence with element details and stack trace
4. **Breakpoint**: Optionally triggers `debugger` in breakpoint mode
5. **Value Return**: Always returns the original value (transparent to the script)

### Evidence Generated
```json
{
  "type": "input.value/get",
  "data": "loginUsername",
  "target": { "id": "elementId" },
  "stackTrace": [
    "https://example.com/script.js:123:45 [functionName]"
  ]
}
```

### Real-World Example: eBay Credit Card Form
When eBay's JavaScript reads credit card values:
```javascript
// eBay code doing this:
const cardNumber = document.getElementById('cardNumber').value;
const expiryDate = document.getElementById('cardExpiryDate').value;

// Our hook catches:
// 1. input.value/get for cardNumber
// 2. input.value/get for cardExpiryDate
```

**Evidence in logs**:
```
🔍 Surveillance Detected: input.value/get
Target: input#cardNumber[name="cardNumber"]
Action: value
Stack Trace: https://ir.ebaystatic.com/rs/c/checkout/vendor_desktop.js:2:137045
```

### Configuration Control
Controlled by Track Events setting: **"Input Value Access"**
- ✅ Enabled: Monitors all `.value` and `.nodeValue` reading
- ❌ Disabled: No property getter monitoring

### Performance Impact
- **Very Low**: Only executes when scripts actually read form values
- **No Performance Cost**: When surveillance isn't happening
- **Transparent**: Never affects normal form functionality

---

## 2. addEventListener Hook (`addEventListener-hook.ts`)

### Purpose
Detects when JavaScript code attaches event listeners to form elements to monitor user input behavior.

### What It Monitors
Based on `EVIDENCE_CONFIG.formElements`:

**Elements**:
- `HTMLInputElement` (text, password, email, etc.)
- `HTMLSelectElement` (dropdowns)
- `HTMLTextAreaElement` (multi-line text)

**Event Types**:
- `keydown` - Key press detection (keyloggers)
- `keypress` - Character input detection
- `keyup` - Key release detection
- `input` - Input value change detection
- `change` - Form field change detection

### How It Works
1. **Global Hook**: Replaces `EventTarget.prototype.addEventListener` globally
2. **Element Filtering**: Only monitors calls on form elements (ignores window, document, etc.)
3. **Event Filtering**: Only monitors surveillance-related events from config
4. **Evidence Creation**: Creates evidence when monitored event listeners are attached
5. **Transparent Execution**: Always calls original addEventListener (never blocks functionality)

### Evidence Generated
```json
{
  "type": "input.addEventListener(keydown)",
  "data": "loginUsername",
  "target": { "id": "elementId" },
  "stackTrace": [
    "https://example.com/script.js:456:78 [functionName]"
  ]
}
```

### Real-World Example: Keylogger Script
When malicious JavaScript attaches keyloggers:
```javascript
// Surveillance code doing this:
document.getElementById('passwordField').addEventListener('keydown', captureKeys);
document.getElementById('emailField').addEventListener('input', monitorInput);

// Our hook catches:
// 1. input.addEventListener(keydown) for passwordField
// 2. input.addEventListener(input) for emailField
```

**Evidence in your test file**:
```json
{
  "type": "input.addEventListener(addEventListener)",
  "data": "loginUsername",
  "stackTrace": ["surveillance-test.html:761:46 [simulateFormSubmissionEvent]"]
}
```

### Filtering Logic
- **Element Check**: `target instanceof Element && isFormElement(target)`
- **Event Check**: `eventListeners.includes(eventType)`
- **Setting Check**: `trackEventsManager.isInputEventsEnabled()`

### What Gets Ignored
- **Window/Document events**: `window.addEventListener('keydown')` - ignored
- **XMLHttpRequest events**: `xhr.addEventListener('readystatechange')` - ignored
- **Non-surveillance events**: `click`, `scroll`, `resize` - ignored
- **Non-form elements**: `div.addEventListener('keydown')` - ignored

### Configuration Control
Controlled by Track Events setting: **"Input Events"**
- ✅ Enabled: Monitors event listener attachments to form fields
- ❌ Disabled: No addEventListener monitoring

### Performance Impact
- **Minimal**: Only executes when addEventListener is called
- **Filtered**: Most addEventListener calls are ignored (not on form elements)
- **Non-blocking**: Never prevents event listeners from being attached

---

## 3. Event Handler Hooks (`event-handler-hooks.ts`)

### Purpose
Detects when JavaScript code assigns event handlers directly to form element properties (legacy surveillance pattern).

### What It Monitors
Based on `EVIDENCE_CONFIG.formElements`:

**Elements**:
- `HTMLInputElement` (text, password, email, etc.)
- `HTMLSelectElement` (dropdowns)
- `HTMLTextAreaElement` (multi-line text)

**Event Handler Properties**:
- `onkeydown` - Direct keydown handler assignment
- `onkeypress` - Direct keypress handler assignment
- `onkeyup` - Direct keyup handler assignment
- `oninput` - Direct input change handler assignment
- `onchange` - Direct change handler assignment

### How It Works
1. **Property Setter Hook**: Replaces setter methods for event handler properties on element prototypes
2. **Function Detection**: Only monitors when actual functions are assigned (ignores null/undefined cleanup)
3. **Evidence Creation**: Creates evidence when surveillance functions are assigned to event properties
4. **Fallback Support**: Creates property descriptors for browsers that don't have native ones
5. **Transparent Execution**: Always calls original setter (maintains normal functionality)

### Evidence Generated
```json
{
  "type": "input.keydown/eventHandler",
  "data": "loginPassword",
  "target": { "id": "elementId" },
  "stackTrace": [
    "https://example.com/legacy-surveillance.js:123:45 [assignKeylogger]"
  ]
}
```

### Real-World Example: Legacy Keylogger
When old-style surveillance code assigns event handlers:
```javascript
// Legacy surveillance script doing this:
const passwordField = document.getElementById('password');
passwordField.onkeydown = function(e) { // ← Our hook catches this assignment
  logKeystroke(e.key);
};

const emailField = document.getElementById('email');
emailField.oninput = captureInput; // ← Our hook catches this too

// Our hook catches:
// 1. input.keydown/eventHandler for password field
// 2. input.input/eventHandler for email field
```

### Difference from addEventListener Hook
- **addEventListener Hook**: Modern approach - `element.addEventListener('keydown', handler)`
- **Event Handler Hook**: Legacy approach - `element.onkeydown = handler`

Both accomplish the same surveillance goal but use different APIs.

### Configuration Control
Controlled by Track Events setting: **"Input Events"** (same as addEventListener)
- ✅ Enabled: Monitors direct event handler property assignments
- ❌ Disabled: No event handler monitoring

### Performance Impact
- **Very Low**: Only executes when event handler properties are assigned
- **Setter-only**: Only hooks property setters, not getters
- **Non-blocking**: Never prevents handlers from being assigned

---

## 4. Form Hooks (`form-hooks.ts`)

### Purpose
Detects bulk form data collection through form submission and serialization mechanisms.

### What It Monitors
Based on `EVIDENCE_CONFIG.formSubmission` and `EVIDENCE_CONFIG.formDataCreation`:

**FormData Constructor Hook**:
- `new FormData(form)` - When scripts serialize entire forms
- Monitors form-to-FormData conversion for bulk data collection

**Form Submit Method Hook**:
- `form.submit()` - When scripts programmatically submit forms
- Monitors direct form submission method calls

**Submit Event Hook**:
- Document-level submit event listener with capture phase
- Catches form submissions via submit buttons, Enter key, etc.

### How It Works

#### 1. FormData Constructor Hook
- **Global Replacement**: Replaces `window.FormData` constructor
- **Form Detection**: Only monitors when FormData is created with a form element
- **Field Iteration**: When `new FormData(form)` is called, iterates through all form fields
- **Individual Evidence**: Creates separate evidence for each form field being serialized

#### 2. Form Submit Method Hook
- **Prototype Hook**: Replaces `HTMLFormElement.prototype.submit`
- **FormData Creation**: Creates FormData from the form to access all fields
- **Field Evidence**: Generates evidence for each field in the submitted form

#### 3. Submit Event Hook
- **Document Listener**: Captures all submit events at document level
- **Event Detection**: Monitors forms submitted via user interaction
- **Field Processing**: Accesses form fields through FormData for evidence creation

### Evidence Generated

**FormData Creation**:
```json
{
  "type": "input.FormData/get",
  "data": "loginUsername",
  "target": { "id": "elementId" },
  "stackTrace": [
    "https://example.com/bulk-scraper.js:621:34 [serializeAllForms]"
  ]
}
```

**Form Submission**:
```json
{
  "type": "input.submit/property",
  "data": "loginPassword",
  "target": { "id": "passwordField" },
  "stackTrace": [
    "https://example.com/form-submitter.js:456:78 [submitForm]"
  ]
}
```

### Real-World Examples

#### Bulk Form Scraping
```javascript
// Surveillance script doing this:
const forms = document.querySelectorAll('form');
forms.forEach(form => {
  const data = new FormData(form); // ← FormData hook catches each field
  fetch('/collect', { method: 'POST', body: data });
});

// Evidence generated:
// - input.FormData/get for each field in each form
// - Separate evidence per field: username, password, email, etc.
```

#### Programmatic Form Submission
```javascript
// Script submitting form programmatically:
const loginForm = document.getElementById('loginForm');
loginForm.submit(); // ← Form submit hook catches this

// Evidence generated:
// - input.submit/property for each field in the form
```

#### Evidence from Your Test File
From your `evidence_127.0.0.1_2025-09-16_19-43-31.json`:
```json
{
  "type": "input.FormData/get",
  "data": "loginUsername",
  "stackTrace": ["surveillance-test.html:621:34 [simulateFormHooksAttack]"]
}
```

This shows the FormData hook catching bulk form serialization.

### Configuration Control

**"Form Submit"** setting controls:
- ✅ Form submit method calls (`form.submit()`)
- ✅ Submit event monitoring (button clicks, Enter key)

**"Form Data Creation"** setting controls:
- ✅ FormData constructor calls (`new FormData(form)`)

Both work together to provide comprehensive form surveillance detection.

### Performance Impact
- **FormData Hook**: Only executes when `new FormData()` is called with form elements
- **Submit Hooks**: Only execute during actual form submissions
- **Field Iteration**: Minimal overhead - just loops through existing FormData entries
- **Event Capture**: Uses efficient capture phase event listener

### Coverage Analysis
This hook catches the **bulk surveillance patterns** that individual field hooks might miss:

1. **Bulk Form Scraping**: Scripts that serialize entire forms at once
2. **Form Submission Monitoring**: Scripts that intercept form submissions
3. **Mass Data Collection**: Scripts that process multiple forms on a page

Combined with our property getter hooks, this provides **comprehensive coverage** of both individual field reading and bulk form processing surveillance patterns.

---

## Complete Hook Coverage Summary

Our four hook classes provide comprehensive surveillance detection:

1. **Property Getter Hooks**: Individual field value reading (`input.value`)
2. **addEventListener Hooks**: Modern event listener surveillance
3. **Event Handler Hooks**: Legacy event handler surveillance (`element.onkeydown`)
4. **Form Hooks**: Bulk form processing surveillance (`new FormData`, `form.submit()`)

Together, these hooks catch **all major surveillance patterns** used to monitor user input in web applications.