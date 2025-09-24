// Stack Trace Utility - Captures and formats JavaScript call stacks for evidence
// Formats stack traces to match Explorer's format: "URL:line:col [functionName]"

interface ParsedStackFrame {
  url: string;
  line: number;
  column: number;
  functionName?: string;
}

export class StackTrace {

  // Anonymous function patterns to ignore
  private static readonly ANONYMOUS_PATTERNS = [
    '<anonymous>',
    'Object.<anonymous>',
    'anonymous'
  ];

  /**
   * Captures current call stack and formats for evidence
   * Returns array of formatted stack frames matching Explorer format
   */
  static capture(): string[] {
    try {
      const error = new Error();
      const stack = error.stack;
      
      if (!stack || typeof stack !== 'string') {
        throw new Error('Stack trace is empty or invalid');
      }

      return this.parseAndFormat(stack);
    } catch (captureError) {
      // Log error for debugging but don't break evidence collection
      console.error('[StackTrace] Failed to capture stack trace:', captureError);
      return ['[STACK_TRACE_CAPTURE_FAILED]'];
    }
  }

  /**
   * Parses raw stack trace string and formats to Explorer-compatible array
   */
  private static parseAndFormat(stackString: string): string[] {
    try {
      const lines = stackString.split('\n');
      const formattedFrames: string[] = [];

      for (const line of lines) {
        // Skip the "Error" line itself and empty lines
        if (line.trim() === '' || line.trim() === 'Error') {
          continue;
        }

        const parsedFrame = this.parseStackFrame(line.trim());
        if (parsedFrame && this.shouldIncludeFrame(parsedFrame)) {
          const formattedFrame = this.formatFrame(parsedFrame);
          if (formattedFrame) {
            formattedFrames.push(formattedFrame);
          }
        }
      }

      // Return meaningful frames or error indicator if none found
      return formattedFrames.length > 0 ? formattedFrames : ['[NO_VALID_STACK_FRAMES]'];
    } catch (parseError) {
      console.error('[StackTrace] Failed to parse stack trace:', parseError);
      return ['[STACK_TRACE_PARSE_FAILED]'];
    }
  }

  /**
   * Parses individual stack frame line into components
   * Handles various browser stack trace formats
   */
  private static parseStackFrame(frame: string): ParsedStackFrame | null {
    try {
      // Remove leading "at " if present
      const cleanFrame = frame.replace(/^\s*at\s+/, '');

      // Pattern 1: "functionName (url:line:col)"
      let match = cleanFrame.match(/^(.+?)\s+\((.+?):(\d+):(\d+)\)$/);
      if (match) {
        const [, functionName, url, line, column] = match;
        return {
          url: url.trim(),
          line: parseInt(line, 10),
          column: parseInt(column, 10),
          functionName: functionName.trim()
        };
      }

      // Pattern 2: "url:line:col" (no function name)
      match = cleanFrame.match(/^(.+?):(\d+):(\d+)$/);
      if (match) {
        const [, url, line, column] = match;
        return {
          url: url.trim(),
          line: parseInt(line, 10),
          column: parseInt(column, 10)
        };
      }

      // Pattern 3: Handle edge cases with eval, Function constructor, etc.
      match = cleanFrame.match(/^(.+?)\s+\(eval\s+at\s+.+?\((.+?):(\d+):(\d+)\)/);
      if (match) {
        const [, functionName, url, line, column] = match;
        return {
          url: url.trim(),
          line: parseInt(line, 10),
          column: parseInt(column, 10),
          functionName: `${functionName.trim()} [eval]`
        };
      }

      return null;
    } catch (error) {
      // Don't log individual frame parse errors - too noisy
      return null;
    }
  }

  /**
   * Determines if stack frame should be included in evidence
   * Uses smart blacklist filtering to exclude noise while preserving attack evidence
   */
  private static shouldIncludeFrame(frame: ParsedStackFrame): boolean {
    // 1. Filter out OUR extension specifically (but allow other extensions for detection)
    const isOurExtension = frame.url.includes('chrome-extension://') &&
                          (frame.url.includes('injected.js') ||
                           frame.url.includes('content.js') ||
                           frame.url.includes('background.js') ||
                           frame.url.includes('shared-types.js'));

    if (isOurExtension) {
      return false;  // Hide our extension code from stack traces
    }

    // 2. Filter out browser internal pages (but allow iframe contexts like about:srcdoc)
    const isBrowserInternal = frame.url.startsWith('about:config') ||
                             frame.url.startsWith('about:chrome') ||
                             frame.url.startsWith('about:debugging') ||
                             frame.url.startsWith('about:preferences') ||
                             frame.url.startsWith('about:memory') ||
                             frame.url.startsWith('about:support') ||
                             frame.url.startsWith('chrome://') ||
                             frame.url.startsWith('edge://') ||
                             frame.url.startsWith('firefox://');

    if (isBrowserInternal) {
      return false;  // Hide browser internals
    }

    // 3. Filter out empty or malformed URLs
    if (!frame.url || frame.url.trim() === '' || frame.url === 'null' || frame.url === 'undefined') {
      return false;
    }

    // 4. Allow everything else - websites, iframes, data URLs, blob URLs, etc.
    // This includes:
    // - http://site.com - Regular websites
    // - https://site.com - Secure websites
    // - about:srcdoc - Iframe content (CRITICAL for cross-frame detection)
    // - about:blank - Dynamic iframes
    // - data:text/html - Data URL content
    // - blob:http://site.com/uuid - Blob URLs
    // - file://path - Local files
    // - chrome-extension://other-ext/ - Other extensions (potential malware)
    return true;
  }

  /**
   * Formats parsed frame to Explorer format: "URL:line:col [functionName]"
   */
  private static formatFrame(frame: ParsedStackFrame): string | null {
    try {
      const baseFormat = `${frame.url}:${frame.line}:${frame.column}`;
      
      // Add function name if present and meaningful
      if (frame.functionName && this.isMeaningfulFunctionName(frame.functionName)) {
        return `${baseFormat} [${frame.functionName}]`;
      }

      return baseFormat;
    } catch (error) {
      return null;
    }
  }

  /**
   * Checks if function name should be included in stack trace
   */
  private static isMeaningfulFunctionName(functionName: string): boolean {
    if (!functionName || functionName.trim() === '') {
      return false;
    }

    // Current: Allow all function names (matches Explorer approach)
    return true;

    // Alternative: Filter only completely meaningless anonymous patterns
    // Uncomment below and comment out above to enable smart filtering:
    // const isCompletelyMeaningless = functionName === '<anonymous>' ||
    //                                functionName === 'Object.<anonymous>' ||
    //                                functionName === 'anonymous';
    // return !isCompletelyMeaningless;
  }

  /**
   * Utility method for testing - captures stack with known depth
   */
  static captureWithContext(context: string): string[] {
    const frames = this.capture();
    
    // Add context information for debugging
    if (frames.length > 0 && !frames[0].includes('FAILED')) {
      console.debug(`[StackTrace] Captured ${frames.length} frames for context: ${context}`);
    }
    
    return frames;
  }
}