/**
 * AUTONOMOUS AGENT ROUTER - Procédures tRPC pour l'architecture multi-agents
 * 
 * Expose les capacités autonomes de Phoenix via l'API tRPC
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getAgentRuntime } from "../phoenix/agentRuntime";
import { ReasoningLoop } from "../phoenix/reasoningLoop";
import { webAutomationWorker } from "../phoenix/webAutomationWorker";
import { autonomousWorker } from "../phoenix/autonomousWorker";

export const autonomousAgentRouter = router({
  /**
   * Crée une nouvelle tâche autonome
   */
  createTask: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string(),
        objective: z.string().min(1),
        priority: z.enum(["low", "medium", "high", "critical"]).optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const runtime = getAgentRuntime(ctx.user.id);

        const taskId = await runtime.createTask({
          title: input.title,
          description: input.description,
          objective: input.objective,
          priority: input.priority
        });

        return {
          success: true,
          taskId,
          message: `Tâche créée: ${input.title}`
        };
      } catch (error) {
        console.error("[AutonomousAgentRouter] Erreur:", error);
        return {
          success: false,
          error: String(error)
        };
      }
    }),

  /**
   * Récupère le statut d'une tâche
   */
  getTaskStatus: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const runtime = getAgentRuntime(ctx.user.id);
        const loaded = await runtime.loadTask(input.taskId);

        if (!loaded) {
          return { success: false, error: "Tâche non trouvée" };
        }

        const state = runtime.getState();
        return {
          success: true,
          state
        };
      } catch (error) {
        console.error("[AutonomousAgentRouter] Erreur:", error);
        return {
          success: false,
          error: String(error)
        };
      }
    }),

  /**
   * Exécute la prochaine étape d'une tâche
   */
  executeNextStep: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const runtime = getAgentRuntime(ctx.user.id);
        const loaded = await runtime.loadTask(input.taskId);

        if (!loaded) {
          return { success: false, error: "Tâche non trouvée" };
        }

        const result = await runtime.executeNextStep();
        return result;
      } catch (error) {
        console.error("[AutonomousAgentRouter] Erreur:", error);
        return {
          success: false,
          error: String(error)
        };
      }
    }),

  /**
   * Prend une décision autonome
   */
  makeDecision: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        objective: z.string(),
        previousAttempts: z.array(z.object({
          action: z.string(),
          error: z.string(),
          timestamp: z.number()
        })).optional(),
        availableTools: z.array(z.string()).optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const decision = await ReasoningLoop.makeDecision({
          taskId: input.taskId,
          userId: ctx.user.id,
          currentObjective: input.objective,
          previousAttempts: input.previousAttempts || [],
          availableTools: input.availableTools || ["execute_code", "browse_web", "generate_content"]
        });

        return {
          success: true,
          decision
        };
      } catch (error) {
        console.error("[AutonomousAgentRouter] Erreur:", error);
        return {
          success: false,
          error: String(error)
        };
      }
    }),

  /**
   * Lance une session de navigation web autonome
   */
  browseWeb: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        url: z.string().url(),
        objective: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Créer une session
        const sessionId = await webAutomationWorker.createSession(
          input.taskId,
          ctx.user.id,
          input.url,
          input.objective
        );

        // Exécuter la session
        const result = await webAutomationWorker.executeSession(sessionId);

        return {
          success: result.success,
          sessionId,
          data: result.data,
          error: result.error
        };
      } catch (error) {
        console.error("[AutonomousAgentRouter] Erreur:", error);
        return {
          success: false,
          error: String(error)
        };
      }
    }),

  /**
   * Récupère les statistiques du worker autonome
   */
  getWorkerStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const workerStats = autonomousWorker.getStatistics();
      const webStats = webAutomationWorker.getStatistics();
      const runtime = getAgentRuntime(ctx.user.id);
      const runtimeState = runtime.getState();

      return {
        success: true,
        worker: workerStats,
        webAutomation: webStats,
        runtime: runtimeState
      };
    } catch (error) {
      console.error("[AutonomousAgentRouter] Erreur:", error);
      return {
        success: false,
        error: String(error)
      };
    }
  }),

  /**
   * Récupère l'état du runtime
   */
  getRuntimeState: protectedProcedure.query(async ({ ctx }) => {
    try {
      const runtime = getAgentRuntime(ctx.user.id);
      const state = runtime.getState();

      return {
        success: true,
        state
      };
    } catch (error) {
      console.error("[AutonomousAgentRouter] Erreur:", error);
      return {
        success: false,
        error: String(error)
      };
    }
  })
});
