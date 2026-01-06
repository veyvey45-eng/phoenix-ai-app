/**
 * MCP Bridge Router
 * 
 * Endpoints tRPC pour gérer la connexion au MCP Bridge
 * Inclut le système de confirmation de sécurité
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { getMCPBridge, type MCPBridgeConfig } from '../phoenix/mcpBridge';
import { TRPCError } from '@trpc/server';
import {
  createConfirmationRequest,
  processConfirmationResponse,
  getPendingConfirmation,
  getUserPendingConfirmations,
  requiresConfirmation,
  getRiskLevelLabel,
  type SecurityConfirmationRequest,
} from '../phoenix/mcpSecurity';

// Stockage des configurations par utilisateur (en mémoire pour l'instant)
const userBridgeConfigs = new Map<string, MCPBridgeConfig>();

// Stockage des appels en attente de confirmation
const pendingToolCalls = new Map<string, {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}>();

export const mcpBridgeRouter = router({
  /**
   * Obtenir le statut de connexion au bridge
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const bridge = getMCPBridge();
    const status = bridge.getStatus();
    
    return {
      ...status,
      hasConfig: userBridgeConfigs.has(String(ctx.user.id)),
      securityEnabled: true,
    };
  }),

  /**
   * Connecter au MCP Bridge
   */
  connect: protectedProcedure
    .input(z.object({
      url: z.string().url().or(z.string().startsWith('ws://')).or(z.string().startsWith('wss://')),
      secret: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const bridge = getMCPBridge();
      
      // Déconnecter si déjà connecté
      if (bridge.isReady()) {
        bridge.disconnect();
      }

      try {
        await bridge.connect({
          url: input.url,
          secret: input.secret,
        });

        // Sauvegarder la config
        userBridgeConfigs.set(String(ctx.user.id), {
          url: input.url,
          secret: input.secret,
        });

        return {
          success: true,
          message: 'Connecté au MCP Bridge',
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Échec de connexion: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  /**
   * Déconnecter du MCP Bridge
   */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const bridge = getMCPBridge();
    bridge.disconnect();
    userBridgeConfigs.delete(String(ctx.user.id));
    
    return {
      success: true,
      message: 'Déconnecté du MCP Bridge',
    };
  }),

  /**
   * Ping le bridge pour vérifier la latence
   */
  ping: protectedProcedure.mutation(async () => {
    const bridge = getMCPBridge();
    
    if (!bridge.isReady()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Non connecté au MCP Bridge',
      });
    }

    try {
      const latency = await bridge.ping();
      return { latency };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ping failed',
      });
    }
  }),

  /**
   * Découvrir les serveurs MCP disponibles
   */
  discoverServers: protectedProcedure.query(async () => {
    const bridge = getMCPBridge();
    
    if (!bridge.isReady()) {
      return { servers: [], connected: false };
    }

    try {
      const servers = await bridge.discoverServers();
      return { servers, connected: true };
    } catch (error) {
      return { servers: [], connected: true, error: 'Discovery failed' };
    }
  }),

  /**
   * Démarrer un serveur MCP
   */
  startServer: protectedProcedure
    .input(z.object({
      serverId: z.string(),
      command: z.string().optional(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const bridge = getMCPBridge();
      
      if (!bridge.isReady()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Non connecté au MCP Bridge',
        });
      }

      const result = await bridge.startMCP(input.serverId, {
        id: input.serverId,
        name: input.serverId,
        command: input.command || 'npx',
        args: input.args || [],
        env: (input.env || {}) as Record<string, string>,
        status: 'available',
        source: 'config',
      });

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to start MCP server',
        });
      }

      return result;
    }),

  /**
   * Arrêter un serveur MCP
   */
  stopServer: protectedProcedure
    .input(z.object({
      serverId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const bridge = getMCPBridge();
      
      if (!bridge.isReady()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Non connecté au MCP Bridge',
        });
      }

      const result = await bridge.stopMCP(input.serverId);

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to stop MCP server',
        });
      }

      return result;
    }),

  /**
   * Lister les outils d'un serveur MCP
   */
  listTools: protectedProcedure
    .input(z.object({
      serverId: z.string(),
    }))
    .query(async ({ input }) => {
      const bridge = getMCPBridge();
      
      if (!bridge.isReady()) {
        return { tools: [], connected: false };
      }

      try {
        const tools = await bridge.listTools(input.serverId);
        return { tools, connected: true };
      } catch (error) {
        return { tools: [], connected: true, error: 'Failed to list tools' };
      }
    }),

  /**
   * Demander une confirmation de sécurité pour un appel d'outil
   */
  requestToolConfirmation: protectedProcedure
    .input(z.object({
      serverId: z.string(),
      toolName: z.string(),
      arguments: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const args = input.arguments || {};
      
      // Vérifier si une confirmation est nécessaire
      if (!requiresConfirmation(input.toolName, args)) {
        return {
          requiresConfirmation: false,
          canExecute: true,
        };
      }
      
      // Créer une demande de confirmation
      const request = createConfirmationRequest(
        String(ctx.user.id),
        input.toolName,
        input.serverId,
        args
      );
      
      const riskInfo = getRiskLevelLabel(request.riskLevel);
      
      return {
        requiresConfirmation: true,
        canExecute: false,
        confirmationRequest: {
          id: request.id,
          action: request.action,
          toolName: request.toolName,
          serverName: request.serverName,
          arguments: request.arguments,
          riskLevel: request.riskLevel,
          description: request.description,
          warnings: request.warnings,
          createdAt: request.createdAt.toISOString(),
          expiresAt: request.expiresAt.toISOString(),
          riskLabel: riskInfo.label,
          riskEmoji: riskInfo.emoji,
          riskColor: riskInfo.color,
        },
      };
    }),

  /**
   * Répondre à une demande de confirmation
   */
  respondToConfirmation: protectedProcedure
    .input(z.object({
      requestId: z.string(),
      approved: z.boolean(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = getPendingConfirmation(input.requestId);
      
      if (!request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Demande de confirmation non trouvée ou expirée',
        });
      }
      
      // Vérifier que l'utilisateur est bien celui qui a fait la demande
      if (request.userId !== String(ctx.user.id)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Vous n\'êtes pas autorisé à répondre à cette demande',
        });
      }
      
      const response = processConfirmationResponse(
        input.requestId,
        input.approved,
        input.reason
      );
      
      if (!response) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors du traitement de la réponse',
        });
      }
      
      // Si approuvé, exécuter l'outil
      if (input.approved) {
        const bridge = getMCPBridge();
        
        if (!bridge.isReady()) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Non connecté au MCP Bridge',
          });
        }
        
        try {
          const result = await bridge.callTool(
            request.serverName,
            request.toolName,
            request.arguments
          );
          
          return {
            approved: true,
            executed: true,
            result,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Tool call failed',
          });
        }
      }
      
      return {
        approved: false,
        executed: false,
        reason: input.reason || 'Refusé par l\'utilisateur',
      };
    }),

  /**
   * Obtenir les demandes de confirmation en attente
   */
  getPendingConfirmations: protectedProcedure.query(async ({ ctx }) => {
    const requests = getUserPendingConfirmations(String(ctx.user.id));
    
    return {
      confirmations: requests.map(r => ({
        id: r.id,
        action: r.action,
        toolName: r.toolName,
        serverName: r.serverName,
        arguments: r.arguments,
        riskLevel: r.riskLevel,
        description: r.description,
        warnings: r.warnings,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
      })),
    };
  }),

  /**
   * Appeler un outil MCP (avec vérification de sécurité)
   */
  callTool: protectedProcedure
    .input(z.object({
      serverId: z.string(),
      toolName: z.string(),
      arguments: z.record(z.string(), z.unknown()).optional(),
      confirmationId: z.string().optional(), // ID de confirmation si déjà approuvé
    }))
    .mutation(async ({ ctx, input }) => {
      const bridge = getMCPBridge();
      
      if (!bridge.isReady()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Non connecté au MCP Bridge',
        });
      }

      const args = input.arguments || {};
      
      // Si pas de confirmationId, vérifier si une confirmation est nécessaire
      if (!input.confirmationId && requiresConfirmation(input.toolName, args)) {
        // Créer une demande de confirmation
        const request = createConfirmationRequest(
          String(ctx.user.id),
          input.toolName,
          input.serverId,
          args
        );
        
        const riskInfo = getRiskLevelLabel(request.riskLevel);
        
        return {
          success: false,
          requiresConfirmation: true,
          confirmationRequest: {
            id: request.id,
            action: request.action,
            toolName: request.toolName,
            serverName: request.serverName,
            arguments: request.arguments,
            riskLevel: request.riskLevel,
            description: request.description,
            warnings: request.warnings,
            createdAt: request.createdAt.toISOString(),
            expiresAt: request.expiresAt.toISOString(),
            riskLabel: riskInfo.label,
            riskEmoji: riskInfo.emoji,
            riskColor: riskInfo.color,
          },
        };
      }

      try {
        const result = await bridge.callTool(
          input.serverId,
          input.toolName,
          args
        );

        return { success: true, result };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Tool call failed',
        });
      }
    }),

  /**
   * Obtenir le statut détaillé du bridge
   */
  getDetailedStatus: protectedProcedure.query(async () => {
    const bridge = getMCPBridge();
    
    if (!bridge.isReady()) {
      return bridge.getStatus();
    }

    try {
      return await bridge.getDetailedStatus();
    } catch (error) {
      return bridge.getStatus();
    }
  }),
});
