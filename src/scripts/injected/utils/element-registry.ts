// Element Registry - Stable ID management for DOM elements
// Provides consistent element identification across multiple surveillance actions

export class ElementRegistry {
  private elementToId: Map<Element, string> = new Map();
  private existingIds: Set<string> = new Set();
  private readonly MAX_ELEMENTS = 5000;
  private cleanupCounter = 0;
  private readonly CLEANUP_INTERVAL = 100;

  /**
   * Gets a stable ID for the given element. Creates new ID if element not seen before.
   * Returns consistent ID for same element across multiple calls.
   */
  getElementId(element: Element): string {
    // Validate input - disregard non-elements
    if (!element || !(element instanceof Element)) {
      throw new Error('ElementRegistry.getElementId() requires a valid DOM Element');
    }

    // Return existing ID if element already registered
    if (this.elementToId.has(element)) {
      return this.elementToId.get(element)!;
    }

    // Periodic cleanup to prevent memory bloat
    if (++this.cleanupCounter % this.CLEANUP_INTERVAL === 0) {
      this.performCleanup();
    }

    // Generate new unique ID for this element
    const newId = this.generateUniqueElementId();
    this.elementToId.set(element, newId);
    this.existingIds.add(newId);

    return newId;
  }

  /**
   * Checks if element already has an assigned ID
   */
  hasElementId(element: Element): boolean {
    if (!element || !(element instanceof Element)) {
      return false;
    }
    return this.elementToId.has(element);
  }

  /**
   * Gets current registry statistics for debugging/monitoring
   */
  getStats(): { totalElements: number; memoryPressure: boolean } {
    return {
      totalElements: this.elementToId.size,
      memoryPressure: this.elementToId.size > this.MAX_ELEMENTS * 0.8
    };
  }

  /**
   * Clears all element registrations (for testing/cleanup)
   */
  clearRegistry(): void {
    this.elementToId.clear();
    this.existingIds.clear();
    this.cleanupCounter = 0;
  }

  /**
   * Generates unique element ID matching Explorer format
   * Uses collision detection to ensure uniqueness
   */
  private generateUniqueElementId(): string {
    let id: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      id = Math.random().toString(36).substr(2);
      attempts++;
      
      // Failsafe: if too many collisions, add timestamp
      if (attempts >= maxAttempts) {
        id = Math.random().toString(36).substr(2) + Date.now().toString(36);
        break;
      }
    } while (this.existingIds.has(id));

    return id;
  }

  /**
   * Removes elements no longer in DOM and enforces size limits
   */
  private performCleanup(): void {
    let removedCount = 0;

    // Remove elements that are no longer in the DOM
    for (const [element, id] of this.elementToId) {
      if (!document.contains(element)) {
        this.elementToId.delete(element);
        this.existingIds.delete(id);
        removedCount++;
      }
    }

    // If still over limit after cleanup, remove oldest entries (FIFO)
    if (this.elementToId.size > this.MAX_ELEMENTS) {
      const elementsToRemove = this.elementToId.size - this.MAX_ELEMENTS;
      let removed = 0;

      for (const [element, id] of this.elementToId) {
        if (removed >= elementsToRemove) break;
        
        this.elementToId.delete(element);
        this.existingIds.delete(id);
        removed++;
      }

      console.warn(`[ElementRegistry] Removed ${removed} oldest elements to stay within ${this.MAX_ELEMENTS} limit`);
    }

    if (removedCount > 0) {
      console.debug(`[ElementRegistry] Cleaned up ${removedCount} detached elements`);
    }
  }
}