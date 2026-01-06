/**
 * E2B BROWSER MODULE - Browsing Autonome via E2B Sandbox
 * 
 * Utilise E2B Sandbox pour exécuter Playwright dans un environnement isolé
 * Fonctionne en développement ET en production
 */

import { getE2BAdapter } from './e2bAdapter';

export interface E2BBrowsingResult {
  success: boolean;
  url: string;
  title?: string;
  content?: string;
  links?: { text: string; href: string }[];
  images?: string[];
  metadata?: Record<string, string>;
  screenshot?: string;
  error?: string;
  duration: number;
  method: 'e2b-playwright' | 'e2b-fetch';
}

export class E2BBrowserModule {
  private setupCompleted: Map<string, boolean> = new Map();

  /**
   * Prépare le sandbox E2B avec Playwright et TOUTES les dépendances
   */
  async setupBrowserSandbox(sandboxId: string): Promise<boolean> {
    if (this.setupCompleted.get(sandboxId)) {
      console.log('[E2BBrowser] Sandbox déjà configuré:', sandboxId);
      return true;
    }

    try {
      const adapter = getE2BAdapter();
      console.log('[E2BBrowser] Configuration du sandbox pour le browsing:', sandboxId);

      // Script d'installation SANS sudo (E2B n'a pas les permissions root)
      // On utilise Playwright qui télécharge ses propres binaires
      const setupScript = `
#!/bin/bash

echo "=== Configuration du répertoire de travail ==="
mkdir -p /home/user/browser
cd /home/user/browser

echo "=== Installation de Playwright ==="
npm init -y 2>/dev/null || true

# Installer playwright-firefox
npm install playwright-firefox@latest --save 2>/dev/null || npm install playwright-firefox --save 2>/dev/null || true

echo "=== Téléchargement du navigateur Firefox ==="
npx playwright install firefox 2>/dev/null || true

echo "SETUP_COMPLETE"
`;

      const result = await adapter.executeShell(sandboxId, setupScript);
      
      if (result.stdout.includes('SETUP_COMPLETE')) {
        this.setupCompleted.set(sandboxId, true);
        console.log('[E2BBrowser] Sandbox configuré avec succès');
        return true;
      } else {
        console.error('[E2BBrowser] Échec de la configuration:', result.stderr);
        return false;
      }
    } catch (error) {
      console.error('[E2BBrowser] Erreur lors de la configuration:', error);
      return false;
    }
  }

  /**
   * Navigue vers une URL et extrait le contenu via E2B + Playwright
   */
  async browseWithPlaywright(
    sandboxId: string,
    url: string,
    takeScreenshot: boolean = false
  ): Promise<E2BBrowsingResult> {
    const startTime = Date.now();

    try {
      const adapter = getE2BAdapter();
      
      // S'assurer que le sandbox est configuré
      const isSetup = await this.setupBrowserSandbox(sandboxId);
      if (!isSetup) {
        console.warn('[E2BBrowser] Setup échoué, fallback vers fetch');
        return await this.browseWithFetch(sandboxId, url);
      }

      console.log('[E2BBrowser] Navigation Playwright vers:', url);

      // Échapper l'URL pour le script
      const escapedUrl = url.replace(/'/g, "\\'").replace(/`/g, "\\`");
      
      // Script Playwright pour extraire le contenu
      const screenshotCode = takeScreenshot 
        ? `
    const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
    extractedData.screenshot = screenshotBuffer.toString('base64');
`
        : '';
      
      const playwrightScript = `
const { firefox } = require('playwright-firefox');

(async () => {
  let browser;
  try {
    browser = await firefox.launch({
      headless: true,
      args: [
        '--no-sandbox'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    await page.goto('${escapedUrl}', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    const extractedData = await page.evaluate(() => {
      const title = document.title || '';
      const currentUrl = window.location.href;
      const mainContent = document.body.innerText.substring(0, 8000);
      
      const links = Array.from(document.querySelectorAll('a[href]'))
        .slice(0, 30)
        .map(a => ({ text: a.innerText.trim().substring(0, 100), href: a.href }))
        .filter(l => l.text && l.href.startsWith('http'));

      const images = Array.from(document.querySelectorAll('img[src]'))
        .slice(0, 15)
        .map(img => img.src)
        .filter(src => src.startsWith('http'));

      const metadata = {};
      document.querySelectorAll('meta').forEach(meta => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        const content = meta.getAttribute('content');
        if (name && content) metadata[name] = content.substring(0, 200);
      });

      return { title, url: currentUrl, content: mainContent, links, images, metadata };
    });
${screenshotCode}
    console.log(JSON.stringify(extractedData));
  } catch (error) {
    console.log(JSON.stringify({ error: error.message }));
  } finally {
    if (browser) await browser.close();
  }
})();
`;

      // Écrire et exécuter le script
      await adapter.writeFile(sandboxId, '/home/user/browser/browse.js', playwrightScript);
      const result = await adapter.executeShell(sandboxId, 'cd /home/user/browser && node browse.js');

      const duration = Date.now() - startTime;

      if (result.success && result.stdout) {
        try {
          // Trouver le JSON dans la sortie
          const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            
            if (data.error) {
              throw new Error(data.error);
            }

            console.log('[E2BBrowser] Extraction Playwright réussie:', data.title);

            return {
              success: true,
              url: data.url || url,
              title: data.title,
              content: data.content,
              links: data.links,
              images: data.images,
              metadata: data.metadata,
              screenshot: data.screenshot ? `data:image/png;base64,${data.screenshot}` : undefined,
              duration,
              method: 'e2b-playwright'
            };
          }
        } catch (parseError) {
          console.error('[E2BBrowser] Erreur de parsing JSON:', parseError);
        }
      }

      // Si Playwright échoue, fallback vers fetch
      console.warn('[E2BBrowser] Playwright a échoué, fallback vers fetch');
      console.warn('[E2BBrowser] Stderr:', result.stderr);
      return await this.browseWithFetch(sandboxId, url);

    } catch (error) {
      console.error('[E2BBrowser] Erreur Playwright:', error);
      return await this.browseWithFetch(sandboxId, url);
    }
  }

  /**
   * Fallback: Navigation avec fetch (sans JavaScript)
   */
  async browseWithFetch(sandboxId: string, url: string): Promise<E2BBrowsingResult> {
    const startTime = Date.now();

    try {
      const adapter = getE2BAdapter();
      console.log('[E2BBrowser] Navigation fetch vers:', url);

      // Échapper l'URL pour Python
      const escapedUrl = url.replace(/'/g, "\\'");

      // Script Python pour fetch + parsing HTML
      const fetchScript = `
import urllib.request
import json
from html.parser import HTMLParser

class ContentExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ''
        self.content = []
        self.links = []
        self.images = []
        self.metadata = {}
        self.in_title = False
        self.in_script = False
        self.in_style = False
        self.current_link = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'title':
            self.in_title = True
        elif tag in ('script', 'style', 'noscript'):
            self.in_script = True
            self.in_style = True
        elif tag == 'a' and 'href' in attrs_dict:
            href = attrs_dict['href']
            if href.startswith('http'):
                self.current_link = {'href': href, 'text': ''}
        elif tag == 'img' and 'src' in attrs_dict:
            src = attrs_dict['src']
            if src.startswith('http') and len(self.images) < 15:
                self.images.append(src)
        elif tag == 'meta':
            name = attrs_dict.get('name') or attrs_dict.get('property')
            content = attrs_dict.get('content')
            if name and content:
                self.metadata[name] = content[:200]

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        elif tag in ('script', 'style', 'noscript'):
            self.in_script = False
            self.in_style = False
        elif tag == 'a' and self.current_link:
            if self.current_link['text'].strip() and len(self.links) < 30:
                self.links.append(self.current_link)
            self.current_link = None

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        elif self.current_link:
            self.current_link['text'] += data
        elif not self.in_script and not self.in_style:
            text = data.strip()
            if text:
                self.content.append(text)

try:
    req = urllib.request.Request(
        '${escapedUrl}',
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        html = response.read().decode('utf-8', errors='ignore')
        final_url = response.url
    
    parser = ContentExtractor()
    parser.feed(html)
    
    result = {
        'title': parser.title.strip(),
        'url': final_url,
        'content': ' '.join(parser.content)[:8000],
        'links': parser.links,
        'images': parser.images,
        'metadata': parser.metadata
    }
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

      const result = await adapter.executePython(sandboxId, fetchScript);
      const duration = Date.now() - startTime;

      if (result.success && result.stdout) {
        try {
          const data = JSON.parse(result.stdout.trim());
          
          if (data.error) {
            return {
              success: false,
              url,
              error: data.error,
              duration,
              method: 'e2b-fetch'
            };
          }

          console.log('[E2BBrowser] Extraction fetch réussie:', data.title);

          return {
            success: true,
            url: data.url || url,
            title: data.title,
            content: data.content,
            links: data.links,
            images: data.images,
            metadata: data.metadata,
            duration,
            method: 'e2b-fetch'
          };
        } catch (parseError) {
          console.error('[E2BBrowser] Erreur de parsing:', parseError);
        }
      }

      return {
        success: false,
        url,
        error: result.stderr || 'Échec de l\'extraction',
        duration,
        method: 'e2b-fetch'
      };

    } catch (error) {
      return {
        success: false,
        url,
        error: String(error),
        duration: Date.now() - startTime,
        method: 'e2b-fetch'
      };
    }
  }

  /**
   * Exécute une session de browsing complète
   */
  async executeBrowsingSession(
    userId: string,
    url: string,
    extractionGoal: string,
    takeScreenshot: boolean = false
  ): Promise<{
    sessionId: string;
    content: string;
    result: E2BBrowsingResult;
    success: boolean;
  }> {
    const sessionId = `browser-${userId}-${Date.now()}`;
    const sandboxId = `browser-${userId}`;

    console.log('[E2BBrowser] Démarrage session:', sessionId);
    console.log('  URL:', url);
    console.log('  Objectif:', extractionGoal);

    // Essayer d'abord avec Playwright, puis fallback vers fetch
    const result = await this.browseWithPlaywright(sandboxId, url, takeScreenshot);

    // Construire le résumé
    let content = `## Résultats de l'extraction depuis ${url}\n\n`;
    content += `**Méthode:** ${result.method === 'e2b-playwright' ? 'E2B + Playwright (Chrome headless)' : 'E2B + Fetch (HTML statique)'}\n`;
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
   * Prend un screenshot d'une page via E2B
   */
  async takeScreenshot(userId: string, url: string): Promise<string | null> {
    const sandboxId = `browser-${userId}`;
    const result = await this.browseWithPlaywright(sandboxId, url, true);
    return result.screenshot || null;
  }

  /**
   * Recherche du texte sur une page
   */
  async searchOnPage(userId: string, url: string, searchText: string): Promise<string[]> {
    const sandboxId = `browser-${userId}`;
    const result = await this.browseWithPlaywright(sandboxId, url, false);
    
    if (!result.success || !result.content) {
      return [];
    }

    const regex = new RegExp(searchText, 'gi');
    const sentences = result.content.split(/[.!?]\s+/);
    
    return sentences
      .filter(s => regex.test(s))
      .slice(0, 10)
      .map(s => s.trim().substring(0, 500));
  }

  /**
   * Nettoie le cache de setup
   */
  clearSetupCache(): void {
    this.setupCompleted.clear();
  }
}

// Export singleton
export const e2bBrowser = new E2BBrowserModule();
