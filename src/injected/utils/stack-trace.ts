// Stack Trace Utility - Captures and formats JavaScript call stacks for evidence
// Formats stack traces to match Explorer's format: "URL:line:col [functionName]"

interface ParsedStackFrame {
  url: string;
  line: number;
  column: number;
  functionName?: string;
}

export class StackTrace {
  // Chrome extension URL patterns to filter out
  private static readonly EXTENSION_PATTERNS = [
    'chrome-extension://',
    'moz-extension://',
    'webkit-masked-url://'
  ];

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
   * Filters out extension frames and invalid URLs
   */
  private static shouldIncludeFrame(frame: ParsedStackFrame): boolean {
    // Filter out extension frames
    const isExtensionFrame = this.EXTENSION_PATTERNS.some(pattern => 
      frame.url.includes(pattern)
    );

    if (isExtensionFrame) {
      return false;
    }

    // Only include HTTP/HTTPS URLs and valid local files
    const isValidUrl = frame.url.startsWith('http://') || 
                      frame.url.startsWith('https://') ||
                      frame.url.startsWith('file://') ||
                      frame.url.startsWith('/');

    return isValidUrl;
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
   * Checks if function name is meaningful (not anonymous)
   */
  private static isMeaningfulFunctionName(functionName: string): boolean {
    if (!functionName || functionName.trim() === '') {
      return false;
    }

    // Filter out anonymous function patterns
    const isAnonymous = this.ANONYMOUS_PATTERNS.some(pattern =>
      functionName.includes(pattern)
    );

    return !isAnonymous;
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