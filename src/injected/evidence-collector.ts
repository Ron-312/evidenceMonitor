// Evidence Collector - Centralizes evidence creation, deduplication, and transmission
// Handles handshake protocol and communication with content script

import { ElementRegistry } from './utils/element-registry';
import { StackTrace } from './utils/stack-trace';
import { generateEvidenceType } from './config/evidence-config';
import { recordingModeHandler } from './state/recording-modes-manager';
import { filterManager } from './state/filter-manager';
import { EvidenceEvent } from '../shared-types';

export class EvidenceCollector {
  private elementRegistry: ElementRegistry;
  private isContentScriptReady: boolean = false;
  private pendingEvidence: EvidenceEvent[] = [];
  private readonly maxQueueSize: number = 1000;
  private readonly handshakeTimeout: number = 5000; // 5 seconds
  private handshakeTimer: number | null = null;

  constructor(elementRegistry: ElementRegistry) {
    this.elementRegistry = elementRegistry;
    this.setupHandshakeListener();
    this.startHandshakeTimeout();
  }

  /**
   * Creates and sends evidence for surveillance action
   * Handles deduplication and queuing until content script ready
   * Returns decision object for debugger breakpoint logic
   */
  createAndSendEvidence(
    element: Element, 
    action: string, 
    hookType: 'property' | 'eventHandler' | 'addEventListener'
  ): { shouldProceed: boolean; evidence: EvidenceEvent } {
    // Create evidence object first to get stack trace (single capture)
    const evidence = this.createEvidence(element, action, hookType);
    
    // Apply filters - check if this element and stack trace should be monitored
    const shouldProceed = filterManager.shouldMonitor(element, evidence.stackTrace);

    if (shouldProceed) {

      // Console log if in console mode
      recordingModeHandler.logEvidence(element, action, hookType, evidence.stackTrace);

      // Send evidence
      this.sendEvidence(evidence);
    }

    return { shouldProceed, evidence };
  }

  /**
   * Creates evidence object from surveillance action
   */
  private createEvidence(
    element: Element,
    action: string, 
    hookType: 'property' | 'eventHandler' | 'addEventListener'
  ): EvidenceEvent {
    const elementId = this.elementRegistry.getElementId(element);
    const stackTrace = StackTrace.capture();
    const evidenceType = generateEvidenceType(element, action, hookType);
    
    return {
      actionId: this.generateActionId(),
      type: evidenceType,
      start: performance.now(),
      duration: 0, // Always 0 for surveillance detection
      data: this.getElementData(element),
      target: { id: elementId },
      stackTrace: stackTrace
    };
  }

  /**
   * Generates unique action ID matching Explorer format
   */
  private generateActionId(): string {
    return Math.random().toString(36).substr(2);
  }

  /**
   * Gets element data for evidence - ID, name, then outerHTML
   */
  private getElementData(element: Element): string {
    try {
      if (element.id) {
        return element.id;
      }
      
      const nameAttr = element.getAttribute('name');
      if (nameAttr) {
        return nameAttr;
      }
      
      if (element.outerHTML) {
        return element.outerHTML.substring(0, 300);
      }
      
      return '[NO_ELEMENT_DATA]';
    } catch (error) {
      return '[ELEMENT_DATA_ERROR]';
    }
  }


  /**
   * Sends evidence immediately or queues if content script not ready
   */
  private sendEvidence(evidence: EvidenceEvent): void {
    if (this.isContentScriptReady) {
      this.transmitEvidence(evidence);
    } else {
      this.queueEvidence(evidence);
    }
  }

  /**
   * Queues evidence with overflow protection
   */
  private queueEvidence(evidence: EvidenceEvent): void {
    // Check queue size limit
    if (this.pendingEvidence.length >= this.maxQueueSize) {
      // Remove oldest evidence (FIFO)
      this.pendingEvidence.shift();
      console.warn(`[EvidenceCollector] Queue full, dropped oldest evidence. Queue size: ${this.maxQueueSize}`);
    }
    
    this.pendingEvidence.push(evidence);
    console.debug(`[EvidenceCollector] Queued evidence. Queue size: ${this.pendingEvidence.length}`);
  }

  /**
   * Transmits evidence to content script via window.postMessage
   */
  private transmitEvidence(evidence: EvidenceEvent): void {
    try {
      window.postMessage({
        type: 'EVIDENCE_EVENT',
        event: evidence
      }, '*');
    } catch (error) {
      console.error('[EvidenceCollector] Failed to transmit evidence:', error);
      // Re-queue the evidence for retry
      this.queueEvidence(evidence);
    }
  }

  /**
   * Sets up listener for content script ready handshake
   */
  private setupHandshakeListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'CONTENT_SCRIPT_READY') {
        this.onContentScriptReady();
      }
    });
  }

  /**
   * Handles content script ready signal
   */
  private onContentScriptReady(): void {
    console.debug('[EvidenceCollector] Content script ready, flushing pending evidence');
    
    this.isContentScriptReady = true;
    
    // Clear handshake timeout
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
    
    // Flush all pending evidence
    this.flushPendingEvidence();
  }

  /**
   * Sends all queued evidence to content script
   */
  private flushPendingEvidence(): void {
    console.debug(`[EvidenceCollector] Flushing ${this.pendingEvidence.length} pending evidence events`);
    
    for (const evidence of this.pendingEvidence) {
      this.transmitEvidence(evidence);
    }
    
    this.pendingEvidence = []; // Clear queue
  }

  /**
   * Starts timeout for handshake - assumes ready if timeout expires
   */
  private startHandshakeTimeout(): void {
    this.handshakeTimer = window.setTimeout(() => {
      if (!this.isContentScriptReady) {
        console.warn('[EvidenceCollector] Handshake timeout - assuming content script ready');
        this.onContentScriptReady();
      }
    }, this.handshakeTimeout);
  }

  /**
   * Gets current collector statistics for debugging
   */
  getStats(): {
    ready: boolean;
    queueSize: number;
    memoryPressure: boolean;
  } {
    return {
      ready: this.isContentScriptReady,
      queueSize: this.pendingEvidence.length,
      memoryPressure: this.pendingEvidence.length > this.maxQueueSize * 0.8
    };
  }

  /**
   * Clears all pending evidence and resets state (for testing)
   */
  clearState(): void {
    this.pendingEvidence = [];
    this.isContentScriptReady = false;

    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }
}