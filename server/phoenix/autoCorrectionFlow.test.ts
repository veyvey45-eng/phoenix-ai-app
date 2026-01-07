/**
 * Tests pour le flux d'auto-correction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock des dépendances
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          correctedArgs: { name: 'test-site', html: '<html><body>Fixed</body></html>' },
          explanation: 'Fixed the HTML content'
        })
      }
    }]
  })
}));

vi.mock('./toolRegistry', () => ({
  toolRegistry: {
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'Site créé: /sites/test-site-abc123'
    })
  }
}));

vi.mock('../hostedSites', () => ({
  getSiteBySlug: vi.fn().mockResolvedValue({
    slug: 'test-site-abc123',
    htmlContent: '<html><body>Test</body></html>'
  })
}));

// Import après les mocks
import { 
  executeWithAutoCorrection,
  verifySiteCreation,
  createSiteWithVerification
} from './autoCorrectionFlow';
import { detectSimulation } from './autonomousAgentSystem';

describe('Auto-Correction Flow', () => {
  
  describe('executeWithAutoCorrection', () => {
    it('should execute tool successfully on first attempt', async () => {
      const context = { userId: '1', sessionId: 'test' };
      
      const result = await executeWithAutoCorrection(
        'static_site_create',
        { name: 'test', html: '<html></html>' },
        context
      );
      
      expect(result.success).toBe(true);
      expect(result.totalAttempts).toBeGreaterThanOrEqual(1);
    });

    it('should pass through non-auto-correction tools', async () => {
      const context = { userId: '1', sessionId: 'test' };
      
      const result = await executeWithAutoCorrection(
        'calculate',
        { expression: '2 + 2' },
        context
      );
      
      expect(result.totalAttempts).toBe(1);
      expect(result.correctionApplied).toBe(false);
    });
  });

  describe('verifySiteCreation', () => {
    it('should verify site exists in database for relative URLs', async () => {
      const context = { userId: '1', sessionId: 'test' };
      
      const result = await verifySiteCreation('/sites/test-site-abc123', context);
      
      expect(result.success).toBe(true);
    });

    it('should return error for non-existent sites', async () => {
      // Re-mock pour ce test
      const { getSiteBySlug } = await import('../hostedSites');
      vi.mocked(getSiteBySlug).mockResolvedValueOnce(null);
      
      const context = { userId: '1', sessionId: 'test' };
      
      const result = await verifySiteCreation('/sites/non-existent', context);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('non trouvé');
    });
  });

  describe('Integration with detectSimulation', () => {
    it('should detect e2b.dev URLs as simulation', () => {
      const output = 'Site créé: https://e2b.dev/sites/my-site-abc123';
      const result = detectSimulation(output);
      
      expect(result.isSimulation).toBe(true);
    });

    it('should NOT flag real site URLs', () => {
      const output = 'Site créé: /sites/my-site-abc123';
      const result = detectSimulation(output);
      
      expect(result.isSimulation).toBe(false);
    });
  });
});
