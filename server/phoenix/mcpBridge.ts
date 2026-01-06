/**
 * MCP Bridge Client for Phoenix
 * 
 * Ce module permet à Phoenix de se connecter au MCP Bridge
 * tournant sur le PC de l'utilisateur.
 */

import WebSocket from 'ws';
import { randomUUID } from 'crypto';

export interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: 'available' | 'running' | 'stopped' | 'error' | 'detected';
  source: 'config' | 'auto-detect';
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPBridgeConfig {
  url: string;
  secret: string;
}

export interface MCPBridgeStatus {
  connected: boolean;
  authenticated: boolean;
  activeMCPs: string[];
  uptime?: number;
  lastPing?: number;
  error?: string;
}

type MessageHandler = (message: unknown) => void;
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class MCPBridgeClient {
  private ws: WebSocket | null = null;
  private config: MCPBridgeConfig | null = null;
  private status: MCPBridgeStatus = {
    connected: false,
    authenticated: false,
    activeMCPs: [],
  };
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  constructor() {
    // Initialisation
  }

  /**
   * Connecter au MCP Bridge
   */
  async connect(config: MCPBridgeConfig): Promise<boolean> {
    this.config = config;
    
    return new Promise((resolve, reject) => {
      try {
        console.log(`[MCPBridge] Connexion à ${config.url}...`);
        
        this.ws = new WebSocket(config.url);

        this.ws.on('open', async () => {
          console.log('[MCPBridge] WebSocket connecté');
          this.status.connected = true;
          
          // Authentification
          const authResult = await this.authenticate(config.secret);
          if (authResult) {
            this.reconnectAttempts = 0;
            resolve(true);
          } else {
            reject(new Error('Authentication failed'));
          }
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('close', () => {
          console.log('[MCPBridge] WebSocket fermé');
          this.status.connected = false;
          this.status.authenticated = false;
          this.handleDisconnect();
        });

        this.ws.on('error', (error: Error) => {
          console.error('[MCPBridge] Erreur WebSocket:', error.message);
          this.status.error = error.message;
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Authentification avec le secret
   * Format attendu par le bridge: { id, type: 'auth', payload: { secret } }
   */
  private async authenticate(secret: string): Promise<boolean> {
    return new Promise((resolve) => {
      const authId = randomUUID();
      
      const handler = (message: unknown) => {
        const msg = message as { type: string; id?: string; data?: { success?: boolean; message?: string }; payload?: { success?: boolean; message?: string }; error?: string };
        console.log('[MCPBridge] Auth response:', JSON.stringify(msg));
        
        // Le bridge répond avec type: 'response' et payload.success: true
        if (msg.type === 'response' && msg.id === authId) {
          if (msg.data?.success || msg.payload?.success) {
            this.status.authenticated = true;
            console.log('[MCPBridge] Authentifié avec succès');
            resolve(true);
          } else {
            console.error('[MCPBridge] Échec authentification:', msg.data?.message || msg.payload?.message || msg.error);
            resolve(false);
          }
        } else if (msg.type === 'error') {
          console.error('[MCPBridge] Erreur authentification:', msg.error);
          resolve(false);
        }
      };

      this.on('response', handler);
      this.on('error', handler);

      // Format correct pour le bridge: { id, type, payload }
      this.send({ 
        id: authId,
        type: 'auth', 
        payload: { secret } 
      });

      // Timeout
      setTimeout(() => {
        this.off('response', handler);
        this.off('error', handler);
        resolve(false);
      }, 10000);
    });
  }

  /**
   * Déconnecter du bridge
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status = {
      connected: false,
      authenticated: false,
      activeMCPs: [],
    };
  }

  /**
   * Gestion de la reconnexion automatique
   */
  private handleDisconnect(): void {
    if (this.config && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[MCPBridge] Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
      setTimeout(() => {
        if (this.config) {
          this.connect(this.config).catch(() => {});
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  /**
   * Envoyer un message au bridge
   */
  private send(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Gérer les messages entrants
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as { type: string; requestId?: string };
      
      // Vérifier si c'est une réponse à une requête en attente
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const pending = this.pendingRequests.get(message.requestId)!;
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.requestId);
        pending.resolve(message);
        return;
      }

      // Notifier les handlers
      const handlers = this.messageHandlers.get(message.type) || [];
      for (const handler of handlers) {
        handler(message);
      }

      // Handler global
      const allHandlers = this.messageHandlers.get('*') || [];
      for (const handler of allHandlers) {
        handler(message);
      }

    } catch (error) {
      console.error('[MCPBridge] Erreur parsing message:', error);
    }
  }

  /**
   * Ajouter un handler pour un type de message
   */
  on(type: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * Handler one-time
   */
  once(type: string, handler: MessageHandler): void {
    const wrappedHandler = (message: unknown) => {
      handler(message);
      this.off(type, wrappedHandler);
    };
    this.on(type, wrappedHandler);
  }

  /**
   * Retirer un handler
   */
  off(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Envoyer une requête et attendre la réponse
   */
  private async request<T>(message: Record<string, unknown>, timeout = 30000): Promise<T> {
    const requestId = randomUUID();
    
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle,
      });

      this.send({ ...message, requestId });
    });
  }

  /**
   * Obtenir le statut du bridge
   */
  getStatus(): MCPBridgeStatus {
    return { ...this.status };
  }

  /**
   * Vérifier si connecté et authentifié
   */
  isReady(): boolean {
    return this.status.connected && this.status.authenticated;
  }

  /**
   * Ping le bridge
   */
  async ping(): Promise<number> {
    const start = Date.now();
    await this.request({ type: 'ping' });
    const latency = Date.now() - start;
    this.status.lastPing = latency;
    return latency;
  }

  /**
   * Découvrir les serveurs MCP disponibles
   */
  async discoverServers(): Promise<MCPServer[]> {
    return new Promise((resolve) => {
      this.once('servers', (message: unknown) => {
        const msg = message as { servers: MCPServer[] };
        resolve(msg.servers || []);
      });
      this.send({ type: 'discover' });
      
      setTimeout(() => resolve([]), 10000);
    });
  }

  /**
   * Démarrer un serveur MCP
   */
  async startMCP(serverId: string, config: Partial<MCPServer>): Promise<{ success: boolean; error?: string; serverInfo?: unknown }> {
    return new Promise((resolve) => {
      this.once('start_result', (message: unknown) => {
        const msg = message as { success: boolean; error?: string; serverInfo?: unknown };
        if (msg.success) {
          this.status.activeMCPs.push(serverId);
        }
        resolve(msg);
      });
      this.send({ type: 'start_mcp', serverId, config });
      
      setTimeout(() => resolve({ success: false, error: 'Timeout' }), 60000);
    });
  }

  /**
   * Arrêter un serveur MCP
   */
  async stopMCP(serverId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.once('stop_result', (message: unknown) => {
        const msg = message as { success: boolean; error?: string };
        if (msg.success) {
          this.status.activeMCPs = this.status.activeMCPs.filter(id => id !== serverId);
        }
        resolve(msg);
      });
      this.send({ type: 'stop_mcp', serverId });
      
      setTimeout(() => resolve({ success: false, error: 'Timeout' }), 10000);
    });
  }

  /**
   * Lister les outils d'un serveur MCP
   */
  async listTools(serverId: string): Promise<MCPTool[]> {
    return new Promise((resolve) => {
      this.once('tools_list', (message: unknown) => {
        const msg = message as { tools: MCPTool[] };
        resolve(msg.tools || []);
      });
      this.once('tools_error', () => {
        resolve([]);
      });
      this.send({ type: 'list_tools', serverId });
      
      setTimeout(() => resolve([]), 30000);
    });
  }

  /**
   * Appeler un outil MCP
   */
  async callTool(serverId: string, toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const requestId = randomUUID();
    
    return new Promise((resolve, reject) => {
      const handleResult = (message: unknown) => {
        const msg = message as { requestId: string; result?: unknown; error?: string };
        if (msg.requestId === requestId) {
          if (msg.result !== undefined) {
            resolve(msg.result);
          }
        }
      };

      const handleError = (message: unknown) => {
        const msg = message as { requestId: string; error?: string };
        if (msg.requestId === requestId) {
          reject(new Error(msg.error || 'Tool call failed'));
        }
      };

      this.once('tool_result', handleResult);
      this.once('tool_error', handleError);

      this.send({ 
        type: 'call_tool', 
        requestId,
        serverId, 
        toolName, 
        arguments: args 
      });

      setTimeout(() => {
        reject(new Error('Tool call timeout'));
      }, 60000);
    });
  }

  /**
   * Obtenir le statut détaillé du bridge
   */
  async getDetailedStatus(): Promise<MCPBridgeStatus> {
    return new Promise((resolve) => {
      this.once('status', (message: unknown) => {
        const msg = message as MCPBridgeStatus;
        this.status = { ...this.status, ...msg };
        resolve(this.status);
      });
      this.send({ type: 'status' });
      
      setTimeout(() => resolve(this.status), 5000);
    });
  }
}

// Instance singleton pour Phoenix
let bridgeInstance: MCPBridgeClient | null = null;

export function getMCPBridge(): MCPBridgeClient {
  if (!bridgeInstance) {
    bridgeInstance = new MCPBridgeClient();
  }
  return bridgeInstance;
}

export function resetMCPBridge(): void {
  if (bridgeInstance) {
    bridgeInstance.disconnect();
    bridgeInstance = null;
  }
}
