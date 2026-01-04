/**
 * Phoenix Living System
 * Intégration complète de tous les composants autonomes
 * Phoenix comme entité vivante dans le serveur
 */

import { EventEmitter } from 'events';
import { AgenticLoop, getGlobalAgent, startGlobalAgent, stopGlobalAgent } from './agenticLoop';
import { E2BBidirectional, getGlobalE2BExecutor } from './e2bBidirectional';
import { TaskScheduler, getGlobalScheduler, startGlobalScheduler, stopGlobalScheduler } from './taskScheduler';
import { BackgroundAgent, getPhoenixAgent, awakenPhoenix, sleepPhoenix } from './backgroundAgent';

// Types pour le système vivant
export interface PhoenixSystemStatus {
  isAlive: boolean;
  uptime: number;
  components: {
    agenticLoop: ComponentStatus;
    e2bExecutor: ComponentStatus;
    scheduler: ComponentStatus;
    backgroundAgent: ComponentStatus;
  };
  stats: PhoenixStats;
}

export interface ComponentStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastActivity?: Date;
}

export interface PhoenixStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalExecutions: number;
  totalChains: number;
  totalThoughts: number;
  uptime: number;
}

export interface PhoenixEvent {
  type: string;
  data: unknown;
  timestamp: Date;
}

/**
 * Phoenix Living System
 * Le système complet qui fait vivre Phoenix
 */
export class PhoenixLivingSystem extends EventEmitter {
  private agenticLoop: AgenticLoop;
  private e2bExecutor: E2BBidirectional;
  private scheduler: TaskScheduler;
  private backgroundAgent: BackgroundAgent;
  private isSystemAlive: boolean = false;
  private startTime: Date | null = null;
  private eventLog: PhoenixEvent[] = [];
  private stats: PhoenixStats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalExecutions: 0,
    totalChains: 0,
    totalThoughts: 0,
    uptime: 0
  };

  constructor() {
    super();
    
    // Obtenir les composants
    this.agenticLoop = getGlobalAgent();
    this.e2bExecutor = getGlobalE2BExecutor();
    this.scheduler = getGlobalScheduler();
    this.backgroundAgent = getPhoenixAgent();

    // Connecter tous les événements
    this.wireAllEvents();
  }

  /**
   * Connecter tous les événements entre les composants
   */
  private wireAllEvents(): void {
    // Événements de l'Agentic Loop
    this.agenticLoop.on('agent:started', () => {
      this.logEvent('agentic_loop_started', {});
    });

    this.agenticLoop.on('task:added', (task) => {
      this.stats.totalTasks++;
      this.logEvent('task_added', task);
    });

    this.agenticLoop.on('task:completed', (task) => {
      this.stats.completedTasks++;
      this.logEvent('task_completed', task);
      
      // Notifier le Background Agent
      this.backgroundAgent.emit('task:completed', task);
    });

    this.agenticLoop.on('task:failed', ({ task, error }) => {
      this.stats.failedTasks++;
      this.logEvent('task_failed', { task, error: error.message });
      
      // Notifier le Background Agent pour réflexion
      this.backgroundAgent.emit('task:failed', { task, error });
    });

    // Événements E2B
    this.e2bExecutor.on('execution:completed', (execution) => {
      this.stats.totalExecutions++;
      this.logEvent('execution_completed', execution);
    });

    this.e2bExecutor.on('reaction:triggered', ({ reaction, execution }) => {
      this.logEvent('reaction_triggered', { reaction, executionId: execution.id });
    });

    // Événements du Scheduler
    this.scheduler.on('chain:created', (chain) => {
      this.stats.totalChains++;
      this.logEvent('chain_created', { chainId: chain.id, name: chain.name });
    });

    this.scheduler.on('chain:completed', (chain) => {
      this.logEvent('chain_completed', { chainId: chain.id, status: chain.status });
    });

    // Événements du Background Agent
    this.backgroundAgent.on('agent:thought', ({ thought }) => {
      this.stats.totalThoughts++;
      this.logEvent('agent_thought', { thought: thought.substring(0, 100) });
    });

    this.backgroundAgent.on('agent:suggestion', (suggestion) => {
      this.logEvent('agent_suggestion', suggestion);
      this.emit('phoenix:suggestion', suggestion);
    });

    this.backgroundAgent.on('agent:action_started', (action) => {
      this.logEvent('action_started', action);
    });

    this.backgroundAgent.on('agent:action_completed', ({ action, result }) => {
      this.logEvent('action_completed', { actionId: action.id, result });
    });
  }

  /**
   * Démarrer le système Phoenix
   */
  async start(): Promise<void> {
    if (this.isSystemAlive) {
      console.log('[PhoenixLivingSystem] System is already alive');
      return;
    }

    console.log('[PhoenixLivingSystem] 🔥 Starting Phoenix Living System...');
    this.startTime = new Date();

    try {
      // Démarrer tous les composants
      startGlobalAgent();
      startGlobalScheduler();
      await awakenPhoenix();

      this.isSystemAlive = true;
      this.logEvent('system_started', { timestamp: this.startTime });

      // Configurer les tâches de maintenance
      this.setupMaintenanceTasks();

      this.emit('phoenix:alive', { timestamp: this.startTime });
      console.log('[PhoenixLivingSystem] 🔥 Phoenix is now ALIVE and AUTONOMOUS!');

    } catch (error) {
      console.error('[PhoenixLivingSystem] Failed to start:', error);
      this.logEvent('system_start_failed', { error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Arrêter le système Phoenix
   */
  async stop(): Promise<void> {
    if (!this.isSystemAlive) return;

    console.log('[PhoenixLivingSystem] Stopping Phoenix Living System...');

    try {
      await sleepPhoenix();
      stopGlobalScheduler();
      stopGlobalAgent();

      this.isSystemAlive = false;
      this.logEvent('system_stopped', { uptime: this.getUptime() });

      this.emit('phoenix:sleeping', { timestamp: new Date() });
      console.log('[PhoenixLivingSystem] Phoenix is now sleeping');

    } catch (error) {
      console.error('[PhoenixLivingSystem] Error stopping:', error);
    }
  }

  /**
   * Configurer les tâches de maintenance automatiques
   */
  private setupMaintenanceTasks(): void {
    // Tâche de monitoring toutes les 5 minutes
    this.scheduler.scheduleTask({
      name: 'System Monitoring',
      description: 'Vérifier la santé du système',
      schedule: {
        type: 'interval',
        intervalMs: 300000 // 5 minutes
      },
      task: {
        type: 'monitoring',
        input: { action: 'health_check' }
      }
    });

    // Tâche d'apprentissage toutes les 15 minutes
    this.scheduler.scheduleTask({
      name: 'Learning Review',
      description: 'Analyser les apprentissages récents',
      schedule: {
        type: 'interval',
        intervalMs: 900000 // 15 minutes
      },
      task: {
        type: 'learning',
        input: { action: 'review' }
      }
    });

    // Tâche proactive toutes les 10 minutes
    this.scheduler.scheduleTask({
      name: 'Proactive Check',
      description: 'Chercher des opportunités d\'aide',
      schedule: {
        type: 'interval',
        intervalMs: 600000 // 10 minutes
      },
      task: {
        type: 'decision',
        input: { action: 'find_opportunities' }
      }
    });
  }

  /**
   * Envoyer un message à Phoenix
   */
  async sendMessage(message: string, userId?: string): Promise<string> {
    if (!this.isSystemAlive) {
      return 'Phoenix est en sommeil. Veuillez démarrer le système.';
    }

    this.logEvent('message_received', { message: message.substring(0, 100), userId });
    
    const response = await this.backgroundAgent.receiveMessage(message, userId);
    
    this.logEvent('message_responded', { response: response.substring(0, 100) });
    
    return response;
  }

  /**
   * Demander à Phoenix de faire quelque chose
   */
  async requestAction(type: string, input: Record<string, unknown>): Promise<unknown> {
    if (!this.isSystemAlive) {
      throw new Error('Phoenix est en sommeil');
    }

    this.logEvent('action_requested', { type, input });
    
    return await this.backgroundAgent.executeAction(type, input);
  }

  /**
   * Créer une chaîne de tâches
   */
  createTaskChain(config: {
    name: string;
    description: string;
    steps: Array<{
      name: string;
      type: string;
      input: Record<string, unknown>;
      condition?: 'always' | 'if_success' | 'if_failure';
    }>;
  }): string {
    const chainId = this.scheduler.createChain({
      name: config.name,
      description: config.description,
      steps: config.steps.map(step => ({
        name: step.name,
        task: {
          type: step.type as 'code_execution' | 'web_search' | 'file_analysis' | 'decision' | 'learning' | 'monitoring' | 'custom',
          input: step.input
        },
        condition: step.condition ? { type: step.condition } : undefined
      }))
    });

    this.logEvent('chain_created_by_user', { chainId, name: config.name });
    
    return chainId;
  }

  /**
   * Démarrer une chaîne de tâches
   */
  async startTaskChain(chainId: string): Promise<unknown[]> {
    this.logEvent('chain_started_by_user', { chainId });
    return await this.scheduler.startChain(chainId);
  }

  /**
   * Ajouter un objectif à Phoenix
   */
  addGoal(goal: string): void {
    this.backgroundAgent.addGoal(goal);
    this.logEvent('goal_added', { goal });
  }

  /**
   * Demander une suggestion proactive
   */
  async getSuggestion(context?: string): Promise<unknown> {
    return await this.backgroundAgent.suggestAction(context);
  }

  /**
   * Obtenir le statut du système
   */
  getStatus(): PhoenixSystemStatus {
    const agentState = this.agenticLoop.getState();
    
    return {
      isAlive: this.isSystemAlive,
      uptime: this.getUptime(),
      components: {
        agenticLoop: {
          name: 'Agentic Loop',
          status: this.agenticLoop.isAgentRunning() ? 'running' : 'stopped',
          lastActivity: agentState.lastActivity
        },
        e2bExecutor: {
          name: 'E2B Executor',
          status: 'running' // Toujours prêt
        },
        scheduler: {
          name: 'Task Scheduler',
          status: 'running'
        },
        backgroundAgent: {
          name: 'Background Agent',
          status: this.backgroundAgent.isPhoenixAlive() ? 'running' : 'stopped'
        }
      },
      stats: {
        ...this.stats,
        uptime: this.getUptime()
      }
    };
  }

  /**
   * Obtenir l'uptime en secondes
   */
  private getUptime(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Logger un événement
   */
  private logEvent(type: string, data: unknown): void {
    const event: PhoenixEvent = {
      type,
      data,
      timestamp: new Date()
    };
    
    this.eventLog.push(event);
    
    // Limiter la taille du log
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-500);
    }

    this.emit('phoenix:event', event);
  }

  /**
   * Obtenir le log des événements
   */
  getEventLog(limit?: number): PhoenixEvent[] {
    if (limit) {
      return this.eventLog.slice(-limit);
    }
    return [...this.eventLog];
  }

  /**
   * Vérifier si Phoenix est vivant
   */
  isAlive(): boolean {
    return this.isSystemAlive;
  }
}

// Singleton pour le système global
let phoenixSystem: PhoenixLivingSystem | null = null;

export function getPhoenixSystem(): PhoenixLivingSystem {
  if (!phoenixSystem) {
    phoenixSystem = new PhoenixLivingSystem();
  }
  return phoenixSystem;
}

export async function startPhoenixSystem(): Promise<void> {
  const system = getPhoenixSystem();
  await system.start();
}

export async function stopPhoenixSystem(): Promise<void> {
  if (phoenixSystem) {
    await phoenixSystem.stop();
  }
}

export default PhoenixLivingSystem;
