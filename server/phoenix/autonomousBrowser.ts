/**
 * AUTONOMOUS BROWSER MODULE - Browsing Autonome avec Puppeteer RÉEL
 * 
 * Navigation web réelle avec Chrome headless
 * Fallback vers fetch + JSDOM si Puppeteer échoue
 * Intégration complète avec le chat streaming
 */

import puppeteer, { Browser, Page } from 'puppeteer';
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
  method: 'puppeteer' | 'fetch';
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
  private browser: Browser | null = null;
  private sessions: Map<string, BrowserSession> = new Map();
  private complexityThreshold = 0.5;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialise le navigateur Puppeteer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.browser) {
      return;
    }

    // Éviter les initialisations multiples simultanées
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('[AutonomousBrowser] Initialisation de Puppeteer...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--window-size=1920,1080',
        ],
        timeout: 30000,
      });
      this.isInitialized = true;
      console.log('[AutonomousBrowser] Puppeteer initialisé avec succès!');
    } catch (error) {
      console.error('[AutonomousBrowser] Erreur d\'initialisation Puppeteer:', error);
      this.isInitialized = false;
      this.browser = null;
      throw error;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Ferme le navigateur proprement
   */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        console.error('[AutonomousBrowser] Erreur lors de la fermeture:', e);
      }
      this.browser = null;
      this.isInitialized = false;
      console.log('[AutonomousBrowser] Navigateur fermé');
    }
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
   * Navigue vers une URL et extrait le contenu avec Puppeteer
   */
  async navigateAndExtract(url: string, takeScreenshot: boolean = false): Promise<ExtractionResult> {
    try {
      // Essayer avec Puppeteer d'abord
      return await this.extractWithPuppeteer(url, takeScreenshot);
    } catch (error) {
      console.warn('[AutonomousBrowser] Puppeteer a échoué, fallback vers fetch+JSDOM:', error);
      // Fallback vers fetch + JSDOM
      return await this.extractWithFetch(url);
    }
  }

  /**
   * Extraction avec Puppeteer (navigateur réel)
   */
  private async extractWithPuppeteer(url: string, takeScreenshot: boolean = false): Promise<ExtractionResult> {
    await this.initialize();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      // Configuration de la page
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      console.log(`[AutonomousBrowser] Navigation Puppeteer vers: ${url}`);
      
      // Navigation avec timeout
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Attendre que le contenu soit chargé
      await page.waitForSelector('body', { timeout: 10000 });

      // Prendre un screenshot si demandé
      let screenshot: string | undefined;
      if (takeScreenshot) {
        const screenshotBuffer = await page.screenshot({ 
          encoding: 'base64',
          fullPage: false 
        });
        screenshot = `data:image/png;base64,${screenshotBuffer}`;
      }

      // Extraire les données
      const result = await page.evaluate(() => {
        const title = document.title || '';
        const currentUrl = window.location.href;
        
        // Extraire le contenu textuel principal
        const mainContent = document.body.innerText.substring(0, 10000);
        
        // Extraire les liens
        const links = Array.from(document.querySelectorAll('a[href]'))
          .slice(0, 50)
          .map(a => ({
            text: (a as HTMLAnchorElement).innerText.trim().substring(0, 100),
            href: (a as HTMLAnchorElement).href
          }))
          .filter(l => l.text && l.href.startsWith('http'));

        // Extraire les images
        const images = Array.from(document.querySelectorAll('img[src]'))
          .slice(0, 20)
          .map(img => (img as HTMLImageElement).src)
          .filter(src => src.startsWith('http'));

        // Extraire les métadonnées
        const metadata: Record<string, string> = {};
        document.querySelectorAll('meta').forEach(meta => {
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');
          if (name && content) {
            metadata[name] = content.substring(0, 200);
          }
        });

        return { title, url: currentUrl, content: mainContent, links, images, metadata };
      });

      console.log(`[AutonomousBrowser] Extraction Puppeteer réussie: ${result.title}`);
      
      return { ...result, screenshot };
    } finally {
      await page.close();
    }
  }

  /**
   * Extraction avec fetch + JSDOM (fallback)
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
  async takeScreenshot(url: string): Promise<string> {
    await this.initialize();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const screenshot = await page.screenshot({ 
        encoding: 'base64',
        fullPage: false 
      });
      
      return `data:image/png;base64,${screenshot}`;
    } finally {
      await page.close();
    }
  }

  /**
   * Recherche du texte spécifique sur une page
   */
  async searchOnPage(url: string, searchText: string): Promise<string[]> {
    const extraction = await this.navigateAndExtract(url);
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
    takeScreenshot: boolean = false
  ): Promise<{
    sessionId: string;
    content: string;
    extraction: ExtractionResult | null;
    screenshot?: string;
    success: boolean;
    error?: string;
    method: 'puppeteer' | 'fetch';
  }> {
    const sessionId = `session-${Date.now()}`;
    const startTime = Date.now();
    let method: 'puppeteer' | 'fetch' = 'puppeteer';

    console.log(`[AutonomousBrowser] Démarrage session: ${sessionId}`);
    console.log(`  URL: ${url}`);
    console.log(`  Objectif: ${extractionGoal}`);

    try {
      // Extraire le contenu
      let extraction: ExtractionResult;
      try {
        extraction = await this.extractWithPuppeteer(url, takeScreenshot);
        method = 'puppeteer';
      } catch (puppeteerError) {
        console.warn('[AutonomousBrowser] Puppeteer échoué, utilisation du fallback fetch');
        extraction = await this.extractWithFetch(url);
        method = 'fetch';
      }
      
      // Construire le résumé du contenu
      let content = `## Résultats de l'extraction depuis ${url}\n\n`;
      content += `**Titre:** ${extraction.title}\n\n`;
      content += `**Objectif:** ${extractionGoal}\n\n`;
      content += `**Méthode:** ${method === 'puppeteer' ? 'Puppeteer (Chrome headless)' : 'Fetch + JSDOM'}\n\n`;
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
        screenshot: extraction.screenshot,
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
        screenshot: extraction.screenshot,
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
   * Intègre le browsing autonome dans le chat
   */
  async executeWithAutonomousBrowsing(
    query: string,
    apiResults?: unknown
  ): Promise<{
    browsed: boolean;
    content?: string;
    sessionId?: string;
    extraction?: ExtractionResult;
    method?: 'puppeteer' | 'fetch';
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
    const result = await this.executeBrowsingSession(urlMatch[0], query);

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
    isInitialized: boolean;
    method: string;
    averageDuration: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const completedSessions = sessions.filter(s => s.endTime);
    const totalDuration = completedSessions.reduce(
      (sum, s) => sum + ((s.endTime || 0) - s.startTime), 
      0
    );

    return {
      totalSessions: sessions.length,
      isInitialized: this.isInitialized,
      method: this.isInitialized ? 'Puppeteer (Chrome headless)' : 'fetch + JSDOM',
      averageDuration: completedSessions.length > 0 
        ? totalDuration / completedSessions.length 
        : 0
    };
  }
}

// Export singleton
export const autonomousBrowser = new AutonomousBrowserModule();
