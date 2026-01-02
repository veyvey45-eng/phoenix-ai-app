/**
 * Tests pour NewsAPI Gratuit
 */

import { describe, it, expect } from 'vitest';
import { newsApiFree } from './newsApiFree';

describe('NewsApiFree', () => {
  describe('getNews', () => {
    it('should return news articles for a query', async () => {
      const response = await newsApiFree.getNews('technologie', 'fr', 'fr');
      expect(response.query).toBe('technologie');
      expect(response.articles).toBeDefined();
      expect(Array.isArray(response.articles)).toBe(true);
      expect(response.articles.length).toBeGreaterThan(0);
    });

    it('should include BBC, Reuters, France24 sources', async () => {
      const response = await newsApiFree.getNews('France', 'fr', 'fr');
      const sources = response.articles.map(a => a.source);
      expect(sources).toContain('BBC News');
      expect(sources).toContain('Reuters');
      expect(sources).toContain('France24');
    });

    it('should format news for context', async () => {
      const response = await newsApiFree.getNews('économie', 'fr', 'fr');
      const formatted = newsApiFree.formatForContext(response);
      expect(formatted).toContain('ACTUALITÉS');
      expect(formatted).toContain('économie');
      expect(formatted).toContain('Sources Publiques');
    });

    it('should cache results', async () => {
      const response1 = await newsApiFree.getNews('test', 'fr', 'fr');
      const response2 = await newsApiFree.getNews('test', 'fr', 'fr');
      expect(response1.articles.length).toBe(response2.articles.length);
    });
  });
});
