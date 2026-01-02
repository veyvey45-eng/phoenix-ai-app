/**
 * Context Enricher - Module d'enrichissement de contexte avec accès Internet
 * 
 * Ce module détecte les questions nécessitant des données en temps réel
 * et enrichit le contexte avec des informations d'Internet.
 */

import { webSearchIntegration, SearchResponse } from './webSearch';
import { weatherApi } from './weatherApi';

interface EnrichmentResult {
  needsInternet: boolean;
  category: 'weather' | 'news' | 'facts' | 'search' | 'none';
  searchResults?: SearchResponse;
  enrichedContext: string;
}

// Patterns pour détecter les questions nécessitant Internet
const WEATHER_PATTERNS = [
  /m[ée]t[ée]o/i,
  /temps\s+(qu'il\s+fait|actuel|aujourd'hui|demain)/i,
  /quel\s+temps/i,
  /pr[ée]vision/i,
  /temp[ée]rature/i,
  /pleut|pleuvoir|pluie/i,
  /neige|neiger/i,
  /soleil|ensoleill[ée]/i,
  /weather/i
];

const NEWS_PATTERNS = [
  /actualit[ée]s?/i,
  /nouvelles/i,
  /derni[èe]res?\s+infos?/i,
  /news/i,
  /aujourd'hui/i,
  /r[ée]cent/i,
  /cette\s+semaine/i
];

const REALTIME_PATTERNS = [
  /en\s+ce\s+moment/i,
  /actuellement/i,
  /maintenant/i,
  /en\s+temps\s+r[ée]el/i,
  /live/i,
  /cours\s+(de\s+bourse|actuel)/i,
  /prix\s+actuel/i,
  /heure\s+(actuelle|qu'il\s+est)/i
];

const SEARCH_PATTERNS = [
  /recherche/i,
  /trouve/i,
  /cherche/i,
  /qu'est-ce\s+que/i,
  /c'est\s+quoi/i,
  /qui\s+est/i,
  /comment\s+faire/i
];

class ContextEnricher {
  /**
   * Analyse une question et détermine si elle nécessite un accès Internet
   */
  analyzeQuery(query: string): { needsInternet: boolean; category: EnrichmentResult['category'] } {
    const lowerQuery = query.toLowerCase();

    // Vérifier les patterns météo
    if (WEATHER_PATTERNS.some(p => p.test(lowerQuery))) {
      return { needsInternet: true, category: 'weather' };
    }

    // Vérifier les patterns actualités
    if (NEWS_PATTERNS.some(p => p.test(lowerQuery))) {
      return { needsInternet: true, category: 'news' };
    }

    // Vérifier les patterns temps réel
    if (REALTIME_PATTERNS.some(p => p.test(lowerQuery))) {
      return { needsInternet: true, category: 'facts' };
    }

    // Vérifier les patterns de recherche
    if (SEARCH_PATTERNS.some(p => p.test(lowerQuery))) {
      return { needsInternet: true, category: 'search' };
    }

    return { needsInternet: false, category: 'none' };
  }

  /**
   * Enrichit le contexte avec des données d'Internet
   */
  async enrichContext(query: string, userId: string): Promise<EnrichmentResult> {
    const analysis = this.analyzeQuery(query);

    if (!analysis.needsInternet) {
      return {
        needsInternet: false,
        category: 'none',
        enrichedContext: ''
      };
    }

    try {
      // Pour les questions météo, utiliser l'API météo dédiée
      if (analysis.category === 'weather') {
        const city = this.extractCityFromQuery(query);
        console.log(`[ContextEnricher] Requête météo pour: ${city}`);
        
        const isForecast = /demain|prévision|semaine|jours/i.test(query);
        
        if (isForecast) {
          const forecast = await weatherApi.getForecast(city, 5);
          return {
            needsInternet: true,
            category: 'weather',
            enrichedContext: weatherApi.formatForecastForContext(forecast)
          };
        } else {
          const weather = await weatherApi.getCurrentWeather(city);
          return {
            needsInternet: true,
            category: 'weather',
            enrichedContext: weatherApi.formatWeatherForContext(weather)
          };
        }
      }

      // Pour les autres catégories, utiliser la recherche web
      const searchResults = await webSearchIntegration.search(query, {
        userId,
        maxResults: 5,
        language: 'fr',
        region: 'FR'
      });

      const enrichedContext = this.buildEnrichedContext(analysis.category, searchResults, query);

      return {
        needsInternet: true,
        category: analysis.category,
        searchResults,
        enrichedContext
      };
    } catch (error) {
      console.error('[ContextEnricher] Erreur lors de la recherche:', error);
      return {
        needsInternet: true,
        category: analysis.category,
        enrichedContext: `[Note: Recherche web indisponible temporairement pour "${query}"]`
      };
    }
  }

  private extractCityFromQuery(query: string): string {
    const patterns = [
      /météo\s+(?:à|a|au|en|de|du)?\s*([A-Za-zà-ü\s-]+)/i,
      /temps\s+(?:à|a|au|en|de|du)?\s*([A-Za-zà-ü\s-]+)/i,
      /(?:à|a|au|en|de|du)\s+([A-Za-zà-ü\s-]+)\s*\??$/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const city = match[1].trim()
          .replace(/\b(aujourd'hui|demain|cette|semaine|ce|soir|matin)\b/gi, '')
          .trim();
        if (city.length > 1) return city;
      }
    }

    const knownCities = ['luxembourg', 'paris', 'bruxelles', 'berlin', 'london', 'londres', 'lyon', 'marseille'];
    const lowerQuery = query.toLowerCase();
    for (const city of knownCities) {
      if (lowerQuery.includes(city)) return city.charAt(0).toUpperCase() + city.slice(1);
    }

    return 'Luxembourg';
  }

  /**
   * Construit le contexte enrichi basé sur les résultats de recherche
   */
  private buildEnrichedContext(
    category: EnrichmentResult['category'],
    searchResults: SearchResponse,
    query: string
  ): string {
    let context = '';

    switch (category) {
      case 'weather':
        context = `\n## DONNÉES MÉTÉO EN TEMPS RÉEL
Tu as accès à Internet et peux fournir des informations météo.
Recherche effectuée: "${query}"
Résultats de recherche:
${searchResults.results.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}

IMPORTANT: Utilise ces informations pour répondre à la question météo de l'utilisateur.
Si les résultats ne contiennent pas de données météo précises, indique que tu peux fournir des informations générales mais recommande de consulter un service météo dédié pour des prévisions exactes.
`;
        break;

      case 'news':
        context = `\n## ACTUALITÉS EN TEMPS RÉEL
Tu as accès à Internet et peux fournir des actualités récentes.
Recherche effectuée: "${query}"
Résultats de recherche:
${searchResults.results.map(r => `- ${r.title}: ${r.snippet} (Source: ${r.source})`).join('\n')}

IMPORTANT: Utilise ces informations pour répondre à la question sur les actualités.
`;
        break;

      case 'facts':
        context = `\n## DONNÉES EN TEMPS RÉEL
Tu as accès à Internet pour des informations actualisées.
Recherche effectuée: "${query}"
Résultats de recherche:
${searchResults.results.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}

IMPORTANT: Utilise ces informations pour fournir une réponse actualisée.
`;
        break;

      case 'search':
        context = `\n## RÉSULTATS DE RECHERCHE WEB
Tu as accès à Internet et peux effectuer des recherches.
Recherche effectuée: "${query}"
Résultats:
${searchResults.results.map(r => `- ${r.title}: ${r.snippet} (${r.url})`).join('\n')}

IMPORTANT: Utilise ces informations pour répondre à la question de l'utilisateur.
`;
        break;

      default:
        context = '';
    }

    return context;
  }

  /**
   * Génère une réponse météo simulée (en attendant une vraie API météo)
   */
  async getWeatherData(location: string): Promise<{
    location: string;
    temperature: number;
    condition: string;
    humidity: number;
    wind: number;
    forecast: string;
  }> {
    // Simulation de données météo
    // En production, utiliser OpenWeatherMap ou une autre API
    const conditions = ['ensoleillé', 'nuageux', 'partiellement nuageux', 'pluvieux', 'orageux'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    const randomTemp = Math.floor(Math.random() * 20) + 5; // 5-25°C

    return {
      location,
      temperature: randomTemp,
      condition: randomCondition,
      humidity: Math.floor(Math.random() * 50) + 30,
      wind: Math.floor(Math.random() * 30) + 5,
      forecast: `Prévisions pour ${location}: ${randomCondition} avec des températures autour de ${randomTemp}°C.`
    };
  }
}

// Instance singleton
export const contextEnricher = new ContextEnricher();
