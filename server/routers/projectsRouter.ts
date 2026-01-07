/**
 * Projects Router
 * 
 * Endpoints tRPC pour la gestion des projets Phoenix persistants.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Sandbox } from "e2b";
import {
  createProject,
  getProject,
  getUserProjects,
  updateProject,
  archiveProject,
  getProjectFiles,
  getProjectFile,
  saveProjectFile,
  deleteProjectFile,
  syncFromSandbox,
  syncToSandbox,
  createSnapshot,
  restoreFromSnapshot,
  getProjectSnapshots,
  exportProjectAsJson,
  startAutoSave,
  stopAutoSave,
  saveProjectNow,
} from "../phoenix/projectPersistence";

// Map pour stocker les sandboxes actifs par projet
const activeSandboxes = new Map<number, { sandbox: Sandbox; projectPath: string }>();

export const projectsRouter = router({
  // ============================================================================
  // Project CRUD
  // ============================================================================
  
  /**
   * Crée un nouveau projet
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      projectType: z.enum(["static", "nodejs", "python", "react", "nextjs", "other"]).default("static"),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await createProject(
        ctx.user.id,
        input.name,
        input.projectType,
        input.description
      );
      
      if (!project) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create project",
        });
      }
      
      return project;
    }),
  
  /**
   * Récupère un projet par son ID
   */
  get: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      // Vérifier que l'utilisateur est le propriétaire
      if (project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this project",
        });
      }
      
      return project;
    }),
  
  /**
   * Liste tous les projets de l'utilisateur
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getUserProjects(ctx.user.id);
  }),
  
  /**
   * Met à jour un projet
   */
  update: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      await updateProject(input.projectId, {
        name: input.name,
        description: input.description,
      });
      
      return { success: true };
    }),
  
  /**
   * Archive un projet (soft delete)
   */
  archive: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      // Arrêter le sandbox si actif
      const active = activeSandboxes.get(input.projectId);
      if (active) {
        stopAutoSave(input.projectId);
        await active.sandbox.kill();
        activeSandboxes.delete(input.projectId);
      }
      
      await archiveProject(input.projectId, ctx.user.id);
      
      return { success: true };
    }),
  
  // ============================================================================
  // Files
  // ============================================================================
  
  /**
   * Liste les fichiers d'un projet
   */
  listFiles: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      const files = await getProjectFiles(input.projectId);
      
      return files.map(f => ({
        id: f.id,
        path: f.path,
        mimeType: f.mimeType,
        size: f.size,
        version: f.version,
        updatedAt: f.updatedAt,
      }));
    }),
  
  /**
   * Récupère le contenu d'un fichier
   */
  getFile: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      path: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      const file = await getProjectFile(input.projectId, input.path);
      
      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found",
        });
      }
      
      return file;
    }),
  
  // ============================================================================
  // Sandbox & Preview
  // ============================================================================
  
  /**
   * Démarre un sandbox pour un projet et restaure les fichiers
   */
  startSandbox: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      // Vérifier si un sandbox est déjà actif
      const existing = activeSandboxes.get(input.projectId);
      if (existing) {
        return {
          sandboxId: existing.sandbox.sandboxId,
          projectPath: existing.projectPath,
          message: "Sandbox already running",
        };
      }
      
      // Créer un nouveau sandbox
      const sandbox = await Sandbox.create({
        apiKey: process.env.E2B_API_KEY,
        timeoutMs: 30 * 60 * 1000, // 30 minutes
      });
      
      const projectPath = `/home/user/projects/${project.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
      
      // Restaurer les fichiers depuis la base de données
      const syncResult = await syncToSandbox(input.projectId, sandbox, projectPath);
      
      if (!syncResult.success) {
        await sandbox.kill();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to restore files: ${syncResult.error}`,
        });
      }
      
      // Stocker le sandbox actif
      activeSandboxes.set(input.projectId, { sandbox, projectPath });
      
      // Démarrer la sauvegarde automatique
      startAutoSave(input.projectId, sandbox, projectPath);
      
      // Mettre à jour le projet
      await updateProject(input.projectId, {
        sandboxId: sandbox.sandboxId,
        sandboxExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      
      return {
        sandboxId: sandbox.sandboxId,
        projectPath,
        filesRestored: syncResult.filesAdded,
        message: "Sandbox started and files restored",
      };
    }),
  
  /**
   * Arrête le sandbox d'un projet et sauvegarde les fichiers
   */
  stopSandbox: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      const active = activeSandboxes.get(input.projectId);
      if (!active) {
        return {
          success: true,
          message: "No active sandbox",
        };
      }
      
      // Sauvegarder les fichiers avant d'arrêter
      const saveResult = await saveProjectNow(input.projectId, active.sandbox, active.projectPath);
      
      // Arrêter le sandbox
      await active.sandbox.kill();
      activeSandboxes.delete(input.projectId);
      
      // Mettre à jour le projet
      await updateProject(input.projectId, {
        sandboxId: null,
        sandboxExpiresAt: null,
        isPreviewActive: false,
        previewUrl: null,
      });
      
      return {
        success: true,
        filesSaved: saveResult.filesAdded + saveResult.filesUpdated,
        message: "Sandbox stopped and files saved",
      };
    }),
  
  /**
   * Démarre le preview d'un projet
   */
  startPreview: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      port: z.number().default(8080),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      const active = activeSandboxes.get(input.projectId);
      if (!active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active sandbox. Start sandbox first.",
        });
      }
      
      // Démarrer un serveur HTTP selon le type de projet
      let serverCommand: string;
      
      switch (project.projectType) {
        case "nodejs":
          serverCommand = `cd ${active.projectPath} && npm install && npm start`;
          break;
        case "python":
          serverCommand = `cd ${active.projectPath} && python -m http.server ${input.port}`;
          break;
        case "react":
        case "nextjs":
          serverCommand = `cd ${active.projectPath} && npm install && npm run dev -- --port ${input.port}`;
          break;
        default:
          serverCommand = `cd ${active.projectPath} && python -m http.server ${input.port}`;
      }
      
      // Démarrer le serveur en arrière-plan
      await active.sandbox.commands.run(`nohup ${serverCommand} > /tmp/server.log 2>&1 &`);
      
      // Attendre que le serveur démarre
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Obtenir l'URL publique
      const previewUrl = `https://${input.port}-${active.sandbox.sandboxId}.e2b.app`;
      
      // Mettre à jour le projet
      await updateProject(input.projectId, {
        previewUrl,
        previewPort: input.port,
        isPreviewActive: true,
      });
      
      return {
        previewUrl,
        port: input.port,
        message: "Preview started",
      };
    }),
  
  // ============================================================================
  // Snapshots
  // ============================================================================
  
  /**
   * Crée un snapshot du projet
   */
  createSnapshot: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      // Si un sandbox est actif, sauvegarder d'abord
      const active = activeSandboxes.get(input.projectId);
      if (active) {
        await syncFromSandbox(input.projectId, active.sandbox, active.projectPath);
      }
      
      const snapshotId = await createSnapshot(input.projectId, input.name, input.description);
      
      if (!snapshotId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create snapshot",
        });
      }
      
      return { snapshotId };
    }),
  
  /**
   * Liste les snapshots d'un projet
   */
  listSnapshots: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      return getProjectSnapshots(input.projectId);
    }),
  
  /**
   * Restaure un projet depuis un snapshot
   */
  restoreSnapshot: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      snapshotId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      const success = await restoreFromSnapshot(input.projectId, input.snapshotId);
      
      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to restore snapshot",
        });
      }
      
      // Si un sandbox est actif, restaurer les fichiers
      const active = activeSandboxes.get(input.projectId);
      if (active) {
        await syncToSandbox(input.projectId, active.sandbox, active.projectPath);
      }
      
      return { success: true };
    }),
  
  // ============================================================================
  // Export
  // ============================================================================
  
  /**
   * Exporte un projet en JSON
   */
  export: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      // Si un sandbox est actif, sauvegarder d'abord
      const active = activeSandboxes.get(input.projectId);
      if (active) {
        await syncFromSandbox(input.projectId, active.sandbox, active.projectPath);
      }
      
      const exportData = await exportProjectAsJson(input.projectId);
      
      if (!exportData) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export project",
        });
      }
      
      return exportData;
    }),
  
  // ============================================================================
  // Sync
  // ============================================================================
  
  /**
   * Force la synchronisation des fichiers du sandbox vers la DB
   */
  syncToDb: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      const active = activeSandboxes.get(input.projectId);
      if (!active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active sandbox",
        });
      }
      
      const result = await syncFromSandbox(input.projectId, active.sandbox, active.projectPath);
      
      return {
        success: result.success,
        filesAdded: result.filesAdded,
        filesUpdated: result.filesUpdated,
        totalSize: result.totalSize,
        error: result.error,
      };
    }),
  
  /**
   * Vérifie le statut du sandbox d'un projet
   */
  getSandboxStatus: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      const active = activeSandboxes.get(input.projectId);
      
      return {
        isActive: !!active,
        sandboxId: active?.sandbox.sandboxId || project.sandboxId,
        projectPath: active?.projectPath,
        previewUrl: project.previewUrl,
        isPreviewActive: project.isPreviewActive,
        expiresAt: project.sandboxExpiresAt,
      };
    }),
});
