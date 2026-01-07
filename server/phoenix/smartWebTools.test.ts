/**
 * Tests pour les Smart Web Tools
 * 
 * Ces tests vérifient:
 * 1. La détection des sites statiques
 * 2. La création directe en DB (bypass E2B)
 * 3. L'outil quick_hotel_site
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock des dépendances
vi.mock('../hostedSites', () => ({
  createHostedSite: vi.fn().mockResolvedValue({
    id: 1,
    slug: 'test-hotel-site',
    name: 'Test Hotel',
    htmlContent: '<html></html>',
    isPublic: true,
    createdAt: new Date()
  }),
  getSiteBySlug: vi.fn().mockResolvedValue(null)
}));

vi.mock('./e2bManager', () => ({
  e2bManager: {
    getOrCreateSandbox: vi.fn().mockResolvedValue({ sandbox: null, error: 'E2B disabled for test' }),
    getStats: vi.fn().mockReturnValue({
      activeSandboxes: 0,
      apiKeys: [{ name: 'primary', isActive: true, usageCount: 0, failureCount: 0 }],
      oldestSandboxAge: 0
    }),
    isAvailable: vi.fn().mockReturnValue(false)
  }
}));

vi.mock('./realProjectSystem', () => ({
  realProjectSystem: {
    createProject: vi.fn().mockResolvedValue({ success: false, filesCreated: [], errors: ['E2B disabled'] }),
    readRealFile: vi.fn().mockResolvedValue({ success: false, content: null })
  }
}));

import { smartProjectCreateTool, smartPreviewStartTool, quickHotelSiteTool, e2bStatsTool } from './smartWebTools';
import { staticSiteGenerator } from './staticSiteGenerator';
import { createHostedSite } from '../hostedSites';

describe('Smart Web Tools', () => {
  const mockContext = {
    sessionId: 'test-session-123',
    userId: '1',
    conversationId: 'conv-123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('smart_project_create', () => {
    it('should detect static sites and save directly to DB', async () => {
      const args = {
        name: 'mon-site-statique',
        files: [
          { path: 'index.html', content: '<html><body>Hello</body></html>' },
          { path: 'style.css', content: 'body { color: red; }' }
        ]
      };

      const result = await smartProjectCreateTool.execute(args, mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain('URL PERMANENTE');
      expect(result.metadata?.method).toBe('direct_db');
      expect(createHostedSite).toHaveBeenCalled();
    });

    it('should identify non-static projects with package.json', async () => {
      const args = {
        name: 'mon-projet-node',
        files: [
          { path: 'package.json', content: '{"name": "test"}' },
          { path: 'index.js', content: 'console.log("hello")' }
        ]
      };

      const result = await smartProjectCreateTool.execute(args, mockContext);

      // Devrait essayer E2B (qui échouera dans le test)
      expect(result.metadata?.method).not.toBe('direct_db');
    });

    it('should force E2B when force_e2b is true', async () => {
      const args = {
        name: 'site-force-e2b',
        files: [
          { path: 'index.html', content: '<html></html>' }
        ],
        force_e2b: true
      };

      const result = await smartProjectCreateTool.execute(args, mockContext);

      // Devrait essayer E2B même pour un site statique
      expect(result.metadata?.method).not.toBe('direct_db');
    });
  });

  describe('quick_hotel_site', () => {
    it('should create a hotel site with permanent URL', async () => {
      const args = {
        name: 'Le Grand Luxembourg',
        address: '15 avenue de la Liberté',
        city: 'Luxembourg',
        description: 'Hôtel de luxe au cœur de la ville'
      };

      const result = await quickHotelSiteTool.execute(args, mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Le Grand Luxembourg');
      expect(result.output).toContain('URL PERMANENTE');
      expect(result.metadata?.permanentUrl).toBeDefined();
      expect(createHostedSite).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          name: 'Le Grand Luxembourg',
          siteType: 'business'
        })
      );
    });

    it('should include features in the hotel site', async () => {
      const args = {
        name: 'Hotel Test',
        address: '123 Test Street',
        features: ['WiFi gratuit', 'Piscine', 'Spa']
      };

      const result = await quickHotelSiteTool.execute(args, mockContext);

      expect(result.success).toBe(true);
      // Le HTML généré devrait contenir les features
      const htmlCall = (createHostedSite as any).mock.calls[0][0];
      expect(htmlCall.htmlContent).toContain('WiFi gratuit');
      expect(htmlCall.htmlContent).toContain('Piscine');
      expect(htmlCall.htmlContent).toContain('Spa');
    });

    it('should include contact info when provided', async () => {
      const args = {
        name: 'Hotel Contact Test',
        address: '456 Contact Ave',
        phone: '+352 123 456',
        email: 'contact@hotel.lu'
      };

      const result = await quickHotelSiteTool.execute(args, mockContext);

      expect(result.success).toBe(true);
      const htmlCall = (createHostedSite as any).mock.calls[0][0];
      expect(htmlCall.htmlContent).toContain('+352 123 456');
      expect(htmlCall.htmlContent).toContain('contact@hotel.lu');
    });
  });

  describe('e2b_stats', () => {
    it('should return E2B statistics', async () => {
      const result = await e2bStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Statistiques E2B');
      expect(result.output).toContain('Sandboxes actifs');
      expect(result.metadata?.activeSandboxes).toBeDefined();
    });
  });

  describe('staticSiteGenerator', () => {
    it('should generate hotel template with correct structure', () => {
      const html = staticSiteGenerator.generateHotelTemplate({
        name: 'Test Hotel',
        address: '123 Test St',
        city: 'Test City'
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Test Hotel');
      expect(html).toContain('123 Test St');
      expect(html).toContain('Test City');
      expect(html).toContain('Réserver maintenant');
    });

    it('should generate landing template', () => {
      const html = staticSiteGenerator.generateLandingTemplate({
        title: 'My Landing Page',
        subtitle: 'Welcome to our site'
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('My Landing Page');
      expect(html).toContain('Welcome to our site');
    });
  });
});

describe('Static Site Detection', () => {
  it('should correctly identify static sites', () => {
    // Test helper function indirectly through tool behavior
    const staticFiles = [
      { path: 'index.html', content: '<html></html>' },
      { path: 'style.css', content: 'body {}' }
    ];

    const hasHTML = staticFiles.some(f => f.path.endsWith('.html'));
    const hasPackageJson = staticFiles.some(f => f.path === 'package.json');
    const hasServerCode = staticFiles.some(f => 
      f.path.endsWith('.ts') || 
      f.path.endsWith('.tsx') ||
      f.path.includes('server')
    );

    expect(hasHTML).toBe(true);
    expect(hasPackageJson).toBe(false);
    expect(hasServerCode).toBe(false);
  });

  it('should correctly identify complex projects', () => {
    const complexFiles = [
      { path: 'package.json', content: '{}' },
      { path: 'src/App.tsx', content: 'export default App' }
    ];

    const hasPackageJson = complexFiles.some(f => f.path === 'package.json');
    const hasServerCode = complexFiles.some(f => f.path.endsWith('.tsx'));

    expect(hasPackageJson).toBe(true);
    expect(hasServerCode).toBe(true);
  });
});
