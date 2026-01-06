/**
 * AUTONOMOUS BROWSER MODULE - Browsing Autonome Unifié
 * 
 * Hiérarchie des méthodes:
 * 1. Browserless.io (production-ready, vrai Chrome dans le cloud)
 * 2. E2B + fetch (fallback si pas de token Browserless)
 * 3. fetch + JSDOM local (fallback universel)
 */

import { browserless, BrowserlessResult } from './browserless';
import { e2bBrowser } from './e2bBrowser';
import { JSDOM } from 'jsdom';

export interface BrowserAction {
  type: 'navigate' | 'click' | 'extract' | 'fill' | 'screenshot' | 'scroll' | 'wait' | 'getText' | 'getLinks';
  target?: string;
  value?: string;
  selector?: string;
  timeout?: number;
}

export interface BrowserSession {
  id: string;
  url: string;
  title?: string;
  content?: string;
  screenshot?: string;
  links?: string[];
  actions: BrowserAction[];
  startTime: number;
  endTime?: number;
  method: 'browserless-chrome' | 'e2b-playwright' | 'e2b-fetch' | 'fetch-jsdom';
}

export interface ExtractionResult {
  title: string;
  url: string;
  content: string;
  links: { text: string; href: string }[];
  images: string[];
  metadata: Record<string, string>;
  screenshot?: string;
}

export class AutonomousBrowserModule {
  private sessions: Map<string, BrowserSession> = new Map();
  private complexityThreshold = 0.5;
  private useBrowserless: boolean;
  private useE2B: boolean;

  constructor() {
    // Vérifier les configurations disponibles
    this.useBrowserless = browserless.isConfigured();
    this.useE2B = !!process.env.E2B_API_KEY;
    
    console.log(`[AutonomousBrowser] Configuration:`);
    console.log(`  - Browserless.io: ${this.useBrowserless ? '✅ Activé' : '❌ Non configuré'}`);
    console.log(`  - E2B Sandbox: ${this.useE2B ? '✅ Disponible' : '❌ Non configuré'}`);
    console.log(`  - Fallback JSDOM: ✅ Toujours disponible`);
  }

  /**
   * Analyse si le browsing autonome est nécessaire
   */
  async analyzeNeedForBrowsing(
    query: string,
    apiResults?: unknown
  ): Promise<{
    needed: boolean;
    score: number;
    reason: string;
  }> {
    const complexPatterns = [
      { pattern: /javascript|dynamique|interactif|formulaire|pagination|infinite scroll/i, weight: 0.9 },
      { pattern: /screenshot|capture|visual|layout|design|css|style/i, weight: 0.85 },
      { pattern: /real-time|live|streaming|websocket/i, weight: 0.85 },
      { pattern: /login|authentification|session|cookie/i, weight: 0.7 },
      { pattern: /table|données complexes|extraction|scraping/i, weight: 0.75 },
      { pattern: /navigue|va sur|ouvre|visite|accède/i, weight: 0.9 },
      { pattern: /extrais|récupère|trouve sur|cherche sur/i, weight: 0.8 },
      { pattern: /site web|page web|url|lien/i, weight: 0.7 },
    ];

    let score = 0;
    let matchedReason = '';

    for (const { pattern, weight } of complexPatterns) {
      if (pattern.test(query)) {
        score = Math.max(score, weight);
        matchedReason = pattern.source;
      }
    }

    // Si les résultats API sont insuffisants
    if (!apiResults || (Array.isArray(apiResults) && apiResults.length === 0)) {
      score = Math.max(score, 0.6);
      matchedReason = matchedReason || 'Résultats API insuffisants';
    }

    // Si la requête contient une URL
    const urlMatch = query.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      score = Math.max(score, 0.85);
      matchedReason = 'URL détectée dans la requête';
    }

    const needed = score >= this.complexityThreshold;

    return {
      needed,
      score,
      reason: matchedReason || 'Complexité insuffisante'
    };
  }

  /**
   * Navigue vers une URL et extrait le contenu
   * Utilise Browserless en priorité, puis E2B, puis JSDOM local
   */
  async navigateAndExtract(
    url: string, 
    userId: string = 'default',
    takeScreenshot: boolean = false
  ): Promise<ExtractionResult> {
    // Méthode 1: Browserless.io (vrai Chrome dans le cloud)
    if (this.useBrowserless) {
      try {
        console.log('[AutonomousBrowser] Utilisation de Browserless.io');
        const result = await browserless.getContent(url);
        
        if (result.success) {
          let screenshot: string | undefined;
          if (takeScreenshot) {
            const screenshotResult = await browserless.screenshot(url);
            screenshot = screenshotResult.screenshot;
          }
          
          return {
            title: result.title || '',
            url: result.url,
            content: result.content || '',
            links: result.links || [],
            images: result.images || [],
            metadata: result.metadata || {},
            screenshot
          };
        }
        console.warn('[AutonomousBrowser] Browserless a échoué:', result.error);
      } catch (error) {
        console.warn('[AutonomousBrowser] Erreur Browserless:', error);
      }
    }

    // Méthode 2: E2B Sandbox avec fetch
    if (this.useE2B) {
      try {
        console.log('[AutonomousBrowser] Utilisation de E2B Sandbox');
        const result = await e2bBrowser.browseWithFetch(`browser-${userId}`, url);
        
        if (result.success) {
          return {
            title: result.title || '',
            url: result.url,
            content: result.content || '',
            links: result.links || [],
            images: result.images || [],
            metadata: result.metadata || {}
          };
        }
      } catch (error) {
        console.warn('[AutonomousBrowser] E2B a échoué:', error);
      }
    }

    // Méthode 3: Fallback fetch + JSDOM (universel)
    console.log('[AutonomousBrowser] Fallback vers fetch + JSDOM');
    return await this.extractWithFetch(url);
  }

  /**
   * Extraction avec fetch + JSDOM (fallback universel)
   */
  private async extractWithFetch(url: string): Promise<ExtractionResult> {
    console.log(`[AutonomousBrowser] Extraction via fetch + JSDOM: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;

      // Extraire le titre
      const title = document.title || '';

      // Supprimer les scripts et styles
      document.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      
      // Essayer de trouver le contenu principal
      const mainContent = 
        document.querySelector('main')?.textContent ||
        document.querySelector('article')?.textContent ||
        document.querySelector('[role="main"]')?.textContent ||
        document.querySelector('.content')?.textContent ||
        document.querySelector('#content')?.textContent ||
        document.body?.textContent || '';
      
      const content = mainContent
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 10000);

      // Extraire les liens
      const links = Array.from(document.querySelectorAll('a[href]'))
        .slice(0, 50)
        .map(a => {
          const anchor = a as HTMLAnchorElement;
          let href = anchor.getAttribute('href') || '';
          if (href && !href.startsWith('http')) {
            try {
              href = new URL(href, url).href;
            } catch {
              href = '';
            }
          }
          return {
            text: anchor.textContent?.trim().substring(0, 100) || '',
            href
          };
        })
        .filter(l => l.text && l.href.startsWith('http'));

      // Extraire les images
      const images = Array.from(document.querySelectorAll('img[src]'))
        .slice(0, 20)
        .map(img => {
          let src = (img as HTMLImageElement).getAttribute('src') || '';
          if (src && !src.startsWith('http')) {
            try {
              src = new URL(src, url).href;
            } catch {
              src = '';
            }
          }
          return src;
        })
        .filter(src => src.startsWith('http'));

      // Extraire les métadonnées
      const metadata: Record<string, string> = {};
      document.querySelectorAll('meta').forEach(meta => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        const metaContent = meta.getAttribute('content');
        if (name && metaContent) {
          metadata[name] = metaContent.substring(0, 200);
        }
      });

      console.log(`[AutonomousBrowser] Extraction fetch réussie: ${title}`);

      return { 
        title, 
        url: response.url || url, 
        content, 
        links, 
        images, 
        metadata 
      };
    } catch (error) {
      console.error('[AutonomousBrowser] Erreur fetch:', error);
      throw error;
    }
  }

  /**
   * Prend un screenshot d'une page
   */
  async takeScreenshot(url: string, userId: string = 'default'): Promise<string | null> {
    if (this.useBrowserless) {
      const result = await browserless.screenshot(url);
      return result.screenshot || null;
    }
    return null; // Pas de screenshot sans Browserless
  }

  /**
   * Recherche du texte spécifique sur une page
   */
  async searchOnPage(url: string, searchText: string, userId: string = 'default'): Promise<string[]> {
    const extraction = await this.navigateAndExtract(url, userId, false);
    
    const regex = new RegExp(searchText, 'gi');
    const paragraphs = extraction.content.split(/[.!?]\s+/);
    
    return paragraphs
      .filter(p => regex.test(p))
      .slice(0, 10)
      .map(p => p.trim().substring(0, 500));
  }

  /**
   * Exécute une session de browsing complète
   */
  async executeBrowsingSession(
    url: string,
    extractionGoal: string,
    userId: string = 'default',
    takeScreenshot: boolean = false
  ): Promise<{
    sessionId: string;
    content: string;
    extraction: ExtractionResult | null;
    screenshot?: string;
    success: boolean;
    error?: string;
    method: 'browserless-chrome' | 'e2b-playwright' | 'e2b-fetch' | 'fetch-jsdom';
  }> {
    const sessionId = `session-${Date.now()}`;
    const startTime = Date.now();
    let method: 'browserless-chrome' | 'e2b-playwright' | 'e2b-fetch' | 'fetch-jsdom' = 'fetch-jsdom';

    console.log(`[AutonomousBrowser] Démarrage session: ${sessionId}`);
    console.log(`  URL: ${url}`);
    console.log(`  Objectif: ${extractionGoal}`);

    try {
      let extraction: ExtractionResult;
      let screenshot: string | undefined;

      // Utiliser Browserless si disponible
      if (this.useBrowserless) {
        const browserlessResult = await browserless.executeBrowsingSession(url, extractionGoal, takeScreenshot);
        
        if (browserlessResult.success) {
          method = 'browserless-chrome';
          extraction = {
            title: browserlessResult.result.title || '',
            url: browserlessResult.result.url,
            content: browserlessResult.result.content || '',
            links: browserlessResult.result.links || [],
            images: browserlessResult.result.images || [],
            metadata: browserlessResult.result.metadata || {},
            screenshot: browserlessResult.result.screenshot
          };
          screenshot = browserlessResult.result.screenshot;
        } else {
          // Fallback vers fetch local
          extraction = await this.extractWithFetch(url);
          method = 'fetch-jsdom';
        }
      } else if (this.useE2B) {
        // Utiliser E2B
        const e2bResult = await e2bBrowser.executeBrowsingSession(userId, url, extractionGoal, takeScreenshot);
        
        if (e2bResult.success) {
          method = e2bResult.result.method === 'e2b-playwright' ? 'e2b-playwright' : 'e2b-fetch';
          extraction = {
            title: e2bResult.result.title || '',
            url: e2bResult.result.url,
            content: e2bResult.result.content || '',
            links: e2bResult.result.links || [],
            images: e2bResult.result.images || [],
            metadata: e2bResult.result.metadata || {},
            screenshot: e2bResult.result.screenshot
          };
          screenshot = e2bResult.result.screenshot;
        } else {
          extraction = await this.extractWithFetch(url);
          method = 'fetch-jsdom';
        }
      } else {
        // Pas de service cloud, utiliser fetch local
        extraction = await this.extractWithFetch(url);
        method = 'fetch-jsdom';
      }
      
      // Construire le résumé du contenu
      let content = `## Résultats de l'extraction depuis ${url}\n\n`;
      content += `**Titre:** ${extraction.title}\n\n`;
      content += `**Objectif:** ${extractionGoal}\n\n`;
      content += `**Méthode:** ${this.getMethodDescription(method)}\n\n`;
      content += `### Contenu principal:\n${extraction.content.substring(0, 3000)}...\n\n`;
      
      if (extraction.links.length > 0) {
        content += `### Liens trouvés (${extraction.links.length}):\n`;
        extraction.links.slice(0, 10).forEach(link => {
          content += `- [${link.text}](${link.href})\n`;
        });
        content += '\n';
      }
      
      if (Object.keys(extraction.metadata).length > 0) {
        content += `### Métadonnées:\n`;
        Object.entries(extraction.metadata).slice(0, 5).forEach(([key, value]) => {
          content += `- **${key}:** ${value}\n`;
        });
      }

      // Sauvegarder la session
      const session: BrowserSession = {
        id: sessionId,
        url,
        title: extraction.title,
        content,
        screenshot,
        links: extraction.links.map(l => l.href),
        actions: [{ type: 'navigate', value: url }, { type: 'extract', value: extractionGoal }],
        startTime,
        endTime: Date.now(),
        method
      };
      this.sessions.set(sessionId, session);

      console.log(`[AutonomousBrowser] Session complétée: ${sessionId} (${Date.now() - startTime}ms) via ${method}`);

      return {
        sessionId,
        content,
        extraction,
        screenshot,
        success: true,
        method
      };
    } catch (error) {
      console.error('[AutonomousBrowser] Erreur:', error);
      return {
        sessionId,
        content: `Erreur lors de l'extraction: ${String(error)}`,
        extraction: null,
        success: false,
        error: String(error),
        method
      };
    }
  }

  /**
   * Description lisible de la méthode utilisée
   */
  private getMethodDescription(method: string): string {
    switch (method) {
      case 'browserless-chrome':
        return 'Browserless.io (Chrome headless cloud - comme Manus)';
      case 'e2b-playwright':
        return 'E2B Sandbox + Playwright (Chrome headless)';
      case 'e2b-fetch':
        return 'E2B Sandbox + Fetch (HTML statique)';
      case 'fetch-jsdom':
        return 'Fetch + JSDOM (fallback local)';
      default:
        return method;
    }
  }

  /**
   * Intègre le browsing autonome dans le chat
   */
  async executeWithAutonomousBrowsing(
    query: string,
    userId: string = 'default',
    apiResults?: unknown
  ): Promise<{
    browsed: boolean;
    content?: string;
    sessionId?: string;
    extraction?: ExtractionResult;
    method?: string;
  }> {
    // Analyser si le browsing est nécessaire
    const analysis = await this.analyzeNeedForBrowsing(query, apiResults);

    if (!analysis.needed) {
      return { browsed: false };
    }

    // Extraire l'URL de la requête
    const urlMatch = query.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) {
      // Pas d'URL explicite, on ne peut pas naviguer
      return { browsed: false };
    }

    // Exécuter la session de browsing
    const result = await this.executeBrowsingSession(urlMatch[0], query, userId);

    return {
      browsed: result.success,
      content: result.content,
      sessionId: result.sessionId,
      extraction: result.extraction || undefined,
      method: result.method
    };
  }

  /**
   * Récupère l'historique des sessions
   */
  getBrowsingHistory(limit: number = 10): BrowserSession[] {
    const sessions = Array.from(this.sessions.values());
    return sessions.sort((a, b) => b.startTime - a.startTime).slice(0, limit);
  }

  /**
   * Récupère une session spécifique
   */
  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Nettoie les anciennes sessions
   */
  cleanupOldSessions(maxAge: number = 3600000): number {
    const now = Date.now();
    let deletedCount = 0;

    this.sessions.forEach((session, sessionId) => {
      if (now - session.startTime > maxAge) {
        this.sessions.delete(sessionId);
        deletedCount++;
      }
    });

    return deletedCount;
  }

  /**
   * Récupère les statistiques
   */
  getStatistics(): {
    totalSessions: number;
    useBrowserless: boolean;
    useE2B: boolean;
    primaryMethod: string;
    averageDuration: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const completedSessions = sessions.filter(s => s.endTime);
    const totalDuration = completedSessions.reduce(
      (sum, s) => sum + ((s.endTime || 0) - s.startTime), 
      0
    );

    let primaryMethod = 'fetch-jsdom';
    if (this.useBrowserless) {
      primaryMethod = 'browserless-chrome';
    } else if (this.useE2B) {
      primaryMethod = 'e2b-fetch';
    }

    return {
      totalSessions: sessions.length,
      useBrowserless: this.useBrowserless,
      useE2B: this.useE2B,
      primaryMethod,
      averageDuration: completedSessions.length > 0 
        ? totalDuration / completedSessions.length 
        : 0
    };
  }

  /**
   * Ferme les ressources (compatibilité)
   */
  async close(): Promise<void> {
    console.log('[AutonomousBrowser] Fermeture des ressources');
    this.sessions.clear();
  }
}

// Export singleton
export const autonomousBrowser = new AutonomousBrowserModule();
