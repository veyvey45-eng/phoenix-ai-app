/**
 * WEB AUTOMATION WORKER - Navigation Web Autonome avec Puppeteer
 * 
 * Responsabilités:
 * 1. Naviguer sur des pages web
 * 2. Extraire des données
 * 3. Interagir avec les éléments
 * 4. Prendre des screenshots
 * 5. Gérer les sessions
 */

import { getDb } from "../db";
import { webAutomationSessions } from "../../drizzle/schema";
import { randomUUID } from "crypto";
import { ReasoningLoop } from "./reasoningLoop";

// Types Puppeteer (sans importer directement pour éviter les dépendances)
export interface BrowserAction {
  type: "navigate" | "click" | "extract" | "fill" | "screenshot" | "wait" | "error";
  selector?: string;
  value?: string;
  timeout?: number;
  result?: string;
  timestamp: number;
}

export interface WebAutomationSession {
  id: string;
  taskId: string;
  userId: number;
  url: string;
  objective: string;
  actions: BrowserAction[];
  extractedData: Record<string, unknown>;
  screenshot?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  errorMessage?: string;
  startTime: number;
  endTime?: number;
}

export class WebAutomationWorker {
  private sessions = new Map<string, WebAutomationSession>();
  private browser: any = null;

  /**
   * Initialise le navigateur
   */
  async initializeBrowser(): Promise<boolean> {
    try {
      // Lazy load Puppeteer pour éviter les dépendances circulaires
      const puppeteer = require("puppeteer");

      if (!this.browser) {
        console.log("[WebAutomation] Initialisation du navigateur Puppeteer...");
        this.browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        console.log("[WebAutomation] ✅ Navigateur initialisé");
      }

      return true;
    } catch (error) {
      console.error("[WebAutomation] Erreur lors de l'initialisation:", error);
      return false;
    }
  }

  /**
   * Crée une nouvelle session de navigation
   */
  async createSession(
    taskId: string,
    userId: number,
    url: string,
    objective: string
  ): Promise<string> {
    const sessionId = randomUUID();
    const session: WebAutomationSession = {
      id: sessionId,
      taskId,
      userId,
      url,
      objective,
      actions: [],
      extractedData: {},
      status: "pending",
      startTime: Date.now()
    };

    this.sessions.set(sessionId, session);

    console.log(`[WebAutomation] Session créée: ${sessionId}`);
    console.log(`  URL: ${url}`);
    console.log(`  Objectif: ${objective}`);

    // Sauvegarder dans la base de données
    await this.saveSession(session);

    return sessionId;
  }

  /**
   * Exécute une session de navigation
   */
  async executeSession(sessionId: string): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: "Session non trouvée" };
    }

    try {
      // Initialiser le navigateur
      const initialized = await this.initializeBrowser();
      if (!initialized) {
        return { success: false, error: "Impossible d'initialiser le navigateur" };
      }

      // Marquer comme en cours
      session.status = "in_progress";

      // Générer un plan d'action avec la boucle de décision
      const plan = await ReasoningLoop.generateActionPlan(session.objective, {
        taskId: session.taskId,
        userId: session.userId,
        currentObjective: session.objective,
        previousAttempts: [],
        availableTools: ["navigate", "click", "extract", "fill", "screenshot"]
      });

      console.log(`[WebAutomation] Plan d'action généré (${plan.steps.length} étapes)`);

      // Exécuter le plan
      const page = await this.browser.newPage();

      try {
        // Naviguer vers l'URL
        console.log(`[WebAutomation] Navigation vers: ${session.url}`);
        await page.goto(session.url, { waitUntil: "networkidle2" });

        session.actions.push({
          type: "navigate",
          value: session.url,
          result: "Page chargée",
          timestamp: Date.now()
        });

        // Exécuter les étapes du plan
        for (const step of plan.steps) {
          console.log(`[WebAutomation] Étape ${step.step}: ${step.action}`);

          try {
            // Parser l'action
            const actionParts = step.action.split(":");
            const actionType = actionParts[0];
            const actionValue = actionParts.slice(1).join(":");

            let result = "";

            switch (actionType) {
              case "click":
                await page.click(actionValue);
                result = `Cliqué sur: ${actionValue}`;
                break;

              case "fill":
                const [selector, value] = actionValue.split("|");
                await page.type(selector, value);
                result = `Rempli: ${selector} = ${value}`;
                break;

              case "extract":
                const data = await page.evaluate(() => {
                  return {
                    title: document.title,
                    url: window.location.href,
                    text: document.body.innerText.substring(0, 1000)
                  };
                });
                session.extractedData = data;
                result = `Données extraites`;
                break;

              case "screenshot":
                const screenshot = await page.screenshot({ encoding: "base64" });
                session.screenshot = screenshot as string;
                result = `Screenshot pris`;
                break;

              case "wait":
                const waitTime = parseInt(actionValue) || 1000;
                await page.waitForTimeout(waitTime);
                result = `Attente de ${waitTime}ms`;
                break;

              default:
                result = `Action inconnue: ${actionType}`;
            }

            session.actions.push({
              type: actionType as any,
              value: actionValue,
              result,
              timestamp: Date.now()
            });

            console.log(`[WebAutomation] ✅ ${result}`);
          } catch (error) {
            console.error(`[WebAutomation] ❌ Erreur lors de l'étape: ${error}`);
            session.actions.push({
              type: "error" as any,
              value: step.action,
              result: String(error),
              timestamp: Date.now()
            });
          }
        }

        // Marquer comme complétée
        session.status = "completed";
        session.endTime = Date.now();

        console.log(`[WebAutomation] ✨ Session complétée`);

        return {
          success: true,
          data: session.extractedData
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      console.error("[WebAutomation] Erreur lors de l'exécution:", error);

      session.status = "failed";
      session.errorMessage = String(error);
      session.endTime = Date.now();

      return {
        success: false,
        error: String(error)
      };
    } finally {
      // Sauvegarder la session
      await this.saveSession(session);
    }
  }

  /**
   * Sauvegarde une session dans la base de données
   */
  private async saveSession(session: WebAutomationSession): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      // Vérifier si la session existe déjà
      const existing = await db
        .select()
        .from(webAutomationSessions)
        .where(require("drizzle-orm").eq(webAutomationSessions.id, session.id));

      if (existing.length > 0) {
        // Mettre à jour
        await db
          .update(webAutomationSessions)
          .set({
            status: session.status as any,
            actions: session.actions as any,
            extractedData: session.extractedData as any,
            screenshot: session.screenshot,
            errorMessage: session.errorMessage,
            endTime: session.endTime ? new Date(session.endTime) : undefined,
            duration: session.endTime ? session.endTime - session.startTime : undefined
          })
          .where(require("drizzle-orm").eq(webAutomationSessions.id, session.id));
      } else {
        // Créer
        await db.insert(webAutomationSessions).values({
          id: session.id,
          taskId: session.taskId,
          userId: session.userId,
          url: session.url,
          objective: session.objective,
          actions: session.actions as any,
          extractedData: session.extractedData as any,
          screenshot: session.screenshot,
          status: session.status as any,
          errorMessage: session.errorMessage,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          duration: session.endTime ? session.endTime - session.startTime : undefined,
          createdAt: new Date()
        });
      }

      console.log(`[WebAutomation] Session sauvegardée: ${session.id}`);
    } catch (error) {
      console.error("[WebAutomation] Erreur lors de la sauvegarde:", error);
    }
  }

  /**
   * Récupère une session
   */
  getSession(sessionId: string): WebAutomationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Récupère les statistiques
   */
  getStatistics(): {
    activeSessions: number;
    totalSessions: number;
    browserRunning: boolean;
  } {
    return {
      activeSessions: Array.from(this.sessions.values()).filter((s) => s.status === "in_progress").length,
      totalSessions: this.sessions.size,
      browserRunning: this.browser !== null
    };
  }

  /**
   * Ferme le navigateur
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        console.log("[WebAutomation] Navigateur fermé");
      } catch (error) {
        console.error("[WebAutomation] Erreur lors de la fermeture:", error);
      }
    }
  }
}

// Export singleton
export const webAutomationWorker = new WebAutomationWorker();
