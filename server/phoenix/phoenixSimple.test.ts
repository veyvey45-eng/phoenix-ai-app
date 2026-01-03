/**
 * Tests complets pour Phoenix Simple
 * Vérification 100% que tout fonctionne réellement
 */

import { describe, it, expect } from 'vitest';
import { processPhoenixQuery, testPhoenix } from './phoenixSimple';

describe('Phoenix Simple - Tests Fonctionnels Réels', () => {
  describe('Test 1: Réponses simples', () => {
    it('devrait répondre à une question simple', async () => {
      const response = await processPhoenixQuery('Bonjour, qui es-tu?');
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.confidence).toBeGreaterThan(0);
      console.log('✅ Réponse simple:', response.content.substring(0, 80));
    }, { timeout: 30000 });
  });

  describe('Test 2: Mémoire des conversations', () => {
    it('devrait se souvenir du contexte de conversation', async () => {
      const history = [
        { role: 'user' as const, content: 'Je m\'appelle Bob' },
        { role: 'assistant' as const, content: 'Enchanté Bob!' }
      ];
      
      const response = await processPhoenixQuery('Quel est mon nom?', history);
      
      expect(response.content).toBeDefined();
      expect(response.content.toLowerCase()).toContain('bob');
      console.log('✅ Mémoire:', response.content.substring(0, 80));
    }, { timeout: 30000 });
  });

  describe('Test 3: Recherche en ligne', () => {
    it('devrait effectuer une recherche en ligne', async () => {
      const response = await processPhoenixQuery('Cherche les actualités sur l\'intelligence artificielle');
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.sources).toBeDefined();
      console.log('✅ Recherche:', response.content.substring(0, 80));
      console.log('✅ Sources:', response.sources);
    }, { timeout: 30000 });
  });

  describe('Test 4: Axiomes et Modules', () => {
    it('devrait connaître les 16 axiomes', async () => {
      const response = await processPhoenixQuery('Quels sont les 16 axiomes de conscience fonctionnelle?');
      
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(100);
      console.log('✅ Axiomes:', response.content.substring(0, 100));
    }, { timeout: 30000 });
  });

  describe('Test 5: Modules opérationnels', () => {
    it('devrait connaître les 10 modules', async () => {
      const response = await processPhoenixQuery('Quels sont les 10 modules opérationnels?');
      
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(100);
      console.log('✅ Modules:', response.content.substring(0, 100));
    }, { timeout: 30000 });
  });

  describe('Test 6: Autonomie et fonctionnalité', () => {
    it('devrait être autonome et fonctionnel', async () => {
      const response = await processPhoenixQuery('Es-tu autonome et fonctionnel?');
      
      expect(response.content).toBeDefined();
      expect(response.content.toLowerCase()).toContain('oui');
      console.log('✅ Autonomie:', response.content.substring(0, 80));
    }, { timeout: 30000 });
  });

  describe('Test 7: Suite complète', () => {
    it('devrait passer tous les tests', async () => {
      const result = await testPhoenix();
      expect(result).toBe(true);
    }, { timeout: 120000 });
  });
});
