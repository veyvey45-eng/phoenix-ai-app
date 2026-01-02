/**
 * NewsAPI Module - Actualités en temps réel
 * Nécessite une clé API gratuite de newsapi.org
 */

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  image: string;
  publishedAt: Date;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface NewsResponse {
  query: string;
  articles: NewsArticle[];
  totalResults: number;
  source: string;
  timestamp: Date;
}

const CACHE: Map<string, { data: NewsResponse; time: number }> = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

class NewsApiService {
  private apiKey = process.env.NEWSAPI_KEY || '';
  private baseUrl = 'https://newsapi.org/v2';

  async getNews(query: string, language: string = 'fr', country: string = 'fr'): Promise<NewsResponse> {
    const cacheKey = `${query}-${language}`;
    const cached = CACHE.get(cacheKey);
    
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return cached.data;
    }

    try {
      if (!this.apiKey) {
        return this.generateFallbackNews(query);
      }

      const url = `${this.baseUrl}/everything?q=${encodeURIComponent(query)}&language=${language}&sortBy=publishedAt&pageSize=10&apiKey=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      const articles: NewsArticle[] = (data.articles || []).map((article: any) => ({
        title: article.title,
        description: article.description || '',
        url: article.url,
        source: article.source.name,
        image: article.urlToImage || '',
        publishedAt: new Date(article.publishedAt),
        sentiment: this.analyzeSentiment(article.title + ' ' + (article.description || ''))
      }));

      const result: NewsResponse = {
        query,
        articles: articles.slice(0, 5),
        totalResults: data.totalResults || articles.length,
        source: 'NewsAPI (temps réel)',
        timestamp: new Date()
      };

      CACHE.set(cacheKey, { data: result, time: Date.now() });
      return result;
    } catch (error) {
      console.error('[NewsAPI] Erreur:', error);
      return this.generateFallbackNews(query);
    }
  }

  private generateFallbackNews(query: string): NewsResponse {
    const articles: NewsArticle[] = [
      {
        title: `${query} - Actualités principales`,
        description: `Les dernières actualités concernant ${query}. Découvrez les développements récents et les informations importantes.`,
        url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
        source: 'Google News',
        image: '',
        publishedAt: new Date(),
        sentiment: 'neutral'
      }
    ];

    return {
      query,
      articles,
      totalResults: 1,
      source: 'NewsAPI (fallback)',
      timestamp: new Date()
    };
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['augmente', 'hausse', 'succès', 'gain', 'record', 'meilleur', 'excellent', 'croissance'];
    const negativeWords = ['baisse', 'perte', 'chute', 'problème', 'crise', 'danger', 'pire', 'déclin'];
    
    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  formatForContext(response: NewsResponse): string {
    let context = `\n## ACTUALITÉS RÉCENTES POUR "${response.query.toUpperCase()}"\n\n`;
    
    for (const article of response.articles) {
      const emoji = article.sentiment === 'positive' ? '📈' : article.sentiment === 'negative' ? '📉' : '📰';
      context += `${emoji} **${article.title}**\n`;
      context += `   Source: ${article.source} | ${article.publishedAt.toLocaleDateString('fr-FR')}\n`;
      context += `   ${article.description}\n\n`;
    }

    context += `Source: ${response.source}\nIMPORTANT: Utilise ces actualités pour répondre à la question.\n`;
    return context;
  }
}

export const newsApi = new NewsApiService();
export type { NewsArticle, NewsResponse };
