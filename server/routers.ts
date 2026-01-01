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
  getConversationByContextId
} from "./db";

export const appRouter = router({
  system: systemRouter,
  
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
        fastMode: z.boolean().optional().default(false)
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

        // Process through Phoenix orchestrator
        // fastMode: 1 hypothèse pour réponse rapide, sinon 3 hypothèses
        const decision = await phoenix.process(input.message, phoenixContext, input.fastMode);

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
  // FILES - File upload and processing
  // ============================================================================
  
  files: router({
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
      return processor.getUserFiles(ctx.user.id).map(f => ({
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
        const file = processor.getFile(input.fileId);
        
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
        const results = processor.searchInFiles(ctx.user.id, input.query);
        
        return results.map(r => ({
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
        const file = processor.getFile(input.fileId);
        
        if (!file || file.userId !== ctx.user.id) {
          throw new Error('Fichier non trouvé');
        }

        processor.deleteFile(input.fileId);

        await logAuditEvent({
          eventType: "file_deleted",
          entityType: "file",
          entityId: 0,
          details: { fileId: input.fileId, fileName: file.originalName },
          userId: ctx.user.id
        });

        return { success: true };
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
});

export type AppRouter = typeof appRouter;
