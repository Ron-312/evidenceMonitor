// Filter Manager - Handles element and stack trace filtering logic
// Determines if surveillance events should be captured based on user-defined filters

import { FilterOptions } from '../../shared-types';

interface AttributeFilter {
  name: string;
  value: string;
}

export class FilterManager {
  private filters: FilterOptions = {
    elementSelector: '',
    attributeFilters: '',
    stackKeywordFilter: ''
  };

  /**
   * Updates the current filter configuration
   */
  setFilters(filters: FilterOptions): void {
    this.filters = filters;
    console.debug('[FilterManager] Filters updated:', filters);
  }

  /**
   * Gets the current filter configuration
   */
  getFilters(): FilterOptions {
    return { ...this.filters };
  }

  /**
   * Determines if an element should be monitored based on current filters
   * Returns true if ANY filter matches (OR logic) or if no filters are set
   */
  shouldMonitorElement(element: Element): boolean {
    try {
      // If no filters are set, monitor everything
      if (this.hasNoFilters()) {
        return true;
      }

      // Check element selector filter
      if (this.filters.elementSelector.trim() && this.matchesElementSelector(element)) {
        return true;
      }

      // Check attribute filters
      if (this.filters.attributeFilters.trim() && this.matchesAttributeFilters(element)) {
        return true;
      }

      // If filters are set but none match, don't monitor
      return false;
    } catch (error) {
      console.error('[FilterManager] Error in shouldMonitorElement:', error);
      // Default to monitoring on error
      return true;
    }
  }

  /**
   * Determines if a stack trace should trigger monitoring based on keyword filter
   * Returns true if keyword matches or if no stack filter is set
   */
  shouldMonitorStackTrace(stackTrace: string[]): boolean {
    try {
      // If no stack keyword filter is set, allow all
      if (!this.filters.stackKeywordFilter.trim()) {
        return true;
      }

      const keyword = this.filters.stackKeywordFilter.toLowerCase();
      
      // Check if any stack frame contains the keyword (case-insensitive)
      return stackTrace.some(frame => 
        frame.toLowerCase().includes(keyword)
      );
    } catch (error) {
      console.error('[FilterManager] Error in shouldMonitorStackTrace:', error);
      // Default to monitoring on error
      return true;
    }
  }

  /**
   * Combined filter check for element and stack trace
   * Returns true if BOTH element and stack filters pass (AND logic between filter types)
   */
  shouldMonitor(element: Element, stackTrace: string[]): boolean {
    return this.shouldMonitorElement(element) && this.shouldMonitorStackTrace(stackTrace);
  }

  /**
   * Checks if no filters are currently set
   */
  private hasNoFilters(): boolean {
    return !this.filters.elementSelector.trim() && 
           !this.filters.attributeFilters.trim() && 
           !this.filters.stackKeywordFilter.trim();
  }

  /**
   * Checks if element matches the CSS selector filter
   */
  private matchesElementSelector(element: Element): boolean {
    try {
      // Split by commas and test each selector
      const selectors = this.filters.elementSelector.split(',').map(s => s.trim());
      
      return selectors.some(selector => {
        if (!selector) return false;
        try {
          return element.matches(selector);
        } catch (selectorError) {
          console.warn(`[FilterManager] Invalid CSS selector: ${selector}`, selectorError);
          return false;
        }
      });
    } catch (error) {
      console.error('[FilterManager] Error in matchesElementSelector:', error);
      return false;
    }
  }

  /**
   * Checks if element matches the attribute filters
   */
  private matchesAttributeFilters(element: Element): boolean {
    try {
      const attributeFilters = this.parseAttributeFilters();
      
      return attributeFilters.some(filter => {
        const elementValue = element.getAttribute(filter.name);
        return elementValue === filter.value;
      });
    } catch (error) {
      console.error('[FilterManager] Error in matchesAttributeFilters:', error);
      return false;
    }
  }

  /**
   * Parses attribute filter string into structured format
   * Example: "name=password, type=email" -> [{name: "name", value: "password"}, {name: "type", value: "email"}]
   */
  private parseAttributeFilters(): AttributeFilter[] {
    try {
      const filters: AttributeFilter[] = [];
      const pairs = this.filters.attributeFilters.split(',');
      
      for (const pair of pairs) {
        const trimmed = pair.trim();
        if (!trimmed) continue;
        
        const [name, value] = trimmed.split('=');
        if (name && value) {
          filters.push({
            name: name.trim(),
            value: value.trim()
          });
        }
      }
      
      return filters;
    } catch (error) {
      console.error('[FilterManager] Error parsing attribute filters:', error);
      return [];
    }
  }

  /**
   * Returns filter statistics for debugging
   */
  getStats(): object {
    return {
      hasElementSelector: !!this.filters.elementSelector.trim(),
      hasAttributeFilters: !!this.filters.attributeFilters.trim(),
      hasStackKeywordFilter: !!this.filters.stackKeywordFilter.trim(),
      attributeFilterCount: this.parseAttributeFilters().length,
      isActive: !this.hasNoFilters()
    };
  }
}

// Global filter manager instance
export const filterManager = new FilterManager();