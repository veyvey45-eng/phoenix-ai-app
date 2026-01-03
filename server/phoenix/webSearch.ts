/**
 * Module 17: Web Search Integration - REAL SERPER API
 * 
 * Responsabilité: Fournir l'accès à Internet en temps réel
 * - Recherche web via Serper API (RÉELLE)
 * - Mise en cache des résultats
 * - Rate limiting
 * - Logging unifié
 */

import { serperApi } from './serperApi';
import { createHash } from 'crypto';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  timestamp: number;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  processingTime: number;
  cached: boolean;
  signature: string;
}

interface CacheEntry {
  data: SearchResponse;
  timestamp: number;
  ttl: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class WebSearchIntegration {
  private cache: Map<string, CacheEntry> = new Map();
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly RATE_LIMIT_MAX = 60; // 60 requests per minute

  /**
   * Effectuer une recherche web RÉELLE via Serper API
   */
  async search(query: string, options: {
    maxResults?: number;
    language?: string;
    region?: string;
    userId?: string;
  } = {}): Promise<SearchResponse> {
    const startTime = Date.now();
    const userId = options.userId || 'anonymous';
    const maxResults = options.maxResults || 10;
    const language = options.language || 'fr';
    const region = options.region || 'FR';

    // Vérifier le rate limit
    this.checkRateLimit(userId);

    // Vérifier le cache
    const cacheKey = this.generateCacheKey(query, language, region);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        cached: true,
        processingTime: Date.now() - startTime
      };
    }

    // Effectuer la recherche RÉELLE via Serper API
    const results = await this.performSearch(query, maxResults, language, region);

    // Générer la signature
    const signature = this.generateSignature(results);

    // Créer la réponse
    const response: SearchResponse = {
      query,
      results,
      totalResults: results.length,
      processingTime: Date.now() - startTime,
      cached: false,
      signature
    };

    // Mettre en cache
    this.saveToCache(cacheKey, response);

    // Incrémenter le rate limit
    this.incrementRateLimit(userId);

    return response;
  }

  /**
   * Effectuer la recherche RÉELLE via Serper API
   */
  private async performSearch(
    query: string,
    maxResults: number,
    language: string,
    region: string
  ): Promise<SearchResult[]> {
    try {
      console.log(`[WebSearch] Recherche RÉELLE via Serper API: "${query}"`);
      
      // Utiliser Serper API pour la recherche réelle
      const serperResults = await serperApi.search(query, { 
        gl: region.toLowerCase(),
        hl: language.toLowerCase(),
        num: maxResults 
      });

      // Convertir les résultats Serper au format SearchResult
      const results: SearchResult[] = [];
      
      if (serperResults && serperResults.length > 0) {
        for (const item of serperResults.slice(0, maxResults)) {
          results.push({
            title: item.title || '',
            url: item.link || '',
            snippet: item.snippet || '',
            source: new URL(item.link || '').hostname || 'Unknown',
            timestamp: Date.now()
          });
        }
      }

      console.log(`[WebSearch] ${results.length} résultats trouvés via Serper API`);
      return results;
    } catch (error) {
      console.error('[WebSearch] Erreur lors de la recherche Serper:', error);
      // Retourner un résultat d'erreur mais ne pas échouer
      return [{
        title: `Erreur lors de la recherche: ${query}`,
        url: '',
        snippet: 'La recherche a échoué. Veuillez réessayer.',
        source: 'Error',
        timestamp: Date.now()
      }];
    }
  }

  /**
   * Générer une clé de cache
   */
  private generateCacheKey(query: string, language: string, region: string): string {
    return `${query}:${language}:${region}`;
  }

  /**
   * Récupérer du cache
   */
  private getFromCache(key: string): SearchResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Vérifier l'expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Sauvegarder en cache
   */
  private saveToCache(key: string, data: SearchResponse): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
  }

  /**
   * Vérifier le rate limit
   */
  private checkRateLimit(userId: string): void {
    const entry = this.rateLimits.get(userId);
    
    if (!entry) {
      this.rateLimits.set(userId, {
        count: 1,
        resetTime: Date.now() + this.RATE_LIMIT_WINDOW
      });
      return;
    }

    // Réinitialiser si la fenêtre a expiré
    if (Date.now() > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = Date.now() + this.RATE_LIMIT_WINDOW;
      return;
    }

    // Vérifier le dépassement
    if (entry.count >= this.RATE_LIMIT_MAX) {
      throw new Error(`Rate limit exceeded for user ${userId}`);
    }
  }

  /**
   * Incrémenter le rate limit
   */
  private incrementRateLimit(userId: string): void {
    const entry = this.rateLimits.get(userId);
    if (entry) {
      entry.count++;
    }
  }

  /**
   * Générer une signature
   */
  private generateSignature(results: SearchResult[]): string {
    const data = results.map(r => r.url).join('|');
    const hash = createHash('sha256').update(data).digest('hex');
    return hash; // Retourner le hash complet (64 caractères pour SHA-256)
  }

  /**
   * Obtenir les statistiques du cache
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      rateLimitEntries: this.rateLimits.size,
      cacheEntries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl
      }))
    };
  }

  /**
   * Nettoyer le cache expiré
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Nettoyer les rate limits expirés
   */
  cleanExpiredRateLimits(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.rateLimits.forEach((entry, key) => {
      if (now > entry.resetTime) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      this.rateLimits.delete(key);
    }
  }
}

export const webSearchIntegration = new WebSearchIntegration();
export type { SearchResult, SearchResponse };
