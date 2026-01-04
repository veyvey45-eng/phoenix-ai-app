/**
 * AUTONOMOUS WORKER - Processus en Arrière-Plan
 * 
 * Ce worker tourne en continu et:
 * 1. Récupère les tâches en attente
 * 2. Les exécute de manière autonome
 * 3. Gère les erreurs et retries
 * 4. Persiste l'état
 * 5. Se récupère après crash
 */

import { getDb } from "../db";
import { autonomousTasks, agentState } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getAgentRuntime } from "./agentRuntime";
import { ReasoningLoop } from "./reasoningLoop";
import { randomUUID } from "crypto";

export class AutonomousWorker {
  private isRunning = false;
  private checkInterval = 5000; // 5 secondes
  private maxConcurrentTasks = 3;
  private activeTasks = new Map<string, NodeJS.Timeout>();

  /**
   * Démarre le worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[AutonomousWorker] Worker déjà en cours d'exécution");
      return;
    }

    this.isRunning = true;
    console.log("[AutonomousWorker] ✅ Worker démarré");

    // Boucle principale
    this.mainLoop();
  }

  /**
   * Arrête le worker
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    console.log("[AutonomousWorker] ⏹️ Worker arrêté");

    // Nettoyer les tâches actives
    this.activeTasks.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.activeTasks.clear();
  }

  /**
   * Boucle principale du worker
   */
  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Récupérer les tâches en attente
        const pendingTasks = await this.getPendingTasks();

        // Exécuter les tâches (avec limite de concurrence)
        for (const task of pendingTasks) {
          if (this.activeTasks.size < this.maxConcurrentTasks) {
            this.executeTask(task);
          }
        }

        // Attendre avant la prochaine itération
        await new Promise((resolve) => setTimeout(resolve, this.checkInterval));
      } catch (error) {
        console.error("[AutonomousWorker] Erreur dans la boucle principale:", error);
        // Continuer malgré l'erreur
        await new Promise((resolve) => setTimeout(resolve, this.checkInterval));
      }
    }
  }

  /**
   * Récupère les tâches en attente
   */
  private async getPendingTasks(): Promise<any[]> {
    const db = await getDb();
    if (!db) return [];

    try {
      const tasks = await db
        .select()
        .from(autonomousTasks)
        .where(
          and(
            eq(autonomousTasks.status, "pending"),
            // Limiter à 10 tâches par itération
          )
        )
        .limit(10);

      return tasks;
    } catch (error) {
      console.error("[AutonomousWorker] Erreur lors de la récupération des tâches:", error);
      return [];
    }
  }

  /**
   * Exécute une tâche de manière autonome
   */
  private executeTask(task: any): void {
    const taskId = task.id;

    console.log(`[AutonomousWorker] 🚀 Exécution de la tâche: ${task.title}`);

    // Créer un timeout pour la tâche
    const timeout = setTimeout(async () => {
      try {
        // Marquer comme en cours
        const db = await getDb();
        if (db) {
          await db
            .update(autonomousTasks)
            .set({
              status: "in_progress",
              updatedAt: new Date()
            })
            .where(eq(autonomousTasks.id, taskId));
        }

        // Récupérer le runtime de l'agent
        const runtime = getAgentRuntime(task.userId);

        // Charger la tâche
        const loaded = await runtime.loadTask(taskId);
        if (!loaded) {
          console.error(`[AutonomousWorker] Impossible de charger la tâche: ${taskId}`);
          return;
        }

        // Exécuter les étapes
        let allCompleted = false;
        let consecutiveErrors = 0;
        const maxErrors = 3;

        while (!allCompleted && consecutiveErrors < maxErrors) {
          const result = await runtime.executeNextStep();

          if (result.success) {
            consecutiveErrors = 0;
            console.log(`[AutonomousWorker] ✅ Étape complétée: ${result.result}`);
          } else {
            consecutiveErrors++;
            console.error(`[AutonomousWorker] ❌ Erreur: ${result.error}`);

            // Essayer de corriger avec la boucle de décision
            if (consecutiveErrors < maxErrors) {
              console.log(`[AutonomousWorker] 🤔 Tentative de correction automatique...`);

              const decision = await ReasoningLoop.makeDecision({
                taskId,
                userId: task.userId,
                currentObjective: task.objective,
                previousAttempts: [],
                availableTools: ["retry", "skip", "abort"]
              });

              console.log(`[AutonomousWorker] 💡 Décision: ${decision.option}`);

              if (decision.option === "abort") {
                allCompleted = true;
              }
            }
          }

          // Vérifier si toutes les étapes sont complétées
          const steps = task.steps || [];
          const currentStepIndex = task.currentStepIndex || 0;
          if (currentStepIndex >= steps.length) {
            allCompleted = true;
          }
        }

        // Sauvegarder l'état final
        await runtime.saveState();

        // Marquer la tâche comme complétée
        if (db) {
          await db
            .update(autonomousTasks)
            .set({
              status: "completed",
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(autonomousTasks.id, taskId));
        }

        console.log(`[AutonomousWorker] ✨ Tâche complétée: ${taskId}`);
      } catch (error) {
        console.error(`[AutonomousWorker] Erreur lors de l'exécution de la tâche:`, error);

        // Marquer comme échouée
        const db = await getDb();
        if (db) {
          await db
            .update(autonomousTasks)
            .set({
              status: "failed",
              errorMessage: String(error),
              updatedAt: new Date()
            })
            .where(eq(autonomousTasks.id, taskId));
        }
      } finally {
        // Nettoyer le timeout
        this.activeTasks.delete(taskId);
      }
    }, 0);

    // Ajouter le timeout à la liste des tâches actives
    this.activeTasks.set(taskId, timeout);
  }

  /**
   * Récupère les tâches après un crash
   */
  async recoverFromCrash(userId: number): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      console.log(`[AutonomousWorker] 🔄 Récupération après crash pour l'utilisateur ${userId}`);

      // Charger l'état sauvegardé
      const runtime = getAgentRuntime(userId);
      const stateLoaded = await runtime.loadState();

      if (stateLoaded) {
        console.log(`[AutonomousWorker] ✅ État restauré`);

        // Récupérer la tâche en cours
        const state = runtime.getState();
        if (state.currentTaskId) {
          console.log(`[AutonomousWorker] 🚀 Reprise de la tâche: ${state.currentTaskId}`);

          // Reprendre l'exécution
          const loaded = await runtime.loadTask(state.currentTaskId);
          if (loaded) {
            // Exécuter la prochaine étape
            const result = await runtime.executeNextStep();
            console.log(`[AutonomousWorker] Résultat: ${result.success ? "✅" : "❌"}`);
          }
        }
      }
    } catch (error) {
      console.error("[AutonomousWorker] Erreur lors de la récupération:", error);
    }
  }

  /**
   * Récupère les statistiques du worker
   */
  getStatistics(): {
    isRunning: boolean;
    activeTasks: number;
    maxConcurrentTasks: number;
    checkInterval: number;
  } {
    return {
      isRunning: this.isRunning,
      activeTasks: this.activeTasks.size,
      maxConcurrentTasks: this.maxConcurrentTasks,
      checkInterval: this.checkInterval
    };
  }
}

// Export singleton
export const autonomousWorker = new AutonomousWorker();

/**
 * Initialise le worker au démarrage du serveur
 */
export async function initializeAutonomousWorker(): Promise<void> {
  try {
    console.log("[AutonomousWorker] Initialisation du worker autonome...");
    await autonomousWorker.start();
    console.log("[AutonomousWorker] ✅ Worker initialisé avec succès");
  } catch (error) {
    console.error("[AutonomousWorker] Erreur lors de l'initialisation:", error);
  }
}

/**
 * Arrête le worker à l'arrêt du serveur
 */
export async function shutdownAutonomousWorker(): Promise<void> {
  try {
    console.log("[AutonomousWorker] Arrêt du worker...");
    await autonomousWorker.stop();
    console.log("[AutonomousWorker] ✅ Worker arrêté");
  } catch (error) {
    console.error("[AutonomousWorker] Erreur lors de l'arrêt:", error);
  }
}
