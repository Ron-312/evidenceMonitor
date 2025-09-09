# Element Registry (element-registry.ts)

## Overview
The ElementRegistry class provides stable, unique identification for DOM elements across multiple surveillance detection events. It ensures that the same element receives the same ID throughout its lifetime, enabling correlation of different surveillance actions on the same element.

## Core Functionality

### Purpose
When multiple scripts interact with the same DOM element (e.g., one script attaches a keydown listener, another reads the value), we need to connect these actions in our evidence. The ElementRegistry provides stable synthetic IDs that remain consistent across all interactions with an element.

### Example Correlation
```javascript
const emailInput = document.getElementById('email');

// Script A attaches listener - gets target.id: "bydcz1k6q7uimu26"
emailInput.addEventListener('keydown', handler1);

// Script B reads value - gets same target.id: "bydcz1k6q7uimu26"  
let value = emailInput.value;

// Script C attaches different listener - same target.id: "bydcz1k6q7uimu26"
emailInput.addEventListener('change', handler2);
```

All three evidence events will share the same `target.id`, allowing analysts to see that one element is under heavy surveillance.

## Key Design Decisions

### 1. Map vs WeakMap Storage
**Decision**: Use `Map<Element, string>` instead of `WeakMap<Element, string>`
**Reasoning**: 
- WeakMap would lose element IDs when elements are temporarily detached/reattached
- Elements that get moved around in DOM would get new IDs, breaking correlation
- Map allows us to implement intelligent cleanup and memory management
- Consistent with Explorer's behavior for element identification

### 2. Element ID Format - Explorer Compatibility
**Decision**: Match Explorer's ID format exactly
**Implementation**: `Math.random().toString(36).substr(2)`
**Example IDs**: `"bydcz1k6q7uimu26"`, `"l1tzmuoezdn68da"`, `"9dg921kimkj3zpzh"`

**Benefits**:
- Direct compatibility with Explorer evidence format
- Enables accurate comparison between Explorer and extension evidence
- Maintains consistent evidence structure across tools

### 3. Collision Detection Strategy
**Decision**: Implement collision detection with failsafe mechanism
```typescript
private generateUniqueElementId(): string {
  let id: string;
  let attempts = 0;
  
  do {
    id = Math.random().toString(36).substr(2);
    attempts++;
    
    // Failsafe: add timestamp if too many collisions
    if (attempts >= 10) {
      id = Math.random().toString(36).substr(2) + Date.now().toString(36);
      break;
    }
  } while (this.existingIds.has(id));
  
  return id;
}
```

**Reasoning**:
- Prevents duplicate IDs which would break evidence correlation
- Failsafe mechanism ensures function always returns unique ID
- Timestamp fallback maintains uniqueness even under extreme collision scenarios

### 4. Memory Management Strategy
**Decision**: Proactive cleanup with 5,000 element limit
**Components**:
- **Periodic Cleanup**: Every 100 new elements, scan for detached DOM elements
- **Size Limit**: Maximum 5,000 tracked elements to prevent memory bloat
- **FIFO Removal**: Remove oldest elements if limit exceeded after cleanup

**Implementation Details**:
```typescript
private performCleanup(): void {
  // Remove elements no longer in DOM
  for (const [element, id] of this.elementToId) {
    if (!document.contains(element)) {
      this.elementToId.delete(element);
      this.existingIds.delete(id);
    }
  }
  
  // FIFO removal if still over limit
  if (this.elementToId.size > this.MAX_ELEMENTS) {
    // Remove oldest entries
  }
}
```

### 5. Error Handling Philosophy
**Decision**: Fail fast for invalid inputs
**Implementation**: Throw error for non-Element parameters
**Reasoning**:
- If calling code passes invalid data, it indicates a programming error
- Better to fail immediately than return meaningless results
- Keeps the API contract clear and predictable

## Mid-Page Activation Behavior

### Scenario: Extension Enabled After Page Load
When users enable the extension after browsing has begun:

1. **Existing Elements**: Get IDs when first encountered by hooks
2. **Element Consistency**: Same element always gets same ID from first encounter
3. **No Retroactive IDs**: Elements don't get IDs until first surveillance interaction

### Example Timeline
```javascript
// Page loads, user types (extension disabled)
inputElement.addEventListener('keydown', spy); // Not captured

// User enables extension mid-session
// User continues typing - existing listener triggers

let value = inputElement.value; // ← First encounter: element gets ID "abc123xyz"
inputElement.addEventListener('change', spy2); // ← Same element uses ID "abc123xyz"
```

**Result**: Both evidence events correlate correctly despite mid-session activation.

## Memory Management Details

### Cleanup Triggers
- **Frequency**: Every 100 new element registrations
- **Detection**: `document.contains(element)` to identify detached elements
- **Scope**: Only removes elements no longer in DOM

### Memory Protection
- **Soft Limit**: 4,000 elements (80% of max) triggers warning in stats
- **Hard Limit**: 5,000 elements triggers FIFO cleanup
- **Tracking**: Dual data structures (`Map` + `Set`) for O(1) collision detection

### Memory Usage Estimation
- Average case: ~100-500 elements per typical webpage
- Heavy case: ~1,000-2,000 elements on complex SPAs
- Limit: 5,000 elements provides 2.5-10x safety margin
- Memory per element: ~200 bytes (element reference + string ID + overhead)

## API Reference

### Core Methods

#### `getElementId(element: Element): string`
**Purpose**: Get or create stable ID for element
**Behavior**: 
- Returns existing ID if element already registered
- Generates new unique ID for new elements
- Triggers periodic cleanup every 100 calls

**Error Conditions**: Throws error if parameter is not a valid DOM Element

#### `hasElementId(element: Element): boolean`
**Purpose**: Check if element already has assigned ID
**Use Case**: Testing and debugging scenarios

#### `getStats(): { totalElements: number; memoryPressure: boolean }`
**Purpose**: Runtime monitoring of registry health
**Returns**:
- `totalElements`: Current number of tracked elements
- `memoryPressure`: true if approaching 80% of limit (4,000 elements)

#### `clearRegistry(): void`
**Purpose**: Complete cleanup for testing/reset scenarios
**Behavior**: Removes all element registrations and resets internal counters

## Integration with Evidence System

### Relationship to Evidence Configuration
- **ElementRegistry**: "Dumb" ID assignment service - assigns IDs to any DOM element
- **Evidence Config**: Used by hook classes to determine which elements to monitor
- **Separation of Concerns**: Registry doesn't filter, hooks decide what to track

### Usage Pattern in Hook Classes
```typescript
// In addEventListener hook
if (shouldHookEventListener(target, eventType)) {  // Config-based filtering
  const elementId = registry.getElementId(target);  // ID assignment
  const evidence = createEvidence(elementId, ...);  // Evidence creation
}
```

## Performance Considerations

### Time Complexity
- **ID Lookup**: O(1) for existing elements (Map access)
- **ID Generation**: O(1) average case, O(k) with collision detection
- **Cleanup**: O(n) where n = number of tracked elements
- **Overall**: Amortized O(1) per element operation

### Space Complexity
- **Primary Storage**: O(n) where n = number of unique elements accessed
- **Secondary Storage**: O(n) for collision detection set
- **Memory Growth**: Linear with number of unique form elements encountered

### Cleanup Impact
- **Frequency**: Every 100 registrations minimizes cleanup overhead
- **DOM Queries**: `document.contains()` is reasonably fast for cleanup
- **Background Processing**: Cleanup doesn't block surveillance detection

## Error Scenarios & Handling

### Invalid Input Handling
```typescript
registry.getElementId(null);        // Throws Error
registry.getElementId(undefined);   // Throws Error  
registry.getElementId('string');    // Throws Error
registry.getElementId(textNode);    // Throws Error
```

### Memory Pressure Scenarios
1. **Normal Cleanup**: Detached elements removed automatically
2. **Excessive Growth**: FIFO removal after cleanup fails to reduce size
3. **Logging**: Warnings logged when memory protection activates

### Edge Cases
1. **Element Reuse**: Same element detached/reattached keeps same ID
2. **Cross-Frame**: Each frame gets independent registry instance
3. **Extension Restart**: Registry cleared when injected script reloads

## Future Enhancement Opportunities

### Performance Optimizations
- Batch cleanup operations for better performance
- Smarter cleanup triggers based on memory pressure
- Element type-specific ID namespacing

### Feature Extensions
- Element metadata storage (tag name, class, attributes)
- Cross-frame element correlation for iframe surveillance
- Element lifecycle event tracking

### Integration Improvements
- Integration with evidence deduplication logic
- Element-specific surveillance pattern analysis
- Memory usage reporting to background worker

---
*Created: 2025-09-04*
*Last Updated: 2025-09-04*