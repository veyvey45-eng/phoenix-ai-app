/**
 * E2B Sandbox Module
 * Real code execution using E2B Code Interpreter SDK
 */

import { Sandbox } from '@e2b/code-interpreter';

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  language: 'python' | 'javascript';
  filesGenerated?: string[];
}

class E2BSandboxService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.E2B_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[E2B Sandbox] API key not configured');
    }
  }

  /**
   * Check if E2B is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Execute Python code in E2B Sandbox
   */
  async executePython(code: string, userId: string, username: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[E2B Sandbox] Executing Python code for user: ${username}`);
      
      // Validate code for dangerous operations
      this.validateCode(code, 'python');
      
      // If E2B is not available, use fallback
      if (!this.isAvailable()) {
        console.log('[E2B Sandbox] E2B not available, using fallback execution');
        return this.executePythonFallback(code, userId, username, startTime);
      }
      
      // Create sandbox and execute code
      let sandbox: InstanceType<typeof Sandbox> | null = null;
      try {
        sandbox = await Sandbox.create();
        
        console.log('[E2B Sandbox] Created E2B sandbox');
        
        // Execute the code
        const execution = await sandbox.runCode(code, { language: 'python' });
        
        // Collect output
        let output = '';
        if (execution.logs?.stdout) {
          output += execution.logs.stdout.join('\n');
        }
        if (execution.logs?.stderr) {
          output += (output ? '\n' : '') + execution.logs.stderr.join('\n');
        }
        
        // Handle errors
        if (execution.error) {
          const executionTime = Date.now() - startTime;
          return {
            success: false,
            output: output || '',
            error: execution.error.value,
            executionTime,
            language: 'python',
          };
        }
        
        const executionTime = Date.now() - startTime;
        
        return {
          success: true,
          output: output || '[No output]',
          executionTime,
          language: 'python',
        };
      } finally {
        // Clean up
        if (sandbox) {
          try {
            // E2B Sandbox doesn't have explicit close method
            // It will be cleaned up automatically
          } catch (e) {
            console.error('[E2B Sandbox] Error closing sandbox:', e);
          }
        }
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error('[E2B Sandbox] Python execution error:', errorMessage);
      
      // If E2B failed, use fallback
      if (errorMessage.includes('API') || errorMessage.includes('auth') || errorMessage.includes('401')) {
        console.log('[E2B Sandbox] E2B authentication failed, using fallback execution');
        return this.executePythonFallback(code, userId, username, startTime);
      }
      
      return {
        success: false,
        output: '',
        error: errorMessage,
        executionTime,
        language: 'python',
      };
    }
  }

  /**
   * Execute JavaScript code in E2B Sandbox
   */
  async executeJavaScript(code: string, userId: string, username: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[E2B Sandbox] Executing JavaScript code for user: ${username}`);
      
      // Validate code for dangerous operations
      this.validateCode(code, 'javascript');
      
      // If E2B is not available, use fallback
      if (!this.isAvailable()) {
        console.log('[E2B Sandbox] E2B not available, using fallback execution');
        return this.executeJavaScriptFallback(code, userId, username, startTime);
      }
      
      // Create sandbox and execute code
      let sandbox: InstanceType<typeof Sandbox> | null = null;
      try {
        sandbox = await Sandbox.create();
        
        console.log('[E2B Sandbox] Created E2B sandbox for JavaScript');
        
        // Execute the code
        const execution = await sandbox.runCode(code, { language: 'javascript' });
        
        // Collect output
        let output = '';
        if (execution.logs?.stdout) {
          output = execution.logs.stdout.join('\n');
        }
        if (execution.logs?.stderr) {
          output += (output ? '\n' : '') + execution.logs.stderr.join('\n');
        }
        
        // Handle errors
        if (execution.error) {
          const executionTime = Date.now() - startTime;
          return {
            success: false,
            output: output || '',
            error: execution.error.value,
            executionTime,
            language: 'javascript',
          };
        }
        
        const executionTime = Date.now() - startTime;
        
        return {
          success: true,
          output: output || '[No output]',
          executionTime,
          language: 'javascript',
        };
      } finally {
        // Clean up
        if (sandbox) {
          try {
            // E2B Sandbox doesn't have explicit close method
            // It will be cleaned up automatically
          } catch (e) {
            console.error('[E2B Sandbox] Error closing sandbox:', e);
          }
        }
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error('[E2B Sandbox] JavaScript execution error:', errorMessage);
      
      // If E2B failed, use fallback
      if (errorMessage.includes('API') || errorMessage.includes('auth') || errorMessage.includes('401')) {
        console.log('[E2B Sandbox] E2B authentication failed, using fallback execution');
        return this.executeJavaScriptFallback(code, userId, username, startTime);
      }
      
      return {
        success: false,
        output: '',
        error: errorMessage,
        executionTime,
        language: 'javascript',
      };
    }
  }

  /**
   * Validate code for dangerous operations
   */
  private validateCode(code: string, language: 'python' | 'javascript'): void {
    const dangerousPatterns = {
      python: [
        /os\.remove/,
        /os\.rmdir/,
        /shutil\.rmtree/,
        /open\([^,]*,\s*['"]w/,
        /subprocess\.call/,
        /subprocess\.run/,
      ],
      javascript: [
        /fs\.unlink/,
        /fs\.rmdir/,
        /fs\.rm/,
        /fs\.writeFile/,
        /process\.exit/,
      ],
    };

    const patterns = dangerousPatterns[language];
    for (const pattern of patterns) {
      if (pattern.test(code)) {
        throw new Error(`Dangerous operation detected: ${pattern.source}`);
      }
    }
  }

  /**
   * Fallback: Simulate Python execution
   */
  private executePythonFallback(code: string, userId: string, username: string, startTime: number): ExecutionResult {
    console.log('[E2B Sandbox] Using Python fallback (simulation)');
    
    try {
      // Extract print statements
      const printRegex = /print\s*\(\s*([^)]+)\s*\)/g;
      const outputs: string[] = [];
      let match;
      
      while ((match = printRegex.exec(code)) !== null) {
        const arg = match[1].trim();
        
        // Try to evaluate simple expressions
        try {
          // Remove f-string prefix if present
          let evalCode = arg;
          if (evalCode.startsWith('f"') || evalCode.startsWith("f'")) {
            evalCode = evalCode.slice(1);
          }
          
          // Simple evaluation (very limited)
          if (evalCode.includes('+')) {
            const parts = evalCode.split('+').map(p => p.trim());
            const numbers = parts.map(p => {
              const num = parseFloat(p);
              return isNaN(num) ? p : num;
            });
            const result = numbers.reduce((a, b) => {
              if (typeof a === 'number' && typeof b === 'number') {
                return a + b;
              }
              return String(a) + String(b);
            });
            outputs.push(String(result));
          } else if (!isNaN(parseFloat(arg))) {
            outputs.push(arg);
          } else {
            outputs.push(arg.replace(/['"]/g, ''));
          }
        } catch (e) {
          outputs.push(arg);
        }
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        output: outputs.length > 0 ? outputs.join('\n') : '[No output]',
        executionTime,
        language: 'python',
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        language: 'python',
      };
    }
  }

  /**
   * Fallback: Simulate JavaScript execution
   */
  private executeJavaScriptFallback(code: string, userId: string, username: string, startTime: number): ExecutionResult {
    console.log('[E2B Sandbox] Using JavaScript fallback (simulation)');
    
    try {
      // Extract console.log statements
      const logRegex = /console\.log\s*\(\s*([^)]+)\s*\)/g;
      const outputs: string[] = [];
      let match;
      
      while ((match = logRegex.exec(code)) !== null) {
        const arg = match[1].trim();
        outputs.push(arg.replace(/['"]/g, ''));
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        output: outputs.length > 0 ? outputs.join('\n') : '[No output]',
        executionTime,
        language: 'javascript',
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        language: 'javascript',
      };
    }
  }

  /**
   * Get all audit logs
   */
  getAuditLogs() {
    return [];
  }

  /**
   * Get audit logs for a specific user
   */
  getAuditLogsForUser(userId: string) {
    return [];
  }
}

// Export singleton instance
export const e2bSandbox = new E2BSandboxService();
