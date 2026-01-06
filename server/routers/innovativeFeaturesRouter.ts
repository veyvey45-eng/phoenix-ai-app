/**
 * Innovative Features Router
 * Endpoints tRPC pour les fonctionnalités innovantes de Phoenix
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import {
  detectFeature,
  getAvailableFeaturesInfo,
  generateSmartSuggestions,
} from '../phoenix/innovativeFeatures';
import {
  conductDeepResearch,
  quickResearch,
  formatReportAsMarkdown,
} from '../phoenix/deepResearch';
import {
  generateDocument,
  detectDocumentRequest,
} from '../phoenix/documentGenerator';
import {
  composeEmail,
  summarizeEmail,
  improveEmail,
  generateResponseSuggestions,
} from '../phoenix/emailAssistant';
import {
  generateImageFromPrompt,
  detectImageRequest,
  getAvailableStyles,
} from '../phoenix/imageGeneratorPhoenix';
import {
  createTaskPlan,
  executeTaskPlan,
} from '../phoenix/taskAgent';

export const innovativeFeaturesRouter = router({
  // ============================================================================
  // DÉTECTION DE FONCTIONNALITÉS
  // ============================================================================
  
  detectFeature: publicProcedure
    .input(z.object({ message: z.string() }))
    .query(({ input }) => {
      return detectFeature(input.message);
    }),

  getAvailableFeatures: publicProcedure
    .query(() => {
      return getAvailableFeaturesInfo();
    }),

  getSuggestions: publicProcedure
    .input(z.object({ message: z.string() }))
    .query(({ input }) => {
      return generateSmartSuggestions(input.message);
    }),

  // ============================================================================
  // DEEP RESEARCH
  // ============================================================================
  
  deepResearch: protectedProcedure
    .input(z.object({
      topic: z.string(),
      depth: z.enum(['quick', 'standard', 'deep']).default('standard'),
      language: z.string().default('fr'),
    }))
    .mutation(async ({ input }) => {
      const report = await conductDeepResearch({
        topic: input.topic,
        depth: input.depth,
        language: input.language,
      });
      return {
        report,
        markdown: formatReportAsMarkdown(report),
      };
    }),

  quickResearch: publicProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input }) => {
      return await quickResearch(input.query);
    }),

  // ============================================================================
  // GÉNÉRATION DE DOCUMENTS
  // ============================================================================
  
  generateDocument: protectedProcedure
    .input(z.object({
      type: z.enum(['pptx', 'xlsx', 'pdf', 'docx', 'markdown']),
      title: z.string(),
      topic: z.string().optional(),
      language: z.string().default('fr'),
    }))
    .mutation(async ({ input }) => {
      return await generateDocument({
        type: input.type,
        title: input.title,
        topic: input.topic,
        language: input.language,
      });
    }),

  detectDocumentType: publicProcedure
    .input(z.object({ message: z.string() }))
    .query(({ input }) => {
      return detectDocumentRequest(input.message);
    }),

  // ============================================================================
  // ASSISTANT EMAIL
  // ============================================================================
  
  composeEmail: protectedProcedure
    .input(z.object({
      topic: z.string(),
      purpose: z.enum(['professional', 'personal', 'sales', 'support', 'follow-up', 'introduction']).default('professional'),
      tone: z.enum(['formal', 'friendly', 'casual', 'urgent', 'apologetic', 'grateful']).default('formal'),
      recipient: z.string().optional(),
      additionalInstructions: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await composeEmail(input.topic, {
        purpose: input.purpose,
        tone: input.tone,
        recipient: input.recipient,
      }, input.additionalInstructions);
    }),

  summarizeEmail: protectedProcedure
    .input(z.object({ emailContent: z.string() }))
    .mutation(async ({ input }) => {
      return await summarizeEmail(input.emailContent);
    }),

  improveEmail: protectedProcedure
    .input(z.object({ email: z.string() }))
    .mutation(async ({ input }) => {
      return await improveEmail(input.email);
    }),

  suggestResponses: protectedProcedure
    .input(z.object({ originalEmail: z.string() }))
    .mutation(async ({ input }) => {
      return await generateResponseSuggestions(input.originalEmail);
    }),

  // ============================================================================
  // GÉNÉRATION D'IMAGES
  // ============================================================================
  
  generateImage: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      style: z.enum([
        'realistic', 'artistic', 'cartoon', 'anime', 'watercolor',
        'oil-painting', 'digital-art', 'sketch', 'minimalist',
        '3d-render', 'photography', 'cinematic'
      ]).default('realistic'),
    }))
    .mutation(async ({ input }) => {
      return await generateImageFromPrompt({
        prompt: input.prompt,
        style: input.style,
      });
    }),

  detectImageStyle: publicProcedure
    .input(z.object({ message: z.string() }))
    .query(({ input }) => {
      return detectImageRequest(input.message);
    }),

  getImageStyles: publicProcedure
    .query(() => {
      return getAvailableStyles();
    }),

  // ============================================================================
  // AGENT DE TÂCHES
  // ============================================================================
  
  createTaskPlan: protectedProcedure
    .input(z.object({ objective: z.string() }))
    .mutation(async ({ input }) => {
      return await createTaskPlan(input.objective);
    }),

  executeTaskPlan: protectedProcedure
    .input(z.object({
      planId: z.string(),
      objective: z.string(),
      steps: z.array(z.object({
        id: z.string(),
        description: z.string(),
        type: z.enum(['research', 'code', 'document', 'email', 'image', 'analysis', 'custom']),
        dependencies: z.array(z.string()),
        status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
      })),
    }))
    .mutation(async ({ input }) => {
      const plan = {
        id: input.planId,
        objective: input.objective,
        steps: input.steps,
        status: 'pending' as const,
        createdAt: new Date(),
        results: [],
      };
      return await executeTaskPlan(plan);
    }),

  // ============================================================================
  // AUTO-EXÉCUTION
  // ============================================================================
  
  autoExecute: protectedProcedure
    .input(z.object({ message: z.string() }))
    .mutation(async ({ input }) => {
      const detected = detectFeature(input.message);
      
      if (!detected.feature) {
        return { executed: false, feature: null, result: null };
      }

      let result: unknown = null;

      switch (detected.feature) {
        case 'deep_research':
          const researchResult = await conductDeepResearch({
            topic: input.message,
            depth: (detected.metadata?.depth as 'quick' | 'standard' | 'deep') || 'standard',
          });
          result = { report: researchResult, markdown: formatReportAsMarkdown(researchResult) };
          break;

        case 'document_generation':
          const docType = detected.metadata?.type as 'pptx' | 'xlsx' | 'pdf' | 'docx' | 'markdown';
          result = await generateDocument({
            type: docType || 'markdown',
            title: (detected.metadata?.topic as string) || 'Document',
            topic: detected.metadata?.topic as string,
          });
          break;

        case 'email_compose':
          result = await composeEmail(input.message, {
            purpose: 'professional',
            tone: 'formal',
          });
          break;

        case 'image_generation':
          result = await generateImageFromPrompt({
            prompt: (detected.metadata?.prompt as string) || input.message,
            style: (detected.metadata?.style as 'realistic') || 'realistic',
          });
          break;

        case 'task_agent':
          result = await createTaskPlan(input.message);
          break;

        default:
          return { executed: false, feature: detected.feature, result: null };
      }

      return { executed: true, feature: detected.feature, result };
    }),
});
