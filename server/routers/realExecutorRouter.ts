/**
 * REAL EXECUTOR ROUTER - Procédures tRPC pour l'exécution réelle
 * 
 * Intègre le RealExecutor au système de chat streaming
 */

import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { RealExecutor } from '../phoenix/realExecutor';
import { observable } from '@trpc/server/observable';

export const realExecutorRouter = router({
  /**
   * Exécute du code réel (Python, JavaScript)
   */
  executeCode: protectedProcedure
    .input(z.object({
      code: z.string().min(1),
      language: z.enum(['python', 'javascript', 'shell']),
      context: z.record(z.string(), z.unknown()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await RealExecutor.execute({
          type: 'code',
          language: input.language as 'python' | 'javascript' | 'shell',
          content: input.code,
          userId: ctx.user.id,
          username: ctx.user.name || 'Unknown',
          context: input.context
        });

        return result;
      } catch (error) {
        console.error('[RealExecutorRouter] Erreur:', error);
        return {
          success: false,
          result: '',
          error: String(error),
          executionTime: 0,
          type: 'code' as const
        };
      }
    }),

  /**
   * Recherche web réelle
   */
  searchWeb: protectedProcedure
    .input(z.object({
      query: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await RealExecutor.execute({
          type: 'search',
          content: input.query,
          userId: ctx.user.id,
          username: ctx.user.name || 'Unknown'
        });

        return result;
      } catch (error) {
        console.error('[RealExecutorRouter] Erreur:', error);
        return {
          success: false,
          result: '',
          error: String(error),
          executionTime: 0,
          type: 'search' as const
        };
      }
    }),

  /**
   * Navigation web réelle
   */
  browseWeb: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      objective: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const content = `${input.url}\n${input.objective || 'Extraire les données principales'}`;

        const result = await RealExecutor.execute({
          type: 'browse',
          content,
          userId: ctx.user.id,
          username: ctx.user.name || 'Unknown'
        });

        return result;
      } catch (error) {
        console.error('[RealExecutorRouter] Erreur:', error);
        return {
          success: false,
          result: '',
          error: String(error),
          executionTime: 0,
          type: 'browse' as const
        };
      }
    }),

  /**
   * Génération de code réelle avec exécution
   */
  generateCode: protectedProcedure
    .input(z.object({
      objective: z.string().min(1),
      language: z.enum(['python', 'javascript']).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await RealExecutor.execute({
          type: 'generate',
          language: (input.language || 'python') as 'python' | 'javascript',
          content: input.objective,
          userId: ctx.user.id,
          username: ctx.user.name || 'Unknown'
        });

        return result;
      } catch (error) {
        console.error('[RealExecutorRouter] Erreur:', error);
        return {
          success: false,
          result: '',
          error: String(error),
          executionTime: 0,
          type: 'generate' as const
        };
      }
    }),

  /**
   * Stream d'exécution avec feedback en temps réel
   */
  executeStream: protectedProcedure
    .input(z.object({
      code: z.string().min(1),
      language: z.enum(['python', 'javascript', 'shell']),
      context: z.record(z.string(), z.unknown()).optional()
    }))
    .subscription(({ input, ctx }) => {
      return observable<{
        type: 'status' | 'output' | 'error' | 'complete';
        message: string;
        data?: unknown;
      }>(emit => {
        let isCancelled = false;

        (async () => {
          try {
            emit.next({
              type: 'status',
              message: `Exécution de code ${input.language}...`
            });

            const result = await RealExecutor.execute({
              type: 'code',
              language: input.language as 'python' | 'javascript' | 'shell',
              content: input.code,
              userId: ctx.user.id,
              username: ctx.user.name || 'Unknown',
              context: input.context
            });

            if (isCancelled) return;

            if (result.success) {
              emit.next({
                type: 'output',
                message: result.result,
                data: result.metadata
              });
            } else {
              emit.next({
                type: 'error',
                message: result.error || 'Erreur inconnue',
                data: result.metadata
              });
            }

            emit.next({
              type: 'complete',
              message: `Exécution terminée en ${result.executionTime}ms`
            });

            emit.complete();
          } catch (error) {
            if (!isCancelled) {
              emit.error(error instanceof Error ? error : new Error(String(error)));
            }
          }
        })();

        return () => {
          isCancelled = true;
        };
      });
    }),

  /**
   * Exécute une action basée sur le langage naturel
   */
  executeAction: protectedProcedure
    .input(z.object({
      action: z.string().min(1),
      context: z.record(z.string(), z.unknown()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Déterminer le type d'action basé sur le contenu
        let executionType: 'code' | 'search' | 'browse' | 'generate' = 'code';
        let content = input.action;
        let language: 'python' | 'javascript' | 'shell' = 'python';

        if (input.action.toLowerCase().includes('search') || input.action.toLowerCase().includes('recherche')) {
          executionType = 'search';
          content = input.action.replace(/search|recherche/i, '').trim();
        } else if (input.action.toLowerCase().includes('browse') || input.action.toLowerCase().includes('navigate')) {
          executionType = 'browse';
        } else if (input.action.toLowerCase().includes('generate') || input.action.toLowerCase().includes('créer')) {
          executionType = 'generate';
          if (input.action.toLowerCase().includes('javascript') || input.action.toLowerCase().includes('js')) {
            language = 'javascript';
          }
        }

        const result = await RealExecutor.execute({
          type: executionType,
          language: executionType === 'code' ? language : undefined,
          content,
          userId: ctx.user.id,
          username: ctx.user.name || 'Unknown',
          context: input.context
        });

        return result;
      } catch (error) {
        console.error('[RealExecutorRouter] Erreur:', error);
        return {
          success: false,
          result: '',
          error: String(error),
          executionTime: 0,
          type: 'code' as const
        };
      }
    })
});
