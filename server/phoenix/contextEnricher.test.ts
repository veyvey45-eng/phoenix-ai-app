/**
 * Tests pour le module Context Enricher
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contextEnricher } from './contextEnricher';

describe('ContextEnricher', () => {
  describe('analyzeQuery', () => {
    describe('Weather detection', () => {
      it('should detect weather queries with "météo"', () => {
        const result = contextEnricher.analyzeQuery('Quelle est la météo demain?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('weather');
      });

      it('should detect weather queries with "temps"', () => {
        const result = contextEnricher.analyzeQuery('Quel temps fait-il à Paris?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('weather');
      });

      it('should detect weather queries with "température"', () => {
        const result = contextEnricher.analyzeQuery('Quelle est la température actuelle?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('weather');
      });

      it('should detect weather queries with "prévision"', () => {
        const result = contextEnricher.analyzeQuery('Donne-moi les prévisions pour la semaine');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('weather');
      });

      it('should detect weather queries with "pluie"', () => {
        const result = contextEnricher.analyzeQuery('Est-ce qu\'il va pleuvoir demain?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('weather');
      });

      it('should detect weather queries with "soleil"', () => {
        const result = contextEnricher.analyzeQuery('Y aura-t-il du soleil ce weekend?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('weather');
      });
    });

    describe('News detection', () => {
      it('should detect news queries with "actualités"', () => {
        const result = contextEnricher.analyzeQuery('Quelles sont les actualités du jour?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('news');
      });

      it('should detect news queries with "nouvelles"', () => {
        const result = contextEnricher.analyzeQuery('Donne-moi les dernières nouvelles');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('news');
      });

      it('should detect news queries with "news"', () => {
        const result = contextEnricher.analyzeQuery('What are the latest news?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('news');
      });
    });

    describe('Realtime data detection', () => {
      it('should detect realtime queries with "en ce moment"', () => {
        const result = contextEnricher.analyzeQuery('Que se passe-t-il en ce moment?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('facts');
      });

      it('should detect realtime queries with "actuellement"', () => {
        const result = contextEnricher.analyzeQuery('Quel est le cours actuellement?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('facts');
      });

      it('should detect realtime queries with "prix actuel"', () => {
        const result = contextEnricher.analyzeQuery('Quel est le prix actuel du Bitcoin?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('facts');
      });
    });

    describe('Search detection', () => {
      it('should detect search queries with "recherche"', () => {
        const result = contextEnricher.analyzeQuery('Fais une recherche sur l\'IA');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('search');
      });

      it('should detect search queries with "qu\'est-ce que"', () => {
        const result = contextEnricher.analyzeQuery('Qu\'est-ce que la blockchain?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('search');
      });

      it('should detect search queries with "comment faire"', () => {
        const result = contextEnricher.analyzeQuery('Comment faire un gâteau?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('search');
      });

      it('should detect search queries with "qui est"', () => {
        const result = contextEnricher.analyzeQuery('Qui est Elon Musk?');
        expect(result.needsInternet).toBe(true);
        expect(result.category).toBe('search');
      });
    });

    describe('Non-internet queries', () => {
      it('should not detect internet need for simple greetings', () => {
        const result = contextEnricher.analyzeQuery('Bonjour, comment vas-tu?');
        expect(result.needsInternet).toBe(false);
        expect(result.category).toBe('none');
      });

      it('should not detect internet need for math questions', () => {
        const result = contextEnricher.analyzeQuery('Combien font 25 multiplié par 4?');
        expect(result.needsInternet).toBe(false);
        expect(result.category).toBe('none');
      });

      it('should not detect internet need for general conversation', () => {
        const result = contextEnricher.analyzeQuery('Raconte-moi une blague');
        expect(result.needsInternet).toBe(false);
        expect(result.category).toBe('none');
      });

      it('should not detect internet need for opinions', () => {
        const result = contextEnricher.analyzeQuery('Que penses-tu de la philosophie?');
        expect(result.needsInternet).toBe(false);
        expect(result.category).toBe('none');
      });
    });
  });

  describe('getWeatherData', () => {
    it('should return weather data for a location', async () => {
      const result = await contextEnricher.getWeatherData('Paris');
      
      expect(result).toHaveProperty('location', 'Paris');
      expect(result).toHaveProperty('temperature');
      expect(result).toHaveProperty('condition');
      expect(result).toHaveProperty('humidity');
      expect(result).toHaveProperty('wind');
      expect(result).toHaveProperty('forecast');
      
      expect(typeof result.temperature).toBe('number');
      expect(result.temperature).toBeGreaterThanOrEqual(5);
      expect(result.temperature).toBeLessThanOrEqual(25);
    });

    it('should return weather data for Luxembourg', async () => {
      const result = await contextEnricher.getWeatherData('Luxembourg');
      
      expect(result.location).toBe('Luxembourg');
      expect(result.forecast).toContain('Luxembourg');
    });
  });

  describe('enrichContext', () => {
    it('should return empty context for non-internet queries', async () => {
      const result = await contextEnricher.enrichContext('Bonjour', 'user123');
      
      expect(result.needsInternet).toBe(false);
      expect(result.category).toBe('none');
      expect(result.enrichedContext).toBe('');
    });

    it('should attempt to enrich context for weather queries', async () => {
      const result = await contextEnricher.enrichContext('Quelle est la météo à Paris?', 'user123');
      
      expect(result.needsInternet).toBe(true);
      expect(result.category).toBe('weather');
      // Le contexte enrichi peut être vide si la recherche échoue, mais la catégorie doit être correcte
    });

    it('should attempt to enrich context for news queries', async () => {
      const result = await contextEnricher.enrichContext('Quelles sont les actualités?', 'user123');
      
      expect(result.needsInternet).toBe(true);
      expect(result.category).toBe('news');
    });

    it('should handle search queries', async () => {
      const result = await contextEnricher.enrichContext('Qu\'est-ce que l\'intelligence artificielle?', 'user123');
      
      expect(result.needsInternet).toBe(true);
      expect(result.category).toBe('search');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty queries', () => {
      const result = contextEnricher.analyzeQuery('');
      expect(result.needsInternet).toBe(false);
      expect(result.category).toBe('none');
    });

    it('should handle queries with special characters', () => {
      const result = contextEnricher.analyzeQuery('Météo à Paris!!! ???');
      expect(result.needsInternet).toBe(true);
      expect(result.category).toBe('weather');
    });

    it('should be case insensitive', () => {
      const result1 = contextEnricher.analyzeQuery('MÉTÉO');
      const result2 = contextEnricher.analyzeQuery('météo');
      const result3 = contextEnricher.analyzeQuery('MéTéO');
      
      expect(result1.category).toBe('weather');
      expect(result2.category).toBe('weather');
      expect(result3.category).toBe('weather');
    });
  });
});
