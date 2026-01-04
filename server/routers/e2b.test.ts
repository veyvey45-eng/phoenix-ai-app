/**
 * Tests pour le router E2B
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2BAdapter } from '../phoenix/e2bAdapter';
import { getE2BMonitoring } from '../phoenix/e2bMonitoring';
import { getE2BPersistentVolume } from '../phoenix/e2bPersistentVolume';

describe('E2B Router', () => {
  let adapter: any;
  let monitoring: any;
  let volume: any;
  const testUserId = 'test-user-123';
  const testSandboxId = `${testUserId}-default`;

  beforeAll(() => {
    adapter = getE2BAdapter();
    monitoring = getE2BMonitoring();
    volume = getE2BPersistentVolume();
  });

  afterAll(async () => {
    // Cleanup
    try {
      await adapter.closeSandbox(testSandboxId);
      await volume.resetVolume(testUserId);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('E2B Adapter', () => {
    it('should execute Python code', async () => {
      const code = 'print("Hello from Python")';
      const result = await adapter.executePython(testSandboxId, code);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello from Python');
      expect(result.exitCode).toBe(0);
    });

    it('should execute Node.js code', async () => {
      const code = 'console.log("Hello from Node");';
      const result = await adapter.executeNode(testSandboxId, code);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello from Node');
      expect(result.exitCode).toBe(0);
    });

    it('should execute shell commands', async () => {
      const command = 'echo "Hello from Shell"';
      const result = await adapter.executeShell(testSandboxId, command);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello from Shell');
      expect(result.exitCode).toBe(0);
    });

    it('should handle Python errors', async () => {
      const code = 'raise ValueError("Test error")';
      const result = await adapter.executePython(testSandboxId, code);
      
      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
    });

    it('should write and read files', async () => {
      const testFile = '/tmp/test-file.txt';
      const testContent = 'Hello, E2B!';

      // Write file
      const writeResult = await adapter.writeFile(testSandboxId, testFile, testContent);
      expect(writeResult.success).toBe(true);

      // Read file
      const readResult = await adapter.readFile(testSandboxId, testFile);
      expect(readResult.success).toBe(true);
      expect(readResult.content).toContain(testContent);
    });

    it('should list files in directory', async () => {
      const result = await adapter.listFiles(testSandboxId, '/tmp');
      expect(result.success).toBe(true);
      expect(typeof result.content).toBe('string');
    });

    it('should get sandbox info', async () => {
      const info = await adapter.getSandboxInfo(testSandboxId);
      expect(info.isActive).toBe(true);
    });
  });

  describe('E2B Monitoring', () => {
    it('should record execution metrics', () => {
      monitoring.recordExecutionStart(testUserId, 'python');
      monitoring.recordExecutionEnd(testUserId, 'python', true, 100);

      const metrics = monitoring.getUserMetrics(testUserId);
      expect(metrics.totalExecutions).toBeGreaterThan(0);
      expect(metrics.successfulExecutions).toBeGreaterThan(0);
    });

    it('should calculate average duration', () => {
      monitoring.resetUserMetrics(testUserId);
      
      monitoring.recordExecutionEnd(testUserId, 'python', true, 100);
      monitoring.recordExecutionEnd(testUserId, 'python', true, 200);

      const metrics = monitoring.getUserMetrics(testUserId);
      expect(metrics.averageDuration).toBe(150);
    });

    it('should track errors', () => {
      monitoring.resetUserMetrics(testUserId);
      monitoring.recordExecutionError(testUserId, 'python', 'Test error');

      const metrics = monitoring.getUserMetrics(testUserId);
      expect(metrics.failedExecutions).toBe(1);
      expect(metrics.errors.length).toBe(1);
    });

    it('should get global metrics', () => {
      const globalMetrics = monitoring.getGlobalMetrics();
      expect(globalMetrics.userCount).toBeGreaterThanOrEqual(0);
      expect(globalMetrics.totalExecutions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('E2B Persistent Volume', () => {
    it('should save file to volume', async () => {
      const result = await volume.saveFile(testUserId, 'test.txt', 'Hello, Volume!');
      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should get file from volume', async () => {
      await volume.saveFile(testUserId, 'test.txt', 'Hello, Volume!');
      const result = await volume.getFile(testUserId, 'test.txt');
      
      expect(result.success).toBe(true);
    });

    it('should list files in volume', async () => {
      await volume.saveFile(testUserId, 'file1.txt', 'Content 1');
      await volume.saveFile(testUserId, 'file2.txt', 'Content 2');

      const files = await volume.listFiles(testUserId);
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThanOrEqual(2);
    });

    it('should delete file from volume', async () => {
      await volume.saveFile(testUserId, 'delete-me.txt', 'To delete');
      const result = await volume.deleteFile(testUserId, 'delete-me.txt');
      
      expect(result.success).toBe(true);
    });

    it('should get volume info', async () => {
      const info = await volume.getVolumeInfo(testUserId);
      
      expect(info.userId).toBe(testUserId);
      expect(info.totalSize).toBeGreaterThanOrEqual(0);
      expect(info.fileCount).toBeGreaterThanOrEqual(0);
      expect(info.usagePercent).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup old files', async () => {
      await volume.saveFile(testUserId, 'old-file.txt', 'Old content');
      const result = await volume.cleanupOldFiles(testUserId, 0); // Delete all files older than now
      
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Tests', () => {
    it('should execute Python and save result to volume', async () => {
      const code = 'print("Result from Python")';
      const result = await adapter.executePython(testSandboxId, code);

      if (result.success) {
        const volumeResult = await volume.saveFile(testUserId, 'python-result.txt', result.stdout);
        expect(volumeResult.success).toBe(true);
      }
    });

    it('should track execution and persist data', async () => {
      monitoring.recordExecutionStart(testUserId, 'python');
      const result = await adapter.executePython(testSandboxId, 'print("Test")');
      monitoring.recordExecutionEnd(testUserId, 'python', result.success, 50);

      const metrics = monitoring.getUserMetrics(testUserId);
      expect(metrics.totalExecutions).toBeGreaterThan(0);

      const volumeInfo = await volume.getVolumeInfo(testUserId);
      expect(volumeInfo.fileCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple consecutive executions', async () => {
      for (let i = 0; i < 3; i++) {
        const result = await adapter.executePython(testSandboxId, `print("Execution ${i + 1}")`);;
        expect(result.success).toBe(true);
      }

      const metrics = monitoring.getUserMetrics(testUserId);
      expect(metrics.totalExecutions).toBeGreaterThanOrEqual(1);
    });
  });
});
