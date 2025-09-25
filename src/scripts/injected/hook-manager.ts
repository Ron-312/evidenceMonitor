// Hook Manager - Coordinates surveillance detection hook installations
// Manages lifecycle of all surveillance detection hooks and provides unified interface

import { ElementRegistry } from './utils/element-registry';
import { EvidenceCollector } from './evidence-collector';
import { AddEventListenerHook } from './hooks/addEventListener-hook';
import { PropertyGetterHooks } from './hooks/property-getter-hooks';
import { EventHandlerHooks } from './hooks/event-handler-hooks';
import { FormHooks } from './hooks/form-hooks';
import { filterManager } from './state/filter-manager';

/**
 * Central coordinator for all surveillance detection hooks
 * Manages installation, lifecycle, and provides unified interface for hook management
 */
export class HookManager {
  private elementRegistry: ElementRegistry;
  private evidenceCollector: EvidenceCollector;
  private addEventListenerHook: AddEventListenerHook;
  private propertyGetterHooks: PropertyGetterHooks;
  private eventHandlerHooks: EventHandlerHooks;
  private formHooks: FormHooks;
  private isInitialized: boolean = false;
  private hooksInstalled: boolean = false;

  constructor() {
    console.debug('[HookManager] Initializing surveillance detection system...');
    
    try {
      // Initialize core components
      this.elementRegistry = new ElementRegistry();
      this.evidenceCollector = new EvidenceCollector(this.elementRegistry);
      
      // Initialize all hook types
      this.addEventListenerHook = new AddEventListenerHook(this.evidenceCollector);
      this.propertyGetterHooks = new PropertyGetterHooks(this.evidenceCollector);
      this.eventHandlerHooks = new EventHandlerHooks(this.evidenceCollector);
      this.formHooks = new FormHooks(this.evidenceCollector);
      
      this.isInitialized = true;
      console.debug('[HookManager] Core components initialized successfully');
      
    } catch (error) {
      console.error('[HookManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Installs all surveillance detection hooks
   */
  installAllHooks(): void {
    if (!this.isInitialized) {
      throw new Error('Cannot install hooks - initialization failed');
    }

    if (this.hooksInstalled) {
      console.warn('[HookManager] Hooks already installed, skipping');
      return;
    }

    try {
      console.debug('[HookManager] Installing all surveillance detection hooks...');
      
      // Install all hook types simultaneously for complete coverage
      this.addEventListenerHook.install();
      this.propertyGetterHooks.install();
      this.eventHandlerHooks.install();
      this.formHooks.install();
      
      this.hooksInstalled = true;
      console.debug('[HookManager] All surveillance detection hooks installed successfully');
      
    } catch (error) {
      console.error('[HookManager] Failed to install hooks:', error);
      throw error;
    }
  }

  /**
   * Uninstalls all surveillance detection hooks and cleans up resources
   */
  uninstallAllHooks(): void {
    if (!this.isInitialized || !this.hooksInstalled) {
      console.debug('[HookManager] No hooks to uninstall');
      return;
    }

    try {
      console.debug('[HookManager] Uninstalling all surveillance detection hooks...');
      
      // Uninstall all hooks
      this.addEventListenerHook.uninstall();
      this.propertyGetterHooks.uninstall();
      this.eventHandlerHooks.uninstall();
      this.formHooks.uninstall();
      
      this.hooksInstalled = false;
      console.debug('[HookManager] All surveillance detection hooks uninstalled successfully');
      
    } catch (error) {
      console.error('[HookManager] Error during hook uninstallation:', error);
      // Continue anyway - mark as uninstalled
      this.hooksInstalled = false;
    }
  }

  /**
   * Signals to content script that hook manager is ready to start evidence collection
   */
  notifyReady(): void {
    try {
      window.postMessage({
        type: 'INJECTED_SCRIPT_READY'
      }, '*');
      console.debug('[HookManager] Sent ready signal to content script');
    } catch (error) {
      console.error('[HookManager] Failed to send ready signal:', error);
    }
  }

  /**
   * Returns comprehensive system statistics for debugging and monitoring
   */
  getStats() {
    if (!this.isInitialized) {
      return null;
    }

    return {
      hookManager: {
        isInitialized: this.isInitialized,
        hooksInstalled: this.hooksInstalled
      },
      elementRegistry: this.elementRegistry.getStats(),
      evidenceCollector: this.evidenceCollector.getStats(),
      filterManager: filterManager.getStats(),
      hooks: {
        addEventListener: this.addEventListenerHook.isInstalled(),
        propertyGetters: this.propertyGetterHooks.isInstalled(),
        eventHandlers: this.eventHandlerHooks.isInstalled(),
        formHooks: this.formHooks.isInstalled()
      }
    };
  }

  /**
   * Returns whether the hook manager is fully initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.hooksInstalled;
  }

  /**
   * Returns whether hooks are currently installed
   */
  areHooksInstalled(): boolean {
    return this.hooksInstalled;
  }

  /**
   * Returns whether the system is initialized (but hooks may not be installed yet)
   */
  isSystemInitialized(): boolean {
    return this.isInitialized;
  }
}