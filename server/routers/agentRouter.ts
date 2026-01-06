/**
 * Agent Router - Routes pour le système d'agent autonome Phoenix
 * Utilise le nouveau AgentCore avec ToolRegistry
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { 
  createAgent, 
  getAgent, 
  listAgents, 
  runAgent, 
  quickRun,
  cancelAgent,
  deleteAgent,
  AgentState,
  AgentEvent
} from "../phoenix/agentCore";
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';

// Event emitter pour les mises à jour en temps réel
const agentEvents = new EventEmitter();
agentEvents.setMaxListeners(100);

// Store pour les callbacks d'événements par agent
const agentCallbacks: Map<string, (event: AgentEvent) => void> = new Map();

export const agentRouter = router({
  /**
   * Créer une nouvelle tâche d'agent
   */
  createTask: protectedProcedure
    .input(z.object({
      goal: z.string().min(1).max(5000),
      config: z.object({
        maxIterations: z.number().min(1).max(50).optional(),
        maxToolCalls: z.number().min(1).max(100).optional(),
        requireConfirmation: z.boolean().optional(),
        verbose: z.boolean().optional()
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const agent = createAgent(input.goal, input.config);
      return {
        success: true,
        task: {
          id: agent.id,
          goal: agent.goal,
          status: agent.status,
          createdAt: agent.createdAt
        }
      };
    }),

  /**
   * Obtenir un agent par son ID
   */
  getTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .query(async ({ input }) => {
      const agent = getAgent(input.taskId);
      if (!agent) {
        return { success: false, error: 'Agent not found' };
      }
      return { 
        success: true, 
        task: {
          id: agent.id,
          goal: agent.goal,
          status: agent.status,
          currentPhase: agent.currentPhase,
          steps: agent.steps.map(s => ({
            id: s.id,
            type: s.type,
            content: s.content,
            status: s.status,
            toolName: s.toolName,
            toolArgs: s.toolArgs,
            toolResult: s.toolResult ? {
              success: s.toolResult.success,
              output: s.toolResult.output?.substring(0, 1000),
              error: s.toolResult.error,
              artifacts: s.toolResult.artifacts
            } : undefined,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
            duration: s.duration
          })),
          result: agent.result,
          error: agent.error,
          artifacts: agent.context.artifacts,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt
        }
      };
    }),

  /**
   * Lister tous les agents
   */
  listTasks: protectedProcedure
    .query(async () => {
      const agents = listAgents();
      return {
        success: true,
        tasks: agents.map(a => ({
          id: a.id,
          goal: a.goal,
          status: a.status,
          currentPhase: a.currentPhase,
          stepsCount: a.steps.length,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt
        }))
      };
    }),

  /**
   * Exécuter un agent (démarrer la boucle)
   */
  runTask: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      config: z.object({
        maxIterations: z.number().min(1).max(50).optional(),
        maxToolCalls: z.number().min(1).max(100).optional(),
        requireConfirmation: z.boolean().optional()
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Créer le callback pour émettre les événements
        const onEvent = (event: AgentEvent) => {
          agentEvents.emit(`agent:${input.taskId}`, event);
        };
        
        agentCallbacks.set(input.taskId, onEvent);

        // Exécuter l'agent de manière asynchrone
        const sessionId = `session-${ctx.user.openId}-${Date.now()}`;
        
        // Lancer l'exécution en arrière-plan
        runAgent(input.taskId, ctx.user.openId, sessionId, onEvent)
          .then((completedAgent) => {
            console.log(`[AgentRouter] Agent ${input.taskId} terminé avec statut: ${completedAgent.status}`);
            agentCallbacks.delete(input.taskId);
          })
          .catch((error) => {
            console.error(`[AgentRouter] Erreur agent ${input.taskId}:`, error);
            agentCallbacks.delete(input.taskId);
          });

        return { 
          success: true, 
          message: 'Agent démarré',
          taskId: input.taskId
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    }),

  /**
   * Exécuter une tâche rapide (création + exécution en une fois)
   */
  quickTask: protectedProcedure
    .input(z.object({
      goal: z.string().min(1).max(5000),
      config: z.object({
        maxIterations: z.number().min(1).max(50).optional(),
        maxToolCalls: z.number().min(1).max(100).optional()
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const sessionId = `session-${ctx.user.openId}-${Date.now()}`;
        
        const agent = await quickRun(
          input.goal,
          ctx.user.openId,
          sessionId,
          input.config,
          (event) => {
            agentEvents.emit(`agent:${event.data?.agentId || 'quick'}`, event);
          }
        );

        return {
          success: true,
          task: {
            id: agent.id,
            goal: agent.goal,
            status: agent.status,
            result: agent.result,
            error: agent.error,
            steps: agent.steps.map(s => ({
              id: s.id,
              type: s.type,
              content: s.content,
              status: s.status,
              toolName: s.toolName,
              duration: s.duration
            })),
            artifacts: agent.context.artifacts
          }
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    }),

  /**
   * Annuler un agent en cours
   */
  cancelTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .mutation(async ({ input }) => {
      const success = cancelAgent(input.taskId);
      agentCallbacks.delete(input.taskId);
      return { success };
    }),

  /**
   * Supprimer un agent
   */
  deleteTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .mutation(async ({ input }) => {
      const success = deleteAgent(input.taskId);
      agentCallbacks.delete(input.taskId);
      return { success };
    }),

  /**
   * S'abonner aux événements d'un agent (SSE)
   */
  subscribeToTask: protectedProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .subscription(({ input }) => {
      return observable<AgentEvent>((emit) => {
        const handler = (event: AgentEvent) => {
          emit.next(event);
        };

        agentEvents.on(`agent:${input.taskId}`, handler);

        return () => {
          agentEvents.off(`agent:${input.taskId}`, handler);
        };
      });
    }),

  /**
   * Obtenir les outils disponibles
   */
  getAvailableTools: protectedProcedure
    .query(async () => {
      const { toolRegistry } = await import('../phoenix/toolRegistry');
      const tools = toolRegistry.listAll();
      
      return {
        success: true,
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
          category: t.category,
          parameters: t.parameters
        }))
      };
    }),

  /**
   * Tester un outil directement
   */
  testTool: protectedProcedure
    .input(z.object({
      toolName: z.string(),
      args: z.record(z.string(), z.any())
    }))
    .mutation(async ({ ctx, input }) => {
      const { toolRegistry } = await import('../phoenix/toolRegistry');
      
      const toolContext = {
        userId: ctx.user.openId,
        sessionId: `test-${Date.now()}`
      };
      
      const result = await toolRegistry.execute(
        input.toolName,
        input.args,
        toolContext
      );

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        artifacts: result.artifacts,
        metadata: result.metadata
      };
    })
});

export default agentRouter;
