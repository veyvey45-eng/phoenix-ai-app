/**
 * Tests pour le détecteur d'intentions
 */

import { describe, it, expect } from 'vitest';
import { detectIntent, generateSystemPromptForIntent } from './intentDetector';

describe('Intent Detector', () => {
  describe('detectIntent', () => {
    describe('Conversation normale', () => {
      it('devrait détecter une conversation simple', () => {
        const result = detectIntent('Bonjour, comment vas-tu?');
        expect(result.type).toBe('conversation');
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('devrait détecter une question générale', () => {
        const result = detectIntent('Raconte-moi une blague');
        expect(result.type).toBe('conversation');
      });

      it('devrait détecter une discussion amicale', () => {
        const result = detectIntent('Merci beaucoup pour ton aide!');
        expect(result.type).toBe('conversation');
      });
    });

    describe('Demandes de code explicites', () => {
      it('devrait détecter "écris-moi un code"', () => {
        const result = detectIntent('Écris-moi un code pour calculer les nombres premiers');
        expect(result.type).toBe('code_request');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('devrait détecter "crée un script python"', () => {
        const result = detectIntent('Crée un script python pour trier une liste');
        expect(result.type).toBe('code_request');
        expect(result.details.language).toBe('python');
      });

      it('devrait détecter "génère une fonction javascript"', () => {
        const result = detectIntent('Génère une fonction javascript pour valider un email');
        expect(result.type).toBe('code_request');
        expect(result.details.language).toBe('javascript');
      });

      it('devrait détecter "code pour"', () => {
        const result = detectIntent('Code pour faire un serveur web');
        expect(result.type).toBe('code_request');
      });

      it('devrait détecter "programme en typescript"', () => {
        const result = detectIntent('Fais-moi un programme en typescript');
        expect(result.type).toBe('code_request');
        expect(result.details.language).toBe('typescript');
      });
    });

    describe('Génération d\'images', () => {
      it('devrait détecter "génère une image"', () => {
        const result = detectIntent('Génère une image d\'un chat sur la lune');
        expect(result.type).toBe('image_generation');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('devrait détecter "crée une illustration"', () => {
        const result = detectIntent('Crée une illustration de paysage montagneux');
        expect(result.type).toBe('image_generation');
      });

      it('devrait détecter "dessine-moi"', () => {
        const result = detectIntent('Dessine-moi un robot futuriste');
        expect(result.type).toBe('image_generation');
      });

      it('devrait extraire le prompt d\'image', () => {
        const result = detectIntent('Génère une image d\'un coucher de soleil sur la mer');
        expect(result.type).toBe('image_generation');
        expect(result.details.imagePrompt).toBeTruthy();
      });
    });

    describe('Météo', () => {
      it('devrait détecter une demande météo', () => {
        const result = detectIntent('Quel temps fait-il à Paris?');
        expect(result.type).toBe('weather');
      });

      it('devrait détecter "météo"', () => {
        const result = detectIntent('Météo Lyon demain');
        expect(result.type).toBe('weather');
      });

      it('devrait détecter "température"', () => {
        const result = detectIntent('Quelle est la température à Marseille?');
        expect(result.type).toBe('weather');
      });
    });

    describe('Crypto', () => {
      it('devrait détecter une demande crypto', () => {
        const result = detectIntent('Quel est le prix du Bitcoin?');
        expect(result.type).toBe('crypto');
      });

      it('devrait détecter "ethereum"', () => {
        const result = detectIntent('Cours de l\'Ethereum');
        expect(result.type).toBe('crypto');
      });
    });

    describe('Recherche web', () => {
      it('devrait détecter "cherche"', () => {
        const result = detectIntent('Cherche des informations sur les voitures électriques');
        expect(result.type).toBe('web_search');
      });

      it('devrait détecter "qu\'est-ce que"', () => {
        const result = detectIntent('Qu\'est-ce que le machine learning?');
        expect(result.type).toBe('web_search');
      });
    });

    describe('Calculs', () => {
      it('devrait détecter "calcule"', () => {
        const result = detectIntent('Calcule 15% de 250');
        expect(result.type).toBe('calculation');
      });

      it('devrait détecter une expression mathématique', () => {
        const result = detectIntent('Combien fait 125 + 375?');
        expect(result.type).toBe('calculation');
      });
    });

    describe('Analyse de fichier', () => {
      it('devrait détecter une analyse de fichier', () => {
        const result = detectIntent('Analyse ce document', true);
        expect(result.type).toBe('file_analysis');
      });
    });

    describe('Non-détection de code pour questions simples', () => {
      it('ne devrait PAS détecter du code pour "comment ça marche"', () => {
        const result = detectIntent('Comment fonctionne une voiture?');
        expect(result.type).not.toBe('code_request');
      });

      it('ne devrait PAS détecter du code pour une explication', () => {
        const result = detectIntent('Explique-moi la photosynthèse');
        expect(result.type).not.toBe('code_request');
      });

      it('ne devrait PAS détecter du code pour une question de culture', () => {
        const result = detectIntent('Qui a inventé l\'ampoule?');
        expect(result.type).not.toBe('code_request');
      });
    });
  });

  describe('generateSystemPromptForIntent', () => {
    it('devrait générer un prompt pour conversation', () => {
      const intent = detectIntent('Bonjour!');
      const prompt = generateSystemPromptForIntent(intent);
      expect(prompt).toContain('CONVERSATION NORMALE');
      expect(prompt).toContain('naturellement');
    });

    it('devrait générer un prompt pour code', () => {
      const intent = detectIntent('Écris un code python');
      const prompt = generateSystemPromptForIntent(intent);
      expect(prompt).toContain('GÉNÉRATION DE CODE');
    });

    it('devrait générer un prompt pour image', () => {
      const intent = detectIntent('Génère une image de chat');
      const prompt = generateSystemPromptForIntent(intent);
      expect(prompt).toContain('GÉNÉRATION D\'IMAGE');
    });
  });
});
