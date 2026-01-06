/**
 * Tests pour le module de navigation web autonome (fetch + JSDOM)
 */

import { describe, it, expect, afterAll } from 'vitest';
import { autonomousBrowser } from './autonomousBrowser';

describe('AutonomousBrowser Module', () => {
  
  describe('analyzeNeedForBrowsing', () => {
    it('should detect URL in query', async () => {
      const result = await autonomousBrowser.analyzeNeedForBrowsing(
        'Va sur https://example.com et extrais le contenu'
      );
      expect(result.needed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.85);
    });

    it('should detect navigation keywords', async () => {
      const result = await autonomousBrowser.analyzeNeedForBrowsing(
        'Navigue vers le site et récupère les données'
      );
      expect(result.needed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.5);
    });

    it('should detect scraping keywords', async () => {
      const result = await autonomousBrowser.analyzeNeedForBrowsing(
        'Extrais les données du tableau sur cette page'
      );
      expect(result.needed).toBe(true);
    });

    it('should not trigger for simple questions', async () => {
      const result = await autonomousBrowser.analyzeNeedForBrowsing(
        'Quelle est la capitale de la France?'
      );
      expect(result.needed).toBe(false);
    });

    it('should detect JavaScript/dynamic content keywords', async () => {
      const result = await autonomousBrowser.analyzeNeedForBrowsing(
        'Cette page utilise JavaScript dynamique pour charger le contenu'
      );
      expect(result.needed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('navigateAndExtract', () => {
    it('should extract content from a real website', async () => {
      const result = await autonomousBrowser.navigateAndExtract('https://example.com');
      
      expect(result).toBeDefined();
      expect(result.title).toBeTruthy();
      expect(result.url).toContain('example.com');
      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(0);
    }, 30000);

    it('should extract links from a page', async () => {
      const result = await autonomousBrowser.navigateAndExtract('https://example.com');
      
      expect(result.links).toBeDefined();
      expect(Array.isArray(result.links)).toBe(true);
    }, 30000);
  });

  describe('executeBrowsingSession', () => {
    it('should execute a complete browsing session', async () => {
      const result = await autonomousBrowser.executeBrowsingSession(
        'https://example.com',
        'Extrais le titre et le contenu principal'
      );
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeTruthy();
      expect(result.content).toBeTruthy();
      expect(result.extraction).toBeDefined();
      expect(result.method).toBe('fetch');
    }, 30000);

    it('should handle errors gracefully', async () => {
      const result = await autonomousBrowser.executeBrowsingSession(
        'https://this-domain-does-not-exist-12345.com',
        'Test error handling'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    }, 30000);
  });

  describe('getStatistics', () => {
    it('should return statistics', () => {
      const stats = autonomousBrowser.getStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalSessions).toBe('number');
      expect(stats.method).toBe('fetch + JSDOM');
      expect(typeof stats.averageDuration).toBe('number');
    });
  });

  describe('getBrowsingHistory', () => {
    it('should return browsing history', () => {
      const history = autonomousBrowser.getBrowsingHistory(5);
      
      expect(Array.isArray(history)).toBe(true);
    });
  });

  // Cleanup après les tests
  afterAll(async () => {
    await autonomousBrowser.close();
  });
});
