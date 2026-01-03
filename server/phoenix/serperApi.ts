/**
 * Serper API Module - Recherche web réelle via Serper
 * Fournit des résultats de recherche Google en temps réel
 */

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
  date?: string;
  source?: string;
}

interface SearchResponse {
  searchParameters: {
    q: string;
    type: string;
    engine: string;
  };
  answerBox?: {
    type: string;
    answer: string;
    title?: string;
    source?: string;
  };
  knowledgeGraph?: {
    title: string;
    type: string;
    description: string;
    attributes?: Record<string, string>;
    imageUrl?: string;
    website?: string;
  };
  organic: SearchResult[];
  news?: SearchResult[];
  relatedSearches?: Array<{ query: string }>;
}

class SerperApiService {
  private apiKey: string;
  private baseUrl = 'https://google.serper.dev';

  constructor() {
    this.apiKey = process.env.SERPER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Serper] API key not found. Web search will not be available.');
    }
  }

  /**
   * Check if Serper API is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search the web
   */
  async search(query: string, options?: { num?: number; gl?: string; hl?: string }): Promise<SearchResult[]> {
    try {
      if (!this.apiKey) {
        throw new Error('Serper API key not configured');
      }

      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          num: options?.num || 10,
          gl: options?.gl || 'fr',
          hl: options?.hl || 'fr'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[Serper] API error:', response.status, error);
        throw new Error(`Serper API error: ${response.status}`);
      }

      const data: SearchResponse = await response.json();

      // Combine organic results and news results
      const results: SearchResult[] = [];

      if (data.organic) {
        results.push(...data.organic.map((r, idx) => ({
          ...r,
          position: idx + 1
        })));
      }

      if (data.news) {
        results.push(...data.news.map((r, idx) => ({
          ...r,
          position: (data.organic?.length || 0) + idx + 1,
          source: 'news'
        })));
      }

      return results;
    } catch (error) {
      console.error('[Serper] Error searching:', error);
      throw error;
    }
  }

  /**
   * Search for news
   */
  async searchNews(query: string, options?: { num?: number; gl?: string }): Promise<SearchResult[]> {
    try {
      if (!this.apiKey) {
        throw new Error('Serper API key not configured');
      }

      const response = await fetch(`${this.baseUrl}/news`, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          num: options?.num || 10,
          gl: options?.gl || 'fr'
        })
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`);
      }

      const data: SearchResponse = await response.json();
      return data.news || [];
    } catch (error) {
      console.error('[Serper] Error searching news:', error);
      throw error;
    }
  }

  /**
   * Search for images
   */
  async searchImages(query: string, options?: { num?: number }): Promise<SearchResult[]> {
    try {
      if (!this.apiKey) {
        throw new Error('Serper API key not configured');
      }

      const response = await fetch(`${this.baseUrl}/images`, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          num: options?.num || 10
        })
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`);
      }

      const data = await response.json();
      return data.images || [];
    } catch (error) {
      console.error('[Serper] Error searching images:', error);
      throw error;
    }
  }

  /**
   * Get answer box (quick answer)
   */
  async getAnswerBox(query: string): Promise<{ answer: string; source: string } | null> {
    try {
      if (!this.apiKey) {
        return null;
      }

      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          num: 1
        })
      });

      if (!response.ok) {
        return null;
      }

      const data: SearchResponse = await response.json();

      if (data.answerBox) {
        return {
          answer: data.answerBox.answer || data.answerBox.title || '',
          source: data.answerBox.source || 'Google'
        };
      }

      return null;
    } catch (error) {
      console.error('[Serper] Error getting answer box:', error);
      return null;
    }
  }

  /**
   * Format search results for context
   */
  formatSearchResults(results: SearchResult[], maxResults: number = 5): string {
    const limited = results.slice(0, maxResults);
    const lines = ['Résultats de recherche:'];

    for (const result of limited) {
      lines.push(`\n📌 ${result.title}`);
      lines.push(`   ${result.snippet}`);
      lines.push(`   🔗 ${result.link}`);
    }

    return lines.join('\n');
  }
}

export const serperApi = new SerperApiService();
