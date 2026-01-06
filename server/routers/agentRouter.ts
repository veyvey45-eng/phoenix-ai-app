/**
 * Agent Router - Routes pour le système d'agent autonome
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { 
  createAgentTask, 
  getAgentTask, 
  listAgentTasks, 
  runAgentLoop, 
  confirmAgentAction, 
  cancelAgentTask,
  deleteAgentTask,
  executeQuickTask,
  AgentTask,
  AgentStep
} from "../phoenix/agentEngine";
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';

// Event emitter pour les mises à jour en temps réel
const agentEvents = new EventEmitter();

export const agentRouter = router({
  /**
   * Créer une nouvelle tâche d'agent
   */
  createTask: protectedProcedure
    .input(z.object({
      goal: z.string().min(1).max(2000)
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await createAgentTask(input.goal, ctx.user.openId);
      return {
        success: true,
        task: {
          id: task.id,
          goal: task.goal,
          status: task.status,
          createdAt: task.createdAt
        }
      };
    }),

  /**
   * Obtenir une tâche par son ID
   */
  getTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .query(async ({ input }) => {
      const task = getAgentTask(input.taskId);
      if (!task) {
        return { success: false, error: 'Task not found' };
      }
      return { success: true, task };
    }),

  /**
   * Lister toutes les tâches
   */
  listTasks: protectedProcedure
    .query(async () => {
      const tasks = listAgentTasks();
      return {
        success: true,
        tasks: tasks.map(t => ({
          id: t.id,
          goal: t.goal,
          status: t.status,
          stepsCount: t.steps.length,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt
        }))
      };
    }),

  /**
   * Exécuter une tâche (démarrer la boucle d'agent)
   */
  runTask: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      config: z.object({
        maxIterations: z.number().min(1).max(50).optional(),
        requireConfirmationForHighRisk: z.boolean().optional(),
        autoExecuteLowRisk: z.boolean().optional()
      }).optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const completedTask = await runAgentLoop(
          input.taskId,
          input.config || {},
          (step) => {
            // Émettre un événement pour chaque étape complétée
            agentEvents.emit(`task:${input.taskId}:step`, step);
          }
        );
        
        return {
          success: true,
          task: completedTask
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  /**
   * Exécuter une tâche rapide (one-shot)
   */
  quickTask: protectedProcedure
    .input(z.object({
      goal: z.string().min(1).max(2000)
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await executeQuickTask(
        input.goal,
        ctx.user.openId,
        (message) => {
          agentEvents.emit(`user:${ctx.user.openId}:progress`, message);
        }
      );
      
      return result;
    }),

  /**
   * Confirmer ou refuser une action en attente
   */
  confirmAction: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      stepId: z.string(),
      confirmed: z.boolean()
    }))
    .mutation(async ({ input }) => {
      const task = await confirmAgentAction(
        input.taskId,
        input.stepId,
        input.confirmed
      );
      
      if (!task) {
        return { success: false, error: 'Task or step not found' };
      }
      
      return { success: true, task };
    }),

  /**
   * Annuler une tâche en cours
   */
  cancelTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .mutation(async ({ input }) => {
      const success = cancelAgentTask(input.taskId);
      return { success };
    }),

  /**
   * Supprimer une tâche terminée
   */
  deleteTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .mutation(async ({ input }) => {
      const success = deleteAgentTask(input.taskId);
      return { success };
    }),

  /**
   * Souscrire aux mises à jour d'une tâche (SSE)
   */
  onTaskUpdate: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .subscription(({ input }) => {
      return observable<AgentStep>((emit) => {
        const handler = (step: AgentStep) => {
          emit.next(step);
        };
        
        agentEvents.on(`task:${input.taskId}:step`, handler);
        
        return () => {
          agentEvents.off(`task:${input.taskId}:step`, handler);
        };
      });
    }),

  /**
   * Souscrire aux messages de progression
   */
  onProgress: protectedProcedure
    .subscription(({ ctx }) => {
      return observable<string>((emit) => {
        const handler = (message: string) => {
          emit.next(message);
        };
        
        agentEvents.on(`user:${ctx.user.openId}:progress`, handler);
        
        return () => {
          agentEvents.off(`user:${ctx.user.openId}:progress`, handler);
        };
      });
    }),
});

export default agentRouter;
