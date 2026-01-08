/**
 * WebSocket Server - Communication bidirectionnelle pour l'agent
 * 
 * Ce module permet:
 * - Streaming en temps réel des événements de l'agent
 * - Interruption par l'utilisateur
 * - Ajout de messages pendant l'exécution
 * - Reconnexion automatique avec récupération des événements manqués
 */

import { WebSocket, WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { taskQueue } from './taskQueue';
import { persistentWorker, WorkerEvent } from './worker';
import { createStateManager } from './stateManager';
import { EventEmitter } from 'events';

// Types
export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'interrupt' | 'pause' | 'resume' | 'add_message' | 'get_status' | 'get_events';
  taskId?: string;
  data?: Record<string, unknown>;
  lastEventSequence?: number;
}

export interface WebSocketResponse {
  type: 'subscribed' | 'unsubscribed' | 'event' | 'status' | 'events' | 'error' | 'ack';
  taskId?: string;
  data?: Record<string, unknown>;
  events?: Array<{ type: string; data: Record<string, unknown>; sequence: number }>;
  error?: string;
}

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  subscribedTasks: Set<string>;
  lastPing: number;
}

/**
 * Classe AgentWebSocketServer - Gère les connexions WebSocket
 */
export class AgentWebSocketServer {
  private static instance: AgentWebSocketServer;
  private wss: WebSocketServer | null = null;
  private connections: Map<string, ClientConnection> = new Map();
  private taskSubscribers: Map<string, Set<string>> = new Map(); // taskId -> Set<connectionId>
  private eventEmitter: EventEmitter = new EventEmitter();
  private pingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    console.log('[AgentWebSocket] Initialized');
  }

  static getInstance(): AgentWebSocketServer {
    if (!AgentWebSocketServer.instance) {
      AgentWebSocketServer.instance = new AgentWebSocketServer();
    }
    return AgentWebSocketServer.instance;
  }

  /**
   * Attache le serveur WebSocket à un serveur HTTP existant
   */
  attach(server: HttpServer, path: string = '/ws/agent'): void {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    // Écouter les événements du worker
    persistentWorker.onEvent((event) => {
      this.broadcastToTaskSubscribers(event.taskId, {
        type: 'event',
        taskId: event.taskId,
        data: {
          eventType: event.type,
          ...event.data,
          timestamp: event.timestamp.toISOString()
        }
      });
    });

    // Ping périodique pour garder les connexions actives
    this.pingInterval = setInterval(() => {
      this.pingAll();
    }, 30000);

    console.log(`[AgentWebSocket] Server attached at ${path}`);
  }

  /**
   * Gère une nouvelle connexion
   */
  private handleConnection(ws: WebSocket, req: any): void {
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Extraire l'userId du query string ou des headers
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId') || 'anonymous';

    const connection: ClientConnection = {
      ws,
      userId,
      subscribedTasks: new Set(),
      lastPing: Date.now()
    };

    this.connections.set(connectionId, connection);
    console.log(`[AgentWebSocket] New connection: ${connectionId} (user: ${userId})`);

    // Gérer les messages
    ws.on('message', async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        await this.handleMessage(connectionId, message);
      } catch (error: any) {
        this.send(ws, { type: 'error', error: error.message });
      }
    });

    // Gérer la fermeture
    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    // Gérer les erreurs
    ws.on('error', (error) => {
      console.error(`[AgentWebSocket] Connection ${connectionId} error:`, error);
    });

    // Gérer les pongs
    ws.on('pong', () => {
      connection.lastPing = Date.now();
    });

    // Envoyer un message de bienvenue
    this.send(ws, {
      type: 'ack',
      data: { connectionId, message: 'Connected to Phoenix Agent WebSocket' }
    });
  }

  /**
   * Gère un message entrant
   */
  private async handleMessage(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    console.log(`[AgentWebSocket] Message from ${connectionId}:`, message.type);

    switch (message.type) {
      case 'subscribe':
        if (message.taskId) {
          await this.subscribeToTask(connectionId, message.taskId, message.lastEventSequence);
        }
        break;

      case 'unsubscribe':
        if (message.taskId) {
          this.unsubscribeFromTask(connectionId, message.taskId);
        }
        break;

      case 'interrupt':
        if (message.taskId) {
          await this.interruptTask(connectionId, message.taskId);
        }
        break;

      case 'pause':
        if (message.taskId) {
          await this.pauseTask(connectionId, message.taskId);
        }
        break;

      case 'resume':
        if (message.taskId) {
          await this.resumeTask(connectionId, message.taskId);
        }
        break;

      case 'add_message':
        if (message.taskId && message.data?.content) {
          await this.addMessageToTask(connectionId, message.taskId, message.data.content as string);
        }
        break;

      case 'get_status':
        await this.sendStatus(connectionId, message.taskId);
        break;

      case 'get_events':
        if (message.taskId) {
          await this.sendEvents(connectionId, message.taskId, message.lastEventSequence || 0);
        }
        break;

      default:
        this.send(connection.ws, { type: 'error', error: `Unknown message type: ${message.type}` });
    }
  }

  /**
   * S'abonne aux événements d'une tâche
   */
  private async subscribeToTask(connectionId: string, taskId: string, lastEventSequence?: number): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Ajouter à la liste des abonnés
    connection.subscribedTasks.add(taskId);

    if (!this.taskSubscribers.has(taskId)) {
      this.taskSubscribers.set(taskId, new Set());
    }
    this.taskSubscribers.get(taskId)!.add(connectionId);

    // Envoyer les événements manqués si demandé
    if (lastEventSequence !== undefined) {
      const stateManager = createStateManager(taskId);
      const missedEvents = await stateManager.getEventsSince(lastEventSequence);
      
      if (missedEvents.length > 0) {
        this.send(connection.ws, {
          type: 'events',
          taskId,
          events: missedEvents
        });
      }
    }

    this.send(connection.ws, {
      type: 'subscribed',
      taskId,
      data: { message: `Subscribed to task ${taskId}` }
    });

    console.log(`[AgentWebSocket] ${connectionId} subscribed to ${taskId}`);
  }

  /**
   * Se désabonne d'une tâche
   */
  private unsubscribeFromTask(connectionId: string, taskId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscribedTasks.delete(taskId);
    this.taskSubscribers.get(taskId)?.delete(connectionId);

    this.send(connection.ws, {
      type: 'unsubscribed',
      taskId,
      data: { message: `Unsubscribed from task ${taskId}` }
    });

    console.log(`[AgentWebSocket] ${connectionId} unsubscribed from ${taskId}`);
  }

  /**
   * Interrompt une tâche
   */
  private async interruptTask(connectionId: string, taskId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      await taskQueue.cancel(taskId);
      
      this.send(connection.ws, {
        type: 'ack',
        taskId,
        data: { message: `Task ${taskId} interrupted` }
      });

      // Notifier tous les abonnés
      this.broadcastToTaskSubscribers(taskId, {
        type: 'event',
        taskId,
        data: {
          eventType: 'task_interrupted',
          message: 'Task was interrupted by user',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      this.send(connection.ws, { type: 'error', taskId, error: error.message });
    }
  }

  /**
   * Met une tâche en pause
   */
  private async pauseTask(connectionId: string, taskId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      await taskQueue.pause(taskId);
      
      this.send(connection.ws, {
        type: 'ack',
        taskId,
        data: { message: `Task ${taskId} paused` }
      });

      this.broadcastToTaskSubscribers(taskId, {
        type: 'event',
        taskId,
        data: {
          eventType: 'task_paused',
          message: 'Task was paused by user',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      this.send(connection.ws, { type: 'error', taskId, error: error.message });
    }
  }

  /**
   * Reprend une tâche en pause
   */
  private async resumeTask(connectionId: string, taskId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      await taskQueue.resume(taskId);
      
      this.send(connection.ws, {
        type: 'ack',
        taskId,
        data: { message: `Task ${taskId} resumed` }
      });

      this.broadcastToTaskSubscribers(taskId, {
        type: 'event',
        taskId,
        data: {
          eventType: 'task_resumed',
          message: 'Task was resumed',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      this.send(connection.ws, { type: 'error', taskId, error: error.message });
    }
  }

  /**
   * Ajoute un message à une tâche en cours
   */
  private async addMessageToTask(connectionId: string, taskId: string, content: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const stateManager = createStateManager(taskId);
      
      // Ajouter le message comme observation
      await stateManager.saveStep({
        type: 'observe',
        content: `[Message utilisateur] ${content}`
      });

      // Mettre à jour la mémoire de travail
      await stateManager.updateWorkingMemory('lastUserMessage', {
        content,
        timestamp: new Date().toISOString()
      });

      this.send(connection.ws, {
        type: 'ack',
        taskId,
        data: { message: 'Message added to task' }
      });

      this.broadcastToTaskSubscribers(taskId, {
        type: 'event',
        taskId,
        data: {
          eventType: 'user_message',
          content,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      this.send(connection.ws, { type: 'error', taskId, error: error.message });
    }
  }

  /**
   * Envoie le statut du worker et/ou d'une tâche
   */
  private async sendStatus(connectionId: string, taskId?: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const workerStatus = persistentWorker.getStatus();
    let taskStatus = null;

    if (taskId) {
      taskStatus = await taskQueue.getTask(taskId);
    }

    this.send(connection.ws, {
      type: 'status',
      taskId,
      data: {
        worker: workerStatus,
        task: taskStatus,
        queueLength: await taskQueue.getQueueLength()
      }
    });
  }

  /**
   * Envoie les événements depuis une séquence donnée
   */
  private async sendEvents(connectionId: string, taskId: string, lastSequence: number): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const stateManager = createStateManager(taskId);
    const events = await stateManager.getEventsSince(lastSequence);

    this.send(connection.ws, {
      type: 'events',
      taskId,
      events
    });
  }

  /**
   * Gère une déconnexion
   */
  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Supprimer des abonnements
    Array.from(connection.subscribedTasks).forEach(taskId => {
      this.taskSubscribers.get(taskId)?.delete(connectionId);
    });

    this.connections.delete(connectionId);
    console.log(`[AgentWebSocket] Connection ${connectionId} closed`);
  }

  /**
   * Envoie un message à tous les abonnés d'une tâche
   */
  private broadcastToTaskSubscribers(taskId: string, message: WebSocketResponse): void {
    const subscribers = this.taskSubscribers.get(taskId);
    if (!subscribers) return;

    Array.from(subscribers).forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        this.send(connection.ws, message);
      }
    });
  }

  /**
   * Envoie un message à une connexion
   */
  private send(ws: WebSocket, message: WebSocketResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Ping toutes les connexions
   */
  private pingAll(): void {
    const now = Date.now();
    const timeout = 60000; // 60 secondes

    Array.from(this.connections.entries()).forEach(([connectionId, connection]) => {
      if (now - connection.lastPing > timeout) {
        // Connexion inactive, fermer
        connection.ws.terminate();
        this.handleDisconnection(connectionId);
      } else if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.ping();
      }
    });
  }

  /**
   * Ferme le serveur WebSocket
   */
  close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    Array.from(this.connections.values()).forEach(connection => {
      connection.ws.close();
    });
    this.connections.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('[AgentWebSocket] Server closed');
  }

  /**
   * Récupère le nombre de connexions actives
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Récupère les statistiques
   */
  getStats(): {
    connections: number;
    tasks: number;
    subscriptions: number;
  } {
    let totalSubscriptions = 0;
    Array.from(this.taskSubscribers.values()).forEach(subscribers => {
      totalSubscriptions += subscribers.size;
    });

    return {
      connections: this.connections.size,
      tasks: this.taskSubscribers.size,
      subscriptions: totalSubscriptions
    };
  }
}

// Export singleton
export const agentWebSocket = AgentWebSocketServer.getInstance();
export default AgentWebSocketServer;
