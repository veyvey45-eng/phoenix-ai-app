/**
 * Tests pour ManusLikeCognition - Capacités cognitives Manus-like
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock des dépendances
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          isAmbiguous: false,
          ambiguityLevel: 'none',
          clarificationNeeded: false,
          bestInterpretation: 'Test message',
          alternativeInterpretations: [],
          confidence: 0.9,
          reasoning: 'Clear message',
          clarificationQuestions: []
        })
      }
    }]
  })
}));

vi.mock('./hypothesisEngine', () => ({
  getHypothesisEngine: vi.fn().mockReturnValue({
    reset: vi.fn()
  })
}));

vi.mock('./metaCognition', () => ({
  getMetaCognition: vi.fn().mockReturnValue({
    reset: vi.fn()
  })
}));

vi.mock('./workingMemory', () => ({
  getWorkingMemory: vi.fn().mockReturnValue({
    store: vi.fn(),
    retrieve: vi.fn(),
    query: vi.fn().mockReturnValue([]),
    getContext: vi.fn().mockReturnValue({
      currentTopic: '',
      entities: new Map(),
      recentActions: [],
      userPreferences: new Map(),
      sessionStart: Date.now()
    }),
    reset: vi.fn()
  })
}));

vi.mock('./proactiveEngine', () => ({
  getProactiveEngine: vi.fn().mockReturnValue({
    generateSuggestions: vi.fn().mockResolvedValue([]),
    reset: vi.fn()
  })
}));

// Import après les mocks
import { ManusLikeCognition, getManusLikeCognition } from './manusLikeCognition';

describe('ManusLikeCognition', () => {
  let cognition: ManusLikeCognition;

  beforeEach(() => {
    vi.clearAllMocks();
    cognition = new ManusLikeCognition();
  });

  describe('Gestion d\'ambiguïté', () => {
    it('devrait détecter un message clair sans ambiguïté', async () => {
      const result = await cognition.analyzeAmbiguity(
        'Génère une image de dragon',
        [],
        'image_generation'
      );

      expect(result.isAmbiguous).toBe(false);
      expect(result.clarificationNeeded).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('devrait générer un message de clarification si nécessaire', () => {
      const resolution = {
        isAmbiguous: true,
        ambiguityLevel: 'high' as const,
        clarificationNeeded: true,
        clarificationQuestions: [{
          id: 'test_1',
          question: 'Quel type de dragon voulez-vous?',
          options: ['Européen', 'Asiatique'],
          type: 'choice' as const,
          priority: 'required' as const,
          context: 'dragon'
        }],
        bestInterpretation: 'Un dragon européen',
        alternativeInterpretations: ['Un dragon asiatique'],
        confidence: 0.5,
        reasoning: 'Type de dragon ambigu'
      };

      const message = cognition.generateClarificationMessage(resolution);
      expect(message).toContain('précision');
      expect(message).toContain('dragon');
    });

    it('ne devrait pas générer de message si pas de clarification nécessaire', () => {
      const resolution = {
        isAmbiguous: false,
        ambiguityLevel: 'none' as const,
        clarificationNeeded: false,
        clarificationQuestions: [],
        bestInterpretation: 'Message clair',
        alternativeInterpretations: [],
        confidence: 0.95,
        reasoning: 'Pas d\'ambiguïté'
      };

      const message = cognition.generateClarificationMessage(resolution);
      expect(message).toBe('');
    });
  });

  describe('Mémoire de travail', () => {
    it('devrait mettre à jour la mémoire de travail', () => {
      const state = cognition.updateWorkingMemory(
        'Recherche sur Bitcoin',
        'crypto',
        ['Bitcoin']
      );

      expect(state).toBeDefined();
      expect(state.currentTopic).toBeDefined();
    });

    it('devrait récupérer l\'état de la mémoire', () => {
      const state = cognition.getWorkingMemoryState();

      expect(state).toHaveProperty('currentTopic');
      expect(state).toHaveProperty('recentEntities');
      expect(state).toHaveProperty('userPreferences');
      expect(state).toHaveProperty('pendingTasks');
    });
  });

  describe('Initiative proactive', () => {
    it('devrait générer des suggestions proactives', async () => {
      const suggestions = await cognition.generateProactiveSuggestions(
        'Analyse le cours de Bitcoin',
        'crypto'
      );

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Analyse cognitive complète', () => {
    it('devrait effectuer une analyse cognitive complète', async () => {
      // Mock pour l'analyse complète
      const { invokeLLM } = await import('../_core/llm');
      (invokeLLM as any)
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                isAmbiguous: false,
                ambiguityLevel: 'none',
                clarificationNeeded: false,
                bestInterpretation: 'Génère une image de dragon',
                alternativeInterpretations: [],
                confidence: 0.9,
                reasoning: 'Demande claire',
                clarificationQuestions: []
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                currentConfidence: 0.85,
                uncertaintyAreas: [],
                knowledgeLimits: [],
                reasoningQuality: 'good',
                selfCorrections: [],
                reflections: []
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                anticipatedNeeds: ['Modifier l\'image', 'Générer des variations']
              })
            }
          }]
        });

      const analysis = await cognition.analyzeCompletely(
        'Génère une image de dragon',
        [],
        'image_generation'
      );

      expect(analysis).toHaveProperty('ambiguity');
      expect(analysis).toHaveProperty('metacognition');
      expect(analysis).toHaveProperty('memory');
      expect(analysis).toHaveProperty('proactive');
      expect(analysis).toHaveProperty('overallReadiness');
      expect(analysis).toHaveProperty('recommendedAction');
      expect(analysis.overallReadiness).toBeGreaterThan(0);
    });

    it('devrait préparer une réponse cognitive', () => {
      const analysis = {
        ambiguity: {
          isAmbiguous: false,
          ambiguityLevel: 'none' as const,
          clarificationNeeded: false,
          clarificationQuestions: [],
          bestInterpretation: 'Test',
          alternativeInterpretations: [],
          confidence: 0.9,
          reasoning: ''
        },
        metacognition: {
          currentConfidence: 0.85,
          uncertaintyAreas: [],
          knowledgeLimits: [],
          reasoningQuality: 'good' as const,
          selfCorrections: [],
          reflections: []
        },
        memory: {
          currentTopic: 'test',
          recentEntities: [],
          userPreferences: {},
          pendingTasks: [],
          conversationSummary: '',
          importantFacts: []
        },
        proactive: {
          suggestions: [],
          anticipatedNeeds: [],
          alerts: [],
          opportunities: []
        },
        overallReadiness: 0.87,
        recommendedAction: 'proceed' as const
      };

      const response = cognition.prepareCognitiveResponse(analysis);

      expect(response.shouldProceed).toBe(true);
      expect(response.clarificationNeeded).toBe(false);
      expect(response.confidenceLevel).toBeGreaterThan(0.5);
    });
  });

  describe('Singleton', () => {
    it('devrait retourner la même instance', () => {
      const instance1 = getManusLikeCognition();
      const instance2 = getManusLikeCognition();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Reset', () => {
    it('devrait réinitialiser l\'état cognitif', () => {
      cognition.reset();
      const status = cognition.getStatus();
      expect(status).toContain('État Cognitif Phoenix');
    });
  });
});
