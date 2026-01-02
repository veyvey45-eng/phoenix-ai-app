/**
 * Tests unitaires pour les Modules 13-16: Productivité
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  contentGenerator,
  documentAnalyzer,
  specialistAgents,
  ideaGenerator,
} from './productivityModules';
import * as llmModule from '../_core/llm';

vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn(),
}));

describe('Modules Productivité (13-16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Module 13: ContentGenerator', () => {
    it('devrait générer un email', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Cher client, nous sommes heureux de vous présenter...',
            },
          },
        ],
      } as any);

      const content = await contentGenerator.generateContent('Nouveau produit', {
        type: 'email',
        style: 'professionnel',
        tone: 'formel',
      });

      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
      expect(mockLLM).toHaveBeenCalled();
    });

    it('devrait générer un article', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Article complet sur le sujet...',
            },
          },
        ],
      } as any);

      const content = await contentGenerator.generateContent('IA et productivité', {
        type: 'article',
        style: 'academique',
        tone: 'informatif',
      });

      expect(content).toBeDefined();
      expect(mockLLM).toHaveBeenCalled();
    });

    it('devrait générer un post réseaux sociaux', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Post court et engageant!',
            },
          },
        ],
      } as any);

      const content = await contentGenerator.generateContent('Nouvelle fonctionnalité', {
        type: 'post',
        style: 'casual',
        tone: 'amical',
      });

      expect(content).toBeDefined();
      expect(mockLLM).toHaveBeenCalled();
    });

    it('devrait générer plusieurs variantes', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Variante de contenu',
            },
          },
        ],
      } as any);

      const variants = await contentGenerator.generateMultipleVariants(
        'Sujet test',
        { type: 'email', style: 'professionnel', tone: 'formel' },
        3
      );

      expect(variants.length).toBe(3);
      expect(mockLLM).toHaveBeenCalledTimes(3);
    });
  });

  describe('Module 14: DocumentAnalyzer', () => {
    it('devrait analyser un document', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Analyse du document: points clés, sentiment positif, sujets importants',
            },
          },
        ],
      } as any);

      const result = await documentAnalyzer.analyzeDocument('Contenu du document à analyser');

      expect(result.summary).toBeDefined();
      expect(result.keyPoints).toBeDefined();
      expect(result.sentiment).toMatch(/positif|négatif|neutre/);
      expect(result.topics).toBeDefined();
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.readingTime).toBeGreaterThan(0);
    });

    it('devrait détecter le sentiment positif', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'C\'est excellent et merveilleux!',
            },
          },
        ],
      } as any);

      const result = await documentAnalyzer.analyzeDocument('Contenu positif');

      expect(result.sentiment).toBe('positif');
    });

    it('devrait détecter le sentiment négatif', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'C\'est horrible et terrible!',
            },
          },
        ],
      } as any);

      const result = await documentAnalyzer.analyzeDocument('Contenu négatif');

      expect(result.sentiment).toBe('négatif');
    });

    it('devrait calculer le temps de lecture', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Analyse',
            },
          },
        ],
      } as any);

      const longContent = 'mot '.repeat(500); // 500 mots
      const result = await documentAnalyzer.analyzeDocument(longContent);

      expect(result.readingTime).toBeGreaterThan(0);
      expect(result.wordCount).toBeGreaterThan(400);
    });
  });

  describe('Module 15: SpecialistAgents', () => {
    it('devrait exécuter l\'agent copywriting', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Texte persuasif et engageant pour le copywriting',
            },
          },
        ],
      } as any);

      const result = await specialistAgents.executeSpecialist('copywriting', 'Crée un titre accrocheur');

      expect(result.type).toBe('copywriting');
      expect(result.output).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('devrait exécuter l\'agent code', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'function hello() { return "world"; }',
            },
          },
        ],
      } as any);

      const result = await specialistAgents.executeSpecialist('code', 'Génère une fonction simple');

      expect(result.type).toBe('code');
      expect(result.output).toContain('function');
    });

    it('devrait exécuter l\'agent SEO', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Contenu optimisé pour SEO avec mots-clés stratégiques',
            },
          },
        ],
      } as any);

      const result = await specialistAgents.executeSpecialist('seo', 'Optimise ce texte pour SEO');

      expect(result.type).toBe('seo');
      expect(result.recommendations).toContain('Augmenter la densité de mots-clés');
    });

    it('devrait exécuter l\'agent UX', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Interface utilisateur intuitive et accessible',
            },
          },
        ],
      } as any);

      const result = await specialistAgents.executeSpecialist('ux', 'Améliore l\'expérience utilisateur');

      expect(result.type).toBe('ux');
      expect(result.recommendations).toContain('Simplifier la navigation');
    });

    it('devrait exécuter l\'agent design', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Design moderne avec palette de couleurs cohérente',
            },
          },
        ],
      } as any);

      const result = await specialistAgents.executeSpecialist('design', 'Crée un design moderne');

      expect(result.type).toBe('design');
      expect(result.recommendations).toContain('Améliorer la hiérarchie visuelle');
    });
  });

  describe('Module 16: IdeaGenerator', () => {
    it('devrait générer des idées', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Idée 1\nIdée 2\nIdée 3\nIdée 4\nIdée 5',
            },
          },
        ],
      } as any);

      const ideas = await ideaGenerator.generateIdeas('Nouvelle application', 5);

      expect(ideas.length).toBe(5);
      expect(ideas[0]).toHaveProperty('id');
      expect(ideas[0]).toHaveProperty('title');
      expect(ideas[0]).toHaveProperty('description');
      expect(ideas[0]).toHaveProperty('score');
      expect(ideas[0]).toHaveProperty('feasibility');
      expect(ideas[0]).toHaveProperty('impact');
    });

    it('devrait filtrer les idées par score', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Idée 1\nIdée 2\nIdée 3',
            },
          },
        ],
      } as any);

      const ideas = await ideaGenerator.generateIdeas('Sujet', 3);
      const filtered = await ideaGenerator.filterIdeas(ideas, 0.3);

      expect(filtered.length).toBeLessThanOrEqual(ideas.length);
    });

    it('devrait classer les idées par score combiné', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Idée 1\nIdée 2\nIdée 3',
            },
          },
        ],
      } as any);

      const ideas = await ideaGenerator.generateIdeas('Sujet', 3);
      const ranked = await ideaGenerator.rankIdeas(ideas);

      expect(ranked.length).toBe(ideas.length);
      // Vérifier que les idées sont classées
      for (let i = 0; i < ranked.length - 1; i++) {
        const scoreA = (ranked[i].score + ranked[i].feasibility / 10 + ranked[i].impact / 10) / 3;
        const scoreB = (ranked[i + 1].score + ranked[i + 1].feasibility / 10 + ranked[i + 1].impact / 10) / 3;
        expect(scoreA).toBeGreaterThanOrEqual(scoreB);
      }
    });

    it('devrait générer des IDs uniques pour les idées', async () => {
      const mockLLM = vi.spyOn(llmModule, 'invokeLLM').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Idée 1\nIdée 2\nIdée 3',
            },
          },
        ],
      } as any);

      const ideas = await ideaGenerator.generateIdeas('Sujet', 3);
      const ids = ideas.map(i => i.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
