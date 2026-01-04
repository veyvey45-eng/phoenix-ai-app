/**
 * Web Automation Manager
 * Permet à Phoenix d'automatiser les navigateurs web et les interactions GUI
 * Utilise Puppeteer pour la navigation, les clics, les saisies, etc.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface BrowserSession {
  sessionId: string;
  userId: string;
  browser: Browser | null;
  pages: Map<string, Page>;
  createdAt: number;
  lastUpdated: number;
}

interface InteractionResult {
  success: boolean;
  message: string;
  data?: any;
  timestamp: number;
}

class WebAutomationManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private screenshotDir: string;
  private maxSessions: number = 10;

  constructor() {
    this.screenshotDir = path.join(process.cwd(), 'public', 'screenshots');
    
    // Créer le répertoire des screenshots
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
    
    console.log('[WebAutomation] Initialized');
  }

  /**
   * Créer une session de navigateur
   */
  async createSession(userId: string, sessionId: string): Promise<BrowserSession> {
    try {
      // Fermer les anciennes sessions si nécessaire
      if (this.sessions.size >= this.maxSessions) {
        const oldestKey = Array.from(this.sessions.entries())
          .sort((a, b) => a[1].lastUpdated - b[1].lastUpdated)[0][0];
        await this.closeSession(oldestKey);
      }
      
      // Créer un nouveau navigateur
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
      
      const session: BrowserSession = {
        sessionId,
        userId,
        browser,
        pages: new Map(),
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };
      
      this.sessions.set(sessionId, session);
      
      console.log('[WebAutomation] Created browser session:', sessionId);
      
      return session;
    } catch (error) {
      console.error('[WebAutomation] Error creating session:', error);
      throw error;
    }
  }

  /**
   * Obtenir une session de navigateur
   */
  async getSession(userId: string, sessionId: string): Promise<BrowserSession> {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = await this.createSession(userId, sessionId);
    }
    
    session.lastUpdated = Date.now();
    
    return session;
  }

  /**
   * Créer une nouvelle page
   */
  async createPage(sessionId: string, pageId: string): Promise<Page> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.browser) {
      throw new Error('Session not found');
    }
    
    const page = await session.browser.newPage();
    session.pages.set(pageId, page);
    
    console.log('[WebAutomation] Created page:', pageId, 'in session:', sessionId);
    
    return page;
  }

  /**
   * Naviguer vers une URL
   */
  async navigateTo(sessionId: string, pageId: string, url: string): Promise<InteractionResult> {
    try {
      let page = this.sessions.get(sessionId)?.pages.get(pageId);
      
      if (!page) {
        page = await this.createPage(sessionId, pageId);
      }
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      console.log('[WebAutomation] Navigated to:', url);
      
      return {
        success: true,
        message: `Navigated to ${url}`,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('[WebAutomation] Navigation error:', error.message);
      return {
        success: false,
        message: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Cliquer sur un élément
   */
  async click(sessionId: string, pageId: string, selector: string): Promise<InteractionResult> {
    try {
      const page = this.sessions.get(sessionId)?.pages.get(pageId);
      if (!page) {
        throw new Error('Page not found');
      }
      
      await page.click(selector);
      
      console.log('[WebAutomation] Clicked on:', selector);
      
      return {
        success: true,
        message: `Clicked on ${selector}`,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('[WebAutomation] Click error:', error.message);
      return {
        success: false,
        message: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Saisir du texte
   */
  async type(sessionId: string, pageId: string, selector: string, text: string): Promise<InteractionResult> {
    try {
      const page = this.sessions.get(sessionId)?.pages.get(pageId);
      if (!page) {
        throw new Error('Page not found');
      }
      
      await page.type(selector, text);
      
      console.log('[WebAutomation] Typed text in:', selector);
      
      return {
        success: true,
        message: `Typed text in ${selector}`,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('[WebAutomation] Type error:', error.message);
      return {
        success: false,
        message: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Prendre une capture d'écran
   */
  async screenshot(sessionId: string, pageId: string, filename?: string): Promise<InteractionResult> {
    try {
      const page = this.sessions.get(sessionId)?.pages.get(pageId);
      if (!page) {
        throw new Error('Page not found');
      }
      
      const screenshotName = filename || `screenshot-${Date.now()}.png`;
      const screenshotPath = path.join(this.screenshotDir, screenshotName);
      
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      console.log('[WebAutomation] Screenshot saved:', screenshotPath);
      
      return {
        success: true,
        message: `Screenshot saved to ${screenshotName}`,
        data: {
          filename: screenshotName,
          path: screenshotPath,
          url: `/screenshots/${screenshotName}`,
        },
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('[WebAutomation] Screenshot error:', error.message);
      return {
        success: false,
        message: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Évaluer du JavaScript sur la page
   */
  async evaluate(sessionId: string, pageId: string, code: string): Promise<InteractionResult> {
    try {
      const page = this.sessions.get(sessionId)?.pages.get(pageId);
      if (!page) {
        throw new Error('Page not found');
      }
      
      const result = await page.evaluate(code);
      
      console.log('[WebAutomation] Evaluated code on page:', pageId);
      
      return {
        success: true,
        message: 'Code evaluated successfully',
        data: result,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('[WebAutomation] Evaluate error:', error.message);
      return {
        success: false,
        message: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Attendre un élément
   */
  async waitForSelector(sessionId: string, pageId: string, selector: string, timeout?: number): Promise<InteractionResult> {
    try {
      const page = this.sessions.get(sessionId)?.pages.get(pageId);
      if (!page) {
        throw new Error('Page not found');
      }
      
      await page.waitForSelector(selector, { timeout: timeout || 30000 });
      
      console.log('[WebAutomation] Waited for selector:', selector);
      
      return {
        success: true,
        message: `Waited for selector ${selector}`,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('[WebAutomation] Wait error:', error.message);
      return {
        success: false,
        message: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Obtenir le contenu HTML
   */
  async getHTML(sessionId: string, pageId: string): Promise<InteractionResult> {
    try {
      const page = this.sessions.get(sessionId)?.pages.get(pageId);
      if (!page) {
        throw new Error('Page not found');
      }
      
      const html = await page.content();
      
      console.log('[WebAutomation] Got HTML from page:', pageId);
      
      return {
        success: true,
        message: 'HTML retrieved successfully',
        data: html,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('[WebAutomation] Get HTML error:', error.message);
      return {
        success: false,
        message: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Fermer une page
   */
  async closePage(sessionId: string, pageId: string): Promise<void> {
    const page = this.sessions.get(sessionId)?.pages.get(pageId);
    if (page) {
      await page.close();
      this.sessions.get(sessionId)?.pages.delete(pageId);
      
      console.log('[WebAutomation] Closed page:', pageId);
    }
  }

  /**
   * Fermer une session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Fermer toutes les pages
      const pages = Array.from(session.pages.values());
      for (const page of pages) {
        try {
          await page.close();
        } catch (error) {
          console.error('[WebAutomation] Error closing page:', error);
        }
      }
      
      // Fermer le navigateur
      if (session.browser) {
        try {
          await session.browser.close();
        } catch (error) {
          console.error('[WebAutomation] Error closing browser:', error);
        }
      }
      
      this.sessions.delete(sessionId);
      
      console.log('[WebAutomation] Closed session:', sessionId);
    }
  }

  /**
   * Obtenir les statistiques
   */
  getStats(): Record<string, any> {
    const sessions: any[] = [];
    
    this.sessions.forEach((session) => {
      sessions.push({
        sessionId: session.sessionId,
        userId: session.userId,
        pagesCount: session.pages.size,
        createdAt: session.createdAt,
        lastUpdated: session.lastUpdated,
      });
    });
    
    return {
      totalSessions: this.sessions.size,
      maxSessions: this.maxSessions,
      screenshotDir: this.screenshotDir,
      sessions,
    };
  }
}

// Export singleton instance
export const webAutomation = new WebAutomationManager();
