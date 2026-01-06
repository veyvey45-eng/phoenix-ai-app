/**
 * MCP Bridge Router
 * 
 * Endpoints tRPC pour gérer la connexion au MCP Bridge
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { getMCPBridge, resetMCPBridge, type MCPBridgeConfig } from '../phoenix/mcpBridge';
import { TRPCError } from '@trpc/server';

// Stockage des configurations par utilisateur (en mémoire pour l'instant)
const userBridgeConfigs = new Map<string, MCPBridgeConfig>();

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
   * Appeler un outil MCP
   */
  callTool: protectedProcedure
    .input(z.object({
      serverId: z.string(),
      toolName: z.string(),
      arguments: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const bridge = getMCPBridge();
      
      if (!bridge.isReady()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Non connecté au MCP Bridge',
        });
      }

      try {
        const result = await bridge.callTool(
          input.serverId,
          input.toolName,
          input.arguments || {}
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
