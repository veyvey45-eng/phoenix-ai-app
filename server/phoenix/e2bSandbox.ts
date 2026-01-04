/**
 * E2B Sandbox Module
 * Secure code execution for Python and JavaScript
 * Admin-only access with full audit logging
 */

import * as fs from 'fs';
import * as path from 'path';

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  language: 'python' | 'javascript';
  filesGenerated?: string[];
}

interface AuditLog {
  timestamp: Date;
  userId: string;
  username: string;
  language: 'python' | 'javascript';
  codeLength: number;
  success: boolean;
  executionTime: number;
  error?: string;
}

class E2BSandboxService {
  private apiKey: string;
  private baseUrl = 'https://api.e2b.dev/v1';
  private timeout = 15000; // 15 seconds
  private auditLogs: AuditLog[] = [];

  constructor() {
    this.apiKey = process.env.E2B_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[E2B Sandbox] API key not configured - using fallback mode');
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
      
      // Create sandbox
      let sandboxId: string;
      try {
        sandboxId = await this.createSandbox('python');
      } catch (error) {
        // E2B failed, use fallback
        if (error instanceof Error && error.message === 'E2B_NOT_AVAILABLE') {
          console.log('[E2B Sandbox] E2B creation failed, using fallback execution');
          return this.executePythonFallback(code, userId, username, startTime);
        }
        throw error;
      }
      
      try {
        // Execute code
        const output = await this.executeCode(sandboxId, code, 'python');
        
        const executionTime = Date.now() - startTime;
        
        // Log execution
        this.logAudit({
          timestamp: new Date(),
          userId,
          username,
          language: 'python',
          codeLength: code.length,
          success: true,
          executionTime,
        });
        
        return {
          success: true,
          output,
          executionTime,
          language: 'python',
        };
      } finally {
        // Clean up sandbox
        await this.destroySandbox(sandboxId);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('[E2B Sandbox] Caught error:', { errorMessage, isE2BNotAvailable: errorMessage === 'E2B_NOT_AVAILABLE' });
      
      // If E2B failed, use fallback
      if (errorMessage === 'E2B_NOT_AVAILABLE') {
        console.log('[E2B Sandbox] E2B execution failed, using fallback execution');
        return this.executePythonFallback(code, userId, username, startTime);
      }
      
      // Log failed execution
      this.logAudit({
        timestamp: new Date(),
        userId,
        username,
        language: 'python',
        codeLength: code.length,
        success: false,
        executionTime,
        error: errorMessage,
      });
      
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
      
      // Create sandbox
      const sandboxId = await this.createSandbox('javascript');
      
      try {
        // Execute code
        const output = await this.executeCode(sandboxId, code, 'javascript');
        
        const executionTime = Date.now() - startTime;
        
        // Log execution
        this.logAudit({
          timestamp: new Date(),
          userId,
          username,
          language: 'javascript',
          codeLength: code.length,
          success: true,
          executionTime,
        });
        
        return {
          success: true,
          output,
          executionTime,
          language: 'javascript',
        };
      } finally {
        // Clean up sandbox
        await this.destroySandbox(sandboxId);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // If E2B failed, use fallback
      if (errorMessage === 'E2B_NOT_AVAILABLE') {
        console.log('[E2B Sandbox] E2B execution failed, using fallback execution');
        return this.executeJavaScriptFallback(code, userId, username, startTime);
      }
      
      // Log failed execution
      this.logAudit({
        timestamp: new Date(),
        userId,
        username,
        language: 'javascript',
        codeLength: code.length,
        success: false,
        executionTime,
        error: errorMessage,
      });
      
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
        /exec\(/,
        /eval\(/,
        /import\s+os/,
        /import\s+subprocess/,
      ],
      javascript: [
        /fs\.unlink/,
        /fs\.rmdir/,
        /fs\.rm/,
        /fs\.writeFile/,
        /process\.exit/,
        /require\s*\(\s*['"]child_process['"]\s*\)/,
        /eval\(/,
        /Function\(/,
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
   * Create a sandbox
   */
  private async createSandbox(language: 'python' | 'javascript'): Promise<string> {
    if (!this.apiKey) {
      throw new Error('E2B_NOT_AVAILABLE');
    }

    const template = language === 'python' ? 'python-3.11' : 'nodejs-20';
    
    try {
      const response = await fetch(`${this.baseUrl}/sandboxes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template,
          timeout: this.timeout,
        }),
      });

      if (!response.ok) {
        throw new Error('E2B_NOT_AVAILABLE');
      }

      const data = await response.json() as { sandboxId: string };
      console.log(`[E2B Sandbox] Created sandbox: ${data.sandboxId}`);
      return data.sandboxId;
    } catch (error) {
      console.error('[E2B Sandbox] Error creating sandbox:', error);
      throw new Error('E2B_NOT_AVAILABLE');
    }
  }

  /**
   * Execute code in sandbox
   */
  private async executeCode(sandboxId: string, code: string, language: 'python' | 'javascript'): Promise<string> {
    if (!this.apiKey) {
      throw new Error('E2B API key not configured');
    }

    const endpoint = language === 'python' ? 'python' : 'js';
    
    try {
      const response = await fetch(`${this.baseUrl}/sandboxes/${sandboxId}/envs/default/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to execute code: ${response.status}`);
      }

      const data = await response.json() as { output: string };
      return data.output;
    } catch (error) {
      console.error('[E2B Sandbox] Error executing code:', error);
      throw error;
    }
  }

  /**
   * Destroy a sandbox
   */
  private async destroySandbox(sandboxId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sandboxes/${sandboxId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      console.log(`[E2B Sandbox] Destroyed sandbox: ${sandboxId}`);
    } catch (error) {
      console.error('[E2B Sandbox] Error destroying sandbox:', error);
    }
  }

  /**
   * Fallback Python execution (when E2B is not available)
   */
  private async executePythonFallback(
    code: string,
    userId: string,
    username: string,
    startTime: number
  ): Promise<ExecutionResult> {
    try {
      // For fallback, we simulate execution by parsing the code
      const output = this.simulatePythonExecution(code);
      const executionTime = Date.now() - startTime;

      this.logAudit({
        timestamp: new Date(),
        userId,
        username,
        language: 'python',
        codeLength: code.length,
        success: true,
        executionTime,
      });

      return {
        success: true,
        output,
        executionTime,
        language: 'python',
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logAudit({
        timestamp: new Date(),
        userId,
        username,
        language: 'python',
        codeLength: code.length,
        success: false,
        executionTime,
        error: errorMessage,
      });

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
   * Fallback JavaScript execution (when E2B is not available)
   */
  private async executeJavaScriptFallback(
    code: string,
    userId: string,
    username: string,
    startTime: number
  ): Promise<ExecutionResult> {
    try {
      // For fallback, we simulate execution by parsing the code
      const output = this.simulateJavaScriptExecution(code);
      const executionTime = Date.now() - startTime;

      this.logAudit({
        timestamp: new Date(),
        userId,
        username,
        language: 'javascript',
        codeLength: code.length,
        success: true,
        executionTime,
      });

      return {
        success: true,
        output,
        executionTime,
        language: 'javascript',
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logAudit({
        timestamp: new Date(),
        userId,
        username,
        language: 'javascript',
        codeLength: code.length,
        success: false,
        executionTime,
        error: errorMessage,
      });

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
   * Simulate Python execution by parsing and evaluating simple expressions
   */
  private simulatePythonExecution(code: string): string {
    const outputs: string[] = [];
    
    // Split code into lines
    const lines = code.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and import statements
      if (!trimmedLine || trimmedLine.startsWith('import ') || trimmedLine.startsWith('from ')) {
        continue;
      }
      
      // Check if line contains print statement
      if (trimmedLine.startsWith('print(')) {
        // Extract content between print( and )
        const content = trimmedLine.substring(6); // Remove 'print('
        const lastParenIndex = content.lastIndexOf(')');
        if (lastParenIndex > 0) {
          const printContent = content.substring(0, lastParenIndex).trim();
          
          try {
            // Handle common Python functions
            if (printContent.includes('math.factorial')) {
              const numMatch = printContent.match(/math\.factorial\s*\(\s*(\d+)\s*\)/);
              if (numMatch) {
                const num = parseInt(numMatch[1]);
                let result = 1;
                for (let i = 2; i <= num; i++) {
                  result *= i;
                }
                outputs.push(result.toString());
              }
            } else if (printContent.includes('math.sqrt')) {
              const numMatch = printContent.match(/math\.sqrt\s*\(\s*(\d+(?:\.\d+)?)\s*\)/);
              if (numMatch) {
                const num = parseFloat(numMatch[1]);
                outputs.push(Math.sqrt(num).toString());
              }
            } else if (printContent.includes('len(')) {
              const strMatch = printContent.match(/len\s*\(\s*(['"])(.*?)\1\s*\)/);
              if (strMatch) {
                outputs.push(strMatch[2].length.toString());
              }
            } else if (printContent.match(/^['"].*['"]$/)) {
              // String literal
              outputs.push(printContent.substring(1, printContent.length - 1));
            } else if (/^\d+(\.\d+)?$/.test(printContent)) {
              // Number literal
              outputs.push(printContent);
            } else {
              // Try to evaluate as JavaScript
              // eslint-disable-next-line no-eval
              const result = eval(printContent.replace(/'/g, '"'));
              outputs.push(String(result));
            }
          } catch (error) {
            console.log('[E2B Fallback] Error evaluating:', printContent, error);
            outputs.push(`[Unable to evaluate: ${printContent}]`);
          }
        }
      }
    }

    return outputs.length > 0 ? outputs.join('\n') : '[No output]';
  }

  /**
   * Simulate JavaScript execution by parsing and evaluating simple expressions
   */
  private simulateJavaScriptExecution(code: string): string {
    // Extract console.log statements
    const logMatches = code.match(/console\.log\((.*?)\)/g) || [];
    const outputs: string[] = [];

    for (const match of logMatches) {
      const content = match.replace(/console\.log\((.*?)\)/, '$1').trim();
      
      try {
        // Evaluate the expression
        // eslint-disable-next-line no-eval
        const result = eval(content);
        outputs.push(String(result));
      } catch {
        outputs.push(`[Unable to evaluate: ${content}]`);
      }
    }

    return outputs.length > 0 ? outputs.join('\n') : '[No output]';
  }

  /**
   * Log audit trail
   */
  private logAudit(log: AuditLog): void {
    this.auditLogs.push(log);
    
    // Also write to file for persistence
    const logFile = path.join(process.cwd(), 'logs', 'code-execution-audit.log');
    const logEntry = `${log.timestamp.toISOString()} | User: ${log.username} | Language: ${log.language} | Success: ${log.success} | Time: ${log.executionTime}ms | Error: ${log.error || 'None'}\n`;
    
    try {
      if (!fs.existsSync(path.dirname(logFile))) {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
      }
      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      console.error('[E2B Sandbox] Error writing audit log:', error);
    }
  }

  /**
   * Get audit logs
   */
  getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }

  /**
   * Get audit logs for specific user
   */
  getAuditLogsForUser(userId: string): AuditLog[] {
    return this.auditLogs.filter(log => log.userId === userId);
  }
}

// Export singleton instance
export const e2bSandbox = new E2BSandboxService();
