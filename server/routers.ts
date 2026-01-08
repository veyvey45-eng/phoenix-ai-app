import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { randomUUID } from "crypto";
import { phoenix, PhoenixContext, MemoryContext, IssueContext, CriteriaContext } from "./phoenix/core";
import { getMemoryStore } from './phoenix/vectraMemory';
import { getSleepModule } from './phoenix/sleepModule';
import { getToolsEngine, ToolCall } from './phoenix/tools';
import { getFileProcessor } from './phoenix/fileProcessor';
import { openweatherApi } from './phoenix/openweatherApi';
import { groqApi } from './phoenix/groqApi';
import { serperApi } from './phoenix/serperApi';
import { getMemorySyncModule } from './phoenix/memorySync';
import { getArbitrator } from './phoenix/arbitrage';
import { getActionEngine } from './phoenix/actionEngine';
import { getReporter } from './phoenix/reporter';
import { getRenaissance } from './phoenix/renaissance';
import { getCommunication } from './phoenix/communication';
import { getOptimizer } from './phoenix/optimizer';
import { getSecurity } from './phoenix/security';
import { getEvolutionInstance } from './phoenix/evolution';
import { contextEnricher } from './phoenix/contextEnricher';
import { processPhoenixQuery } from './phoenix/phoenixSimple';
import { e2bSandbox } from './phoenix/e2bSandbox';
import { streamingRouter } from './routers/streamingRouter';
import { codeInterpreterRouter } from './routers/codeInterpreterRouter';
import { stripeRouter } from './routers/stripe';
import { e2bRouter } from './routers/e2b';
import { e2bHistoryRouter } from './routers/e2bHistory';
import { engineerRouter } from './routers/engineer';
import { autonomousAgentRouter } from './routers/autonomousAgentRouter';
import { realExecutorRouter } from './routers/realExecutorRouter';
import { cryptoExpertRouter } from './routers/cryptoExpertRouter';
import { innovativeFeaturesRouter } from './routers/innovativeFeaturesRouter';
import { mcpBridgeRouter } from './routers/mcpBridgeRouter';
import { agentRouter } from './routers/agentRouter';
import { workspaceRouter } from './routers/workspaceRouter';
import { projectsRouter } from './routers/projectsRouter';
import { hostedSitesRouter } from './routers/hostedSitesRouter';
import { persistentAgentRouter } from './routers/persistentAgentRouter';
import { filesRouter } from './routers/filesRouter';
import { synthesizeSpeech, checkTTSAvailability, splitTextForTTS, TTSVoice, TTSFormat } from './_core/tts';
import {
  createUtterance,
  getUtterancesByContext,
  getRecentUtterances,
  createDecision,
  getDecisionsByUser,
  createIssue,
  getActiveIssues,
  updateIssueStatus,
  getIssueStats,
  createMemory,
  getMemoriesByUser,
  updateMemoryUsage,
  createActionRequest,
  updateActionRequestStatus,
  getPendingActionRequests,
  createActionResult,
  getActiveCriteria,
  initializeDefaultCriteria,
  getOrCreatePhoenixState,
  updatePhoenixState,
  logAuditEvent,
  getAuditLog,
  createConversation,
  getConversationsByUser,
  getConversationByContextId,
  isUserAdmin,
  promoteToAdmin,
  logAdminAction,
  getAdminAuditLog,
  initializeModuleConfigs,
  getModuleConfigs,
  updateModuleConfig,
  initializeSensitiveValidations,
  getSensitiveValidations,
  updateSensitiveValidation,
  createApprovalRequest,
  getPendingApprovals,
  processApprovalRequest,
  getApprovalHistory,
  updateConversation,
  getConversationById,
  deleteConversation,
  getConversationMessages,
  saveConversationMessage,
  getOrCreateConversationForUser
} from "./db";

export const appRouter = router({
  system: systemRouter,
  codeInterpreter: codeInterpreterRouter,
  stripe: stripeRouter,
  e2b: e2bRouter,
  e2bHistory: e2bHistoryRouter,
  engineer: engineerRouter,
  autonomousAgent: autonomousAgentRouter,
  realExecutor: realExecutorRouter,
  cryptoExpert: cryptoExpertRouter,
  innovative: innovativeFeaturesRouter,
  mcpBridge: mcpBridgeRouter,
  agent: agentRouter,
  workspace: workspaceRouter,
  projects: projectsRouter,
  hostedSites: hostedSitesRouter,
  persistentAgent: persistentAgentRouter,
  persistentFiles: filesRouter,  // Système de fichiers persistant (comme Manus)
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================================================
  // PHOENIX CORE - Main orchestration endpoints
  // ============================================================================
  
  phoenix: router({
    /**
     * Process a user message through the Phoenix orchestrator
     * Implements the "penser vs agir" separation
     */
    chat: protectedProcedure
      .input(z.object({
        message: z.string().min(1),
        contextId: z.string().optional(),
        fastMode: z.boolean().optional().default(false),
        uploadedFileIds: z.array(z.string()).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const contextId = input.contextId || randomUUID();

        // Initialize criteria if needed
        await initializeDefaultCriteria();

        // Get or create Phoenix state
        const state = await getOrCreatePhoenixState(userId);

        // Build context
        const memories = await getMemoriesByUser(userId, 50);
        const recentUtterances = await getRecentUtterances(userId, 10);
        const activeIssues = await getActiveIssues(userId);
        const criteriaList = await getActiveCriteria();

        const phoenixContext: PhoenixContext = {
          userId,
          contextId,
          memories: memories.map(m => ({
            id: m.id,
            content: m.content,
            salience: m.salience ?? 0.5,
            memoryType: m.memoryType
          })),
          recentUtterances: recentUtterances.map(u => ({
            role: u.role,
            content: u.content,
            confidence: u.confidence ?? 1.0
          })),
          activeIssues: activeIssues.map(i => ({
            id: i.id,
            type: i.type,
            severity: i.severity,
            evidence: i.evidence
          })),
          tormentScore: state.tormentScore,
          criteria: criteriaList.map(c => ({
            name: c.name,
            level: c.level,
            rule: c.rule,
            weight: c.weight
          }))
        };

        // Store user utterance
        const userUtterance = await createUtterance({
          role: "user",
          content: input.message,
          contextId,
          confidence: 1.0,
          userId
        });

        // Log audit event
        await logAuditEvent({
          eventType: "utterance_created",
          entityType: "utterance",
          entityId: userUtterance?.id || 0,
          details: { role: "user", contextId },
          userId
        });

        // Enrichir le contexte avec des données Internet si nécessaire
        const enrichment = await contextEnricher.enrichContext(input.message, userId.toString());
        console.log(`[Phoenix] Enrichissement Internet: ${enrichment.needsInternet ? enrichment.category : 'non requis'}`);

        // Extract text from uploaded files if provided
        let documentContext = '';
        if (input.uploadedFileIds && input.uploadedFileIds.length > 0) {
          const processor = getFileProcessor();
          const documentTexts: string[] = [];
          for (const fileId of input.uploadedFileIds) {
            const file = await processor.getFile(fileId);
            if (file && file.userId === userId && file.extractedText) {
              documentTexts.push(`[Document: ${file.originalName}]\n${file.extractedText}`);
            }
          }
          if (documentTexts.length > 0) {
            documentContext = `\n\n=== DOCUMENTS FOURNIS ===\n${documentTexts.join('\n\n=== FIN DOCUMENT ===\n')}`;
            console.log(`[Phoenix] ${documentTexts.length} document(s) charges pour analyse`);
          }
        }
        const messageWithDocuments = input.message + documentContext;

        // Ajouter les données d'enrichissement Internet au message
        let finalMessage = messageWithDocuments;
        if (enrichment.needsInternet && enrichment.enrichedContext) {
          finalMessage += `\n\n=== DONNÉES INTERNET ===\n${enrichment.enrichedContext}\n=== FIN DONNÉES ===`;
          console.log(`[Phoenix] Données Internet ajoutées au message (catégorie: ${enrichment.category})`);
        }

        // Process through Phoenix Simple (100% fonctionnel)
        const conversationHistory = recentUtterances.map(u => ({
          role: u.role as 'user' | 'assistant',
          content: u.content
        }));
        
        const phoenixResponse = await processPhoenixQuery(
          finalMessage,
          conversationHistory
        );
        
        const decision = {
          hypotheses: [{
            id: 'hyp_1',
            content: phoenixResponse.content,
            confidence: phoenixResponse.confidence,
            reasoning: 'Phoenix Simple',
            sources: phoenixResponse.sources || []
          }],
          chosen: {
            id: 'hyp_1',
            content: phoenixResponse.content,
            confidence: phoenixResponse.confidence,
            reasoning: 'Phoenix Simple',
            sources: phoenixResponse.sources || []
          },
          rationale: 'Traite par Phoenix Simple',
          tormentBefore: state.tormentScore,
          tormentAfter: state.tormentScore,
          actionRequest: null
        };

        // Store the decision
        const storedDecision = await createDecision({
          options: decision.hypotheses.map(h => ({
            id: h.id,
            content: h.content,
            score: h.confidence
          })),
          chosen: decision.chosen.id,
          rationale: decision.rationale,
          criteriaSnapshot: criteriaList.reduce((acc, c) => ({ ...acc, [c.name]: c.weight }), {}),
          tormentBefore: decision.tormentBefore,
          tormentAfter: decision.tormentAfter,
          contextId,
          userId
        });

        // Log decision
        await logAuditEvent({
          eventType: "decision_made",
          entityType: "decision",
          entityId: storedDecision?.id || 0,
          details: {
            hypothesesCount: decision.hypotheses.length,
            chosenId: decision.chosen.id,
            tormentChange: decision.tormentAfter - decision.tormentBefore
          },
          userId
        });

        // Store assistant utterance
        const assistantUtterance = await createUtterance({
          role: "assistant",
          content: decision.chosen.content,
          contextId,
          confidence: decision.chosen.confidence,
          sources: decision.chosen.sources,
          decisionId: storedDecision?.id,
          userId
        });

        // Store as memory if high confidence
        if (decision.chosen.confidence > 0.8) {
          const embedding = phoenix.computeEmbedding(decision.chosen.content);
          const salience = phoenix.computeSalience(decision.chosen.content, phoenixContext);
          
          await createMemory({
            content: decision.chosen.content,
            embedding,
            tags: ["conversation", contextId],
            salience,
            provenance: `conversation:${contextId}`,
            memoryType: decision.chosen.confidence > 0.9 ? "fact" : "hypothesis",
            userId
          });

          await logAuditEvent({
            eventType: "memory_stored",
            entityType: "memory",
            entityId: 0,
            details: { salience, memoryType: decision.chosen.confidence > 0.9 ? "fact" : "hypothesis" },
            userId
          });
        }

        // Update Phoenix state
        await updatePhoenixState(userId, {
          tormentScore: decision.tormentAfter,
          activeHypotheses: decision.hypotheses.map(h => ({
            id: h.id,
            content: h.content.substring(0, 200),
            confidence: h.confidence
          })),
          totalDecisions: state.totalDecisions + 1,
          totalUtterances: state.totalUtterances + 2
        });

        // ============================================
        // TRANSPIRATION - Store in Vectra vector memory
        // This is where Phoenix "learns" from each conversation
        // ============================================
        const memoryStore = getMemoryStore();
        
        // Transpire user message
        await memoryStore.transpire({
          userId,
          contextId,
          role: 'user',
          content: input.message,
          confidence: 1.0
        });

        // Transpire assistant response with hypotheses and any issues
        await memoryStore.transpire({
          userId,
          contextId,
          role: 'assistant',
          content: decision.chosen.content,
          confidence: decision.chosen.confidence,
          hypotheses: decision.hypotheses.map(h => h.content),
          issues: activeIssues.map(i => i.evidence)
        });

        // Log torment update if significant change
        if (Math.abs(decision.tormentAfter - decision.tormentBefore) > 5) {
          await logAuditEvent({
            eventType: "torment_updated",
            entityType: "state",
            entityId: state.id,
            details: {
              before: decision.tormentBefore,
              after: decision.tormentAfter,
              change: decision.tormentAfter - decision.tormentBefore
            },
            userId
          });
        }

        return {
          response: decision.chosen.content,
          confidence: decision.chosen.confidence,
          reasoning: decision.chosen.reasoning,
          hypotheses: decision.hypotheses,
          rationale: decision.rationale,
          tormentScore: decision.tormentAfter,
          tormentChange: decision.tormentAfter - decision.tormentBefore,
          actionRequest: decision.actionRequest,
          contextId,
          decisionId: storedDecision?.id,
          utteranceId: assistantUtterance?.id
        };
      }),

    /**
     * Get current Phoenix state for a user
     */
    getState: protectedProcedure.query(async ({ ctx }) => {
      const state = await getOrCreatePhoenixState(ctx.user.id);
      const issueStats = await getIssueStats(ctx.user.id);
      const activeIssues = await getActiveIssues(ctx.user.id);
      
      return {
        ...state,
        issueStats,
        activeIssues: activeIssues.slice(0, 10)
      };
    }),

    /**
     * Get conversation history
     */
    getHistory: protectedProcedure
      .input(z.object({
        contextId: z.string()
      }))
      .query(async ({ ctx, input }) => {
        const utterances = await getUtterancesByContext(input.contextId);
        return utterances.reverse(); // Oldest first
      }),

    /**
     * Get all conversations for a user
     */
    getConversations: protectedProcedure.query(async ({ ctx }) => {
      return getConversationsByUser(ctx.user.id);
    }),

    /**
     * Create a new conversation
     */
    createConversation: protectedProcedure
      .input(z.object({
        title: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const contextId = randomUUID();
        return createConversation({
          userId: ctx.user.id,
          title: input.title || "Nouvelle conversation",
          contextId,
          isActive: true
        });
      }),
  }),

  // ============================================================================
  // ISSUES - Problem tracking and resolution
  // ============================================================================
  
  issues: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getActiveIssues(ctx.user.id);
    }),

    resolve: protectedProcedure
      .input(z.object({
        issueId: z.number(),
        resolution: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        await updateIssueStatus(input.issueId, "resolved", input.resolution);
        
        await logAuditEvent({
          eventType: "issue_resolved",
          entityType: "issue",
          entityId: input.issueId,
          details: { resolution: input.resolution },
          userId: ctx.user.id
        });

        return { success: true };
      }),

    defer: protectedProcedure
      .input(z.object({
        issueId: z.number()
      }))
      .mutation(async ({ ctx, input }) => {
        await updateIssueStatus(input.issueId, "deferred");
        return { success: true };
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      return getIssueStats(ctx.user.id);
    }),
  }),

  // ============================================================================
  // MEMORY - Long-term memory management
  // ============================================================================
  
  memory: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50)
      }))
      .query(async ({ ctx, input }) => {
        return getMemoriesByUser(ctx.user.id, input.limit);
      }),

    search: protectedProcedure
      .input(z.object({
        query: z.string()
      }))
      .query(async ({ ctx, input }) => {
        const allMemories = await getMemoriesByUser(ctx.user.id, 100);
        const memoryContexts: MemoryContext[] = allMemories.map(m => ({
          id: m.id,
          content: m.content,
          salience: m.salience ?? 0.5,
          memoryType: m.memoryType
        }));
        
        const relevant = phoenix.retrieveMemories(input.query, memoryContexts);
        
        // Update usage stats for retrieved memories
        for (const mem of relevant) {
          await updateMemoryUsage(mem.id);
        }

        await logAuditEvent({
          eventType: "memory_retrieved",
          entityType: "memory",
          entityId: 0,
          details: { query: input.query, resultsCount: relevant.length },
          userId: ctx.user.id
        });

        return relevant;
      }),

    add: protectedProcedure
      .input(z.object({
        content: z.string(),
        memoryType: z.enum(["fact", "hypothesis", "experience", "rule"]),
        tags: z.array(z.string()).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const state = await getOrCreatePhoenixState(ctx.user.id);
        const phoenixContext: PhoenixContext = {
          userId: ctx.user.id,
          contextId: "",
          memories: [],
          recentUtterances: [],
          activeIssues: [],
          tormentScore: state.tormentScore,
          criteria: []
        };

        const embedding = phoenix.computeEmbedding(input.content);
        const salience = phoenix.computeSalience(input.content, phoenixContext);

        const memory = await createMemory({
          content: input.content,
          embedding,
          tags: input.tags || [],
          salience,
          provenance: "user_input",
          memoryType: input.memoryType,
          userId: ctx.user.id
        });

        await logAuditEvent({
          eventType: "memory_stored",
          entityType: "memory",
          entityId: memory?.id || 0,
          details: { memoryType: input.memoryType, salience },
          userId: ctx.user.id
        });

        return memory;
      }),
  }),

  // ============================================================================
  // DECISIONS - Decision history and analysis
  // ============================================================================
  
  decisions: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50)
      }))
      .query(async ({ ctx, input }) => {
        return getDecisionsByUser(ctx.user.id, input.limit);
      }),
  }),

  // ============================================================================
  // ACTIONS - Action requests and execution
  // ============================================================================
  
  actions: router({
    pending: protectedProcedure.query(async ({ ctx }) => {
      return getPendingActionRequests(ctx.user.id);
    }),

    approve: protectedProcedure
      .input(z.object({
        actionId: z.number()
      }))
      .mutation(async ({ ctx, input }) => {
        await updateActionRequestStatus(input.actionId, "approved");
        
        await logAuditEvent({
          eventType: "action_executed",
          entityType: "action",
          entityId: input.actionId,
          details: { status: "approved" },
          userId: ctx.user.id
        });

        return { success: true };
      }),

    reject: protectedProcedure
      .input(z.object({
        actionId: z.number(),
        reason: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        await updateActionRequestStatus(input.actionId, "rejected");
        
        await logAuditEvent({
          eventType: "action_rejected",
          entityType: "action",
          entityId: input.actionId,
          details: { reason: input.reason },
          userId: ctx.user.id
        });

        return { success: true };
      }),
  }),

  // ============================================================================
  // CRITERIA - Judgment criteria management
  // ============================================================================
  
  criteria: router({
    list: protectedProcedure.query(async () => {
      await initializeDefaultCriteria();
      return getActiveCriteria();
    }),
  }),

  // ============================================================================
  // AUDIT - Audit log access
  // ============================================================================
  
  audit: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(100)
      }))
      .query(async ({ ctx, input }) => {
        return getAuditLog(ctx.user.id, input.limit);
      }),
  }),

  // ============================================================================
  // VECTRA MEMORY - Vector-based persistent memory (Transpiration)
  // ============================================================================
  
  // ============================================================================
  // TOOLS - Phoenix tools for concrete actions
  // ============================================================================
  
  tools: router({
    /**
     * Get available tools
     */
    list: protectedProcedure.query(async () => {
      const toolsEngine = getToolsEngine();
      return toolsEngine.getAvailableTools();
    }),

    /**
     * Execute a tool
     */
    execute: protectedProcedure
      .input(z.object({
        name: z.string(),
        arguments: z.record(z.string(), z.unknown())
      }))
      .mutation(async ({ ctx, input }) => {
        const toolsEngine = getToolsEngine();
        const toolCall: ToolCall = {
          id: randomUUID(),
          name: input.name,
          arguments: input.arguments,
          timestamp: new Date()
        };

        const result = await toolsEngine.executeTool(toolCall);

        await logAuditEvent({
          eventType: "tool_executed",
          entityType: "tool",
          entityId: 0,
          details: { toolName: input.name, success: result.success, executionTime: result.executionTime },
          userId: ctx.user.id
        });

        return result;
      }),

    /**
     * Get tool execution history
     */
    history: protectedProcedure.query(async () => {
      const toolsEngine = getToolsEngine();
      return toolsEngine.getExecutionHistory();
    }),
  }),

  // ============================================================================
  // UPLOADED FILES - File upload and processing (fichiers uploadés par l'utilisateur)
  // ============================================================================
  
  uploadedFiles: router({
    /**
     * Get supported file types
     */
    supportedTypes: publicProcedure.query(async () => {
      const processor = getFileProcessor();
      return {
        mimeTypes: processor.getSupportedTypes(),
        extensions: processor.getSupportedExtensions()
      };
    }),

    /**
     * Upload a file (base64 encoded)
     */
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        mimeType: z.string(),
        base64Content: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const processor = getFileProcessor();
        
        // Validate file type
        const validation = processor.validateFile({
          name: input.fileName,
          size: Buffer.from(input.base64Content, 'base64').length,
          type: input.mimeType
        });

        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Convert base64 to buffer and upload
        const buffer = Buffer.from(input.base64Content, 'base64');
        const uploadedFile = await processor.uploadFile(
          buffer,
          input.fileName,
          input.mimeType,
          ctx.user.id
        );

        await logAuditEvent({
          eventType: "file_uploaded",
          entityType: "file",
          entityId: 0,
          details: { 
            fileId: uploadedFile.id, 
            fileName: input.fileName,
            mimeType: input.mimeType,
            size: buffer.length,
            hasExtractedText: !!uploadedFile.extractedText
          },
          userId: ctx.user.id
        });

        return {
          id: uploadedFile.id,
          originalName: uploadedFile.originalName,
          mimeType: uploadedFile.mimeType,
          size: uploadedFile.size,
          extractedText: uploadedFile.extractedText,
          uploadedAt: uploadedFile.uploadedAt
        };
      }),

    /**
     * Get user's uploaded files
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const processor = getFileProcessor();
      const files = await processor.getUserFiles(ctx.user.id);
      return files.map(f => ({
        id: f.id,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
        hasExtractedText: !!f.extractedText,
        uploadedAt: f.uploadedAt
      }));
    }),

    /**
     * Get a specific file's content
     */
    get: protectedProcedure
      .input(z.object({ fileId: z.string() }))
      .query(async ({ ctx, input }) => {
        const processor = getFileProcessor();
        const file = await processor.getFile(input.fileId);
        
        if (!file || file.userId !== ctx.user.id) {
          throw new Error('Fichier non trouvé');
        }

        return {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          extractedText: file.extractedText,
          metadata: file.metadata,
          storageUrl: file.storageUrl,
          uploadedAt: file.uploadedAt
        };
      }),

    /**
     * Search in uploaded files
     */
    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ ctx, input }) => {
        const processor = getFileProcessor();
        const results = await processor.searchInFiles(ctx.user.id, input.query);
        
        return results.map((r: { file: { id: string; originalName: string }; matches: string[] }) => ({
          fileId: r.file.id,
          fileName: r.file.originalName,
          matches: r.matches
        }));
      }),

    /**
     * Delete a file
     */
    delete: protectedProcedure
      .input(z.object({ fileId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const processor = getFileProcessor();
        const file = await processor.getFile(input.fileId);
        
        if (!file || file.userId !== ctx.user.id) {
          throw new Error('Fichier non trouvé');
        }

        await processor.deleteFile(input.fileId);

        await logAuditEvent({
          eventType: "file_deleted",
          entityType: "file",
          entityId: 0,
          details: { fileId: input.fileId, fileName: file.originalName },
          userId: ctx.user.id
        });

        return { success: true };
      }),

    /**
     * Analyze a PDF file automatically
     */
    analyze: protectedProcedure
      .input(z.object({ 
        fileId: z.string(),
        fileName: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const processor = getFileProcessor();
        const file = await processor.getFile(input.fileId);
        
        if (!file || file.userId !== ctx.user.id) {
          throw new Error('Fichier non trouve');
        }

        if (!file.extractedText) {
          throw new Error('Contenu du fichier non disponible');
        }

        const analysisPrompt = `Analyse ce document et donne un resume: ${input.fileName}. Contenu: ${file.extractedText.substring(0, 5000)}`;

        try {
          const result = await processPhoenixQuery(
            analysisPrompt,
            [],
            [file.extractedText.substring(0, 5000)]
          );

          return {
            success: true,
            analysis: result.content || 'Analyse completee',
            fileName: input.fileName
          };
        } catch (error) {
          console.error('[Files.analyze] Error:', error);
          throw new Error('Erreur lors de l\'analyse');
        }
      }),
  }),

  vectraMemory: router({
    /**
     * Search vector memory for relevant memories
     */
    search: protectedProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().optional().default(10),
        types: z.array(z.enum(['utterance', 'decision', 'fact', 'correction', 'insight'])).optional()
      }))
      .query(async ({ ctx, input }) => {
        const memoryStore = getMemoryStore();
        const memories = await memoryStore.retrieve(input.query, ctx.user.id, {
          limit: input.limit,
          types: input.types
        });

        await logAuditEvent({
          eventType: "vectra_memory_searched",
          entityType: "vectra_memory",
          entityId: 0,
          details: { query: input.query, resultsCount: memories.length },
          userId: ctx.user.id
        });

        return memories;
      }),

    /**
     * Store a new memory in vector store
     */
    store: protectedProcedure
      .input(z.object({
        content: z.string(),
        type: z.enum(['utterance', 'decision', 'fact', 'correction', 'insight']),
        salience: z.number().min(0).max(1).optional().default(0.5),
        contextId: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const memoryStore = getMemoryStore();
        const id = await memoryStore.store({
          userId: ctx.user.id,
          content: input.content,
          type: input.type,
          timestamp: Date.now(),
          salience: input.salience,
          contextId: input.contextId
        });

        await logAuditEvent({
          eventType: "vectra_memory_stored",
          entityType: "vectra_memory",
          entityId: 0,
          details: { memoryId: id, type: input.type, salience: input.salience },
          userId: ctx.user.id
        });

        return { id, success: true };
      }),

    /**
     * Transpire - automatically store a conversation event
     * This is the core of Phoenix's learning mechanism
     */
    transpire: protectedProcedure
      .input(z.object({
        contextId: z.string(),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        confidence: z.number().optional(),
        hypotheses: z.array(z.string()).optional(),
        issues: z.array(z.string()).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const memoryStore = getMemoryStore();
        await memoryStore.transpire({
          userId: ctx.user.id,
          contextId: input.contextId,
          role: input.role,
          content: input.content,
          confidence: input.confidence,
          hypotheses: input.hypotheses,
          issues: input.issues
        });

        await logAuditEvent({
          eventType: "transpiration_completed",
          entityType: "vectra_memory",
          entityId: 0,
          details: { contextId: input.contextId, role: input.role },
          userId: ctx.user.id
        });

        return { success: true };
      }),

    /**
     * Consolidate memories (full sleep module)
     */
    consolidate: protectedProcedure.mutation(async ({ ctx }) => {
      const sleepModule = getSleepModule();
      const result = await sleepModule.consolidate(ctx.user.id);

      await logAuditEvent({
        eventType: "memory_consolidated",
        entityType: "vectra_memory",
        entityId: 0,
        details: { ...result },
        userId: ctx.user.id
      });

      return result;
    }),

    /**
     * Get sleep module statistics
     */
    sleepStats: protectedProcedure.query(async ({ ctx }) => {
      const sleepModule = getSleepModule();
      return sleepModule.getStats(ctx.user.id);
    }),

    /**
     * Get memory statistics
     */
    stats: protectedProcedure.query(async ({ ctx }) => {
      const memoryStore = getMemoryStore();
      return memoryStore.getStats(ctx.user.id);
    }),
  }),

  // ============================================================================
  // TTS - Text-to-Speech endpoints
  // ============================================================================
  
  tts: router({
    /**
     * Synthesize speech from text
     * Returns audio as base64 encoded string
     */
    synthesize: protectedProcedure
      .input(z.object({
        text: z.string().min(1).max(4096),
        voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional().default("nova"),
        format: z.enum(["mp3", "opus", "aac", "flac", "wav", "pcm"]).optional().default("mp3"),
        speed: z.number().min(0.25).max(4.0).optional().default(1.0)
      }))
      .mutation(async ({ input }) => {
        const result = await synthesizeSpeech({
          text: input.text,
          voice: input.voice as TTSVoice,
          format: input.format as TTSFormat,
          speed: input.speed
        });
        return result;
      }),

    /**
     * Synthesize long text by splitting into segments
     * Returns array of audio segments
     */
    synthesizeLong: protectedProcedure
      .input(z.object({
        text: z.string().min(1),
        voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional().default("nova"),
        format: z.enum(["mp3", "opus", "aac", "flac", "wav", "pcm"]).optional().default("mp3"),
        speed: z.number().min(0.25).max(4.0).optional().default(1.0)
      }))
      .mutation(async ({ input }) => {
        const segments = splitTextForTTS(input.text);
        const results = await Promise.all(
          segments.map(segment => synthesizeSpeech({
            text: segment,
            voice: input.voice as TTSVoice,
            format: input.format as TTSFormat,
            speed: input.speed
          }))
        );
        return {
          segments: results,
          totalDuration: results.reduce((sum, r) => sum + r.estimatedDuration, 0)
        };
      }),

    /**
     * Check if TTS service is available
     */
    checkAvailability: protectedProcedure.query(async () => {
      const available = await checkTTSAvailability();
      return { available };
    }),
  }),

  // ============================================================================
  // ADMIN - Administrative endpoints (Admin role required)
  // ============================================================================
  
  admin: router({
    /**
     * Check if current user is admin
     */
    isAdmin: protectedProcedure.query(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      return { isAdmin, role: ctx.user.role };
    }),

    /**
     * Get admin dashboard data
     */
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required");
      }

      const [modules, validations, pendingApprovals, auditLog] = await Promise.all([
        getModuleConfigs(),
        getSensitiveValidations(),
        getPendingApprovals(),
        getAdminAuditLog(20)
      ]);

      return {
        modules,
        validations,
        pendingApprovals,
        recentAuditLog: auditLog
      };
    }),

    /**
     * Initialize admin system (modules and validations)
     */
    initialize: protectedProcedure.mutation(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required");
      }

      await initializeModuleConfigs();
      await initializeSensitiveValidations();

      await logAdminAction({
        adminId: ctx.user.id,
        action: "initialize_admin_system",
        resourceType: "system",
        resourceId: 0,
        changes: { initialized: true }
      });

      return { success: true };
    }),

    // Module configuration endpoints
    modules: router({
      /**
       * Get all module configurations
       */
      list: protectedProcedure.query(async ({ ctx }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        return getModuleConfigs();
      }),

      /**
       * Update a module configuration
       */
      update: protectedProcedure
        .input(z.object({
          moduleId: z.string(),
          isEnabled: z.boolean().optional(),
          config: z.record(z.string(), z.unknown()).optional()
        }))
        .mutation(async ({ ctx, input }) => {
          const success = await updateModuleConfig(
            input.moduleId,
            { isEnabled: input.isEnabled, config: input.config },
            ctx.user.id
          );
          if (!success) {
            throw new Error("Failed to update module or admin access required");
          }
          return { success: true };
        }),
    }),

    // Sensitive validation endpoints
    validations: router({
      /**
       * Get all sensitive validations (16 axioms)
       */
      list: protectedProcedure.query(async ({ ctx }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        return getSensitiveValidations();
      }),

      /**
       * Update a sensitive validation setting
       */
      update: protectedProcedure
        .input(z.object({
          axiomId: z.string(),
          requiresApproval: z.boolean().optional(),
          severity: z.enum(["low", "medium", "high", "critical"]).optional()
        }))
        .mutation(async ({ ctx, input }) => {
          const success = await updateSensitiveValidation(
            input.axiomId,
            { requiresApproval: input.requiresApproval, severity: input.severity },
            ctx.user.id
          );
          if (!success) {
            throw new Error("Failed to update validation or admin access required");
          }
          return { success: true };
        }),
    }),

    // Approval request endpoints
    approvals: router({
      /**
       * Get pending approval requests
       */
      pending: protectedProcedure.query(async ({ ctx }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        return getPendingApprovals();
      }),

      /**
       * Get approval history
       */
      history: protectedProcedure
        .input(z.object({ limit: z.number().optional().default(50) }))
        .query(async ({ ctx, input }) => {
          const isAdmin = await isUserAdmin(ctx.user.id);
          if (!isAdmin) {
            throw new Error("Admin access required");
          }
          return getApprovalHistory(input.limit);
        }),

      /**
       * Approve or reject a request
       */
      process: protectedProcedure
        .input(z.object({
          requestId: z.number(),
          approved: z.boolean(),
          reason: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
          const success = await processApprovalRequest(
            input.requestId,
            input.approved,
            ctx.user.id,
            input.reason
          );
          if (!success) {
            throw new Error("Failed to process approval or admin access required");
          }
          return { success: true };
        }),
    }),

    // Audit log endpoints
    audit: router({
      /**
       * Get admin audit log
       */
      list: protectedProcedure
        .input(z.object({ limit: z.number().optional().default(100) }))
        .query(async ({ ctx, input }) => {
          const isAdmin = await isUserAdmin(ctx.user.id);
          if (!isAdmin) {
            throw new Error("Admin access required");
          }
          return getAdminAuditLog(input.limit);
        }),

      /**
       * Get full audit log (all events)
       */
      full: protectedProcedure
        .input(z.object({ limit: z.number().optional().default(100) }))
        .query(async ({ ctx, input }) => {
          const isAdmin = await isUserAdmin(ctx.user.id);
          if (!isAdmin) {
            throw new Error("Admin access required");
          }
          return getAuditLog(ctx.user.id, input.limit);
        }),
    }),

    // User management endpoints
    users: router({
      /**
       * Promote a user to admin
       */
      promoteToAdmin: protectedProcedure
        .input(z.object({ userId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const success = await promoteToAdmin(input.userId, ctx.user.id);
          if (!success) {
            throw new Error("Failed to promote user or admin access required");
          }
          return { success: true };
        }),
    }),
  }),

  // ============================================================================
  // MEMORY SYNC - Document Knowledge Base (Module 02)
  // ============================================================================
  
  memorySync: router({
    /**
     * Upload a new reference document
     */
    upload: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        fileName: z.string(),
        fileUrl: z.string(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        priority: z.enum(["H0", "H1", "H2", "H3"]),
        category: z.string().optional(),
        tags: z.array(z.string()).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const memorySync = getMemorySyncModule();
        const documentId = await memorySync.uploadDocument({
          ...input,
          uploadedBy: ctx.user.id
        });
        
        if (!documentId) {
          throw new Error("Failed to upload document");
        }

        await logAuditEvent({
          eventType: "document_uploaded",
          entityType: "reference_document",
          entityId: documentId,
          details: { title: input.title, priority: input.priority },
          userId: ctx.user.id
        });

        return { documentId };
      }),

    /**
     * Approve a document (admin only)
     */
    approve: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const memorySync = getMemorySyncModule();
        const success = await memorySync.approveDocument(input.documentId, ctx.user.id);
        if (!success) {
          throw new Error("Failed to approve document or admin access required");
        }
        return { success: true };
      }),

    /**
     * Reject a document (admin only)
     */
    reject: protectedProcedure
      .input(z.object({ 
        documentId: z.number(),
        reason: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const memorySync = getMemorySyncModule();
        const success = await memorySync.rejectDocument(input.documentId, ctx.user.id, input.reason);
        if (!success) {
          throw new Error("Failed to reject document or admin access required");
        }
        return { success: true };
      }),

    /**
     * Index a document (admin only)
     */
    index: protectedProcedure
      .input(z.object({ 
        documentId: z.number(),
        content: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const memorySync = getMemorySyncModule();
        const success = await memorySync.indexDocument(input.documentId, input.content, ctx.user.id);
        if (!success) {
          throw new Error("Failed to index document or admin access required");
        }
        return { success: true };
      }),

    /**
     * Extract concepts from a document (admin only)
     */
    extractConcepts: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const memorySync = getMemorySyncModule();
        const count = await memorySync.extractConcepts(input.documentId, ctx.user.id);
        return { conceptsExtracted: count };
      }),

    /**
     * Search documents
     */
    search: protectedProcedure
      .input(z.object({
        query: z.string(),
        priorities: z.array(z.enum(["H0", "H1", "H2", "H3"])).optional(),
        categories: z.array(z.string()).optional(),
        limit: z.number().optional().default(10)
      }))
      .query(async ({ ctx, input }) => {
        const memorySync = getMemorySyncModule();
        return memorySync.search({
          ...input,
          userId: ctx.user.id
        });
      }),

    /**
     * Get context for Phoenix decisions
     */
    getContext: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ ctx, input }) => {
        const memorySync = getMemorySyncModule();
        return memorySync.getContextForDecision(input.query, ctx.user.id);
      }),

    /**
     * Get all documents
     */
    list: protectedProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => {
        const memorySync = getMemorySyncModule();
        return memorySync.getDocuments(input.status);
      }),

    /**
     * Get document statistics
     */
    stats: protectedProcedure.query(async () => {
      const memorySync = getMemorySyncModule();
      return memorySync.getStats();
    }),
  }),

  // ============================================================================
  // ARBITRAGE - Conflict Resolution (Module 03)
  // ============================================================================
  
  arbitrage: router({
    /**
     * Get arbitration statistics
     */
    stats: protectedProcedure.query(async () => {
      const arbitrator = getArbitrator();
      return arbitrator.getStats();
    }),

    /**
     * Get decision log
     */
    decisionLog: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(50) }))
      .query(async ({ input }) => {
        const arbitrator = getArbitrator();
        const log = arbitrator.getDecisionLog();
        return log.slice(-input.limit);
      }),

    /**
     * Get axiom definitions
     */
    axioms: protectedProcedure.query(async () => {
      const arbitrator = getArbitrator();
      return arbitrator.getAxioms();
    }),

    /**
     * Get priority weights
     */
    priorityWeights: protectedProcedure.query(async () => {
      const arbitrator = getArbitrator();
      return arbitrator.getPriorityWeights();
    }),

    /**
     * Admin override for a blocked conflict
     */
    override: protectedProcedure
      .input(z.object({
        conflictId: z.string(),
        selectedOptionId: z.string(),
        justification: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required for override");
        }
        const arbitrator = getArbitrator();
        return arbitrator.adminOverride(
          input.conflictId,
          ctx.user.id,
          input.selectedOptionId,
          input.justification
        );
      }),

    /**
     * Initiate rollback (Renaissance protocol)
     */
    rollback: protectedProcedure
      .input(z.object({
        conflictId: z.string(),
        reason: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required for rollback");
        }
        const arbitrator = getArbitrator();
        return arbitrator.initiateRollback(
          input.conflictId,
          input.reason,
          ctx.user.id
        );
      }),

    /**
     * Evaluate an action against axioms
     */
    evaluate: protectedProcedure
      .input(z.object({
        action: z.string(),
        context: z.record(z.string(), z.any()).optional()
      }))
      .query(async ({ ctx, input }) => {
        const arbitrator = getArbitrator();
        return arbitrator.evaluateAction(input.action, {
          userId: ctx.user.id,
          ...input.context
        });
      }),
  }),

  // ==================== MODULE 04: ACTION ENGINE ====================
  actionEngine: router({
    /**
     * Create a new web task
     */
    createTask: protectedProcedure
      .input(z.object({
        description: z.string(),
        taskType: z.enum(['search', 'extract', 'navigate', 'interact', 'monitor']),
        targetUrl: z.string().optional(),
        parameters: z.record(z.string(), z.any()).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const engine = getActionEngine();
        return engine.createTask({
          ...input,
          userId: ctx.user.id
        });
      }),

    /**
     * Execute a task
     */
    executeTask: protectedProcedure
      .input(z.object({ taskId: z.string() }))
      .mutation(async ({ input }) => {
        const engine = getActionEngine();
        return engine.executeTask(input.taskId);
      }),

    /**
     * Cancel a pending task
     */
    cancelTask: protectedProcedure
      .input(z.object({ taskId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const engine = getActionEngine();
        return engine.cancelTask(input.taskId, ctx.user.id);
      }),

    /**
     * Get task by ID
     */
    getTask: protectedProcedure
      .input(z.object({ taskId: z.string() }))
      .query(async ({ input }) => {
        const engine = getActionEngine();
        return engine.getTask(input.taskId);
      }),

    /**
     * Get user's tasks
     */
    getUserTasks: protectedProcedure.query(async ({ ctx }) => {
      const engine = getActionEngine();
      return engine.getTasksByUser(ctx.user.id);
    }),

    /**
     * Get pending tasks (admin only)
     */
    getPendingTasks: protectedProcedure.query(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required");
      }
      const engine = getActionEngine();
      return engine.getPendingTasks();
    }),

    /**
     * Get action engine stats
     */
    getStats: protectedProcedure.query(async () => {
      const engine = getActionEngine();
      return engine.getStats();
    }),

    /**
     * Check security filters on content
     */
    checkSecurity: protectedProcedure
      .input(z.object({ content: z.string() }))
      .query(async ({ input }) => {
        const engine = getActionEngine();
        return engine.checkSecurityFilters(input.content);
      }),

    /**
     * Validate domain
     */
    validateDomain: protectedProcedure
      .input(z.object({ url: z.string() }))
      .query(async ({ input }) => {
        const engine = getActionEngine();
        return engine.validateDomain(input.url);
      }),

    /**
     * Get security filters list
     */
    getSecurityFilters: protectedProcedure.query(async () => {
      const engine = getActionEngine();
      return engine.getSecurityFilters().map(f => ({
        name: f.name,
        action: f.action,
        priority: f.priority
      }));
    }),

    /**
     * Get trusted domains
     */
    getTrustedDomains: protectedProcedure.query(async () => {
      const engine = getActionEngine();
      return engine.getTrustedDomains();
    }),
  }),

  // ==================== MODULE 05: REPORTER ====================
  reporter: router({
    /**
     * Generate a report
     */
    generateReport: protectedProcedure
      .input(z.object({
        period: z.enum(['daily', 'weekly', 'monthly', 'custom']),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        format: z.enum(['json', 'summary', 'detailed']).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required to generate reports");
        }
        const reporter = getReporter();
        return reporter.generateReport({
          period: input.period,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          format: input.format,
          userId: ctx.user.id
        });
      }),

    /**
     * Get quick summary for dashboard
     */
    getQuickSummary: protectedProcedure.query(async ({ ctx }) => {
      const reporter = getReporter();
      return reporter.generateQuickSummary(ctx.user.id);
    }),

    /**
     * Get report history
     */
    getReportHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const reporter = getReporter();
        return reporter.getReportHistory(input?.limit || 20);
      }),

    /**
     * Get a specific report
     */
    getReport: protectedProcedure
      .input(z.object({ reportId: z.string() }))
      .query(async ({ input }) => {
        const reporter = getReporter();
        return reporter.getReport(input.reportId);
      }),

    /**
     * Get unresolved alerts
     */
    getUnresolvedAlerts: protectedProcedure.query(async () => {
      const reporter = getReporter();
      return reporter.getUnresolvedAlerts();
    }),

    /**
     * Get all alerts
     */
    getAllAlerts: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const reporter = getReporter();
        return reporter.getAllAlerts(input?.limit || 100);
      }),

    /**
     * Resolve an alert
     */
    resolveAlert: protectedProcedure
      .input(z.object({ alertId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required to resolve alerts");
        }
        const reporter = getReporter();
        return reporter.resolveAlert(input.alertId, ctx.user.id);
      }),

    /**
     * Add a critical alert (for system use)
     */
    addAlert: protectedProcedure
      .input(z.object({
        type: z.enum(['h0_violation', 'security_breach', 'system_error', 'integrity_drop']),
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        description: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required to add alerts");
        }
        const reporter = getReporter();
        return reporter.addCriticalAlert(input);
      }),

    /**
     * Get integrity trend data
     */
    getIntegrityTrend: protectedProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const reporter = getReporter();
        return reporter.getIntegrityTrend(input?.days || 30);
      }),
  }),

  /**
   * Module 06: Renaissance - Auto-correction & Résilience
   */
  renaissance: router({
    /**
     * Get system health report
     */
    getHealthReport: protectedProcedure.query(async () => {
      const renaissance = getRenaissance();
      return renaissance.monitorHealth();
    }),

    /**
     * Get Renaissance stats
     */
    getStats: protectedProcedure.query(async () => {
      const renaissance = getRenaissance();
      return renaissance.getStats();
    }),

    /**
     * Get all errors
     */
    getErrors: protectedProcedure
      .input(z.object({ includeResolved: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        const renaissance = getRenaissance();
        return renaissance.getErrors(input?.includeResolved || false);
      }),

    /**
     * Get Renaissance cycles history
     */
    getCycles: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const renaissance = getRenaissance();
        return renaissance.getRenaissanceCycles(input?.limit || 20);
      }),

    /**
     * Report an error (for system use)
     */
    reportError: protectedProcedure
      .input(z.object({
        module: z.string(),
        severity: z.enum(['minor', 'moderate', 'severe', 'critical']),
        priority: z.enum(['H0', 'H1', 'H2', 'H3']),
        message: z.string(),
        context: z.record(z.string(), z.unknown()).optional()
      }))
      .mutation(async ({ input }) => {
        const renaissance = getRenaissance();
        return renaissance.reportError(input);
      }),

    /**
     * Resolve an error manually (Admin only)
     */
    resolveError: protectedProcedure
      .input(z.object({ errorId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required to resolve errors");
        }
        const renaissance = getRenaissance();
        return renaissance.resolveError(input.errorId, ctx.user.id);
      }),

    /**
     * Admin validate to unlock system
     */
    adminValidate: protectedProcedure.mutation(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required to validate Renaissance");
      }
      const renaissance = getRenaissance();
      return renaissance.adminValidate(ctx.user.id);
    }),

    /**
     * Force Renaissance (Admin only)
     */
    forceRenaissance: protectedProcedure
      .input(z.object({ reason: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required to force Renaissance");
        }
        const renaissance = getRenaissance();
        return renaissance.forceRenaissance(ctx.user.id, input.reason);
      }),

    /**
     * Check if system is locked
     */
    isLocked: protectedProcedure.query(async () => {
      const renaissance = getRenaissance();
      return renaissance.isLocked();
    }),
  }),

  /**
   * Module 07: Communication & Interface
   */
  communication: router({
    /**
     * Get communication stats
     */
    getStats: protectedProcedure.query(async () => {
      const comms = getCommunication();
      return comms.getStats();
    }),

    /**
     * Get notifications for current user
     */
    getNotifications: protectedProcedure
      .input(z.object({ includeRead: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const comms = getCommunication();
        const isAdmin = await isUserAdmin(ctx.user.id);
        const role = isAdmin ? 'admin' : 'user';
        return comms.getNotifications(role, input?.includeRead || false);
      }),

    /**
     * Mark notification as read
     */
    markAsRead: protectedProcedure
      .input(z.object({ notificationId: z.string() }))
      .mutation(async ({ input }) => {
        const comms = getCommunication();
        return comms.markAsRead(input.notificationId);
      }),

    /**
     * Mark all notifications as read
     */
    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      const comms = getCommunication();
      const isAdmin = await isUserAdmin(ctx.user.id);
      const role = isAdmin ? 'admin' : 'user';
      return comms.markAllAsRead(role);
    }),

    /**
     * Send notification (Admin only)
     */
    sendNotification: protectedProcedure
      .input(z.object({
        type: z.enum(['alert', 'info', 'warning', 'approval_request']),
        message: z.string(),
        priority: z.enum(['H0', 'H1', 'H2', 'H3']),
        targetRole: z.enum(['admin', 'user', 'viewer', 'all']).optional(),
        actionRequired: z.boolean().optional(),
        actionUrl: z.string().optional(),
        expiresIn: z.number().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required to send notifications");
        }
        const comms = getCommunication();
        return comms.sendNotification(
          input.type,
          input.message,
          input.priority,
          input.targetRole || 'all',
          {
            actionRequired: input.actionRequired,
            actionUrl: input.actionUrl,
            expiresIn: input.expiresIn
          }
        );
      }),

    /**
     * Get message history
     */
    getMessageHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const comms = getCommunication();
        const isAdmin = await isUserAdmin(ctx.user.id);
        const role = isAdmin ? 'admin' : 'user';
        return comms.getMessageHistory(input?.limit || 100, role);
      }),

    /**
     * Get current alert level
     */
    getAlertLevel: protectedProcedure.query(async () => {
      const comms = getCommunication();
      return comms.getAlertLevel();
    }),

    /**
     * Reset alert level (Admin only)
     */
    resetAlertLevel: protectedProcedure.mutation(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required to reset alert level");
      }
      const comms = getCommunication();
      comms.resetAlertLevel();
      return { success: true, alertLevel: 'standard' };
    }),

    /**
     * Get axiom descriptions
     */
    getAxiomDescriptions: protectedProcedure.query(async () => {
      const comms = getCommunication();
      return comms.getAxiomDescriptions();
    }),

    /**
     * Format message with role and priority
     */
    formatMessage: protectedProcedure
      .input(z.object({
        content: z.string(),
        priority: z.enum(['H0', 'H1', 'H2', 'H3']).optional(),
        axiomReference: z.string().optional(),
        confidenceScore: z.number().optional(),
        tormentScore: z.number().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const comms = getCommunication();
        const isAdmin = await isUserAdmin(ctx.user.id);
        const role = isAdmin ? 'admin' : 'user';
        return comms.formatMessage(
          input.content,
          role,
          input.priority || 'H3',
          {
            axiomReference: input.axiomReference,
            confidenceScore: input.confidenceScore,
            tormentScore: input.tormentScore
          }
        );
      }),

    /**
     * Justify a decision with axiom references
     */
    justifyDecision: protectedProcedure
      .input(z.object({
        decision: z.string(),
        axioms: z.array(z.string()),
        confidenceScore: z.number(),
        tormentScore: z.number()
      }))
      .query(async ({ input }) => {
        const comms = getCommunication();
        return comms.justifyDecision(
          input.decision,
          input.axioms,
          input.confidenceScore,
          input.tormentScore
        );
      }),

    /**
     * Clear expired notifications
     */
    clearExpired: protectedProcedure.mutation(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required to clear notifications");
      }
      const comms = getCommunication();
      const cleared = comms.clearExpiredNotifications();
      return { cleared };
    }),
  }),

  // ==================== Module 08: Optimizer ====================
  optimizer: router({
    /**
     * Allocate resources for a task
     */
    allocateTask: protectedProcedure
      .input(z.object({
        priority: z.enum(['H0', 'H1', 'H2', 'H3']),
        description: z.string(),
        estimatedDuration: z.number().optional(),
        metadata: z.record(z.string(), z.unknown()).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const optimizer = getOptimizer();
        const result = optimizer.allocatePower(
          input.priority,
          input.description,
          input.estimatedDuration,
          input.metadata
        );
        
        await logAdminAction({
          adminId: ctx.user.id,
          action: 'task_allocated',
          resourceType: 'optimizer',
          resourceId: 0,
          changes: {
            taskId: result.task.id,
            priority: input.priority,
            allocation: result.allocation
          }
        });
        
        return result;
      }),

    /**
     * Complete a task
     */
    completeTask: protectedProcedure
      .input(z.object({
        taskId: z.string(),
        success: z.boolean().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const optimizer = getOptimizer();
        const task = optimizer.completeTask(input.taskId, input.success ?? true);
        
        if (task) {
          await logAdminAction({
            adminId: ctx.user.id,
            action: 'task_completed',
            resourceType: 'optimizer',
            resourceId: 0,
            changes: {
              taskId: input.taskId,
              success: input.success ?? true,
              duration: task.actualDuration
            }
          });
        }
        
        return { task };
      }),

    /**
     * Cancel a task
     */
    cancelTask: protectedProcedure
      .input(z.object({ taskId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required to cancel tasks");
        }
        
        const optimizer = getOptimizer();
        const cancelled = optimizer.cancelTask(input.taskId);
        
        if (cancelled) {
          await logAdminAction({
            adminId: ctx.user.id,
            action: 'task_cancelled',
            resourceType: 'optimizer',
            resourceId: 0,
            changes: { taskId: input.taskId }
          });
        }
        
        return { cancelled };
      }),

    /**
     * Get resource metrics
     */
    getResourceMetrics: protectedProcedure.query(async () => {
      const optimizer = getOptimizer();
      return optimizer.getResourceMetrics();
    }),

    /**
     * Get efficiency metrics
     */
    getEfficiencyMetrics: protectedProcedure.query(async () => {
      const optimizer = getOptimizer();
      return optimizer.getEfficiencyMetrics();
    }),

    /**
     * Get optimization stats by priority
     */
    getOptimizationStats: protectedProcedure.query(async () => {
      const optimizer = getOptimizer();
      return optimizer.getOptimizationStats();
    }),

    /**
     * Get queued tasks
     */
    getQueuedTasks: protectedProcedure.query(async () => {
      const optimizer = getOptimizer();
      return optimizer.getQueuedTasks();
    }),

    /**
     * Get running tasks
     */
    getRunningTasks: protectedProcedure.query(async () => {
      const optimizer = getOptimizer();
      return optimizer.getRunningTasks();
    }),

    /**
     * Get recent completed tasks
     */
    getRecentCompletedTasks: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        const optimizer = getOptimizer();
        return optimizer.getRecentCompletedTasks(input.limit);
      }),

    /**
     * Set resource limit (admin only)
     */
    setResourceLimit: protectedProcedure
      .input(z.object({ limit: z.number().min(0.1).max(1) }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required to set resource limit");
        }
        
        const optimizer = getOptimizer();
        optimizer.setResourceLimit(input.limit);
        
        await logAdminAction({
          adminId: ctx.user.id,
          action: 'resource_limit_changed',
          resourceType: 'optimizer',
          resourceId: 0,
          changes: { limit: input.limit }
        });
        
        return { limit: optimizer.getResourceLimit() };
      }),

    /**
     * Get current resource limit
     */
    getResourceLimit: protectedProcedure.query(async () => {
      const optimizer = getOptimizer();
      return { limit: optimizer.getResourceLimit() };
    }),

    /**
     * Force process queue (admin only)
     */
    forceProcessQueue: protectedProcedure.mutation(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required to force process queue");
      }
      
      const optimizer = getOptimizer();
      const processed = optimizer.forceProcessQueue();
      
      await logAdminAction({
        adminId: ctx.user.id,
        action: 'force_process_queue',
        resourceType: 'optimizer',
        resourceId: 0,
        changes: { processed }
      });
      
      return { processed };
    }),

    /**
     * Clear all queues (admin only)
     */
    clearQueues: protectedProcedure.mutation(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required to clear queues");
      }
      
      const optimizer = getOptimizer();
      const cleared = optimizer.clearQueues();
      
      await logAdminAction({
        adminId: ctx.user.id,
        action: 'clear_queues',
        resourceType: 'optimizer',
        resourceId: 0,
        changes: { cleared }
      });
      
      return { cleared };
    }),

    /**
     * Get load history for charts
     */
    getLoadHistory: protectedProcedure
      .input(z.object({ samples: z.number().optional() }))
      .query(async ({ input }) => {
        const optimizer = getOptimizer();
        return optimizer.getLoadHistory(input.samples);
      }),
  }),

  // ==================== MODULE 09: SECURITY ====================
  security: router({
    /**
     * Get security status
     */
    getStatus: protectedProcedure.query(async () => {
      const security = getSecurity();
      return security.getStatus();
    }),

    /**
     * Get security metrics
     */
    getMetrics: protectedProcedure.query(async () => {
      const security = getSecurity();
      return security.getMetrics();
    }),

    /**
     * Get audit log
     */
    getAuditLog: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        const security = getSecurity();
        return security.getAuditLog(input.limit);
      }),

    /**
     * Get recent violations
     */
    getViolations: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        const security = getSecurity();
        return security.getRecentViolations(input.limit);
      }),

    /**
     * Verify audit integrity
     */
    verifyIntegrity: protectedProcedure.query(async () => {
      const security = getSecurity();
      return security.verifyAuditIntegrity();
    }),

    /**
     * Filter content for sensitive data
     */
    filterContent: protectedProcedure
      .input(z.object({ content: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const security = getSecurity();
        return security.filterOutput(input.content, String(ctx.user.id));
      }),

    /**
     * Encrypt data (admin only)
     */
    encryptData: protectedProcedure
      .input(z.object({ data: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required for encryption");
        }
        
        const security = getSecurity();
        return security.encrypt(input.data);
      }),

    /**
     * Decrypt data (admin only)
     */
    decryptData: protectedProcedure
      .input(z.object({
        iv: z.string(),
        data: z.string(),
        tag: z.string(),
        algorithm: z.string(),
        timestamp: z.number()
      }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required for decryption");
        }
        
        const security = getSecurity();
        return { decrypted: security.decrypt(input) };
      }),

    /**
     * Unlock system (admin only)
     */
    unlock: protectedProcedure.mutation(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required to unlock system");
      }
      
      const security = getSecurity();
      const success = security.unlock(String(ctx.user.id));
      
      await logAdminAction({
        adminId: ctx.user.id,
        action: 'system_unlock',
        resourceType: 'security',
        resourceId: 0,
        changes: { success }
      });
      
      return { success };
    }),

    /**
     * Toggle encryption (admin only)
     */
    setEncryption: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required to change encryption settings");
        }
        
        const security = getSecurity();
        security.setEncryptionEnabled(input.enabled, String(ctx.user.id));
        
        await logAdminAction({
          adminId: ctx.user.id,
          action: input.enabled ? 'encryption_enabled' : 'encryption_disabled',
          resourceType: 'security',
          resourceId: 0,
          changes: { enabled: input.enabled }
        });
        
        return { enabled: input.enabled };
      }),

    /**
     * Toggle filter (admin only)
     */
    setFilter: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required to change filter settings");
        }
        
        const security = getSecurity();
        security.setFilterEnabled(input.enabled, String(ctx.user.id));
        
        await logAdminAction({
          adminId: ctx.user.id,
          action: input.enabled ? 'filter_enabled' : 'filter_disabled',
          resourceType: 'security',
          resourceId: 0,
          changes: { enabled: input.enabled }
        });
        
        return { enabled: input.enabled };
      }),

    /**
     * Reset metrics (admin only)
     */
    resetMetrics: protectedProcedure.mutation(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required to reset metrics");
      }
      
      const security = getSecurity();
      security.resetMetrics(String(ctx.user.id));
      
      await logAdminAction({
        adminId: ctx.user.id,
        action: 'security_metrics_reset',
        resourceType: 'security',
        resourceId: 0,
        changes: {}
      });
      
      return { success: true };
    }),

    /**
     * Generate signature
     */
    generateSignature: protectedProcedure
      .input(z.object({ data: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required for signature generation");
        }
        
        const security = getSecurity();
        return { signature: security.generateSignature(input.data) };
      }),

    /**
     * Verify signature
     */
    verifySignature: protectedProcedure
      .input(z.object({ data: z.string(), signature: z.string() }))
      .query(async ({ input }) => {
        const security = getSecurity();
        return { valid: security.verifySignature(input.data, input.signature) };
      }),
  }),

  // ==================== EVOLUTION MODULE ====================
  evolution: router({
    /**
     * Get current system version
     */
    getVersion: publicProcedure.query(async () => {
      const evolution = getEvolutionInstance();
      return evolution.getCurrentVersion();
    }),

    /**
     * Check compatibility with target version
     */
    checkCompatibility: protectedProcedure
      .input(z.object({ targetVersion: z.string() }))
      .query(async ({ input }) => {
        const evolution = getEvolutionInstance();
        return evolution.checkCompatibility(input.targetVersion);
      }),

    /**
     * Get scalability metrics
     */
    getMetrics: protectedProcedure.query(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required");
      }
      
      const evolution = getEvolutionInstance();
      return evolution.getScalabilityMetrics();
    }),

    /**
     * List all modules
     */
    listModules: protectedProcedure.query(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required");
      }
      
      const evolution = getEvolutionInstance();
      return evolution.listModules();
    }),

    /**
     * Enable a module
     */
    enableModule: protectedProcedure
      .input(z.object({ moduleId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        const success = evolution.enableModule(input.moduleId as any, String(ctx.user.id));
        
        if (success) {
          await logAdminAction({
            adminId: ctx.user.id,
            action: 'module_enabled',
            resourceType: 'module',
            resourceId: 0,
            changes: { moduleId: input.moduleId }
          });
        }
        
        return { success };
      }),

    /**
     * Disable a module
     */
    disableModule: protectedProcedure
      .input(z.object({ moduleId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        const success = evolution.disableModule(input.moduleId as any, String(ctx.user.id));
        
        if (success) {
          await logAdminAction({
            adminId: ctx.user.id,
            action: 'module_disabled',
            resourceType: 'module',
            resourceId: 0,
            changes: { moduleId: input.moduleId }
          });
        }
        
        return { success };
      }),

    /**
     * List all extensions
     */
    listExtensions: protectedProcedure
      .input(z.object({
        status: z.enum(['pending', 'approved', 'active', 'disabled', 'rejected']).optional(),
        category: z.enum(['ai_model', 'data_source', 'api_integration', 'tool', 'visualization', 'automation']).optional()
      }).optional())
      .query(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        return evolution.listExtensions(input);
      }),

    /**
     * Register a new extension
     */
    registerExtension: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string(),
        category: z.enum(['ai_model', 'data_source', 'api_integration', 'tool', 'visualization', 'automation']),
        version: z.string(),
        author: z.string(),
        dependencies: z.array(z.string()).default([]),
        capabilities: z.array(z.string()).default([]),
        config: z.record(z.string(), z.any()).default({})
      }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        const extension = evolution.registerExtension(input);
        
        await logAdminAction({
          adminId: ctx.user.id,
          action: 'extension_registered',
          resourceType: 'extension',
          resourceId: 0,
          changes: { extensionId: extension.id, name: extension.name }
        });
        
        return extension;
      }),

    /**
     * Approve an extension
     */
    approveExtension: protectedProcedure
      .input(z.object({ extensionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        const success = evolution.approveExtension(input.extensionId, String(ctx.user.id));
        
        if (success) {
          await logAdminAction({
            adminId: ctx.user.id,
            action: 'extension_approved',
            resourceType: 'extension',
            resourceId: 0,
            changes: { extensionId: input.extensionId }
          });
        }
        
        return { success };
      }),

    /**
     * Activate an extension
     */
    activateExtension: protectedProcedure
      .input(z.object({ extensionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        const success = evolution.activateExtension(input.extensionId, String(ctx.user.id));
        
        if (success) {
          await logAdminAction({
            adminId: ctx.user.id,
            action: 'extension_activated',
            resourceType: 'extension',
            resourceId: 0,
            changes: { extensionId: input.extensionId }
          });
        }
        
        return { success };
      }),

    /**
     * Deactivate an extension
     */
    deactivateExtension: protectedProcedure
      .input(z.object({ extensionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        const success = evolution.deactivateExtension(input.extensionId, String(ctx.user.id));
        
        if (success) {
          await logAdminAction({
            adminId: ctx.user.id,
            action: 'extension_deactivated',
            resourceType: 'extension',
            resourceId: 0,
            changes: { extensionId: input.extensionId }
          });
        }
        
        return { success };
      }),

    /**
     * Remove an extension
     */
    removeExtension: protectedProcedure
      .input(z.object({ extensionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        const success = evolution.removeExtension(input.extensionId, String(ctx.user.id));
        
        if (success) {
          await logAdminAction({
            adminId: ctx.user.id,
            action: 'extension_removed',
            resourceType: 'extension',
            resourceId: 0,
            changes: { extensionId: input.extensionId }
          });
        }
        
        return { success };
      }),

    /**
     * Run security scan on extension
     */
    scanExtension: protectedProcedure
      .input(z.object({ extensionId: z.string() }))
      .query(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        return evolution.runSecurityScan(input.extensionId);
      }),

    /**
     * Verify axiom compatibility
     */
    verifyAxiomCompatibility: protectedProcedure
      .input(z.object({ extensionId: z.string() }))
      .query(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        return evolution.verifyAxiomCompatibility(input.extensionId);
      }),

    /**
     * Get event log
     */
    getEventLog: protectedProcedure
      .input(z.object({ limit: z.number().default(100) }).optional())
      .query(async ({ ctx, input }) => {
        const isAdmin = await isUserAdmin(ctx.user.id);
        if (!isAdmin) {
          throw new Error("Admin access required");
        }
        
        const evolution = getEvolutionInstance();
        return evolution.getEventLog(input?.limit);
      }),

    /**
     * Optimize resources
     */
    optimizeResources: protectedProcedure.mutation(async ({ ctx }) => {
      const isAdmin = await isUserAdmin(ctx.user.id);
      if (!isAdmin) {
        throw new Error("Admin access required");
      }
      
      const evolution = getEvolutionInstance();
      evolution.optimizeResources();
      
      await logAdminAction({
        adminId: ctx.user.id,
        action: 'resources_optimized',
        resourceType: 'system',
        resourceId: 0,
        changes: {}
      });
      
       return { success: true };
    }),
  }),

  // ============================================================================
  // Streaming - Real-time responses with SSE
  // ============================================================================
  streaming: streamingRouter,

  // ============================================================================
  // REAL APIs - OpenWeatherMap, Groq, Serper
  // ============================================================================
  apis: router({
    /**
     * Get current weather from OpenWeatherMap
     */
    weather: protectedProcedure
      .input(z.object({ city: z.string() }))
      .query(async ({ ctx, input }) => {
        const weather = await openweatherApi.getCurrentWeather(input.city);
        return weather;
      }),

    /**
     * Get weather forecast
     */
    weatherForecast: protectedProcedure
      .input(z.object({ city: z.string(), days: z.number().default(5) }))
      .query(async ({ ctx, input }) => {
        const forecast = await openweatherApi.getForecast(input.city, input.days);
        return forecast;
      }),

    /**
     * Generate text using Groq LLM
     */
    groqGenerate: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string()
        })),
        temperature: z.number().min(0).max(2).optional().default(0.7),
        maxTokens: z.number().optional().default(2048)
      }))
      .mutation(async ({ ctx, input }) => {
        if (!groqApi.isAvailable()) {
          throw new Error('Groq API not available');
        }
        const response = await groqApi.generateText(input.messages, {
          temperature: input.temperature,
          maxTokens: input.maxTokens
        });
        return { text: response };
      }),

    /**
     * Search the web using Serper
     */
    serperSearch: protectedProcedure
      .input(z.object({
        query: z.string(),
        num: z.number().min(1).max(100).optional().default(10)
      }))
      .query(async ({ ctx, input }) => {
        if (!serperApi.isAvailable()) {
          throw new Error('Serper API not available');
        }
        const results = await serperApi.search(input.query, { num: input.num });
        return results;
      }),

    /**
     * Search for news using Serper
     */
    serperNews: protectedProcedure
      .input(z.object({
        query: z.string(),
        num: z.number().min(1).max(100).optional().default(10)
      }))
      .query(async ({ ctx, input }) => {
        if (!serperApi.isAvailable()) {
          throw new Error('Serper API not available');
        }
        const results = await serperApi.searchNews(input.query, { num: input.num });
        return results;
      }),

    /**
     * Get quick answer from Serper
     */
    serperAnswer: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!serperApi.isAvailable()) {
          throw new Error('Serper API not available');
        }
        const answer = await serperApi.getAnswerBox(input.query);
        return answer;
      }),

    /**
     * Check API availability
     */
    status: publicProcedure.query(async () => {
      return {
        openweathermap: !!process.env.Openweather_API_KEY,
        groq: groqApi.isAvailable(),
        serper: serperApi.isAvailable()
      };
    })
  }),

  // ============================================================================
  // CONVERSATIONS - Persistent conversation history
  // ============================================================================
  conversations: router({
    /**
     * List all conversations for the current user
     */
    list: publicProcedure.query(async ({ ctx }) => {
      const userId = ctx.user?.id || 1;
      return getConversationsByUser(userId);
    }),

    /**
     * Get a specific conversation with its messages
     */
    get: publicProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const conversation = await getConversationById(input.conversationId);
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        const messages = await getConversationMessages(input.conversationId);
        return { conversation, messages };
      }),

    /**
     * Create a new conversation
     */
    create: publicProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 1;
        return getOrCreateConversationForUser(userId, input.title);
      }),

    /**
     * Update conversation title
     */
    updateTitle: publicProcedure
      .input(z.object({
        conversationId: z.number(),
        title: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const conversation = await getConversationById(input.conversationId);
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        return updateConversation(input.conversationId, { title: input.title });
      }),

    /**
     * Delete a conversation
     */
    delete: publicProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const conversation = await getConversationById(input.conversationId);
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        return deleteConversation(input.conversationId);
      }),

    /**
     * Save a message to a conversation
     */
    saveMessage: publicProcedure
      .input(z.object({
        conversationId: z.number(),
        role: z.enum(['user', 'assistant']),
        content: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const conversation = await getConversationById(input.conversationId);
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        return saveConversationMessage(
          input.conversationId,
          input.role,
          input.content
        );
      })
  }),
});
export type AppRouter = typeof appRouter;
