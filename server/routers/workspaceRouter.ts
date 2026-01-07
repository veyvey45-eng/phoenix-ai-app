/**
 * Workspace Router - API tRPC pour le système de fichiers persistant
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createWorkspaceFile,
  readWorkspaceFile,
  editWorkspaceFile,
  deleteWorkspaceFile,
  listWorkspaceFiles,
  createWorkspaceDirectory,
  workspaceFileExists,
  getWorkspaceFileHistory,
  moveWorkspaceFile,
} from "../workspaceDb";

export const workspaceRouter = router({
  /**
   * Créer un nouveau fichier
   */
  createFile: protectedProcedure
    .input(z.object({
      path: z.string().min(1, "Le chemin est requis"),
      content: z.string().default(""),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await createWorkspaceFile(
        ctx.user.id,
        input.path,
        input.content,
        { modifiedBy: 'user' }
      );
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return {
        success: true,
        file: result.file,
        message: `Fichier créé: ${input.path}`,
      };
    }),

  /**
   * Lire un fichier
   */
  readFile: protectedProcedure
    .input(z.object({
      path: z.string().min(1, "Le chemin est requis"),
    }))
    .query(async ({ ctx, input }) => {
      const result = await readWorkspaceFile(ctx.user.id, input.path);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return {
        success: true,
        file: result.file,
        content: result.content,
      };
    }),

  /**
   * Éditer un fichier existant
   */
  editFile: protectedProcedure
    .input(z.object({
      path: z.string().min(1, "Le chemin est requis"),
      content: z.string(),
      changeDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await editWorkspaceFile(
        ctx.user.id,
        input.path,
        input.content,
        {
          modifiedBy: 'user',
          changeDescription: input.changeDescription,
        }
      );
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return {
        success: true,
        file: result.file,
        message: `Fichier modifié: ${input.path}`,
      };
    }),

  /**
   * Supprimer un fichier
   */
  deleteFile: protectedProcedure
    .input(z.object({
      path: z.string().min(1, "Le chemin est requis"),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await deleteWorkspaceFile(
        ctx.user.id,
        input.path,
        { modifiedBy: 'user' }
      );
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return {
        success: true,
        message: `Fichier supprimé: ${input.path}`,
      };
    }),

  /**
   * Lister les fichiers
   */
  listFiles: protectedProcedure
    .input(z.object({
      path: z.string().optional(),
      recursive: z.boolean().optional().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const result = await listWorkspaceFiles(ctx.user.id, {
        path: input.path,
        recursive: input.recursive,
      });
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return {
        success: true,
        files: result.files || [],
        count: result.files?.length || 0,
      };
    }),

  /**
   * Créer un répertoire
   */
  createDirectory: protectedProcedure
    .input(z.object({
      path: z.string().min(1, "Le chemin est requis"),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await createWorkspaceDirectory(ctx.user.id, input.path);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return {
        success: true,
        file: result.file,
        message: `Répertoire créé: ${input.path}`,
      };
    }),

  /**
   * Vérifier si un fichier existe
   */
  fileExists: protectedProcedure
    .input(z.object({
      path: z.string().min(1, "Le chemin est requis"),
    }))
    .query(async ({ ctx, input }) => {
      const exists = await workspaceFileExists(ctx.user.id, input.path);
      return { exists };
    }),

  /**
   * Obtenir l'historique d'un fichier
   */
  getHistory: protectedProcedure
    .input(z.object({
      path: z.string().min(1, "Le chemin est requis"),
    }))
    .query(async ({ ctx, input }) => {
      const result = await getWorkspaceFileHistory(ctx.user.id, input.path);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return {
        success: true,
        history: result.history || [],
      };
    }),

  /**
   * Renommer/déplacer un fichier
   */
  moveFile: protectedProcedure
    .input(z.object({
      oldPath: z.string().min(1, "L'ancien chemin est requis"),
      newPath: z.string().min(1, "Le nouveau chemin est requis"),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await moveWorkspaceFile(
        ctx.user.id,
        input.oldPath,
        input.newPath,
        { modifiedBy: 'user' }
      );
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return {
        success: true,
        file: result.file,
        message: `Fichier déplacé: ${input.oldPath} → ${input.newPath}`,
      };
    }),

  /**
   * Obtenir les statistiques du workspace
   */
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const result = await listWorkspaceFiles(ctx.user.id, { recursive: true });
      
      if (!result.success) {
        return {
          totalFiles: 0,
          totalDirectories: 0,
          totalSize: 0,
        };
      }
      
      const files = result.files || [];
      const totalFiles = files.filter(f => f.fileType === 'file').length;
      const totalDirectories = files.filter(f => f.fileType === 'directory').length;
      const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
      
      return {
        totalFiles,
        totalDirectories,
        totalSize,
        files: files.slice(0, 100), // Limiter à 100 fichiers pour la preview
      };
    }),
});

export type WorkspaceRouter = typeof workspaceRouter;
