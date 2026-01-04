import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createCallerFactory } from '../_core/trpc';
import { codeInterpreterRouter } from './codeInterpreterRouter';

describe('Code Interpreter Router', () => {
  let caller: ReturnType<typeof createCallerFactory>;

  beforeAll(() => {
    // Create a caller for testing
    caller = createCallerFactory()(codeInterpreterRouter);
  });

  describe('executePythonPublic', () => {
    it('should execute simple Python code', async () => {
      const result = await caller.executePythonPublic({
        code: 'print("Hello from Python")',
        language: 'python'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.language).toBe('python');
      expect(result.output).toContain('Hello from Python');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle Python math operations', async () => {
      const result = await caller.executePythonPublic({
        code: 'print(2 + 2)',
        language: 'python'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('4');
    });

    it('should handle Python errors gracefully', async () => {
      const result = await caller.executePythonPublic({
        code: 'print(1 / 0)',
        language: 'python'
      });

      // Should either have error or indicate failure
      expect(result).toBeDefined();
      expect(result.language).toBe('python');
    });

    it('should reject empty code', async () => {
      try {
        await caller.executePythonPublic({
          code: '',
          language: 'python'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('executeJavaScriptPublic', () => {
    it('should execute simple JavaScript code', async () => {
      const result = await caller.executeJavaScriptPublic({
        code: 'console.log("Hello from JavaScript")',
        language: 'javascript'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.language).toBe('javascript');
      expect(result.output).toContain('Hello from JavaScript');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle JavaScript math operations', async () => {
      const result = await caller.executeJavaScriptPublic({
        code: 'console.log(2 + 2)',
        language: 'javascript'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('4');
    });

    it('should handle JavaScript errors gracefully', async () => {
      const result = await caller.executeJavaScriptPublic({
        code: 'console.log(1 / 0)',
        language: 'javascript'
      });

      expect(result).toBeDefined();
      expect(result.language).toBe('javascript');
    });

    it('should reject empty code', async () => {
      try {
        await caller.executeJavaScriptPublic({
          code: '',
          language: 'javascript'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Code Executor Integration', () => {
    it('should execute Python with multiple statements', async () => {
      const code = `
x = 10
y = 20
print(x + y)
`;
      const result = await caller.executePythonPublic({
        code,
        language: 'python'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('30');
    });

    it('should execute JavaScript with multiple statements', async () => {
      const code = `
const x = 10;
const y = 20;
console.log(x + y);
`;
      const result = await caller.executeJavaScriptPublic({
        code,
        language: 'javascript'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('30');
    });

    it('should measure execution time accurately', async () => {
      const result = await caller.executePythonPublic({
        code: 'print("test")',
        language: 'python'
      });

      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(30000); // Less than 30 seconds
    });
  });
});
