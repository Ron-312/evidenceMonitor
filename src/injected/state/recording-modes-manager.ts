// Recording Modes - Manages recording mode and console logging for evidence events

import { generateEvidenceType } from '../config/evidence-config';

export type RecordingMode = 'console' | 'breakpoint';

/**
 * Handles recording mode state and console logging
 */
export class RecordingModeHandler {
  private currentMode: RecordingMode = 'console';
  private isRecording: boolean = false;

  /**
   * Sets the current recording mode
   */
  setMode(mode: RecordingMode): void {
    this.currentMode = mode;
    console.debug(`[RecordingMode] Mode set to: ${mode}`);
  }

  /**
   * Gets the current recording mode
   */
  getMode(): RecordingMode {
    return this.currentMode;
  }

  /**
   * Sets the recording state
   */
  setRecording(recording: boolean): void {
    this.isRecording = recording;
    console.debug(`[RecordingMode] Recording state set to: ${recording}`);
  }

  /**
   * Gets the current recording state
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Logs evidence to console with detailed information
   */
  logEvidence(
    target: Element, 
    action: string, 
    hookType: 'property' | 'eventHandler' | 'addEventListener',
    stackTrace?: string[]
  ): void {
    // Only log if recording is active AND mode is console
    if (!this.isRecording || this.currentMode !== 'console') return;

    const targetInfo = this.getTargetInfo(target);
    const evidenceType = generateEvidenceType(target, action, hookType);
    
    console.group(`🔍 Surveillance Detected: ${evidenceType}`);
    console.log('Target:', targetInfo);
    console.log('Action:', action);
    console.log('Hook Type:', hookType);
    console.log('Element:', target);
    
    if (stackTrace && stackTrace.length > 0) {
      console.log('Stack Trace:');
      stackTrace.forEach((frame, index) => {
        console.log(`  ${index + 1}. ${frame}`);
      });
    }
    
    console.groupEnd();
  }

  /**
   * Gets human-readable target information
   */
  private getTargetInfo(target: Element): string {
    const tagName = target.tagName.toLowerCase();
    const id = target.id ? `#${target.id}` : '';
    const className = target.className ? `.${target.className.replace(/\s+/g, '.')}` : '';
    const name = target.getAttribute('name') ? `[name="${target.getAttribute('name')}"]` : '';
    
    return `${tagName}${id}${className}${name}`;
  }

}

// Global instance
export const recordingModeHandler = new RecordingModeHandler();