/**
 * Tests du E2B Adapter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { E2BAdapter, getE2BAdapter } from './e2bAdapter';

describe('E2B Adapter', () => {
  let adapter: E2BAdapter;

  beforeEach(() => {
    adapter = getE2BAdapter();
  });

  afterEach(async () => {
    // Fermer toutes les sandboxes
    await adapter.closeAllSandboxes();
  });

  describe('Sandbox Management', () => {
    it('should create a sandbox', async () => {
      const sandbox = await adapter.createSandbox('test-sandbox-1');
      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toBeDefined();
    });

    it('should get or create a sandbox', async () => {
      const sandbox1 = await adapter.getOrCreateSandbox('test-sandbox-2');
      const sandbox2 = await adapter.getOrCreateSandbox('test-sandbox-2');
      expect(sandbox1.sandboxId).toBe(sandbox2.sandboxId);
    });

    it('should get active sandbox count', async () => {
      await adapter.createSandbox('test-sandbox-3');
      await adapter.createSandbox('test-sandbox-4');
      expect(adapter.getActiveSandboxCount()).toBeGreaterThanOrEqual(2);
    });

    it('should close a sandbox', async () => {
      await adapter.createSandbox('test-sandbox-5');
      const result = await adapter.closeSandbox('test-sandbox-5');
      expect(result).toBe(true);
    });
  });

  describe('Python Execution', () => {
    it('should execute simple Python code', async () => {
      const result = await adapter.executePython('test-python-1', 'print("hello")');
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('hello');
    });

    it('should handle Python errors', async () => {
      const result = await adapter.executePython('test-python-2', 'print(undefined_var)');
      expect(result.success).toBe(false);
      expect(result.stderr).toBeDefined();
    });

    it('should execute Python with imports', async () => {
      const code = `import json\ndata = {"key": "value"}\nprint(json.dumps(data))`;
      const result = await adapter.executePython('test-python-3', code);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('key');
    });
  });

  describe('Node.js Execution', () => {
    it('should execute simple Node.js code', async () => {
      const result = await adapter.executeNode('test-node-1', 'console.log("hello")');
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('hello');
    });

    it('should handle Node.js errors', async () => {
      const result = await adapter.executeNode('test-node-2', 'throw new Error("test error")');
      expect(result.success).toBe(false);
    });
  });

  describe('Shell Execution', () => {
    it('should execute shell commands', async () => {
      const result = await adapter.executeShell('test-shell-1', 'echo "hello"');
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('hello');
    });

    it('should handle shell errors', async () => {
      const result = await adapter.executeShell('test-shell-2', 'ls /nonexistent');
      expect(result.success).toBe(false);
    });

    it('should execute complex shell commands', async () => {
      const result = await adapter.executeShell('test-shell-3', 'echo "test" | wc -c');
      expect(result.success).toBe(true);
      expect(result.stdout).toBeDefined();
    });
  });

  describe('File Operations', () => {
    it('should write a file', async () => {
      const result = await adapter.writeFile('test-files-1', '/tmp/test.txt', 'test content');
      expect(result.success).toBe(true);
      expect(result.path).toBe('/tmp/test.txt');
    });

    it('should read a file', async () => {
      const sandboxId = 'test-files-2';
      await adapter.writeFile(sandboxId, '/tmp/test.txt', 'test content');
      const result = await adapter.readFile(sandboxId, '/tmp/test.txt');
      expect(result.success).toBe(true);
      expect(result.content).toBe('test content');
    });

    it('should list files', async () => {
      const result = await adapter.listFiles('test-files-3', '/tmp');
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should get adapter stats', async () => {
      const stats = adapter.getStats();
      expect(stats.activeSandboxes).toBeGreaterThanOrEqual(0);
      expect(stats.maxConcurrentSandboxes).toBe(5);
      expect(stats.executionTimeout).toBe(60000);
    });
  });
});
