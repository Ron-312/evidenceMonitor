# Form Hooks Implementation Plan

## Overview

Based on analysis of Explorer's reference implementation, this document outlines our approach for implementing form submission and FormData creation surveillance hooks.

## What Explorer Does

### FormData Constructor Hook
```typescript
h_window.hookMembers({
    FormData(ctx, setup) {
        let next = ctx.next();
        if (ctx.args[1]) {  // Only if FormData(formElement) - not empty FormData()
            let form = ctx.args[1];
            next.value.forEach((value, key, parent) => {
                const element = form.querySelector(`[name="${key}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
                if (!element) return;
                let reportPayload = prepareValueReportPayload(element, setup, false);
                if (reportPayload) {
                    reportFopi(next, setup, {
                        ...reportPayload,
                        actionId: Misc.getRandomId()  // Separate actionId for each field
                    });
                }
            });
        }
    }
});
```

### Form Submit Method Hook
```typescript
h_HTMLFormElement_prototype.hookMembers({
    submit(ctx, setup) {
        let next = ctx.next();
        let form = ctx.self;
        let formData = new FormData(form);
        formData.forEach((value, key, parent) => {
            const element = form.querySelector(`[name="${key}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            if (!element) return;
            let reportPayload = prepareValueReportPayload(element, setup);
            if (reportPayload) {
                reportFopi(next, setup, {
                    ...reportPayload,
                    actionId: Misc.getRandomId(),
                    extraData: { formAction: form.action }
                });
            }
        });
    }
});
```

### Form Submit Event Hook
```typescript
b_document.bind("addEventListener")("submit", event => {
    if ((event.target as HTMLFormElement).tagName === "FORM") {
        const form = event.target as HTMLFormElement;
        const formData = new FormData(event.target as HTMLFormElement);
        const formAction = form.action;
        formData.forEach((value, key, parent) => {
            const element = form.querySelector(`[name="${key}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            if (!element) return;
            let reportPayload = prepareValueReportPayload(element, setup, true);  // isSubmitEvent = true
            if (reportPayload) {
                Report.data({
                    ...reportPayload,
                    extraData: { formAction },
                    actionId: Misc.getRandomId(),
                    // ... other fields
                });
            }
        });
    }
});
```

## Key Design Decisions

### 1. Hook Location Strategy
**Decision**: Hook FormData globally, filter by context
- **Rationale**: FormData is a global constructor, can't be hooked per-element
- **Implementation**: Only generate evidence when `new FormData(formElement)` is called with actual form
- **Filter**: Skip `new FormData()` empty constructors and manual append scenarios

### 2. Evidence Generation Pattern
**Decision**: Generate individual evidence entries per form field
- **Rationale**: Matches Explorer's pattern for granular tracking
- **Implementation**: Each form field gets its own `actionId` and evidence entry
- **Benefits**: Can track individual field access patterns vs bulk form serialization

### 3. Form Context Tracking
**Decision**: Include form action URL in evidence metadata
- **Rationale**: Knowing WHERE data is being sent is critical for surveillance detection
- **Implementation**: Add `extraData.formAction` to all form-related evidence
- **Use case**: Detect when sensitive fields are submitted to third-party domains

## Implementation Plan

### Phase 1: Create `form-hooks.ts` File
1. **FormData Constructor Hook**
   - Hook `window.FormData` globally
   - Check if first argument is HTMLFormElement
   - Iterate through FormData entries and generate evidence per field
   - Use existing `generateEvidenceType()` function

2. **Form Submit Method Hook**
   - Hook `HTMLFormElement.prototype.submit`
   - Create FormData from form and iterate fields
   - Include form action URL in evidence

3. **Form Submit Event Hook**
   - Set up document-level submit event listener
   - Handle event-based form submissions
   - Mark evidence with `isSubmitEvent = true` flag

### Phase 2: Evidence Config Extension
```typescript
export const EVIDENCE_CONFIG: EvidenceHooks = {
  formElements: {
    // existing config...
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

### Phase 3: Integration with Existing Architecture
1. **Hook Manager Integration**
   - Add form hooks to `HookManager.installHooks()`
   - Ensure proper initialization order

2. **Evidence Collector Integration**
   - Extend evidence types for form operations
   - Add form-specific metadata fields

3. **Filter Integration**
   - Connect to Track Events checkboxes in HUD
   - Enable/disable form tracking based on user settings

## Evidence Types

### FormData Creation
- **Type**: `FormData.constructor`
- **Target**: Form element
- **Action**: `FormData`
- **Hook Type**: `constructor`
- **Example**: `form.FormData/constructor`

### Form Submit Method
- **Type**: `form.submit`
- **Target**: Form element
- **Action**: `submit`
- **Hook Type**: `method`
- **Example**: `form.submit/method`

### Form Submit Event
- **Type**: `form.addEventListener(submit)`
- **Target**: Form element
- **Action**: `submit`
- **Hook Type**: `addEventListener`
- **Example**: `form.addEventListener(submit)`

## Integration with Track Events UI

### Checkbox Mapping
1. **"FormData Creation"** → Controls FormData constructor hook
2. **"Form Submit"** → Controls both method and event hooks

### State Management
```typescript
trackingEnabled: {
  inputValueAccess: boolean,
  inputEvents: boolean,
  formSubmit: boolean,
  formDataCreation: boolean
}
```

## Next Steps

1. Create `src/injected/hooks/form-hooks.ts` file
2. Extend evidence config with form categories
3. Add form hook installation to HookManager
4. Create Track Events section in HUD
5. Test with various form submission patterns

## Testing Scenarios

1. **FormData Constructor**
   - `new FormData(form)` with login form
   - `new FormData()` empty (should not trigger)
   - `formData.append()` after creation

2. **Form Submit Methods**
   - `form.submit()` programmatic submission
   - Form submission via button click
   - Form submission via Enter key

3. **Form Context**
   - Same-domain form submission
   - Cross-domain form submission
   - Forms with password fields
   - Forms with sensitive inputs

## Implementation Priority

**High Priority** (Required for MVP):
- FormData constructor hook
- Form submit method hook
- Basic evidence generation

**Medium Priority**:
- Form submit event hook
- Form action URL tracking
- Integration with existing filters

**Low Priority**:
- Advanced form field classification
- Dynamic form detection
- Form validation hooks