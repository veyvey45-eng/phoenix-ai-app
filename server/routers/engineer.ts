/**
 * Router tRPC pour Engineer Module
 * 
 * Endpoints pour générer des pages, des projets, déployer et monitorer
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { getEngineerModule } from '../phoenix/engineerModule';

export const engineerRouter = router({
  /**
   * Obtenir les capacités de Phoenix Engineer
   */
  getCapabilities: publicProcedure.query(async () => {
    const engineer = getEngineerModule();
    return engineer.getCapabilities();
  }),

  /**
   * Générer une page web
   */
  generateWebPage: protectedProcedure
    .input(
      z.object({
        description: z.string(),
        pageType: z.enum(['landing', 'dashboard', 'blog', 'ecommerce', 'portfolio', 'custom']),
        colorScheme: z.enum(['light', 'dark', 'auto']).optional(),
        components: z.array(z.string()).optional(),
        sections: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const engineer = getEngineerModule();
        const page = await engineer.generateWebPage({
          description: input.description,
          pageType: input.pageType,
          colorScheme: input.colorScheme,
          components: input.components,
          sections: input.sections,
        });

        return {
          success: true,
          page,
          message: 'Page generated successfully'
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
          message: 'Failed to generate page'
        };
      }
    }),

  /**
   * Générer un projet complet
   */
  generateProject: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string(),
        projectType: z.enum(['react-app', 'next-app', 'express-api', 'full-stack', 'static-site']),
        features: z.array(z.string()).optional(),
        database: z.enum(['none', 'postgresql', 'mongodb', 'sqlite']).optional(),
        authentication: z.boolean().optional(),
        styling: z.enum(['tailwind', 'bootstrap', 'material-ui', 'none']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const engineer = getEngineerModule();
        const project = await engineer.generateProject({
          name: input.name,
          description: input.description,
          projectType: input.projectType,
          features: input.features,
          database: input.database,
          authentication: input.authentication,
          styling: input.styling,
        });

        return {
          success: true,
          project,
          message: 'Project generated successfully'
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
          message: 'Failed to generate project'
        };
      }
    }),

  /**
   * Installer les dépendances
   */
  installDependencies: protectedProcedure
    .input(
      z.object({
        projectPath: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const engineer = getEngineerModule();
        const result = await engineer.installDependencies(input.projectPath);

        return {
          success: result.success,
          result,
          message: result.success ? 'Dependencies installed' : 'Installation failed'
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
          message: 'Failed to install dependencies'
        };
      }
    }),

  /**
   * Déployer une application
   */
  deployApplication: protectedProcedure
    .input(
      z.object({
        projectPath: z.string(),
        projectName: z.string(),
        platform: z.enum(['manus', 'vercel', 'netlify', 'railway', 'render', 'heroku']),
        environment: z.enum(['development', 'staging', 'production']),
        buildCommand: z.string().optional(),
        startCommand: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const engineer = getEngineerModule();
        const result = await engineer.deployApplication({
          projectPath: input.projectPath,
          projectName: input.projectName,
          platform: input.platform,
          environment: input.environment,
          buildCommand: input.buildCommand,
          startCommand: input.startCommand,
        });

        return {
          success: result.success,
          result,
          message: result.success ? 'Application deployed' : 'Deployment failed'
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
          message: 'Failed to deploy application'
        };
      }
    }),

  /**
   * Obtenir le dashboard de monitoring
   */
  getMonitoringDashboard: protectedProcedure
    .input(
      z.object({
        period: z.enum(['hour', 'day', 'week', 'month']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const engineer = getEngineerModule();
        const dashboard = engineer.getMonitoringDashboard(input.period || 'hour');

        return {
          success: true,
          dashboard,
          message: 'Dashboard retrieved'
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
          message: 'Failed to retrieve dashboard'
        };
      }
    }),

  /**
   * Obtenir l'état d'une tâche
   */
  getTaskStatus: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const engineer = getEngineerModule();
        const task = engineer.getTaskStatus(input.taskId);

        return {
          success: true,
          task,
          message: 'Task status retrieved'
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
          message: 'Failed to retrieve task status'
        };
      }
    }),

  /**
   * Obtenir toutes les tâches
   */
  getAllTasks: protectedProcedure.query(async ({ ctx }) => {
    try {
      const engineer = getEngineerModule();
      const tasks = engineer.getAllTasks();

      return {
        success: true,
        tasks,
        message: 'All tasks retrieved'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        message: 'Failed to retrieve tasks'
      };
    }
  }),
});
