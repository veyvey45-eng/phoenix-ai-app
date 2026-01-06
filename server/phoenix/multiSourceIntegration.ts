/**
 * Multi-Source Integration Module
 * Combine plusieurs APIs pour fournir des réponses enrichies
 */

import { serperApi } from './serperApi';
import { openweatherApi } from './openweatherApi';
import { 
  getCryptoPrice,
  generateTechnicalAnalysis,
  TechnicalIndicators 
} from './cryptoExpert';

// Types pour les résultats multi-sources
interface MultiSourceResult {
  type: 'crypto' | 'weather' | 'news' | 'search' | 'combined';
  data: any;
  sources: string[];
  timestamp: Date;
  confidence: number;
}

interface CryptoNewsResult {
  news: Array<{
    title: string;
    snippet: string;
    link: string;
    date?: string;
  }>;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  keyTopics: string[];
}

interface EnrichedCryptoAnalysis {
  price: any;
  technicalAnalysis: any;
  news: CryptoNewsResult;
  weather?: any; // Pour les corrélations météo/marché (fun fact)
  summary: string;
}

class MultiSourceIntegrationService {
  
  /**
   * Détecte le type de requête et les sources nécessaires
   */
  detectQueryType(query: string): {
    types: ('crypto' | 'weather' | 'news' | 'search' | 'code' | 'general')[];
    entities: string[];
    intent: string;
  } {
    const lowerQuery = query.toLowerCase();
    const types: ('crypto' | 'weather' | 'news' | 'search' | 'code' | 'general')[] = [];
    const entities: string[] = [];
    let intent = 'information';

    // Détection crypto
    const cryptoPatterns = [
      /bitcoin|btc|ethereum|eth|solana|sol|cardano|ada|xrp|ripple|dogecoin|doge/i,
      /crypto|blockchain|defi|nft|token|altcoin|stablecoin/i,
      /trading|investir|acheter|vendre|hodl|bull|bear/i,
      /prix|cours|market cap|volume|rsi|macd|bollinger/i
    ];
    
    if (cryptoPatterns.some(p => p.test(query))) {
      types.push('crypto');
      // Extraire les cryptos mentionnées
      const cryptoMatch = query.match(/bitcoin|btc|ethereum|eth|solana|sol|cardano|ada|xrp|dogecoin|doge|bnb|avax|matic|polygon|link|chainlink|uni|uniswap|aave|dot|polkadot/gi);
      if (cryptoMatch) {
        entities.push(...Array.from(new Set(cryptoMatch.map(c => c.toLowerCase()))));
      }
      intent = 'analysis';
    }

    // Détection météo
    const weatherPatterns = [
      /météo|meteo|temps|température|pluie|soleil|neige|vent|orage/i,
      /weather|forecast|rain|sunny|cloudy|storm/i,
      /quel temps|fait-il|prévisions/i
    ];
    
    if (weatherPatterns.some(p => p.test(query))) {
      types.push('weather');
      // Extraire les villes
      const cityMatch = query.match(/(?:à|a|de|pour|in|at)\s+([A-Z][a-zéèêëàâäùûüôöîïç]+(?:\s+[A-Z][a-zéèêëàâäùûüôöîïç]+)?)/);
      if (cityMatch) {
        entities.push(cityMatch[1]);
      }
    }

    // Détection news/actualités
    const newsPatterns = [
      /actualités|actualites|news|nouvelles|dernières|dernieres/i,
      /qu'est-ce qui se passe|quoi de neuf|breaking/i,
      /aujourd'hui|cette semaine|récent|recent/i
    ];
    
    if (newsPatterns.some(p => p.test(query))) {
      types.push('news');
      intent = 'news';
    }

    // Détection code
    const codePatterns = [
      /code|script|programme|fonction|algorithme/i,
      /python|javascript|typescript|java|c\+\+|rust/i,
      /exécute|execute|run|compile|debug/i,
      /calcul|calculer|compute|fibonacci|factorial/i
    ];
    
    if (codePatterns.some(p => p.test(query))) {
      types.push('code');
      intent = 'execution';
    }

    // Détection recherche générale
    const searchPatterns = [
      /recherche|cherche|trouve|search|find/i,
      /qu'est-ce que|c'est quoi|définition|explain/i,
      /comment|pourquoi|quand|où|who|what|when|where|why|how/i
    ];
    
    if (searchPatterns.some(p => p.test(query)) || types.length === 0) {
      types.push('search');
    }

    if (types.length === 0) {
      types.push('general');
    }

    return { types, entities, intent };
  }

  /**
   * Recherche de news crypto via Serper
   */
  async getCryptoNews(crypto: string = 'bitcoin', limit: number = 5): Promise<CryptoNewsResult> {
    try {
      const newsResults = await serperApi.searchNews(`${crypto} cryptocurrency news`, { num: limit });
      
      // Analyser le sentiment basé sur les titres
      let bullishCount = 0;
      let bearishCount = 0;
      const keyTopics: string[] = [];

      const bullishKeywords = ['surge', 'rally', 'bullish', 'gain', 'rise', 'up', 'high', 'record', 'hausse', 'monte', 'augmente', 'positif'];
      const bearishKeywords = ['crash', 'drop', 'bearish', 'fall', 'down', 'low', 'plunge', 'baisse', 'chute', 'perd', 'négatif'];

      for (const news of newsResults) {
        const titleLower = (news.title + ' ' + news.snippet).toLowerCase();
        
        if (bullishKeywords.some(k => titleLower.includes(k))) {
          bullishCount++;
        }
        if (bearishKeywords.some(k => titleLower.includes(k))) {
          bearishCount++;
        }

        // Extraire les topics clés
        const topicMatch = titleLower.match(/etf|sec|regulation|adoption|halving|mining|defi|nft|whale|institutional/gi);
        if (topicMatch) {
          keyTopics.push(...Array.from(topicMatch));
        }
      }

      let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (bullishCount > bearishCount + 1) sentiment = 'bullish';
      else if (bearishCount > bullishCount + 1) sentiment = 'bearish';

      return {
        news: newsResults.map(n => ({
          title: n.title,
          snippet: n.snippet,
          link: n.link,
          date: n.date
        })),
        sentiment,
        keyTopics: Array.from(new Set(keyTopics))
      };
    } catch (error) {
      console.error('[MultiSource] Error fetching crypto news:', error);
      return {
        news: [],
        sentiment: 'neutral',
        keyTopics: []
      };
    }
  }

  /**
   * Analyse crypto enrichie avec news et indicateurs
   */
  async getEnrichedCryptoAnalysis(cryptoId: string): Promise<EnrichedCryptoAnalysis> {
    try {
      // Récupérer les données en parallèle
      const [priceData, technicalData, newsData] = await Promise.all([
        getCryptoPrice(cryptoId).catch(() => null),
        generateTechnicalAnalysis(cryptoId).catch(() => null),
        this.getCryptoNews(cryptoId, 5).catch(() => ({ news: [], sentiment: 'neutral' as const, keyTopics: [] }))
      ]);

      // Générer un résumé
      let summary = `📊 **Analyse ${cryptoId.toUpperCase()}** (${new Date().toLocaleDateString('fr-FR')})\n\n`;

      if (priceData) {
        summary += `💰 **Prix**: $${priceData.current_price?.toLocaleString() || 'N/A'}\n`;
        summary += `📈 **24h**: ${priceData.price_change_percentage_24h?.toFixed(2) || 'N/A'}%\n`;
        summary += `📊 **Market Cap**: $${(priceData.market_cap / 1e9)?.toFixed(2) || 'N/A'}B\n\n`;
      }

      if (technicalData) {
        summary += `🔬 **Indicateurs Techniques**:\n`;
        const rsiValue = typeof technicalData.rsi === 'number' ? technicalData.rsi : 0;
        summary += `- RSI: ${rsiValue.toFixed(1) || 'N/A'} (${rsiValue > 70 ? 'Suracheté' : rsiValue < 30 ? 'Survendu' : 'Neutre'})\n`;
        if (technicalData.macd) {
          const macdSignal = typeof technicalData.macd?.signal === 'number' ? technicalData.macd.signal : 0;
          summary += `- MACD: ${macdSignal > 0 ? '🟢 Bullish' : '🔴 Bearish'}\n`;
        }
        summary += `\n`;
      }

      if (newsData.news.length > 0) {
        summary += `📰 **Sentiment News**: ${newsData.sentiment === 'bullish' ? '🟢 Bullish' : newsData.sentiment === 'bearish' ? '🔴 Bearish' : '⚪ Neutre'}\n`;
        if (newsData.keyTopics.length > 0) {
          summary += `🏷️ **Topics**: ${newsData.keyTopics.slice(0, 5).join(', ')}\n`;
        }
        summary += `\n📰 **Dernières News**:\n`;
        for (const news of newsData.news.slice(0, 3)) {
          summary += `- ${news.title}\n`;
        }
      }

      return {
        price: priceData,
        technicalAnalysis: technicalData,
        news: newsData,
        summary
      };
    } catch (error) {
      console.error('[MultiSource] Error in enriched crypto analysis:', error);
      return {
        price: null,
        technicalAnalysis: null,
        news: { news: [], sentiment: 'neutral', keyTopics: [] },
        summary: 'Erreur lors de la récupération des données.'
      };
    }
  }

  /**
   * Recherche web enrichie avec résumé
   */
  async getEnrichedSearch(query: string): Promise<{
    results: any[];
    summary: string;
    answerBox?: { answer: string; source: string };
  }> {
    try {
      const [results, answerBox] = await Promise.all([
        serperApi.search(query, { num: 8 }),
        serperApi.getAnswerBox(query)
      ]);

      let summary = '';
      
      if (answerBox) {
        summary = `📌 **Réponse rapide**: ${answerBox.answer}\n(Source: ${answerBox.source})\n\n`;
      }

      if (results.length > 0) {
        summary += `🔍 **Résultats de recherche pour "${query}"**:\n\n`;
        for (const result of results.slice(0, 5)) {
          summary += `**${result.title}**\n`;
          summary += `${result.snippet}\n`;
          summary += `🔗 ${result.link}\n\n`;
        }
      }

      return { results, summary, answerBox: answerBox || undefined };
    } catch (error) {
      console.error('[MultiSource] Error in enriched search:', error);
      return { results: [], summary: 'Erreur lors de la recherche.' };
    }
  }

  /**
   * Obtenir la météo enrichie
   */
  async getEnrichedWeather(city: string): Promise<{
    current: any;
    summary: string;
  }> {
    try {
      const weather = await openweatherApi.getCurrentWeather(city);
      
      if (!weather) {
        return { current: null, summary: `Impossible de récupérer la météo pour ${city}.` };
      }

      const summary = `🌤️ **Météo à ${weather.location}, ${weather.country}**\n\n` +
        `🌡️ **Température**: ${weather.temperature}°C (ressenti ${weather.feelsLike}°C)\n` +
        `☁️ **Conditions**: ${weather.description}\n` +
        `💧 **Humidité**: ${weather.humidity}%\n` +
        `💨 **Vent**: ${weather.windSpeed} m/s\n` +
        (weather.visibility ? `👁️ **Visibilité**: ${(weather.visibility / 1000).toFixed(1)} km` : '');

      return { current: weather, summary };
    } catch (error) {
      console.error('[MultiSource] Error in enriched weather:', error);
      return { current: null, summary: 'Erreur lors de la récupération de la météo.' };
    }
  }

  /**
   * Génère un contexte enrichi pour le LLM
   */
  async generateEnrichedContext(query: string): Promise<{
    context: string;
    sources: string[];
    dataType: string;
  }> {
    const { types, entities, intent } = this.detectQueryType(query);
    let context = '';
    const sources: string[] = [];
    
    // Ajouter la date actuelle
    context += `📅 Date actuelle: ${new Date().toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n\n`;

    // Traiter selon les types détectés
    for (const type of types) {
      switch (type) {
        case 'crypto':
          const cryptoId = entities[0] || 'bitcoin';
          const cryptoAnalysis = await this.getEnrichedCryptoAnalysis(this.normalizeCryptoId(cryptoId));
          context += cryptoAnalysis.summary + '\n\n';
          sources.push('CoinGecko API', 'Serper News API');
          break;

        case 'weather':
          const city = entities[0] || 'Paris';
          const weatherData = await this.getEnrichedWeather(city);
          context += weatherData.summary + '\n\n';
          sources.push('OpenWeather API');
          break;

        case 'news':
          const topic = entities[0] || query.replace(/actualités|news|nouvelles/gi, '').trim() || 'technology';
          const newsSearch = await serperApi.searchNews(topic, { num: 5 });
          if (newsSearch.length > 0) {
            context += `📰 **Actualités "${topic}"**:\n\n`;
            for (const news of newsSearch.slice(0, 5)) {
              context += `- **${news.title}**\n  ${news.snippet}\n\n`;
            }
          }
          sources.push('Serper News API');
          break;

        case 'search':
          const searchResult = await this.getEnrichedSearch(query);
          context += searchResult.summary;
          sources.push('Serper Search API');
          break;
      }
    }

    return {
      context: context || 'Aucune donnée externe disponible pour cette requête.',
      sources: Array.from(new Set(sources)),
      dataType: types.join(', ')
    };
  }

  /**
   * Normalise l'ID crypto (btc -> bitcoin, eth -> ethereum, etc.)
   */
  private normalizeCryptoId(id: string): string {
    const mapping: Record<string, string> = {
      'btc': 'bitcoin',
      'eth': 'ethereum',
      'sol': 'solana',
      'ada': 'cardano',
      'doge': 'dogecoin',
      'xrp': 'ripple',
      'bnb': 'binancecoin',
      'avax': 'avalanche-2',
      'matic': 'matic-network',
      'polygon': 'matic-network',
      'dot': 'polkadot',
      'link': 'chainlink',
      'uni': 'uniswap',
      'aave': 'aave',
      'ltc': 'litecoin'
    };
    return mapping[id.toLowerCase()] || id.toLowerCase();
  }
}

export const multiSourceIntegration = new MultiSourceIntegrationService();
