/**
 * Phoenix Task Scheduler
 * Système de scheduling intelligent pour le chaînage des tâches
 * "Si A réussit → faire B"
 */

import { EventEmitter } from 'events';
import { getGlobalAgent, AgentTask } from './agenticLoop';

// Types pour le Scheduler
export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  schedule: TaskSchedule;
  task: TaskDefinition;
  status: 'active' | 'paused' | 'completed' | 'failed';
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  maxRuns?: number;
  createdAt: Date;
}

export interface TaskSchedule {
  type: 'once' | 'interval' | 'cron' | 'trigger' | 'chain';
  // Pour 'once': exécuter une seule fois
  runAt?: Date;
  // Pour 'interval': répéter à intervalle
  intervalMs?: number;
  // Pour 'cron': expression cron
  cronExpression?: string;
  // Pour 'trigger': déclenché par un événement
  triggerEvent?: string;
  triggerCondition?: (data: unknown) => boolean;
  // Pour 'chain': déclenché après une autre tâche
  afterTask?: string;
  afterCondition?: 'success' | 'failure' | 'any';
}

export interface TaskDefinition {
  type: 'code_execution' | 'web_search' | 'file_analysis' | 'decision' | 'learning' | 'monitoring' | 'custom';
  input: Record<string, unknown>;
  timeout?: number;
  retries?: number;
}

export interface TaskChain {
  id: string;
  name: string;
  description: string;
  steps: TaskChainStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  currentStep: number;
  results: TaskChainResult[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskChainStep {
  id: string;
  name: string;
  task: TaskDefinition;
  condition?: ChainCondition;
  onSuccess?: string; // ID de l'étape suivante en cas de succès
  onFailure?: string; // ID de l'étape suivante en cas d'échec
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export interface ChainCondition {
  type: 'always' | 'if_success' | 'if_failure' | 'if_output_contains' | 'if_output_matches' | 'custom';
  value?: string | RegExp;
  customCheck?: (previousResult: TaskChainResult) => boolean;
}

export interface TaskChainResult {
  stepId: string;
  status: 'success' | 'failure' | 'skipped';
  output?: unknown;
  error?: string;
  duration: number;
  timestamp: Date;
}

/**
 * Phoenix Task Scheduler
 * Gère le scheduling et le chaînage des tâches
 */
export class TaskScheduler extends EventEmitter {
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private taskChains: Map<string, TaskChain> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor() {
    super();
  }

  /**
   * Démarrer le scheduler
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('scheduler:started');
    console.log('[TaskScheduler] Started');

    // Activer toutes les tâches planifiées
    this.scheduledTasks.forEach((task, id) => {
      if (task.status === 'active') {
        this.activateTask(id);
      }
    });
  }

  /**
   * Arrêter le scheduler
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    // Arrêter tous les timers
    this.timers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.timers.clear();

    this.emit('scheduler:stopped');
    console.log('[TaskScheduler] Stopped');
  }

  /**
   * Planifier une nouvelle tâche
   */
  scheduleTask(config: {
    name: string;
    description: string;
    schedule: TaskSchedule;
    task: TaskDefinition;
    maxRuns?: number;
  }): string {
    const scheduledTask: ScheduledTask = {
      id: `scheduled-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: config.name,
      description: config.description,
      schedule: config.schedule,
      task: config.task,
      status: 'active',
      runCount: 0,
      maxRuns: config.maxRuns,
      createdAt: new Date()
    };

    // Calculer la prochaine exécution
    scheduledTask.nextRun = this.calculateNextRun(config.schedule);

    this.scheduledTasks.set(scheduledTask.id, scheduledTask);
    
    if (this.isRunning) {
      this.activateTask(scheduledTask.id);
    }

    this.emit('task:scheduled', scheduledTask);
    console.log(`[TaskScheduler] Task scheduled: ${scheduledTask.id} - ${scheduledTask.name}`);
    
    return scheduledTask.id;
  }

  /**
   * Créer une chaîne de tâches
   */
  createChain(config: {
    name: string;
    description: string;
    steps: Array<{
      name: string;
      task: TaskDefinition;
      condition?: ChainCondition;
      onSuccess?: string;
      onFailure?: string;
      retryOnFailure?: boolean;
      maxRetries?: number;
    }>;
  }): string {
    const chain: TaskChain = {
      id: `chain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: config.name,
      description: config.description,
      steps: config.steps.map((step, index) => ({
        id: `step-${index}`,
        name: step.name,
        task: step.task,
        condition: step.condition,
        onSuccess: step.onSuccess || (index < config.steps.length - 1 ? `step-${index + 1}` : undefined),
        onFailure: step.onFailure,
        retryOnFailure: step.retryOnFailure,
        maxRetries: step.maxRetries
      })),
      status: 'pending',
      currentStep: 0,
      results: [],
      createdAt: new Date()
    };

    this.taskChains.set(chain.id, chain);
    this.emit('chain:created', chain);
    console.log(`[TaskScheduler] Chain created: ${chain.id} - ${chain.name}`);
    
    return chain.id;
  }

  /**
   * Démarrer une chaîne de tâches
   */
  async startChain(chainId: string): Promise<TaskChainResult[]> {
    const chain = this.taskChains.get(chainId);
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }

    chain.status = 'running';
    chain.startedAt = new Date();
    chain.currentStep = 0;
    chain.results = [];

    this.emit('chain:started', chain);
    console.log(`[TaskScheduler] Chain started: ${chain.id}`);

    try {
      await this.executeChainStep(chain);
      
      chain.status = chain.results.every(r => r.status === 'success') ? 'completed' : 'failed';
      chain.completedAt = new Date();
      
      this.emit('chain:completed', chain);
      console.log(`[TaskScheduler] Chain completed: ${chain.id} - Status: ${chain.status}`);
      
      return chain.results;

    } catch (error) {
      chain.status = 'failed';
      chain.completedAt = new Date();
      
      this.emit('chain:failed', { chain, error });
      console.error(`[TaskScheduler] Chain failed: ${chain.id}`, error);
      
      return chain.results;
    }
  }

  /**
   * Exécuter une étape de la chaîne
   */
  private async executeChainStep(chain: TaskChain): Promise<void> {
    if (chain.currentStep >= chain.steps.length) {
      return;
    }

    const step = chain.steps[chain.currentStep];
    const previousResult = chain.results.length > 0 ? chain.results[chain.results.length - 1] : null;

    // Vérifier la condition
    if (step.condition && previousResult) {
      const shouldExecute = this.checkCondition(step.condition, previousResult);
      if (!shouldExecute) {
        chain.results.push({
          stepId: step.id,
          status: 'skipped',
          duration: 0,
          timestamp: new Date()
        });
        
        // Passer à l'étape suivante
        chain.currentStep++;
        await this.executeChainStep(chain);
        return;
      }
    }

    this.emit('chain:step_started', { chain, step });
    console.log(`[TaskScheduler] Executing step: ${step.id} - ${step.name}`);

    const startTime = Date.now();
    let retries = 0;
    let success = false;
    let output: unknown;
    let error: string | undefined;

    while (!success && retries <= (step.maxRetries || 0)) {
      try {
        // Exécuter la tâche via l'agent
        const agent = getGlobalAgent();
        const taskId = agent.addTask({
          type: step.task.type as 'code_execution' | 'web_search' | 'file_analysis' | 'decision' | 'learning' | 'monitoring',
          description: step.name,
          priority: 'high',
          input: step.task.input
        });

        // Attendre que la tâche soit complétée (avec timeout)
        output = await this.waitForTaskCompletion(taskId, step.task.timeout || 30000);
        success = true;

      } catch (err) {
        error = err instanceof Error ? err.message : 'Unknown error';
        retries++;
        
        if (step.retryOnFailure && retries <= (step.maxRetries || 0)) {
          console.log(`[TaskScheduler] Retrying step ${step.id} (${retries}/${step.maxRetries})`);
          await this.delay(1000 * retries); // Backoff exponentiel
        }
      }
    }

    const result: TaskChainResult = {
      stepId: step.id,
      status: success ? 'success' : 'failure',
      output,
      error,
      duration: Date.now() - startTime,
      timestamp: new Date()
    };

    chain.results.push(result);
    this.emit('chain:step_completed', { chain, step, result });

    // Déterminer l'étape suivante
    let nextStepId: string | undefined;
    if (success && step.onSuccess) {
      nextStepId = step.onSuccess;
    } else if (!success && step.onFailure) {
      nextStepId = step.onFailure;
    } else if (success) {
      // Étape suivante par défaut
      const nextIndex = chain.currentStep + 1;
      if (nextIndex < chain.steps.length) {
        nextStepId = chain.steps[nextIndex].id;
      }
    }

    if (nextStepId) {
      const nextStepIndex = chain.steps.findIndex(s => s.id === nextStepId);
      if (nextStepIndex !== -1) {
        chain.currentStep = nextStepIndex;
        await this.executeChainStep(chain);
      }
    }
  }

  /**
   * Vérifier une condition de chaîne
   */
  private checkCondition(condition: ChainCondition, previousResult: TaskChainResult): boolean {
    switch (condition.type) {
      case 'always':
        return true;
      case 'if_success':
        return previousResult.status === 'success';
      case 'if_failure':
        return previousResult.status === 'failure';
      case 'if_output_contains':
        return String(previousResult.output).includes(condition.value as string);
      case 'if_output_matches':
        return (condition.value as RegExp).test(String(previousResult.output));
      case 'custom':
        return condition.customCheck ? condition.customCheck(previousResult) : true;
      default:
        return true;
    }
  }

  /**
   * Attendre la complétion d'une tâche
   */
  private async waitForTaskCompletion(taskId: string, timeout: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const agent = getGlobalAgent();
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        const state = agent.getState();
        const task = state.completedTasks.find(t => t.id === taskId);

        if (task) {
          clearInterval(checkInterval);
          if (task.status === 'completed') {
            resolve(task.output);
          } else {
            reject(new Error(task.error || 'Task failed'));
          }
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error('Task timeout'));
        }
      }, 100);
    });
  }

  /**
   * Activer une tâche planifiée
   */
  private activateTask(taskId: string): void {
    const task = this.scheduledTasks.get(taskId);
    if (!task || task.status !== 'active') return;

    switch (task.schedule.type) {
      case 'once':
        if (task.schedule.runAt) {
          const delay = task.schedule.runAt.getTime() - Date.now();
          if (delay > 0) {
            const timer = setTimeout(() => this.runScheduledTask(taskId), delay);
            this.timers.set(taskId, timer);
          } else {
            this.runScheduledTask(taskId);
          }
        }
        break;

      case 'interval':
        if (task.schedule.intervalMs) {
          const timer = setInterval(() => this.runScheduledTask(taskId), task.schedule.intervalMs);
          this.timers.set(taskId, timer);
        }
        break;

      case 'trigger':
        // Les triggers sont gérés par les événements
        if (task.schedule.triggerEvent) {
          this.on(task.schedule.triggerEvent, (data) => {
            if (!task.schedule.triggerCondition || task.schedule.triggerCondition(data)) {
              this.runScheduledTask(taskId);
            }
          });
        }
        break;

      case 'chain':
        // Les chaînes sont gérées par les événements de complétion
        if (task.schedule.afterTask) {
          this.on('task:completed', (completedTask: { id: string; status: string }) => {
            if (completedTask.id === task.schedule.afterTask) {
              const shouldRun = 
                task.schedule.afterCondition === 'any' ||
                (task.schedule.afterCondition === 'success' && completedTask.status === 'completed') ||
                (task.schedule.afterCondition === 'failure' && completedTask.status === 'failed');
              
              if (shouldRun) {
                this.runScheduledTask(taskId);
              }
            }
          });
        }
        break;
    }
  }

  /**
   * Exécuter une tâche planifiée
   */
  private async runScheduledTask(taskId: string): Promise<void> {
    const task = this.scheduledTasks.get(taskId);
    if (!task || task.status !== 'active') return;

    // Vérifier le nombre maximum d'exécutions
    if (task.maxRuns && task.runCount >= task.maxRuns) {
      task.status = 'completed';
      this.emit('task:max_runs_reached', task);
      return;
    }

    task.lastRun = new Date();
    task.runCount++;

    this.emit('scheduled_task:running', task);
    console.log(`[TaskScheduler] Running scheduled task: ${task.id} - ${task.name} (run ${task.runCount})`);

    try {
      const agent = getGlobalAgent();
      agent.addTask({
        type: task.task.type as 'code_execution' | 'web_search' | 'file_analysis' | 'decision' | 'learning' | 'monitoring',
        description: task.description,
        priority: 'medium',
        input: task.task.input
      });

      // Calculer la prochaine exécution
      task.nextRun = this.calculateNextRun(task.schedule);

      this.emit('scheduled_task:completed', task);

    } catch (error) {
      this.emit('scheduled_task:failed', { task, error });
      console.error(`[TaskScheduler] Scheduled task failed: ${task.id}`, error);
    }
  }

  /**
   * Calculer la prochaine exécution
   */
  private calculateNextRun(schedule: TaskSchedule): Date | undefined {
    switch (schedule.type) {
      case 'once':
        return schedule.runAt;
      case 'interval':
        return schedule.intervalMs ? new Date(Date.now() + schedule.intervalMs) : undefined;
      default:
        return undefined;
    }
  }

  /**
   * Utilitaire de délai
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtenir toutes les tâches planifiées
   */
  getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  /**
   * Obtenir toutes les chaînes
   */
  getChains(): TaskChain[] {
    return Array.from(this.taskChains.values());
  }

  /**
   * Annuler une tâche planifiée
   */
  cancelTask(taskId: string): void {
    const task = this.scheduledTasks.get(taskId);
    if (task) {
      task.status = 'paused';
      const timer = this.timers.get(taskId);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(taskId);
      }
      this.emit('task:cancelled', task);
    }
  }

  /**
   * Annuler une chaîne
   */
  cancelChain(chainId: string): void {
    const chain = this.taskChains.get(chainId);
    if (chain && chain.status === 'running') {
      chain.status = 'paused';
      this.emit('chain:cancelled', chain);
    }
  }
}

// Singleton pour le scheduler global
let globalScheduler: TaskScheduler | null = null;

export function getGlobalScheduler(): TaskScheduler {
  if (!globalScheduler) {
    globalScheduler = new TaskScheduler();
  }
  return globalScheduler;
}

export function startGlobalScheduler(): void {
  const scheduler = getGlobalScheduler();
  scheduler.start();
}

export function stopGlobalScheduler(): void {
  if (globalScheduler) {
    globalScheduler.stop();
  }
}

export default TaskScheduler;
