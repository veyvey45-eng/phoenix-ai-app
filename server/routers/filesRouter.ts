/**
 * Files Router - Routes tRPC pour le système de fichiers persistant
 * 
 * Expose les opérations CRUD sur les fichiers et dossiers du workspace
 */

import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { fileSystemManager } from '../phoenix/fileSystemManager';
import { TRPCError } from '@trpc/server';

export const filesRouter = router({
  // ============================================================================
  // FICHIERS
  // ============================================================================

  /**
   * Créer un nouveau fichier
   */
  create: protectedProcedure
    .input(z.object({
      path: z.string().min(1).max(1024),
      content: z.string(),
      mimeType: z.string().optional(),
      language: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const file = await fileSystemManager.createFile({
          userId: ctx.user.id,
          path: input.path,
          content: input.content,
          mimeType: input.mimeType,
          language: input.language
        });
        return { success: true, file };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create file'
        });
      }
    }),

  /**
   * Lire un fichier par ID
   */
  read: protectedProcedure
    .input(z.object({
      fileId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const file = await fileSystemManager.readFile(input.fileId, ctx.user.id);
        return file;
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error instanceof Error ? error.message : 'File not found'
        });
      }
    }),

  /**
   * Lire un fichier par chemin
   */
  readByPath: protectedProcedure
    .input(z.object({
      path: z.string().min(1)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const file = await fileSystemManager.readFileByPath(input.path, ctx.user.id);
        return file;
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error instanceof Error ? error.message : 'File not found'
        });
      }
    }),

  /**
   * Mettre à jour un fichier
   */
  update: protectedProcedure
    .input(z.object({
      fileId: z.string(),
      content: z.string(),
      changeDescription: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const file = await fileSystemManager.updateFile(input.fileId, ctx.user.id, {
          content: input.content,
          changeDescription: input.changeDescription
        });
        return { success: true, file };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update file'
        });
      }
    }),

  /**
   * Supprimer un fichier
   */
  delete: protectedProcedure
    .input(z.object({
      fileId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await fileSystemManager.deleteFile(input.fileId, ctx.user.id);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete file'
        });
      }
    }),

  /**
   * Lister les fichiers dans un dossier
   */
  list: protectedProcedure
    .input(z.object({
      directory: z.string().default('/'),
      recursive: z.boolean().default(false),
      fileType: z.enum(['file', 'directory', 'all']).default('all')
    }))
    .query(async ({ ctx, input }) => {
      try {
        const files = await fileSystemManager.listFiles({
          userId: ctx.user.id,
          directory: input.directory,
          recursive: input.recursive,
          fileType: input.fileType
        });
        return files;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to list files'
        });
      }
    }),

  /**
   * Déplacer/renommer un fichier
   */
  move: protectedProcedure
    .input(z.object({
      fileId: z.string(),
      newPath: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const file = await fileSystemManager.moveFile(input.fileId, ctx.user.id, input.newPath);
        return { success: true, file };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to move file'
        });
      }
    }),

  /**
   * Copier un fichier
   */
  copy: protectedProcedure
    .input(z.object({
      fileId: z.string(),
      newPath: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const file = await fileSystemManager.copyFile(input.fileId, ctx.user.id, input.newPath);
        return { success: true, file };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to copy file'
        });
      }
    }),

  /**
   * Rechercher des fichiers
   */
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      directory: z.string().optional(),
      searchContent: z.boolean().default(false)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const files = await fileSystemManager.searchFiles(ctx.user.id, input.query, {
          directory: input.directory,
          searchContent: input.searchContent
        });
        return files;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to search files'
        });
      }
    }),

  /**
   * Récupérer l'historique d'un fichier
   */
  history: protectedProcedure
    .input(z.object({
      fileId: z.string(),
      limit: z.number().min(1).max(100).default(20)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const history = await fileSystemManager.getFileHistory(input.fileId, ctx.user.id, input.limit);
        return history;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get file history'
        });
      }
    }),

  /**
   * Restaurer une version précédente
   */
  restore: protectedProcedure
    .input(z.object({
      fileId: z.string(),
      version: z.number().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const file = await fileSystemManager.restoreVersion(input.fileId, ctx.user.id, input.version);
        return { success: true, file };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to restore version'
        });
      }
    }),

  // ============================================================================
  // DOSSIERS
  // ============================================================================

  /**
   * Créer un dossier
   */
  createDirectory: protectedProcedure
    .input(z.object({
      path: z.string().min(1).max(1024)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const dir = await fileSystemManager.createDirectory(ctx.user.id, input.path);
        return { success: true, directory: dir };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create directory'
        });
      }
    }),

  /**
   * Supprimer un dossier
   */
  deleteDirectory: protectedProcedure
    .input(z.object({
      path: z.string().min(1),
      recursive: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await fileSystemManager.deleteDirectory(ctx.user.id, input.path, input.recursive);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete directory'
        });
      }
    }),

  // ============================================================================
  // STATISTIQUES
  // ============================================================================

  /**
   * Récupérer les statistiques du workspace
   */
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const stats = await fileSystemManager.getWorkspaceStats(ctx.user.id);
        return stats;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get workspace stats'
        });
      }
    }),

  // ============================================================================
  // UPLOAD/DOWNLOAD
  // ============================================================================

  /**
   * Upload un fichier binaire (via base64)
   */
  upload: protectedProcedure
    .input(z.object({
      path: z.string().min(1).max(1024),
      content: z.string(), // Base64 encoded
      mimeType: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Décoder le base64
        const buffer = Buffer.from(input.content, 'base64');
        const textContent = buffer.toString('utf-8');
        
        const file = await fileSystemManager.createFile({
          userId: ctx.user.id,
          path: input.path,
          content: textContent,
          mimeType: input.mimeType
        });
        return { success: true, file };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to upload file'
        });
      }
    }),

  /**
   * Télécharger un fichier (retourne le contenu)
   */
  download: protectedProcedure
    .input(z.object({
      fileId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const file = await fileSystemManager.readFile(input.fileId, ctx.user.id);
        return {
          name: file.name,
          path: file.path,
          content: file.content,
          mimeType: file.mimeType,
          size: file.size
        };
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error instanceof Error ? error.message : 'File not found'
        });
      }
    })
});

export type FilesRouter = typeof filesRouter;
