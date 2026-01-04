/**
 * AGENT RUNTIME - Le Cerveau Autonome de Phoenix
 * 
 * Responsabilités:
 * 1. Lire les objectifs utilisateur
 * 2. Décomposer en étapes
 * 3. Orchestrer l'exécution
 * 4. Gérer les erreurs et retries
 * 5. Persister l'état
 * 6. Prendre des décisions autonomes
 */

import { getDb } from "../db";
import { autonomousTasks, agentState, taskLogs, agentDecisions } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { invokeLLM } from "../_core/llm";

export interface TaskStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  action: string;
  result?: string;
  error?: string;
}

export interface TaskObjective {
  title: string;
  description: string;
  objective: string;
  priority?: "low" | "medium" | "high" | "critical";
}

export class AgentRuntime {
  private userId: number;
  private currentTaskId?: string;
  private state: {
    variables: Map<string, unknown>;
    memory: string;
    context: Record<string, unknown>;
    lastAction: string;
    lastActionTime: number;
  };

  constructor(userId: number) {
    this.userId = userId;
    this.state = {
      variables: new Map(),
      memory: "",
      context: {},
      lastAction: "initialized",
      lastActionTime: Date.now()
    };
  }

  /**
   * Crée une nouvelle tâche autonome à partir d'un objectif
   */
  async createTask(objective: TaskObjective): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const taskId = randomUUID();
    const timestamp = new Date();

    try {
      // Décomposer l'objectif en étapes avec LLM
      const steps = await this.decomposeObjective(objective.objective);

      await db.insert(autonomousTasks).values({
        id: taskId,
        userId: this.userId,
        title: objective.title,
        description: objective.description,
        objective: objective.objective,
        status: "pending",
        priority: objective.priority || "medium",
        steps,
        currentStepIndex: 0,
        logs: [
          {
            timestamp: Date.now(),
            level: "info",
            message: `Tâche créée: ${objective.title}`
          }
        ],
        createdAt: timestamp,
        updatedAt: timestamp
      });

      console.log(`[AgentRuntime] Tâche créée: ${taskId}`);
      return taskId;
    } catch (error) {
      console.error("[AgentRuntime] Erreur lors de la création de la tâche:", error);
      throw error;
    }
  }

  /**
   * Décompose un objectif en étapes avec LLM
   */
  private async decomposeObjective(objective: string): Promise<TaskStep[]> {
    const prompt = `Tu es un agent autonome expert en planification.

OBJECTIF: ${objective}

Décompose cet objectif en étapes claires et exécutables. Chaque étape doit être:
1. Spécifique et mesurable
2. Exécutable de manière autonome
3. Avec un résultat vérifiable

Format: JSON array avec chaque étape ayant {id, title, description, action}

Réponds UNIQUEMENT avec le JSON, sans explications.`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Tu es un expert en décomposition de tâches complexes en étapes autonomes."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const messageContent = response.choices[0]?.message?.content;
      if (typeof messageContent === "string") {
        try {
          const parsed = JSON.parse(messageContent);
          if (Array.isArray(parsed)) {
            return parsed.map((step: any) => ({
              id: step.id || randomUUID(),
              title: step.title || "Étape sans titre",
              description: step.description || "",
              status: "pending",
              action: step.action || "",
              result: undefined,
              error: undefined
            }));
          }
        } catch {
          // Fallback
        }
      }
    } catch (error) {
      console.error("[AgentRuntime] Erreur lors de la décomposition:", error);
    }

    // Fallback: créer une étape générique
    return [
      {
        id: randomUUID(),
        title: "Exécuter l'objectif",
        description: objective,
        status: "pending",
        action: objective,
        result: undefined,
        error: undefined
      }
    ];
  }

  /**
   * Charge une tâche et reprend son exécution
   */
  async loadTask(taskId: string): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    try {
      const result = await db
        .select()
        .from(autonomousTasks)
        .where(eq(autonomousTasks.id, taskId));

      if (result.length === 0) {
        console.log("[AgentRuntime] Tâche non trouvée:", taskId);
        return false;
      }

      const task = result[0];
      this.currentTaskId = taskId;

      console.log(`[AgentRuntime] Tâche chargée: ${task.title}`);
      console.log(`  Statut: ${task.status}`);
      console.log(`  Étape actuelle: ${task.currentStepIndex}/${(task.steps as any[])?.length || 0}`);

      return true;
    } catch (error) {
      console.error("[AgentRuntime] Erreur lors du chargement de la tâche:", error);
      return false;
    }
  }

  /**
   * Exécute la prochaine étape de la tâche
   */
  async executeNextStep(): Promise<{
    success: boolean;
    stepId?: string;
    result?: string;
    error?: string;
  }> {
    const db = await getDb();
    if (!db || !this.currentTaskId) {
      return { success: false, error: "Aucune tâche en cours" };
    }

    try {
      // Charger la tâche
      const taskResult = await db
        .select()
        .from(autonomousTasks)
        .where(eq(autonomousTasks.id, this.currentTaskId));

      if (taskResult.length === 0) {
        return { success: false, error: "Tâche non trouvée" };
      }

      const task = taskResult[0];
      const steps = (task.steps as any[]) || [];
      const currentStepIndex = task.currentStepIndex || 0;

      if (currentStepIndex >= steps.length) {
        console.log("[AgentRuntime] Toutes les étapes sont complétées");
        return { success: true, error: "Tâche complétée" };
      }

      const currentStep = steps[currentStepIndex];
      console.log(`[AgentRuntime] Exécution de l'étape ${currentStepIndex + 1}/${steps.length}: ${currentStep.title}`);

      // Marquer comme en cours
      currentStep.status = "in_progress";
      const startTime = Date.now();

      try {
        // Exécuter l'action
        const result = await this.executeAction(currentStep.action);

        // Marquer comme complétée
        currentStep.status = "completed";
        currentStep.result = result;

        // Sauvegarder le log
        await this.logAction({
          taskId: this.currentTaskId,
          stepIndex: currentStepIndex,
          stepId: currentStep.id,
          actionType: "step_execution",
          input: { action: currentStep.action },
          output: { result },
          duration: Date.now() - startTime
        });

        // Mettre à jour la tâche
        const nextStepIndex = currentStepIndex + 1;
        const isCompleted = nextStepIndex >= steps.length;

        await db
          .update(autonomousTasks)
          .set({
            steps,
            currentStepIndex: nextStepIndex,
            status: isCompleted ? "completed" : "in_progress",
            completedAt: isCompleted ? new Date() : undefined,
            actualDuration: isCompleted ? Date.now() - task.createdAt.getTime() : undefined,
            updatedAt: new Date()
          })
          .where(eq(autonomousTasks.id, this.currentTaskId));

        return {
          success: true,
          stepId: currentStep.id,
          result
        };
      } catch (error) {
        // Marquer comme échouée
        currentStep.status = "failed";
        currentStep.error = String(error);

        // Sauvegarder le log d'erreur
        await this.logAction({
          taskId: this.currentTaskId,
          stepIndex: currentStepIndex,
          stepId: currentStep.id,
          actionType: "step_execution",
          input: { action: currentStep.action },
          error: String(error),
          duration: Date.now() - startTime
        });

        // Mettre à jour la tâche
        await db
          .update(autonomousTasks)
          .set({
            steps,
            status: "failed",
            errorMessage: String(error),
            updatedAt: new Date()
          })
          .where(eq(autonomousTasks.id, this.currentTaskId));

        return {
          success: false,
          stepId: currentStep.id,
          error: String(error)
        };
      }
    } catch (error) {
      console.error("[AgentRuntime] Erreur lors de l'exécution:", error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Exécute une action (peut être du code, une requête web, etc.)
   */
  private async executeAction(action: string): Promise<string> {
    // En production, cela appellerait le code executor, le browser, etc.
    console.log(`[AgentRuntime] Exécution de l'action: ${action}`);

    // Simuler l'exécution
    return `Résultat de: ${action}`;
  }

  /**
   * Sauvegarde un log d'action
   */
  private async logAction(log: {
    taskId: string;
    stepIndex?: number;
    stepId?: string;
    actionType: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
    duration?: number;
  }): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      await db.insert(taskLogs).values({
        id: randomUUID(),
        taskId: log.taskId,
        userId: this.userId,
        stepIndex: log.stepIndex,
        stepId: log.stepId,
        actionType: log.actionType,
        input: log.input,
        output: log.output,
        error: log.error,
        duration: log.duration,
        startTime: new Date(Date.now() - (log.duration || 0)),
        endTime: new Date(),
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      });
    } catch (error) {
      console.error("[AgentRuntime] Erreur lors de la sauvegarde du log:", error);
    }
  }

  /**
   * Récupère l'état actuel du runtime
   */
  getState() {
    return {
      currentTaskId: this.currentTaskId,
      state: {
        variables: Object.fromEntries(this.state.variables),
        memory: this.state.memory,
        context: this.state.context,
        lastAction: this.state.lastAction,
        lastActionTime: this.state.lastActionTime
      }
    };
  }

  /**
   * Sauvegarde l'état du runtime
   */
  async saveState(): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      const stateId = `agent-state-${this.userId}`;

      await db
        .update(agentState)
        .set({
          currentTaskId: this.currentTaskId,
          state: {
            variables: Object.fromEntries(this.state.variables),
            memory: this.state.memory,
            context: this.state.context,
            lastAction: this.state.lastAction,
            lastActionTime: this.state.lastActionTime
          },
          lastHeartbeat: new Date(),
          updatedAt: new Date()
        })
        .where(eq(agentState.id, stateId));
    } catch (error) {
      console.error("[AgentRuntime] Erreur lors de la sauvegarde de l'état:", error);
    }
  }

  /**
   * Charge l'état du runtime (pour récupération après crash)
   */
  async loadState(): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    try {
      const stateId = `agent-state-${this.userId}`;
      const result = await db
        .select()
        .from(agentState)
        .where(eq(agentState.id, stateId));

      if (result.length === 0) {
        console.log("[AgentRuntime] Aucun état sauvegardé");
        return false;
      }

      const savedState = result[0];
      if (savedState.state) {
        const stateData = typeof savedState.state === "string" 
          ? JSON.parse(savedState.state) 
          : savedState.state;

        this.state = {
          variables: new Map(Object.entries(stateData.variables || {})),
          memory: stateData.memory || "",
          context: stateData.context || {},
          lastAction: stateData.lastAction || "loaded",
          lastActionTime: stateData.lastActionTime || Date.now()
        };

        this.currentTaskId = savedState.currentTaskId || undefined;

        console.log("[AgentRuntime] État restauré");
        return true;
      }

      return false;
    } catch (error) {
      console.error("[AgentRuntime] Erreur lors du chargement de l'état:", error);
      return false;
    }
  }
}

// Export singleton pour chaque utilisateur
const runtimes = new Map<number, AgentRuntime>();

export function getAgentRuntime(userId: number): AgentRuntime {
  if (!runtimes.has(userId)) {
    runtimes.set(userId, new AgentRuntime(userId));
  }
  return runtimes.get(userId)!;
}
