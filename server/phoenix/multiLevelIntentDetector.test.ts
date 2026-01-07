/**
 * Tests pour le système de détection d'intentions multi-niveaux
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectIntentMultiLevel, detectIntentQuick } from './multiLevelIntentDetector';
import { createContext, getOrCreateContext } from './conversationContext';

// Mock du LLM pour les tests
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          explicit_intent: { type: 'conversation', confidence: 0.8, reasoning: 'Test' },
          implicit_intent: null,
          has_negation: false,
          negated_intent: null,
          has_transition: false,
          transition_from: null,
          transition_to: null
        })
      }
    }]
  })
}));

describe('MultiLevelIntentDetector', () => {
  describe('detectIntentQuick', () => {
    it('should detect simple conversation', () => {
      const result = detectIntentQuick('Bonjour, comment ça va?');
      expect(result.type).toBe('conversation');
    });

    it('should detect image generation', () => {
      const result = detectIntentQuick('Génère-moi une image de chat');
      expect(result.type).toBe('image_generation');
    });

    it('should detect site creation', () => {
      const result = detectIntentQuick('Crée-moi un site web pour mon hôtel');
      expect(result.type).toBe('site_creation');
    });

    it('should detect app creation', () => {
      const result = detectIntentQuick('Crée-moi une application de chatbot');
      expect(result.type).toBe('app_creation');
    });

    it('should detect weather request', () => {
      const result = detectIntentQuick('Quelle est la météo à Paris?');
      expect(result.type).toBe('weather');
    });

    it('should detect crypto request', () => {
      const result = detectIntentQuick('Quel est le prix du Bitcoin?');
      expect(result.type).toBe('crypto');
    });

    it('should flag negation for full analysis', () => {
      const result = detectIntentQuick('Je ne veux plus de génération d\'images');
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should flag transition for full analysis', () => {
      const result = detectIntentQuick('Maintenant crée-moi une application');
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('Transition Detection', () => {
    it('should detect negation pattern "je ne veux plus"', () => {
      const result = detectIntentQuick('Je ne veux plus de génération d\'images, crée-moi une app');
      // Should flag for full analysis
      expect(result.confidence).toBeLessThanOrEqual(0.8);
    });

    it('should detect transition pattern "maintenant"', () => {
      const result = detectIntentQuick('Maintenant je veux un site web');
      expect(result.confidence).toBeLessThanOrEqual(0.8);
    });

    it('should detect transition pattern "plutôt"', () => {
      const result = detectIntentQuick('Plutôt crée-moi une application');
      expect(result.confidence).toBeLessThanOrEqual(0.8);
    });

    it('should detect transition pattern "à la place"', () => {
      const result = detectIntentQuick('À la place, fais-moi un site');
      expect(result.confidence).toBeLessThanOrEqual(0.8);
    });
  });

  describe('App vs Image Distinction', () => {
    it('should detect "vraie application" as app_creation', () => {
      const result = detectIntentQuick('Crée-moi une vraie application de chat');
      expect(result.type).toBe('app_creation');
    });

    it('should detect "image d\'application" as image_generation', () => {
      const result = detectIntentQuick('Génère une image d\'une application mobile');
      expect(result.type).toBe('image_generation');
    });

    it('should detect "application fonctionnelle" as app_creation', () => {
      const result = detectIntentQuick('Je veux une application fonctionnelle');
      expect(result.type).toBe('app_creation');
    });
  });

  describe('Context-Aware Detection', () => {
    it('should use context for pronoun resolution', async () => {
      const context = createContext(1, 'user1');
      context.lastIntent = 'image_generation';
      
      // Simulate a follow-up message
      const result = await detectIntentMultiLevel('Refais ça en bleu', context, false, false);
      
      // Should consider the previous context
      expect(result.levels.context).not.toBeNull();
    });
  });

  describe('Multi-Language Support', () => {
    it('should detect French requests', () => {
      const result = detectIntentQuick('Crée-moi un site web');
      expect(result.type).toBe('site_creation');
    });

    it('should detect English requests', () => {
      const result = detectIntentQuick('Create me a website');
      expect(result.type).toBe('site_creation');
    });

    it('should detect German requests', () => {
      const result = detectIntentQuick('Erstelle mir eine Webseite');
      expect(result.type).toBe('site_creation');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle "stop images, create app" pattern', async () => {
      const result = await detectIntentMultiLevel(
        'Arrête les images, crée-moi une application de chatbot',
        null,
        false,
        false
      );
      
      // Should detect the transition and prioritize app_creation
      expect(result.hasNegation || result.hasTransition).toBe(true);
    });

    it('should handle implicit requests', async () => {
      const result = await detectIntentMultiLevel(
        'J\'ai un restaurant à Paris',
        null,
        false,
        false
      );
      
      // Could be conversation or implicit site creation
      expect(['conversation', 'site_creation']).toContain(result.finalIntent);
    });
  });
});
