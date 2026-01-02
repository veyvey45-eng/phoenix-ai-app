/**
 * Context Enricher - Module d'enrichissement de contexte avec accès Internet
 */

import { webSearchIntegration, SearchResponse } from './webSearch';
import { weatherApi } from './weatherApi';
import { cryptoApi } from './cryptoApi';
import { newsApiFree } from './newsApiFree';

interface EnrichmentResult {
  needsInternet: boolean;
  category: 'weather' | 'news' | 'facts' | 'search' | 'crypto' | 'none';
  searchResults?: SearchResponse;
  enrichedContext: string;
}

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
  /r[ée]cent/i,
  /cette\s+semaine/i
];

const CRYPTO_PATTERNS = [
  /bitcoin|ethereum|btc|eth|crypto|bnb|xrp|ada|sol|dogecoin|doge|litecoin|ltc|chainlink|link|uniswap|uni|polygon|matic|avalanche|avax/i,
  /prix.*crypto/i,
  /price.*crypto/i,
  /cours.*bitcoin/i
];

const FACTS_PATTERNS = [
  /comment/i,
  /pourquoi/i,
  /qu'est-ce/i,
  /d[ée]finition/i,
  /explication/i
];

const SEARCH_PATTERNS = [
  /cherche|recherche|trouve|google/i,
  /qui|quel|o[ù]|quand/i
];

class ContextEnricher {
  private analyzeQuery(query: string): { needsInternet: boolean; category: 'weather' | 'news' | 'facts' | 'search' | 'crypto' | 'none'; } {
    if (WEATHER_PATTERNS.some(p => p.test(query))) return { needsInternet: true, category: 'weather' };
    if (CRYPTO_PATTERNS.some(p => p.test(query))) return { needsInternet: true, category: 'crypto' };
    if (NEWS_PATTERNS.some(p => p.test(query))) return { needsInternet: true, category: 'news' };
    if (FACTS_PATTERNS.some(p => p.test(query))) return { needsInternet: true, category: 'facts' };
    if (SEARCH_PATTERNS.some(p => p.test(query))) return { needsInternet: true, category: 'search' };
    return { needsInternet: false, category: 'none' };
  }

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
      if (analysis.category === 'crypto') {
        const symbols = this.extractCryptoSymbols(query);
        console.log(`[ContextEnricher] Requête crypto: ${symbols.join(', ')}`);
        
        try {
          const prices = await cryptoApi.getPrices(symbols, 'usd');
          const enrichedContext = prices.map(p => cryptoApi.formatForContext(p)).join('\n');
          
          return {
            needsInternet: true,
            category: 'crypto',
            enrichedContext
          };
        } catch (error) {
          console.error('[ContextEnricher] Erreur crypto:', error);
          return {
            needsInternet: true,
            category: 'crypto',
            enrichedContext: '[Note: Données crypto indisponibles]'
          };
        }
      }

      if (analysis.category === 'weather') {
        const city = this.extractCityFromQuery(query);
        console.log(`[ContextEnricher] Requête météo: ${city}`);
        
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

      if (analysis.category === 'news') {
        const newsResponse = await newsApiFree.getNews(query, 'fr', 'fr');
        return {
          needsInternet: true,
          category: 'news',
          enrichedContext: newsApiFree.formatForContext(newsResponse)
        };
      }

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
      console.error('[ContextEnricher] Erreur:', error);
      return {
        needsInternet: true,
        category: analysis.category,
        enrichedContext: `[Note: Recherche indisponible pour "${query}"]`
      };
    }
  }

  private extractCryptoSymbols(query: string): string[] {
    const symbols: Record<string, string> = {
      'bitcoin': 'btc', 'ethereum': 'eth', 'bnb': 'bnb', 'xrp': 'xrp', 'ada': 'ada',
      'solana': 'sol', 'dogecoin': 'doge', 'doge': 'doge', 'litecoin': 'ltc', 'ltc': 'ltc',
      'chainlink': 'link', 'link': 'link', 'uniswap': 'uni', 'uni': 'uni',
      'polygon': 'matic', 'matic': 'matic', 'avalanche': 'avax', 'avax': 'avax'
    };

    const found: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [key, symbol] of Object.entries(symbols)) {
      if (lowerQuery.includes(key)) found.push(symbol);
    }

    return found.length > 0 ? found : ['btc', 'eth'];
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

    const knownCities = ['luxembourg', 'paris', 'bruxelles', 'berlin', 'london', 'lyon', 'marseille'];
    for (const city of knownCities) {
      if (query.toLowerCase().includes(city)) return city.charAt(0).toUpperCase() + city.slice(1);
    }

    return 'Luxembourg';
  }

  private buildEnrichedContext(category: string, searchResults: SearchResponse, query: string): string {
    let context = `\n## RÉSULTATS DE RECHERCHE POUR "${query}"\n\n`;
    
    for (const result of searchResults.results) {
      context += `📌 **${result.title}**\n`;
      context += `   Source: ${result.source}\n`;
      context += `   ${result.snippet}\n`;
      context += `   URL: ${result.url}\n\n`;
    }

    context += `IMPORTANT: Utilise ces résultats pour répondre à la question.\n`;
    return context;
  }
}

export const contextEnricher = new ContextEnricher();
export type { EnrichmentResult };
