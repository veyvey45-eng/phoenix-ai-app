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
      console.warn('[E2B Sandbox] API key not configured');
    }
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
      
      // Create sandbox
      const sandboxId = await this.createSandbox('python');
      
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
        /require\(['"]fs['"]\)/,
        /require\(['"]child_process['"]\)/,
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
   * Create a sandbox environment
   */
  private async createSandbox(language: 'python' | 'javascript'): Promise<string> {
    if (!this.apiKey) {
      throw new Error('E2B API key not configured');
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
        throw new Error(`Failed to create sandbox: ${response.status}`);
      }

      const data = await response.json() as { sandboxId: string };
      console.log(`[E2B Sandbox] Created sandbox: ${data.sandboxId}`);
      return data.sandboxId;
    } catch (error) {
      console.error('[E2B Sandbox] Error creating sandbox:', error);
      throw error;
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
      const response = await fetch(`${this.baseUrl}/sandboxes/${sandboxId}/${endpoint}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          timeout: this.timeout,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Code execution failed: ${error}`);
      }

      const data = await response.json() as { output: string; error?: string };
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data.output || '';
    } catch (error) {
      console.error('[E2B Sandbox] Error executing code:', error);
      throw error;
    }
  }

  /**
   * Destroy sandbox
   */
  private async destroySandbox(sandboxId: string): Promise<void> {
    if (!this.apiKey) {
      return;
    }

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

export const e2bSandbox = new E2BSandboxService();
