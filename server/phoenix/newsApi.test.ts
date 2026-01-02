/**
 * Tests pour NewsAPI
 */

import { describe, it, expect } from 'vitest';
import { newsApi } from './newsApi';

describe('NewsApi', () => {
  describe('getNews', () => {
    it('should return news articles', async () => {
      const response = await newsApi.getNews('technologie', 'fr', 'fr');
      expect(response.query).toBe('technologie');
      expect(response.articles).toBeDefined();
      expect(Array.isArray(response.articles)).toBe(true);
    });

    it('should format news for context', async () => {
      const response = await newsApi.getNews('France', 'fr', 'fr');
      const formatted = newsApi.formatForContext(response);
      expect(formatted).toContain('ACTUALITÉS');
      expect(formatted).toContain('France');
    });
  });
});
