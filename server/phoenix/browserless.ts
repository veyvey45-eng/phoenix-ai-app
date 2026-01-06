/**
 * BROWSERLESS MODULE - Vrai navigateur Chrome dans le cloud
 * 
 * Utilise Browserless.io pour exécuter un vrai navigateur Chrome
 * Exactement comme ce que Manus utilise - un Puppeteer/Playwright hébergé
 * 
 * Fonctionne en développement ET en production
 */

export interface BrowserlessResult {
  success: boolean;
  url: string;
  title?: string;
  content?: string;
  html?: string;
  links?: { text: string; href: string }[];
  images?: string[];
  metadata?: Record<string, string>;
  screenshot?: string;
  error?: string;
  duration: number;
  method: 'browserless-chrome';
}

export interface BrowserlessConfig {
  apiToken: string;
  baseUrl?: string;
  timeout?: number;
}

export class BrowserlessModule {
  private apiToken: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config?: Partial<BrowserlessConfig>) {
    this.apiToken = config?.apiToken || process.env.BROWSERLESS_API_KEY || '';
    this.baseUrl = config?.baseUrl || 'https://production-sfo.browserless.io';
    this.timeout = config?.timeout || 30000;
    
    if (this.apiToken) {
      console.log('[Browserless] Initialisé avec API token');
    } else {
      console.warn('[Browserless] Pas de token API configuré');
    }
  }

  /**
   * Vérifie si Browserless est configuré
   */
  isConfigured(): boolean {
    return !!this.apiToken;
  }

  /**
   * Récupère le contenu HTML rendu (avec JavaScript exécuté)
   */
  async getContent(url: string): Promise<BrowserlessResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        url,
        error: 'Browserless API token non configuré',
        duration: Date.now() - startTime,
        method: 'browserless-chrome'
      };
    }

    try {
      console.log('[Browserless] Récupération du contenu:', url);

      const response = await fetch(`${this.baseUrl}/content?token=${this.apiToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          url,
          gotoOptions: {
            waitUntil: 'networkidle2',
            timeout: this.timeout
          }
        }),
        signal: AbortSignal.timeout(this.timeout + 5000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const html = await response.text();
      const duration = Date.now() - startTime;

      // Parser le HTML pour extraire les informations
      const extracted = this.parseHtml(html, url);

      console.log('[Browserless] Contenu récupéré:', extracted.title);

      return {
        success: true,
        url,
        html,
        title: extracted.title,
        content: extracted.content,
        links: extracted.links,
        images: extracted.images,
        metadata: extracted.metadata,
        duration,
        method: 'browserless-chrome'
      };
    } catch (error) {
      console.error('[Browserless] Erreur:', error);
      return {
        success: false,
        url,
        error: String(error),
        duration: Date.now() - startTime,
        method: 'browserless-chrome'
      };
    }
  }

  /**
   * Scrape des éléments spécifiques d'une page
   */
  async scrape(url: string, selectors: string[]): Promise<BrowserlessResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        url,
        error: 'Browserless API token non configuré',
        duration: Date.now() - startTime,
        method: 'browserless-chrome'
      };
    }

    try {
      console.log('[Browserless] Scraping:', url);

      const elements = selectors.map(selector => ({ selector }));

      const response = await fetch(`${this.baseUrl}/scrape?token=${this.apiToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          url,
          elements,
          gotoOptions: {
            waitUntil: 'networkidle2',
            timeout: this.timeout
          }
        }),
        signal: AbortSignal.timeout(this.timeout + 5000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      // Extraire le contenu des éléments scrapés
      let content = '';
      if (data.data && Array.isArray(data.data)) {
        content = data.data.map((item: any) => {
          if (item.results && Array.isArray(item.results)) {
            return item.results.map((r: any) => r.text || '').join('\n');
          }
          return item.text || item.html || '';
        }).join('\n\n');
      }

      console.log('[Browserless] Scraping réussi');

      return {
        success: true,
        url,
        content,
        duration,
        method: 'browserless-chrome'
      };
    } catch (error) {
      console.error('[Browserless] Erreur scraping:', error);
      return {
        success: false,
        url,
        error: String(error),
        duration: Date.now() - startTime,
        method: 'browserless-chrome'
      };
    }
  }

  /**
   * Prend un screenshot d'une page
   */
  async screenshot(url: string, fullPage: boolean = false): Promise<BrowserlessResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        url,
        error: 'Browserless API token non configuré',
        duration: Date.now() - startTime,
        method: 'browserless-chrome'
      };
    }

    try {
      console.log('[Browserless] Screenshot:', url);

      const response = await fetch(`${this.baseUrl}/screenshot?token=${this.apiToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          url,
          options: {
            fullPage,
            type: 'png'
          },
          gotoOptions: {
            waitUntil: 'networkidle2',
            timeout: this.timeout
          }
        }),
        signal: AbortSignal.timeout(this.timeout + 5000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const duration = Date.now() - startTime;

      console.log('[Browserless] Screenshot réussi');

      return {
        success: true,
        url,
        screenshot: `data:image/png;base64,${base64}`,
        duration,
        method: 'browserless-chrome'
      };
    } catch (error) {
      console.error('[Browserless] Erreur screenshot:', error);
      return {
        success: false,
        url,
        error: String(error),
        duration: Date.now() - startTime,
        method: 'browserless-chrome'
      };
    }
  }

  /**
   * Utilise l'API Unblock pour contourner les protections anti-bot
   */
  async unblock(url: string, useResidentialProxy: boolean = false): Promise<BrowserlessResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        url,
        error: 'Browserless API token non configuré',
        duration: Date.now() - startTime,
        method: 'browserless-chrome'
      };
    }

    try {
      console.log('[Browserless] Unblock:', url);

      const proxyParam = useResidentialProxy ? '&proxy=residential' : '';
      const response = await fetch(`${this.baseUrl}/unblock?token=${this.apiToken}${proxyParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          url,
          content: true,
          screenshot: false
        }),
        signal: AbortSignal.timeout(this.timeout + 10000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      const html = data.content || '';
      const extracted = this.parseHtml(html, url);

      console.log('[Browserless] Unblock réussi:', extracted.title);

      return {
        success: true,
        url,
        html,
        title: extracted.title,
        content: extracted.content,
        links: extracted.links,
        images: extracted.images,
        metadata: extracted.metadata,
        duration,
        method: 'browserless-chrome'
      };
    } catch (error) {
      console.error('[Browserless] Erreur unblock:', error);
      return {
        success: false,
        url,
        error: String(error),
        duration: Date.now() - startTime,
        method: 'browserless-chrome'
      };
    }
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
    result: BrowserlessResult;
    success: boolean;
  }> {
    const sessionId = `browserless-${Date.now()}`;

    console.log('[Browserless] Démarrage session:', sessionId);
    console.log('  URL:', url);
    console.log('  Objectif:', extractionGoal);

    // Récupérer le contenu
    let result = await this.getContent(url);

    // Si échec, essayer avec unblock
    if (!result.success && result.error?.includes('403')) {
      console.log('[Browserless] Tentative avec unblock...');
      result = await this.unblock(url);
    }

    // Prendre un screenshot si demandé
    if (takeScreenshot && result.success) {
      const screenshotResult = await this.screenshot(url);
      if (screenshotResult.success) {
        result.screenshot = screenshotResult.screenshot;
      }
    }

    // Construire le résumé
    let content = `## Résultats de l'extraction depuis ${url}\n\n`;
    content += `**Méthode:** Browserless.io (Chrome headless cloud)\n`;
    content += `**Durée:** ${result.duration}ms\n\n`;

    if (result.success) {
      content += `**Titre:** ${result.title}\n\n`;
      content += `**Objectif:** ${extractionGoal}\n\n`;
      content += `### Contenu principal:\n${result.content?.substring(0, 3000)}...\n\n`;

      if (result.links && result.links.length > 0) {
        content += `### Liens trouvés (${result.links.length}):\n`;
        result.links.slice(0, 10).forEach(link => {
          content += `- [${link.text}](${link.href})\n`;
        });
        content += '\n';
      }

      if (result.metadata && Object.keys(result.metadata).length > 0) {
        content += `### Métadonnées:\n`;
        Object.entries(result.metadata).slice(0, 5).forEach(([key, value]) => {
          content += `- **${key}:** ${value}\n`;
        });
      }
    } else {
      content += `**Erreur:** ${result.error}\n`;
    }

    return {
      sessionId,
      content,
      result,
      success: result.success
    };
  }

  /**
   * Parse le HTML pour extraire les informations
   */
  private parseHtml(html: string, baseUrl: string): {
    title: string;
    content: string;
    links: { text: string; href: string }[];
    images: string[];
    metadata: Record<string, string>;
  } {
    // Extraire le titre
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Supprimer les scripts et styles pour le contenu
    let cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

    // Extraire le texte du body
    const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    let content = bodyMatch ? bodyMatch[1] : cleanHtml;
    
    // Nettoyer le HTML pour obtenir le texte
    content = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000);

    // Extraire les liens
    const links: { text: string; href: string }[] = [];
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null && links.length < 50) {
      let href = linkMatch[1];
      const text = linkMatch[2].trim();
      
      if (text && href) {
        // Convertir les URLs relatives en absolues
        if (!href.startsWith('http')) {
          try {
            href = new URL(href, baseUrl).href;
          } catch {
            continue;
          }
        }
        if (href.startsWith('http')) {
          links.push({ text: text.substring(0, 100), href });
        }
      }
    }

    // Extraire les images
    const images: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null && images.length < 20) {
      let src = imgMatch[1];
      if (!src.startsWith('http')) {
        try {
          src = new URL(src, baseUrl).href;
        } catch {
          continue;
        }
      }
      if (src.startsWith('http')) {
        images.push(src);
      }
    }

    // Extraire les métadonnées
    const metadata: Record<string, string> = {};
    const metaRegex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["']/gi;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      metadata[metaMatch[1]] = metaMatch[2].substring(0, 200);
    }

    return { title, content, links, images, metadata };
  }
}

// Export singleton (sera initialisé avec le token quand disponible)
export const browserless = new BrowserlessModule();

// Export factory pour créer une instance avec un token spécifique
export function createBrowserless(apiToken: string): BrowserlessModule {
  return new BrowserlessModule({ apiToken });
}
