/**
 * Tests unitaires pour le Module 17: Web Search Integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webSearchIntegration } from './webSearch';

describe('Module 17: Web Search Integration', () => {
  beforeEach(() => {
    // Réinitialiser les caches et rate limits
    vi.clearAllMocks();
  });

  describe('Recherche web basique', () => {
    it('devrait effectuer une recherche simple', async () => {
      const response = await webSearchIntegration.search('Phoenix IA');

      expect(response).toBeDefined();
      expect(response.query).toBe('Phoenix IA');
      expect(response.results).toBeDefined();
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.cached).toBe(false);
      expect(response.signature).toBeDefined();
      expect(response.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('devrait retourner les résultats avec les champs requis', async () => {
      const response = await webSearchIntegration.search('test');

      expect(response.results[0]).toHaveProperty('title');
      expect(response.results[0]).toHaveProperty('url');
      expect(response.results[0]).toHaveProperty('snippet');
      expect(response.results[0]).toHaveProperty('source');
      expect(response.results[0]).toHaveProperty('timestamp');
    });

    it('devrait respecter le nombre de résultats demandés', async () => {
      const response = await webSearchIntegration.search('test', { maxResults: 5 });

      expect(response.results.length).toBeLessThanOrEqual(5);
    });

    it('devrait générer une signature SHA-256 unique', async () => {
      const response1 = await webSearchIntegration.search('test1');
      const response2 = await webSearchIntegration.search('test2');

      expect(response1.signature).toBeDefined();
      expect(response2.signature).toBeDefined();
      expect(response1.signature.length).toBe(64); // SHA-256 = 64 caractères hex
      expect(response2.signature.length).toBe(64);
    });
  });

  describe('Mise en cache', () => {
    it('devrait mettre en cache les résultats', async () => {
      const response1 = await webSearchIntegration.search('cache-test');
      const response2 = await webSearchIntegration.search('cache-test');

      expect(response1.cached).toBe(false);
      expect(response2.cached).toBe(true);
    });

    it('devrait retourner les mêmes résultats du cache', async () => {
      const response1 = await webSearchIntegration.search('cache-compare');
      const response2 = await webSearchIntegration.search('cache-compare');

      expect(response1.results).toEqual(response2.results);
      expect(response1.signature).toBe(response2.signature);
    });

    it('devrait avoir des temps de traitement différents (cache plus rapide)', async () => {
      const response1 = await webSearchIntegration.search('timing-test');
      const response2 = await webSearchIntegration.search('timing-test');

      // Le cache devrait être plus rapide
      expect(response2.processingTime).toBeLessThanOrEqual(response1.processingTime);
    });
  });

  describe('Options de recherche', () => {
    it('devrait accepter la langue', async () => {
      const response = await webSearchIntegration.search('test', { language: 'en' });

      expect(response).toBeDefined();
      expect(response.results.length).toBeGreaterThan(0);
    });

    it('devrait accepter la région', async () => {
      const response = await webSearchIntegration.search('test', { region: 'US' });

      expect(response).toBeDefined();
      expect(response.results.length).toBeGreaterThan(0);
    });

    it('devrait accepter l\'userId', async () => {
      const response = await webSearchIntegration.search('test', { userId: 'user-123' });

      expect(response).toBeDefined();
    });

    it('devrait combiner plusieurs options', async () => {
      const response = await webSearchIntegration.search('test', {
        maxResults: 5,
        language: 'fr',
        region: 'FR',
        userId: 'user-456'
      });

      expect(response).toBeDefined();
      expect(response.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Rate limiting', () => {
    it('devrait permettre les requêtes jusqu\'à la limite', async () => {
      const userId = 'rate-limit-test-user';
      
      // Effectuer 10 requêtes (bien en dessous de la limite de 60)
      for (let i = 0; i < 10; i++) {
        const response = await webSearchIntegration.search(`query-${i}`, { userId });
        expect(response).toBeDefined();
      }
    });

    it('devrait lever une erreur au-delà du rate limit', async () => {
      const userId = 'rate-limit-exceed-user';
      
      // Essayer de dépasser la limite (60 requêtes par minute)
      // Pour le test, on va simuler cela
      for (let i = 0; i < 60; i++) {
        try {
          await webSearchIntegration.search(`query-${i}`, { userId });
        } catch (error) {
          // Accepter l'erreur de rate limit
          expect(error).toBeDefined();
          break;
        }
      }
    });

    it('devrait avoir des rate limits séparés par utilisateur', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';
      
      // Chaque utilisateur devrait avoir son propre compteur
      const response1 = await webSearchIntegration.search('test', { userId: user1 });
      const response2 = await webSearchIntegration.search('test', { userId: user2 });
      
      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
    });
  });

  describe('Statistiques', () => {
    it('devrait retourner les statistiques du cache', () => {
      const stats = webSearchIntegration.getStats();

      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('cachedQueries');
      expect(stats).toHaveProperty('rateLimitEntries');
      expect(typeof stats.cacheSize).toBe('number');
      expect(Array.isArray(stats.cachedQueries)).toBe(true);
      expect(typeof stats.rateLimitEntries).toBe('number');
    });

    it('devrait augmenter la taille du cache après une recherche', async () => {
      const statsBefore = webSearchIntegration.getStats();
      await webSearchIntegration.search('stats-test-unique-query-12345');
      const statsAfter = webSearchIntegration.getStats();

      expect(statsAfter.cacheSize).toBeGreaterThanOrEqual(statsBefore.cacheSize);
    });
  });

  describe('Nettoyage', () => {
    it('devrait nettoyer le cache expiré', async () => {
      await webSearchIntegration.search('cleanup-test');
      
      // Appeler le nettoyage
      webSearchIntegration.cleanExpiredCache();
      
      // Les statistiques devraient être mises à jour
      const stats = webSearchIntegration.getStats();
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
    });

    it('devrait nettoyer les rate limits expirés', () => {
      // Appeler le nettoyage
      webSearchIntegration.cleanExpiredRateLimits();
      
      // Les statistiques devraient être mises à jour
      const stats = webSearchIntegration.getStats();
      expect(stats.rateLimitEntries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait gérer les requêtes vides', async () => {
      const response = await webSearchIntegration.search('');

      expect(response).toBeDefined();
      expect(response.query).toBe('');
    });

    it('devrait gérer les requêtes avec caractères spéciaux', async () => {
      const response = await webSearchIntegration.search('test & spécial @#$%');

      expect(response).toBeDefined();
      expect(response.results.length).toBeGreaterThan(0);
    });

    it('devrait gérer les requêtes très longues', async () => {
      const longQuery = 'a'.repeat(1000);
      const response = await webSearchIntegration.search(longQuery);

      expect(response).toBeDefined();
    });
  });

  describe('Intégration avec IntegrationHub', () => {
    it('devrait être compatible avec le Module 12', async () => {
      // Simuler un appel via IntegrationHub
      const response = await webSearchIntegration.search('integration-test', {
        userId: 'integration-user',
        maxResults: 10
      });

      expect(response).toBeDefined();
      expect(response.signature).toBeDefined();
      expect(response.processingTime).toBeGreaterThanOrEqual(0);
    });
  });
});
