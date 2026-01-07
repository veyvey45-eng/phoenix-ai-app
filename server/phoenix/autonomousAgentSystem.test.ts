/**
 * Tests pour le système d'agent autonome
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectSimulation,
  interceptSimulation,
  generateStrictAgentPrompt
} from './autonomousAgentSystem';

describe('Autonomous Agent System', () => {
  
  describe('detectSimulation', () => {
    it('should detect "simulate" keyword in code', () => {
      const code = `# Simulate the creation of a website
url = "https://example.com"
print(url)`;
      
      const result = detectSimulation(code);
      expect(result.isSimulation).toBe(true);
      expect(result.reason).toContain('simulate');
    });

    it('should detect fake e2b.dev URLs', () => {
      const code = `url = "https://e2b.dev/sites/my-site-abc123"
print(f"Site created: {url}")`;
      
      const result = detectSimulation(code);
      expect(result.isSimulation).toBe(true);
      expect(result.reason).toContain('e2b.dev');
    });

    it('should detect print statements with URLs', () => {
      const code = `print("Site créé: https://example.com/sites/test")`;
      
      const result = detectSimulation(code);
      expect(result.isSimulation).toBe(true);
      expect(result.reason).toContain('Print');
    });

    it('should NOT flag legitimate code', () => {
      const code = `import requests
response = requests.get("https://api.example.com/data")
data = response.json()
print(data)`;
      
      const result = detectSimulation(code);
      expect(result.isSimulation).toBe(false);
    });

    it('should detect fake/mock/dummy keywords', () => {
      const code = `fake_url = "https://fake-site.com"
mock_response = {"status": "ok"}`;
      
      const result = detectSimulation(code);
      expect(result.isSimulation).toBe(true);
    });
  });

  describe('interceptSimulation', () => {
    it('should block Python code with simulation', () => {
      const result = interceptSimulation('execute_python', {
        code: `# Simulate creating a website
url = "https://e2b.dev/sites/test"
print(url)`
      });
      
      expect(result.blocked).toBe(true);
      expect(result.reason).toBeDefined();
    });

    it('should block JavaScript code with simulation', () => {
      const result = interceptSimulation('execute_javascript', {
        code: `// Simulate site creation
const url = "https://e2b.dev/sites/test";
console.log(url);`
      });
      
      expect(result.blocked).toBe(true);
    });

    it('should NOT block legitimate Python code', () => {
      const result = interceptSimulation('execute_python', {
        code: `import math
result = math.sqrt(16)
print(f"Result: {result}")`
      });
      
      expect(result.blocked).toBe(false);
    });

    it('should NOT block non-code tools', () => {
      const result = interceptSimulation('web_navigate', {
        url: 'https://example.com'
      });
      
      expect(result.blocked).toBe(false);
    });
  });

  describe('generateStrictAgentPrompt', () => {
    it('should include simulation prohibition rules', () => {
      const prompt = generateStrictAgentPrompt();
      
      expect(prompt).toContain('JAMAIS de simulation');
      expect(prompt).toContain('JAMAIS d\'URLs fictives');
      expect(prompt).toContain('e2b.dev');
    });

    it('should include real tools instructions', () => {
      const prompt = generateStrictAgentPrompt();
      
      expect(prompt).toContain('static_site_create');
      expect(prompt).toContain('/sites/');
      expect(prompt).toContain('Vérifie');
    });

    it('should include auto-correction instructions', () => {
      const prompt = generateStrictAgentPrompt();
      
      expect(prompt).toContain('Auto-correction');
      expect(prompt).toContain('vérifie');
    });
  });
});
