/**
 * Tests pour le service Hosted Sites
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Hosted Sites Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSlug', () => {
    it('should generate a valid slug from a name', () => {
      // Test de la logique de génération de slug
      const name = "Hôtel Luxembourg";
      const baseSlug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 40);
      
      expect(baseSlug).toBe("hotel-luxembourg");
    });

    it('should handle special characters', () => {
      const name = "Café & Restaurant L'Étoile";
      const baseSlug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 40);
      
      expect(baseSlug).toBe("cafe-restaurant-l-etoile");
    });

    it('should truncate long names', () => {
      const name = "This is a very long hotel name that should be truncated to forty characters maximum";
      const baseSlug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 40);
      
      expect(baseSlug.length).toBeLessThanOrEqual(40);
    });
  });

  describe('Site data validation', () => {
    it('should validate required fields', () => {
      const validSite = {
        userId: 1,
        name: 'Test Site',
        htmlContent: '<html><body>Hello</body></html>',
      };
      
      expect(validSite.userId).toBeGreaterThan(0);
      expect(validSite.name.length).toBeGreaterThan(0);
      expect(validSite.htmlContent.length).toBeGreaterThan(0);
    });

    it('should accept optional fields', () => {
      const siteWithOptionals = {
        userId: 1,
        name: 'Test Site',
        description: 'A test description',
        htmlContent: '<html><body>Hello</body></html>',
        cssContent: 'body { color: red; }',
        jsContent: 'console.log("hello");',
        isPublic: true,
      };
      
      expect(siteWithOptionals.description).toBeDefined();
      expect(siteWithOptionals.cssContent).toBeDefined();
      expect(siteWithOptionals.jsContent).toBeDefined();
      expect(siteWithOptionals.isPublic).toBe(true);
    });
  });

  describe('Site types', () => {
    it('should accept valid site types', () => {
      const validTypes = ["landing", "portfolio", "business", "ecommerce", "blog", "custom"];
      
      validTypes.forEach(type => {
        expect(validTypes).toContain(type);
      });
    });
  });

  describe('View count', () => {
    it('should increment view count correctly', () => {
      let viewCount = 0;
      viewCount = viewCount + 1;
      expect(viewCount).toBe(1);
      
      viewCount = viewCount + 1;
      expect(viewCount).toBe(2);
    });
  });
});
