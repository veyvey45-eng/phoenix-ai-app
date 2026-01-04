/**
 * Router tRPC pour E2B Sandbox
 * 
 * Endpoints pour exécution de code avec streaming en temps réel
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { getE2BAdapter } from '../phoenix/e2bAdapter';
import { getE2BMonitoring } from '../phoenix/e2bMonitoring';
import { getE2BPersistentVolume } from '../phoenix/e2bPersistentVolume';

export const e2bRouter = router({
  /**
   * Exécuter du code Python
   */
  executePython: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        conversationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const e2bAdapter = getE2BAdapter();
      const monitoring = getE2BMonitoring();
      const userId = String(ctx.user.id);
      const sandboxId = `${userId}-${input.conversationId || 'default'}`;

      try {
        const startTime = Date.now();
        monitoring.recordExecutionStart(userId, 'python');

        const result = await e2bAdapter.executePython(sandboxId, input.code);

        const duration = Date.now() - startTime;
        monitoring.recordExecutionEnd(userId, 'python', result.success, duration);

        return {
          success: result.success,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          duration,
          sandboxId: result.sandboxId,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        monitoring.recordExecutionError(userId, 'python', errorMessage);

        return {
          success: false,
          stdout: '',
          stderr: errorMessage,
          exitCode: 1,
          duration: 0,
        };
      }
    }),

  /**
   * Exécuter du code Node.js
   */
  executeNode: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        conversationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const e2bAdapter = getE2BAdapter();
      const monitoring = getE2BMonitoring();
      const userId = String(ctx.user.id);
      const sandboxId = `${userId}-${input.conversationId || 'default'}`;

      try {
        const startTime = Date.now();
        monitoring.recordExecutionStart(userId, 'node');

        const result = await e2bAdapter.executeNode(sandboxId, input.code);

        const duration = Date.now() - startTime;
        monitoring.recordExecutionEnd(userId, 'node', result.success, duration);

        return {
          success: result.success,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          duration,
          sandboxId: result.sandboxId,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        monitoring.recordExecutionError(userId, 'node', errorMessage);

        return {
          success: false,
          stdout: '',
          stderr: errorMessage,
          exitCode: 1,
          duration: 0,
        };
      }
    }),

  /**
   * Exécuter une commande shell
   */
  executeShell: protectedProcedure
    .input(
      z.object({
        command: z.string(),
        conversationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const e2bAdapter = getE2BAdapter();
      const monitoring = getE2BMonitoring();
      const userId = String(ctx.user.id);
      const sandboxId = `${userId}-${input.conversationId || 'default'}`;

      try {
        const startTime = Date.now();
        monitoring.recordExecutionStart(userId, 'shell');

        const result = await e2bAdapter.executeShell(sandboxId, input.command);

        const duration = Date.now() - startTime;
        monitoring.recordExecutionEnd(userId, 'shell', result.success, duration);

        return {
          success: result.success,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          duration,
          sandboxId: result.sandboxId,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        monitoring.recordExecutionError(userId, 'shell', errorMessage);

        return {
          success: false,
          stdout: '',
          stderr: errorMessage,
          exitCode: 1,
          duration: 0,
        };
      }
    }),

  /**
   * Sauvegarder un fichier dans la sandbox
   */
  writeFile: protectedProcedure
    .input(
      z.object({
        path: z.string(),
        content: z.string(),
        conversationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const e2bAdapter = getE2BAdapter();
      const userId = String(ctx.user.id);
      const sandboxId = `${userId}-${input.conversationId || 'default'}`;

      try {
        const result = await e2bAdapter.writeFile(sandboxId, input.path, input.content);

        return {
          success: result.success,
          path: result.path,
          size: result.size,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          path: input.path,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  /**
   * Lire un fichier de la sandbox
   */
  readFile: protectedProcedure
    .input(
      z.object({
        path: z.string(),
        conversationId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const e2bAdapter = getE2BAdapter();
      const userId = String(ctx.user.id);
      const sandboxId = `${userId}-${input.conversationId || 'default'}`;

      try {
        const result = await e2bAdapter.readFile(sandboxId, input.path);

        return {
          success: result.success,
          path: result.path,
          content: result.content || '',
          size: result.size || 0,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          path: input.path,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  /**
   * Lister les fichiers dans un répertoire
   */
  listFiles: protectedProcedure
    .input(
      z.object({
        path: z.string().default('/'),
        conversationId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const e2bAdapter = getE2BAdapter();
      const userId = String(ctx.user.id);
      const sandboxId = `${userId}-${input.conversationId || 'default'}`;

      try {
        const result = await e2bAdapter.listFiles(sandboxId, input.path);

        return {
          success: result.success,
          path: result.path,
          content: result.content || '',
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          path: input.path,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  /**
   * Obtenir les informations de la sandbox
   */
  getSandboxInfo: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const e2bAdapter = getE2BAdapter();
      const userId = String(ctx.user.id);
      const sandboxId = `${userId}-${input.conversationId || 'default'}`;

      try {
        const info = await e2bAdapter.getSandboxInfo(sandboxId);
        return {
          success: !info.error,
          sandboxId: info.sandboxId,
          isActive: info.isActive,
          createdAt: info.createdAt,
          error: info.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  /**
   * Fermer une sandbox
   */
  closeSandbox: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const e2bAdapter = getE2BAdapter();
      const userId = String(ctx.user.id);
      const sandboxId = `${userId}-${input.conversationId || 'default'}`;

      try {
        const result = await e2bAdapter.closeSandbox(sandboxId);
        return { success: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  /**
   * Obtenir les statistiques d'utilisation
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const e2bAdapter = getE2BAdapter();
    const monitoring = getE2BMonitoring();
    const userId = String(ctx.user.id);

    try {
      const adapterStats = e2bAdapter.getStats();
      const userMetrics = monitoring.getUserMetrics(userId);

      return {
        success: true,
        adapter: adapterStats,
        user: userMetrics,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }),

  /**
   * Obtenir le volume persistant de l'utilisateur
   */
  getPersistentVolume: protectedProcedure.query(async ({ ctx }) => {
    const volume = getE2BPersistentVolume();
    const userId = String(ctx.user.id);

    try {
      const volumeInfo = await volume.getVolumeInfo(userId);
      return {
        success: true,
        ...volumeInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }),

  /**
   * Sauvegarder un fichier dans le volume persistant
   */
  saveToPersistentVolume: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const volume = getE2BPersistentVolume();
      const userId = String(ctx.user.id);

      try {
        const result = await volume.saveFile(userId, input.filename, input.content);
        return {
          success: result.success,
          path: result.path,
          size: result.size || 0,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  /**
   * Lire un fichier du volume persistant
   */
  readFromPersistentVolume: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const volume = getE2BPersistentVolume();
      const userId = String(ctx.user.id);

      try {
        const result = await volume.getFile(userId, input.filename);
        return {
          success: result.success,
          content: '',
          size: result.size || 0,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  /**
   * Lister les fichiers du volume persistant
   */
  listPersistentVolume: protectedProcedure.query(async ({ ctx }) => {
    const volume = getE2BPersistentVolume();
    const userId = String(ctx.user.id);

    try {
      const files = await volume.listFiles(userId);
      return {
        success: true,
        files,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }),
});
