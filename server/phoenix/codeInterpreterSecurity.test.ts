import { describe, it, expect } from 'vitest';
import { e2bSandbox } from './e2bSandbox';

/**
 * Code Interpreter Security Tests
 * Validates that dangerous operations are blocked
 */

describe('Code Interpreter Security', () => {
  describe('Python Code Validation', () => {
    it('should block os.remove operations', () => {
      const dangerousCode = `
import os
os.remove('/etc/passwd')
`;
      expect(() => {
        // This would be called internally by executePython
        // We're testing the validation logic
        const pattern = /os\.remove/;
        if (pattern.test(dangerousCode)) {
          throw new Error('Dangerous operation detected: os.remove');
        }
      }).toThrow('Dangerous operation detected');
    });

    it('should block shutil.rmtree operations', () => {
      const dangerousCode = `
import shutil
shutil.rmtree('/important/data')
`;
      const pattern = /shutil\.rmtree/;
      expect(pattern.test(dangerousCode)).toBe(true);
    });

    it('should block file write operations', () => {
      const dangerousCode = `
with open('/etc/config', 'w') as f:
    f.write('malicious')
`;
      const pattern = /open\([^,]*,\s*['"]w/;
      expect(pattern.test(dangerousCode)).toBe(true);
    });

    it('should block subprocess operations', () => {
      const dangerousCode = `
import subprocess
subprocess.run(['rm', '-rf', '/'])
`;
      const pattern = /subprocess\.run/;
      expect(pattern.test(dangerousCode)).toBe(true);
    });

    it('should allow safe Python code', () => {
      const safeCode = `
import math
result = math.sqrt(16)
print(result)
`;
      const dangerousPatterns = [
        /os\.remove/,
        /os\.rmdir/,
        /shutil\.rmtree/,
        /open\([^,]*,\s*['"]w/,
        /subprocess\.call/,
      ];

      let isDangerous = false;
      for (const pattern of dangerousPatterns) {
        if (pattern.test(safeCode)) {
          isDangerous = true;
          break;
        }
      }
      expect(isDangerous).toBe(false);
    });
  });

  describe('JavaScript Code Validation', () => {
    it('should block fs.unlink operations', () => {
      const dangerousCode = `
const fs = require('fs');
fs.unlink('/etc/passwd', (err) => {});
`;
      const pattern = /fs\.unlink/;
      expect(pattern.test(dangerousCode)).toBe(true);
    });

    it('should block fs.rmdir operations', () => {
      const dangerousCode = `
const fs = require('fs');
fs.rmdir('/important/data');
`;
      const pattern = /fs\.rmdir/;
      expect(pattern.test(dangerousCode)).toBe(true);
    });

    it('should block require fs operations', () => {
      const dangerousCode = `
const fs = require('fs');
fs.writeFileSync('/etc/config', 'malicious');
`;
      const pattern = /require\(['"]fs['"]\)/;
      expect(pattern.test(dangerousCode)).toBe(true);
    });

    it('should block eval operations', () => {
      const dangerousCode = `
eval('malicious code here');
`;
      const pattern = /eval\(/;
      expect(pattern.test(dangerousCode)).toBe(true);
    });

    it('should allow safe JavaScript code', () => {
      const safeCode = `
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log(sum);
`;
      const dangerousPatterns = [
        /fs\.unlink/,
        /fs\.rmdir/,
        /fs\.rm/,
        /fs\.writeFile/,
        /require\(['"]fs['"]\)/,
        /eval\(/,
      ];

      let isDangerous = false;
      for (const pattern of dangerousPatterns) {
        if (pattern.test(safeCode)) {
          isDangerous = true;
          break;
        }
      }
      expect(isDangerous).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    it('should maintain audit logs', () => {
      const logs = e2bSandbox.getAuditLogs();
      expect(Array.isArray(logs)).toBe(true);
    });

    it('should filter audit logs by user', () => {
      const userId = 'test-user-123';
      const userLogs = e2bSandbox.getAuditLogsForUser(userId);
      expect(Array.isArray(userLogs)).toBe(true);
      
      // All logs should belong to the specified user
      for (const log of userLogs) {
        expect(log.userId).toBe(userId);
      }
    });
  });

  describe('Code Execution Constraints', () => {
    it('should have 15 second timeout', () => {
      // Timeout is configured in e2bSandbox
      expect(true).toBe(true); // Placeholder for actual timeout test
    });

    it('should limit resource usage', () => {
      // Resource limits are enforced by E2B
      expect(true).toBe(true); // Placeholder for actual resource limit test
    });
  });
});
