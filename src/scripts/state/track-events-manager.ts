// Track Events Manager - Manages Track Events checkbox states for surveillance detection
// Controls which types of surveillance hooks are active based on HUD checkbox settings

import { TrackEventsState } from '../utils/shared-types';

/**
 * Manages Track Events state received from HUD checkboxes
 * Controls which surveillance detection hooks are active
 */
class TrackEventsManager {
  private trackEventsState: TrackEventsState = {
    inputValueAccess: true,
    inputEvents: true,
    formSubmit: true,
    formDataCreation: true
  };

  /**
   * Updates the track events configuration from HUD
   */
  setTrackEvents(trackEvents: TrackEventsState): void {
    this.trackEventsState = { ...trackEvents };
    console.debug('[TrackEventsManager] Track events updated:', trackEvents);
  }

  /**
   * Returns current track events state
   */
  getTrackEvents(): TrackEventsState {
    return { ...this.trackEventsState };
  }

  /**
   * Checks if Input Value Access tracking is enabled
   * Controls property getter hooks (input.value, textarea.value, etc.)
   */
  isInputValueAccessEnabled(): boolean {
    return this.trackEventsState.inputValueAccess;
  }

  /**
   * Checks if Input Events tracking is enabled
   * Controls addEventListener hooks for keydown, input, change, etc.
   */
  isInputEventsEnabled(): boolean {
    return this.trackEventsState.inputEvents;
  }

  /**
   * Checks if Form Submit tracking is enabled
   * Controls form.submit() method hooks and submit event listeners
   */
  isFormSubmitEnabled(): boolean {
    return this.trackEventsState.formSubmit;
  }

  /**
   * Checks if FormData Creation tracking is enabled
   * Controls FormData constructor hooks (new FormData())
   */
  isFormDataCreationEnabled(): boolean {
    return this.trackEventsState.formDataCreation;
  }

  /**
   * Gets current statistics for debugging
   */
  getStats(): {
    trackEventsState: TrackEventsState;
    enabledCount: number;
    totalCategories: number;
  } {
    const enabled = Object.values(this.trackEventsState).filter(Boolean).length;
    const total = Object.keys(this.trackEventsState).length;

    return {
      trackEventsState: this.getTrackEvents(),
      enabledCount: enabled,
      totalCategories: total
    };
  }
}

// Export singleton instance following the same pattern as other state managers
export const trackEventsManager = new TrackEventsManager();