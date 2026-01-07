/**
 * Tests pour la sauvegarde automatique des sites dans hostedSites
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock des dépendances
vi.mock('../hostedSites', () => ({
  createHostedSite: vi.fn().mockResolvedValue({
    id: 1,
    slug: 'test-project-abc123',
    name: 'test-project',
    userId: 1,
    htmlContent: '<html><body>Test</body></html>',
    cssContent: 'body { color: red; }',
    jsContent: 'console.log("test");',
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date()
  })
}));

vi.mock('./realProjectSystem', () => ({
  realProjectSystem: {
    createProject: vi.fn().mockResolvedValue({
      success: true,
      projectPath: '/home/user/projects/test-project',
      filesCreated: ['/home/user/projects/test-project/index.html'],
      errors: []
    }),
    startPreviewServer: vi.fn().mockResolvedValue({
      success: true,
      publicUrl: 'https://e2b-sandbox.example.com:8080'
    }),
    readRealFile: vi.fn().mockImplementation(async (sessionId: string, path: string) => {
      if (path.includes('index.html')) {
        return { success: true, content: '<html><body>Test</body></html>' };
      }
      if (path.includes('style.css')) {
        return { success: true, content: 'body { color: red; }' };
      }
      if (path.includes('script.js')) {
        return { success: true, content: 'console.log("test");' };
      }
      return { success: false, error: 'File not found' };
    }),
    startNodeServer: vi.fn().mockResolvedValue({
      success: true,
      publicUrl: 'https://e2b-sandbox.example.com:3000'
    }),
    getActivePreviews: vi.fn().mockReturnValue([])
  }
}));

import { createHostedSite } from '../hostedSites';
import { realProjectSystem } from './realProjectSystem';

describe('Real Tools Auto-Save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('projectFilesCache', () => {
    it('should cache project files after real_project_create', async () => {
      // Import dynamically to get fresh module with mocks
      const { realProjectCreateTool } = await import('./realTools');
      
      const context = {
        userId: '1',
        sessionId: 'test-session-123'
      };
      
      const result = await realProjectCreateTool.execute({
        name: 'hotel-site',
        files: [
          { path: 'index.html', content: '<html><body>Hotel</body></html>' },
          { path: 'style.css', content: 'body { background: blue; }' }
        ]
      }, context);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('hotel-site');
      expect(realProjectSystem.createProject).toHaveBeenCalledWith(
        'test-session-123',
        'hotel-site',
        expect.any(Array)
      );
    });
  });

  describe('real_preview_start auto-save', () => {
    it('should auto-save site to hostedSites when starting preview', async () => {
      const { realPreviewStartTool } = await import('./realTools');
      
      const context = {
        userId: '1',
        sessionId: 'test-session-456'
      };
      
      const result = await realPreviewStartTool.execute({
        project_path: 'projects/test-project',
        port: 8080
      }, context);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('URL TEMPORAIRE');
      // Should have tried to read files from sandbox
      expect(realProjectSystem.readRealFile).toHaveBeenCalled();
    });

    it('should include permanent URL in output when save succeeds', async () => {
      const { realPreviewStartTool } = await import('./realTools');
      
      const context = {
        userId: '1',
        sessionId: 'test-session-789'
      };
      
      const result = await realPreviewStartTool.execute({
        project_path: 'projects/test-project',
        port: 8080
      }, context);
      
      expect(result.success).toBe(true);
      // Should contain permanent URL info
      expect(result.output).toContain('URL PERMANENTE');
      expect(result.output).toContain('/sites/');
    });

    it('should call createHostedSite with correct parameters', async () => {
      const { realPreviewStartTool } = await import('./realTools');
      
      const context = {
        userId: '5',
        sessionId: 'test-session-abc'
      };
      
      await realPreviewStartTool.execute({
        project_path: 'projects/my-hotel',
        port: 8080
      }, context);
      
      expect(createHostedSite).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 5,
          name: 'my-hotel',
          htmlContent: expect.any(String),
          isPublic: true
        })
      );
    });

    it('should include permanentUrl in metadata', async () => {
      const { realPreviewStartTool } = await import('./realTools');
      
      const context = {
        userId: '1',
        sessionId: 'test-session-meta'
      };
      
      const result = await realPreviewStartTool.execute({
        project_path: 'projects/test-project',
        port: 8080
      }, context);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.permanentUrl).toContain('/sites/');
    });
  });

  describe('Error handling', () => {
    it('should still return E2B URL even if permanent save fails', async () => {
      // Mock createHostedSite to fail
      vi.mocked(createHostedSite).mockResolvedValueOnce(null);
      
      const { realPreviewStartTool } = await import('./realTools');
      
      const context = {
        userId: '1',
        sessionId: 'test-session-error'
      };
      
      const result = await realPreviewStartTool.execute({
        project_path: 'projects/test-project',
        port: 8080
      }, context);
      
      // Should still succeed with E2B URL
      expect(result.success).toBe(true);
      expect(result.output).toContain('URL TEMPORAIRE');
    });
  });
});
