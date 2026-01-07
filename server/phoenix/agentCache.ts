/**
 * Système de caching pour Phoenix Agent
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hitCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class AgentCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats = { hits: 0, misses: 0 };
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_ENTRIES = 1000;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    entry.hitCount++;
    this.stats.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = this.DEFAULT_TTL_MS): void {
    if (this.cache.size >= this.MAX_ENTRIES) {
      this.evictOldest();
    }
    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + ttlMs,
      createdAt: now,
      hitCount: 0
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  async getOrCompute<T>(key: string, compute: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const value = await compute();
    this.set(key, value, ttlMs);
    return value;
  }
}

class SearchResultCache extends AgentCache {
  private readonly SEARCH_TTL_MS = 10 * 60 * 1000;

  generateKey(query: string): string {
    return `search:${query.toLowerCase().trim()}`;
  }

  cacheSearchResult(query: string, results: any): void {
    this.set(this.generateKey(query), results, this.SEARCH_TTL_MS);
  }

  getSearchResult(query: string): any | null {
    return this.get(this.generateKey(query));
  }
}

class LLMResponseCache extends AgentCache {
  private readonly LLM_TTL_MS = 30 * 60 * 1000;

  generateKey(prompt: string, model?: string): string {
    const hash = this.simpleHash(prompt);
    return `llm:${model || 'default'}:${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  cacheLLMResponse(prompt: string, response: any, model?: string): void {
    this.set(this.generateKey(prompt, model), response, this.LLM_TTL_MS);
  }

  getLLMResponse(prompt: string, model?: string): any | null {
    return this.get(this.generateKey(prompt, model));
  }
}

class BrowseResultCache extends AgentCache {
  private readonly BROWSE_TTL_MS = 15 * 60 * 1000;

  generateKey(url: string): string {
    return `browse:${url}`;
  }

  cacheBrowseResult(url: string, content: any): void {
    this.set(this.generateKey(url), content, this.BROWSE_TTL_MS);
  }

  getBrowseResult(url: string): any | null {
    return this.get(this.generateKey(url));
  }
}

export const agentCache = new AgentCache();
export const searchCache = new SearchResultCache();
export const llmCache = new LLMResponseCache();
export const browseCache = new BrowseResultCache();

export function getAllCacheStats(): Record<string, CacheStats> {
  return {
    agent: agentCache.getStats(),
    search: searchCache.getStats(),
    llm: llmCache.getStats(),
    browse: browseCache.getStats()
  };
}

export function clearAllCaches(): void {
  agentCache.clear();
  searchCache.clear();
  llmCache.clear();
  browseCache.clear();
}
