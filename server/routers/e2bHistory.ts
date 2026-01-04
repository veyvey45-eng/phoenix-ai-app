/**
 * E2B History Router - Endpoints tRPC pour l'historique et les webhooks
 */

import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { getExecutionHistoryService } from '../phoenix/executionHistoryService';
import { getE2BWebhookManager } from '../phoenix/e2bWebhookManager';

export const e2bHistoryRouter = router({
  /**
   * Obtenir l'historique des exécutions
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        language: z.enum(['python', 'node', 'shell']).optional(),
        conversationId: z.string().optional(),
      })
    )
    .query(({ ctx, input }) => {
      const historyService = getExecutionHistoryService();
      const records = historyService.getHistory({
        userId: ctx.user.id,
        limit: input.limit,
        offset: input.offset,
        language: input.language,
        conversationId: input.conversationId,
      });

      return {
        success: true,
        records,
        total: records.length,
      };
    }),

  /**
   * Obtenir les exécutions récentes
   */
  getRecentExecutions: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(({ ctx, input }) => {
      const historyService = getExecutionHistoryService();
      const records = historyService.getRecentExecutions(ctx.user.id, input.limit);

      return {
        success: true,
        records,
      };
    }),

  /**
   * Obtenir une exécution spécifique
   */
  getExecution: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .query(({ ctx, input }) => {
      const historyService = getExecutionHistoryService();
      const record = historyService.getExecution(input.executionId);

      if (!record || record.userId !== ctx.user.id) {
        return {
          success: false,
          error: 'Execution not found',
        };
      }

      return {
        success: true,
        record,
      };
    }),

  /**
   * Obtenir les statistiques
   */
  getStatistics: protectedProcedure.query(({ ctx }) => {
    const historyService = getExecutionHistoryService();
    const stats = historyService.getStatistics(ctx.user.id);

    return {
      success: true,
      stats,
    };
  }),

  /**
   * Exporter l'historique
   */
  exportHistory: protectedProcedure.query(({ ctx }) => {
    const historyService = getExecutionHistoryService();
    const json = historyService.exportHistory(ctx.user.id);

    return {
      success: true,
      data: json,
      filename: `execution-history-${new Date().toISOString().split('T')[0]}.json`,
    };
  }),

  /**
   * Supprimer l'historique
   */
  clearHistory: protectedProcedure.mutation(({ ctx }) => {
    const historyService = getExecutionHistoryService();
    historyService.clearHistory(ctx.user.id);

    return {
      success: true,
      message: 'History cleared',
    };
  }),

  /**
   * Créer une souscription webhook
   */
  createWebhookSubscription: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        events: z.array(z.enum(['execution_started', 'execution_completed', 'execution_failed', 'timeout'])),
      })
    )
    .mutation(({ ctx, input }) => {
      const webhookManager = getE2BWebhookManager();
      const subscription = webhookManager.createSubscription(ctx.user.id, input.url, input.events);

      return {
        success: true,
        subscription,
      };
    }),

  /**
   * Obtenir les souscriptions webhooks
   */
  getWebhookSubscriptions: protectedProcedure.query(({ ctx }) => {
    const webhookManager = getE2BWebhookManager();
    const subscriptions = webhookManager.getSubscriptions(ctx.user.id);

    return {
      success: true,
      subscriptions,
    };
  }),

  /**
   * Supprimer une souscription webhook
   */
  deleteWebhookSubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.string() }))
    .mutation(({ ctx, input }) => {
      const webhookManager = getE2BWebhookManager();
      const subscriptions = webhookManager.getSubscriptions(ctx.user.id);

      // Vérifier que la souscription appartient à l'utilisateur
      if (!subscriptions.some(s => s.id === input.subscriptionId)) {
        return {
          success: false,
          error: 'Subscription not found',
        };
      }

      const deleted = webhookManager.deleteSubscription(input.subscriptionId);

      return {
        success: deleted,
        message: deleted ? 'Subscription deleted' : 'Failed to delete subscription',
      };
    }),

  /**
   * Obtenir l'historique des événements webhooks
   */
  getWebhookEventHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(({ ctx, input }) => {
      const webhookManager = getE2BWebhookManager();
      const events = webhookManager.getEventHistory(ctx.user.id, input.limit);

      return {
        success: true,
        events,
      };
    }),

  /**
   * Obtenir les statistiques des webhooks
   */
  getWebhookStatistics: protectedProcedure.query(({ ctx }) => {
    const webhookManager = getE2BWebhookManager();
    const stats = webhookManager.getStatistics(ctx.user.id);

    return {
      success: true,
      stats,
    };
  }),

  /**
   * Obtenir les exécutions similaires
   */
  getSimilarExecutions: protectedProcedure
    .input(z.object({ codeHash: z.string(), limit: z.number().default(5) }))
    .query(({ ctx, input }) => {
      const historyService = getExecutionHistoryService();
      const records = historyService.getSimilarExecutions(ctx.user.id, input.codeHash, input.limit);

      return {
        success: true,
        records,
      };
    }),
});
