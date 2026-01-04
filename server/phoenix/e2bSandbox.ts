/**
 * E2B Sandbox Module
 * Real code execution using E2B Code Interpreter SDK or native execution
 */

import { Sandbox } from '@e2b/code-interpreter';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
  private tempDir: string;

  constructor() {
    this.apiKey = process.env.E2B_API_KEY || '';
    this.tempDir = path.join(os.tmpdir(), 'phoenix-sandbox');
    
    // Créer le répertoire temporaire
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    if (!this.apiKey) {
      console.warn('[E2B Sandbox] E2B API key not configured - using native execution');
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
      
      // If E2B is available, use it
      if (this.isAvailable()) {
        return await this.executePythonE2B(code, userId, username, startTime);
      }
      
      // Otherwise use native Python execution
      console.log('[E2B Sandbox] Using native Python execution');
      return await this.executePythonNative(code, userId, username, startTime);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error('[E2B Sandbox] Python execution error:', errorMessage);
      
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
   * Execute Python code using E2B
   */
  private async executePythonE2B(code: string, userId: string, username: string, startTime: number): Promise<ExecutionResult> {
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
      if (sandbox) {
        try {
          // E2B Sandbox doesn't have explicit close method
        } catch (e) {
          console.error('[E2B Sandbox] Error closing sandbox:', e);
        }
      }
    }
  }

  /**
   * Execute Python code using native Python
   */
  private async executePythonNative(code: string, userId: string, username: string, startTime: number): Promise<ExecutionResult> {
    try {
      // Create a temporary Python file
      const tempFile = path.join(this.tempDir, `${userId}-${Date.now()}.py`);
      fs.writeFileSync(tempFile, code, 'utf-8');
      
      console.log(`[E2B Sandbox] Created temporary Python file: ${tempFile}`);
      
      try {
        // Execute the Python file
        const output = execSync(`python3 "${tempFile}"`, {
          encoding: 'utf-8',
          timeout: 30000, // 30 seconds timeout
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });
        
        const executionTime = Date.now() - startTime;
        
        return {
          success: true,
          output: output.trim() || '[No output]',
          executionTime,
          language: 'python',
        };
      } catch (error: any) {
        const executionTime = Date.now() - startTime;
        
        // Extract error message from stderr
        let errorMessage = error.message || String(error);
        if (error.stderr) {
          errorMessage = error.stderr.toString();
        }
        
        return {
          success: false,
          output: error.stdout?.toString() || '',
          error: errorMessage,
          executionTime,
          language: 'python',
        };
      } finally {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempFile);
          console.log(`[E2B Sandbox] Cleaned up temporary file: ${tempFile}`);
        } catch (e) {
          console.error('[E2B Sandbox] Error cleaning up temporary file:', e);
        }
      }
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
   * Execute JavaScript code in E2B Sandbox
   */
  async executeJavaScript(code: string, userId: string, username: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[E2B Sandbox] Executing JavaScript code for user: ${username}`);
      
      // Validate code for dangerous operations
      this.validateCode(code, 'javascript');
      
      // If E2B is available, use it
      if (this.isAvailable()) {
        return await this.executeJavaScriptE2B(code, userId, username, startTime);
      }
      
      // Otherwise use native Node.js execution
      console.log('[E2B Sandbox] Using native Node.js execution');
      return await this.executeJavaScriptNative(code, userId, username, startTime);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error('[E2B Sandbox] JavaScript execution error:', errorMessage);
      
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
   * Execute JavaScript code using E2B
   */
  private async executeJavaScriptE2B(code: string, userId: string, username: string, startTime: number): Promise<ExecutionResult> {
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
      if (sandbox) {
        try {
          // E2B Sandbox doesn't have explicit close method
        } catch (e) {
          console.error('[E2B Sandbox] Error closing sandbox:', e);
        }
      }
    }
  }

  /**
   * Execute JavaScript code using native Node.js
   */
  private async executeJavaScriptNative(code: string, userId: string, username: string, startTime: number): Promise<ExecutionResult> {
    try {
      // Create a temporary JavaScript file
      const tempFile = path.join(this.tempDir, `${userId}-${Date.now()}.js`);
      fs.writeFileSync(tempFile, code, 'utf-8');
      
      console.log(`[E2B Sandbox] Created temporary JavaScript file: ${tempFile}`);
      
      try {
        // Execute the JavaScript file
        const output = execSync(`node "${tempFile}"`, {
          encoding: 'utf-8',
          timeout: 30000, // 30 seconds timeout
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });
        
        const executionTime = Date.now() - startTime;
        
        return {
          success: true,
          output: output.trim() || '[No output]',
          executionTime,
          language: 'javascript',
        };
      } catch (error: any) {
        const executionTime = Date.now() - startTime;
        
        // Extract error message from stderr
        let errorMessage = error.message || String(error);
        if (error.stderr) {
          errorMessage = error.stderr.toString();
        }
        
        return {
          success: false,
          output: error.stdout?.toString() || '',
          error: errorMessage,
          executionTime,
          language: 'javascript',
        };
      } finally {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempFile);
          console.log(`[E2B Sandbox] Cleaned up temporary file: ${tempFile}`);
        } catch (e) {
          console.error('[E2B Sandbox] Error cleaning up temporary file:', e);
        }
      }
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
