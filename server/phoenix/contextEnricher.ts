/**
 * Context Enricher - Enrichit le contexte avec des données Internet
 */

import { openweatherApi } from './openweatherApi';
import { cryptoApi } from './cryptoApi';
import { newsApiFree } from './newsApiFree';
import { webSearchIntegration } from './webSearch';

interface EnrichmentResult {
  needsInternet: boolean;
  category: 'weather' | 'news' | 'facts' | 'search' | 'crypto' | 'none';
  enrichedContext: string;
}

interface SearchResponse {
  results: Array<{
    title: string;
    snippet: string;
    url: string;
    source: string;
  }>;
}

const WEATHER_PATTERNS = [
  /meteo|météo/i,
  /temperature|température/i,
  /temps/i,
  /climat/i,
  /celsius|fahrenheit|degre|degree/i,
  /quel.*temps/i,
  /froid|chaud|beau/i,
  /temp.*a|temp.*à/i
];

const CRYPTO_PATTERNS = [
  /bitcoin|btc|ethereum|eth|crypto|blockchain|web3/i,
  /prix.*crypto/i,
  /cours.*bitcoin/i
];

const NEWS_PATTERNS = [
  /actualit|nouvelles|news|dernière|récent/i,
  /qu'est-ce.*passé|qu'est.*arrivé/i
];

const FACTS_PATTERNS = [
  /qui|quoi|comment|pourquoi|définition|c'est quoi/i
];

const SEARCH_PATTERNS = [
  /cherche|recherche|google|internet|web|site/i,
  /trouve.*info|donne.*info/i
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
          
          console.log(`[ContextEnricher] Crypto enrichment successful for: ${symbols.join(', ')}`);
          return {
            needsInternet: true,
            category: 'crypto',
            enrichedContext
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error('[ContextEnricher] Erreur crypto détaillée:', errorMsg);
          // Return empty context so Groq doesn't see the error message
          return {
            needsInternet: true,
            category: 'crypto',
            enrichedContext: ''
          };
        }
      }

      if (analysis.category === 'weather') {
        const city = this.extractCityFromQuery(query);
        console.log(`[ContextEnricher] Requête météo: ${city}`);
        
        const isForecast = /demain|prévision|semaine|jours/i.test(query);
        
        if (isForecast) {
          const forecast = await openweatherApi.getForecast(city, 5);
          return {
            needsInternet: true,
            category: 'weather',
            enrichedContext: openweatherApi.formatForecastForContext(forecast)
          };
        } else {
          const weather = await openweatherApi.getCurrentWeather(city);
          return {
            needsInternet: true,
            category: 'weather',
            enrichedContext: openweatherApi.formatWeatherForContext(weather)
          };
        }
      }

      if (analysis.category === 'news') {
        const newsResponse = await newsApiFree.getNews(query, 'fr', 'fr');
        return {
          needsInternet: true,
          category: 'news',
          enrichedContext: newsResponse.articles
            .slice(0, 3)
            .map(a => `📰 ${a.title}\n${a.description}\n🔗 ${a.url}`)
            .join('\n\n')
        };
      }

      if (analysis.category === 'search') {
        try {
          const searchResponse = await webSearchIntegration.search(query);
          return {
            needsInternet: true,
            category: 'search',
            enrichedContext: this.buildEnrichedContext('search', searchResponse, query)
          };
        } catch (error) {
          console.error('[ContextEnricher] Erreur recherche:', error);
          return {
            needsInternet: true,
            category: 'search',
            enrichedContext: '[Note: Recherche indisponible]'
          };
        }
      }

      return {
        needsInternet: false,
        category: 'none',
        enrichedContext: ''
      };
    } catch (error) {
      console.error('[ContextEnricher] Erreur:', error);
      return {
        needsInternet: false,
        category: 'none',
        enrichedContext: ''
      };
    }
  }

  private extractCryptoSymbols(query: string): string[] {
    const symbols: string[] = [];
    const cryptoMap: Record<string, string> = {
      'bitcoin': 'BTC',
      'btc': 'BTC',
      'ethereum': 'ETH',
      'eth': 'ETH',
      'bnb': 'BNB',
      'xrp': 'XRP',
      'ripple': 'XRP',
      'ada': 'ADA',
      'cardano': 'ADA',
      'sol': 'SOL',
      'solana': 'SOL',
      'dot': 'DOT',
      'polkadot': 'DOT'
    };

    for (const [key, value] of Object.entries(cryptoMap)) {
      if (query.toLowerCase().includes(key)) symbols.push(value);
    }

    return symbols.length > 0 ? symbols : ['BTC'];
  }

  private extractCityFromQuery(query: string): string {
    const knownCities = [
      'luxembourg', 'paris', 'bruxelles', 'berlin', 'london', 'lyon', 'marseille',
      'toulouse', 'nice', 'strasbourg', 'bordeaux', 'lille', 'nantes', 'rennes',
      'rouen', 'dijon', 'grenoble', 'montpellier', 'cannes', 'monaco', 'genève',
      'zurich', 'berne', 'lausanne', 'amsterdam', 'rotterdam', 'anvers', 'gand',
      'liège', 'namur', 'charleroi', 'cologne', 'francfort', 'munich', 'hambourg',
      'vienne', 'prague', 'budapest', 'varsovie', 'cracovie', 'bucarest', 'sofia',
      'belgrade', 'athènes', 'istanbul', 'ankara', 'madrid', 'barcelone', 'valence',
      'séville', 'lisbonne', 'porto', 'rome', 'milan', 'venise', 'florence', 'naples',
      'dublin', 'belfast', 'édimbourg', 'glasgow', 'manchester', 'liverpool',
      'birmingham', 'bristol', 'oxford', 'cambridge', 'york', 'bath'
    ];
    
    for (const city of knownCities) {
      if (query.toLowerCase().includes(city)) {
        return city.charAt(0).toUpperCase() + city.slice(1);
      }
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
