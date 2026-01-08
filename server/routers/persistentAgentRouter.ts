/**
 * Persistent Agent Router - Routes tRPC pour l'agent persistant
 * 
 * Ce router expose les fonctionnalités de l'agent persistant via tRPC:
 * - Création de tâches
 * - Gestion du cycle de vie (pause, resume, cancel)
 * - Récupération de l'état et des étapes
 * - Statistiques
 */

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import {
  taskQueue,
  createStateManager,
  persistentWorker,
  getPersistentAgentStats
} from '../phoenix/persistentAgent';

// Schémas de validation
const taskConfigSchema = z.object({
  maxIterations: z.number().min(1).max(500).optional(),
  maxToolCalls: z.number().min(1).max(500).optional(),
  requireConfirmation: z.boolean().optional(),
  verbose: z.boolean().optional(),
  timeout: z.number().min(60000).max(3600000).optional() // 1 min to 1 hour
}).optional();

export const persistentAgentRouter = router({
  /**
   * Crée une nouvelle tâche d'agent
   */
  createTask: protectedProcedure
    .input(z.object({
      goal: z.string().min(1).max(10000),
      config: taskConfigSchema,
      priority: z.number().min(0).max(100).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const taskId = await taskQueue.createTask({
          userId: ctx.user.id,
          goal: input.goal,
          config: input.config,
          priority: input.priority
        });

        return {
          success: true,
          taskId,
          message: 'Task created and queued'
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }
    }),

  /**
   * Récupère l'état d'une tâche
   */
  getTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const task = await taskQueue.getTask(input.taskId);
      
      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found'
        });
      }

      // Vérifier que l'utilisateur a accès à cette tâche
      if (task.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return task;
    }),

  /**
   * Récupère les étapes d'une tâche
   */
  getTaskSteps: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      limit: z.number().min(1).max(100).optional()
    }))
    .query(async ({ ctx, input }) => {
      const task = await taskQueue.getTask(input.taskId);
      
      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found'
        });
      }

      if (task.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      const stateManager = createStateManager(input.taskId);
      const steps = await stateManager.getSteps();
      
      return input.limit ? steps.slice(-input.limit) : steps;
    }),

  /**
   * Récupère les checkpoints d'une tâche
   */
  getTaskCheckpoints: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const task = await taskQueue.getTask(input.taskId);
      
      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found'
        });
      }

      if (task.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      const stateManager = createStateManager(input.taskId);
      return stateManager.getCheckpoints();
    }),

  /**
   * Met une tâche en pause
   */
  pauseTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await taskQueue.getTask(input.taskId);
      
      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found'
        });
      }

      if (task.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      await taskQueue.pause(input.taskId);
      return { success: true, message: 'Task paused' };
    }),

  /**
   * Reprend une tâche en pause
   */
  resumeTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await taskQueue.getTask(input.taskId);
      
      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found'
        });
      }

      if (task.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      await taskQueue.resume(input.taskId);
      return { success: true, message: 'Task resumed' };
    }),

  /**
   * Annule une tâche
   */
  cancelTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await taskQueue.getTask(input.taskId);
      
      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found'
        });
      }

      if (task.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      await taskQueue.cancel(input.taskId);
      return { success: true, message: 'Task cancelled' };
    }),

  /**
   * Restaure une tâche depuis un checkpoint
   */
  restoreFromCheckpoint: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      checkpointId: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await taskQueue.getTask(input.taskId);
      
      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found'
        });
      }

      if (task.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      const stateManager = createStateManager(input.taskId);
      const state = await stateManager.restoreFromCheckpoint(input.checkpointId);
      
      if (!state) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Checkpoint not found'
        });
      }

      // Remettre la tâche dans la queue
      await taskQueue.resume(input.taskId);

      return { success: true, message: 'Task restored from checkpoint', state };
    }),

  /**
   * Récupère les tâches de l'utilisateur
   */
  getUserTasks: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional(),
      status: z.enum(['pending', 'running', 'paused', 'waiting', 'completed', 'failed', 'cancelled']).optional()
    }))
    .query(async ({ ctx, input }) => {
      const tasks = await taskQueue.getUserTasks(ctx.user.id, input.limit || 50);
      
      if (input.status) {
        return tasks.filter(t => t.status === input.status);
      }
      
      return tasks;
    }),

  /**
   * Récupère les statistiques du système (admin only)
   */
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required'
        });
      }

      return getPersistentAgentStats();
    }),

  /**
   * Récupère l'état du worker
   */
  getWorkerStatus: publicProcedure
    .query(async () => {
      return persistentWorker.getStatus();
    }),

  /**
   * Démarre le worker (admin only)
   */
  startWorker: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required'
        });
      }

      persistentWorker.start();
      return { success: true, message: 'Worker started' };
    }),

  /**
   * Arrête le worker (admin only)
   */
  stopWorker: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required'
        });
      }

      persistentWorker.stop();
      return { success: true, message: 'Worker stopped' };
    }),

  /**
   * Récupère la file d'attente
   */
  getQueue: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        // Les utilisateurs normaux ne voient que leurs propres tâches
        const tasks = await taskQueue.getQueuedTasks();
        return tasks.filter(t => t.userId === ctx.user.id);
      }
      
      return taskQueue.getQueuedTasks();
    })
});

export default persistentAgentRouter;
