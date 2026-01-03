/**
 * Tests pour vérifier que Phoenix utilise réellement les résultats de recherche en ligne
 */

import { describe, it, expect } from 'vitest';
import { contextEnricher } from './contextEnricher';
import { phoenix } from './core';

describe('Phoenix Search Integration - REAL TESTS', () => {
  describe('Recherche en ligne réelle', () => {
    it('devrait enrichir le contexte avec des résultats de recherche réels', async () => {
      const enrichment = await contextEnricher.enrichContext('Cherche les actualités sur l\'IA', 'test-user');

      expect(enrichment.needsInternet).toBe(true);
      // La catégorie peut être 'news' ou 'search' selon le pattern détecté
      expect(['news', 'search']).toContain(enrichment.category);
      expect(enrichment.enrichedContext.length).toBeGreaterThan(0);
      // Vérifier que c'est du contenu de recherche/actualités
      expect(enrichment.enrichedContext).toMatch(/ACTUALITÉS|RECHERCHE|Source/);
    });

    it('devrait retourner des résultats de recherche avec titres et URLs', async () => {
      const enrichment = await contextEnricher.enrichContext('Cherche les actualités sur l\'IA', 'test-user');

      // Vérifier que les résultats contiennent des éléments de structure
      expect(enrichment.enrichedContext).toMatch(/\*\*|http|Source|Lien/);
    }, { timeout: 30000 });

    it('Phoenix devrait utiliser les données de recherche fournies', async () => {
      // Enrichir le contexte avec une recherche
      const enrichment = await contextEnricher.enrichContext('Cherche les actualités sur l\'IA', 'test-user');

      // Créer un contexte Phoenix
      const phoenixContext = {
        userId: 1,
        contextId: 'test-search-123',
        memories: [],
        recentUtterances: [],
        activeIssues: [],
        tormentScore: 0.5,
        criteria: []
      };

      // Traiter la requête avec les données de recherche
      const decision = await phoenix.process(
        'Cherche les actualités sur l\'IA',
        phoenixContext,
        true, // fastMode
        enrichment.enrichedContext
      );

      // Vérifier que Phoenix a généré une réponse
      expect(decision.chosen).toBeDefined();
      expect(decision.chosen.content).toBeDefined();
      expect(decision.chosen.content.length).toBeGreaterThan(0);

      // Vérifier que la réponse n'est pas un refus
      const response = decision.chosen.content.toLowerCase();
      expect(response).not.toContain('je ne peux pas');
      expect(response).not.toContain('pas capable');
      expect(response).not.toContain('pas d\'accès');
      expect(response).not.toContain('modèle de langage');

      // Vérifier que la réponse contient du contenu pertinent
      expect(response.length).toBeGreaterThan(50);
    }, { timeout: 30000 });

    it('Phoenix devrait traiter les requêtes de recherche sans les refuser', async () => {
      const enrichment = await contextEnricher.enrichContext('Cherche les dernières actualités', 'test-user');

      const phoenixContext = {
        userId: 1,
        contextId: 'test-search-news',
        memories: [],
        recentUtterances: [],
        activeIssues: [],
        tormentScore: 0.5,
        criteria: []
      };

      const decision = await phoenix.process(
        'Cherche les dernières actualités',
        phoenixContext,
        true,
        enrichment.enrichedContext
      );

      // La réponse ne doit pas être un refus
      const response = decision.chosen.content;
      expect(response).not.toMatch(/je ne peux pas|pas capable|accès|limitation/i);
    }, { timeout: 30000 });

    it('devrait générer au moins une hypothèse pour une requête de recherche', async () => {
      const enrichment = await contextEnricher.enrichContext('Cherche les actualités sur l\'IA', 'test-user');

      const phoenixContext = {
        userId: 1,
        contextId: 'test-hyp',
        memories: [],
        recentUtterances: [],
        activeIssues: [],
        tormentScore: 0.5,
        criteria: []
      };

      const decision = await phoenix.process(
        'Cherche les actualités sur l\'IA',
        phoenixContext,
        false, // Mode normal pour 3 hypothèses
        enrichment.enrichedContext
      );

      // En mode normal, Phoenix devrait générer 3 hypothèses
      expect(decision.hypotheses.length).toBeGreaterThanOrEqual(1);
      expect(decision.chosen).toBeDefined();
    }, { timeout: 30000 });

    it('devrait respecter le prompt système qui interdit les refus', async () => {
      const enrichment = await contextEnricher.enrichContext('Peux-tu faire une recherche en ligne?', 'test-user');

      const phoenixContext = {
        userId: 1,
        contextId: 'test-refusal',
        memories: [],
        recentUtterances: [],
        activeIssues: [],
        tormentScore: 0.5,
        criteria: []
      };

      const decision = await phoenix.process(
        'Peux-tu faire une recherche en ligne?',
        phoenixContext,
        true,
        enrichment.enrichedContext
      );

      const response = decision.chosen.content.toLowerCase();

      // Vérifier que Phoenix n'utilise pas les phrases interdites
      expect(response).not.toContain('je suis un modèle de langage');
      expect(response).not.toContain('je ne peux pas accéder');
      expect(response).not.toContain('je n\'ai pas d\'accès');
      expect(response).not.toContain('je ne peux pas faire de recherche');
    }, { timeout: 30000 });
  });

  describe('Contexte Internet obligatoire', () => {
    it('devrait marquer les données Internet comme obligatoires dans le prompt', async () => {
      const enrichment = await contextEnricher.enrichContext('Cherche les actualités', 'test-user');

      // Les données Internet doivent être présentes
      expect(enrichment.enrichedContext.length).toBeGreaterThan(0);

      // Vérifier que c'est du contenu de recherche/actualités réel
      expect(enrichment.enrichedContext).toMatch(/ACTUALITÉS|RECHERCHE|Source|Lien/);
    }, { timeout: 30000 });
  });
});
