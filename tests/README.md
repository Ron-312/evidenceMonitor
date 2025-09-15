# Extension Testing Page

## Purpose

This test page is designed to simulate malicious JavaScript behaviors that should trigger the surveillance detection hooks in our Chrome extension. Each section tests a specific hook type to verify the extension is working correctly.

## Test Scenarios

### 1. addEventListener Hook Test
- Simulates malicious scripts adding event listeners to form elements
- Tests monitoring of `input`, `keydown`, `change`, `focus`, `blur` events
- Should trigger evidence collection when surveillance patterns are detected

### 2. Event Handler Hooks Test
- Simulates malicious scripts setting event handler properties
- Tests monitoring of `oninput`, `onkeydown`, `onchange`, `onfocus`, `onblur` properties
- Should trigger evidence collection when event handlers are assigned

### 3. Property Getter Hooks Test
- Simulates malicious scripts accessing form element values
- Tests monitoring of `value`, `nodeValue` property access
- Should trigger evidence collection when scripts read user input

### 4. Form Hooks Test
- Simulates malicious scripts intercepting form submissions
- Tests monitoring of `FormData` creation and `form.submit()` calls
- Should trigger evidence collection when form data is accessed or submitted

## How to Use

1. Load this HTML page in Chrome with the extension installed
2. Open Chrome DevTools Console to see hook activity
3. Click the test buttons to trigger each hook type
4. Verify extension creates evidence for detected surveillance
5. Check extension popup/HUD for recorded evidence

## Expected Behavior

- Console should show hook installation messages
- Test button clicks should trigger surveillance detection
- Extension should create evidence entries for each detected pattern
- No errors should occur during normal page functionality