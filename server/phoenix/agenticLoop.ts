/**
 * Phoenix Agentic Loop
 * Boucle de décision autonome qui tourne en arrière-plan
 * Phoenix prend des décisions et agit sans intervention humaine
 */

import { EventEmitter } from 'events';

// Types pour l'Agentic Loop
export interface AgentState {
  id: string;
  status: 'idle' | 'thinking' | 'executing' | 'waiting' | 'error';
  currentTask: AgentTask | null;
  taskQueue: AgentTask[];
  completedTasks: AgentTask[];
  memory: AgentMemory;
  lastActivity: Date;
  cycleCount: number;
}

export interface AgentTask {
  id: string;
  type: 'code_execution' | 'web_search' | 'file_analysis' | 'decision' | 'learning' | 'monitoring';
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  dependsOn?: string[]; // IDs des tâches dont celle-ci dépend
  triggeredBy?: string; // ID de la tâche qui a déclenché celle-ci
  nextTasks?: string[]; // IDs des tâches à déclencher après
}

export interface AgentMemory {
  shortTerm: MemoryItem[];
  longTerm: MemoryItem[];
  workingContext: Record<string, unknown>;
  learnings: Learning[];
}

export interface MemoryItem {
  id: string;
  type: 'observation' | 'decision' | 'result' | 'error' | 'insight';
  content: string;
  timestamp: Date;
  importance: number; // 0-1
  tags: string[];
}

export interface Learning {
  id: string;
  pattern: string;
  insight: string;
  confidence: number;
  applications: number;
  createdAt: Date;
}

export interface AgentDecision {
  action: string;
  reasoning: string;
  confidence: number;
  alternatives: string[];
  risks: string[];
}

// Configuration de l'agent
export interface AgentConfig {
  maxConcurrentTasks: number;
  cycleIntervalMs: number;
  maxIdleTimeMs: number;
  autoStartOnBoot: boolean;
  learningEnabled: boolean;
  proactiveMode: boolean;
}

const DEFAULT_CONFIG: AgentConfig = {
  maxConcurrentTasks: 3,
  cycleIntervalMs: 5000, // 5 secondes entre chaque cycle
  maxIdleTimeMs: 300000, // 5 minutes max d'inactivité
  autoStartOnBoot: true,
  learningEnabled: true,
  proactiveMode: true
};

/**
 * Phoenix Agentic Loop
 * Le cœur de l'autonomie de Phoenix
 */
export class AgenticLoop extends EventEmitter {
  private state: AgentState;
  private config: AgentConfig;
  private isRunning: boolean = false;
  private cycleTimer: NodeJS.Timeout | null = null;
  private taskHandlers: Map<string, (task: AgentTask) => Promise<Record<string, unknown>>> = new Map();

  constructor(config: Partial<AgentConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.initializeState();
    this.registerDefaultHandlers();
  }

  private initializeState(): AgentState {
    return {
      id: `phoenix-agent-${Date.now()}`,
      status: 'idle',
      currentTask: null,
      taskQueue: [],
      completedTasks: [],
      memory: {
        shortTerm: [],
        longTerm: [],
        workingContext: {},
        learnings: []
      },
      lastActivity: new Date(),
      cycleCount: 0
    };
  }

  private registerDefaultHandlers(): void {
    // Handler pour l'exécution de code
    this.taskHandlers.set('code_execution', async (task) => {
      this.emit('task:code_start', task);
      // L'exécution réelle sera déléguée au E2B Executor
      return { status: 'delegated_to_e2b', taskId: task.id };
    });

    // Handler pour la recherche web
    this.taskHandlers.set('web_search', async (task) => {
      this.emit('task:search_start', task);
      return { status: 'delegated_to_search', taskId: task.id };
    });

    // Handler pour l'analyse de fichiers
    this.taskHandlers.set('file_analysis', async (task) => {
      this.emit('task:analysis_start', task);
      return { status: 'delegated_to_analyzer', taskId: task.id };
    });

    // Handler pour les décisions
    this.taskHandlers.set('decision', async (task) => {
      const decision = await this.makeDecision(task);
      return { decision };
    });

    // Handler pour l'apprentissage
    this.taskHandlers.set('learning', async (task) => {
      const learning = await this.learn(task);
      return { learning };
    });

    // Handler pour le monitoring
    this.taskHandlers.set('monitoring', async (task) => {
      return await this.monitor(task);
    });
  }

  /**
   * Démarrer la boucle agentique
   */
  start(): void {
    if (this.isRunning) {
      console.log('[AgenticLoop] Already running');
      return;
    }

    this.isRunning = true;
    this.state.status = 'idle';
    this.emit('agent:started', { agentId: this.state.id });
    console.log(`[AgenticLoop] Phoenix Agent started: ${this.state.id}`);

    // Démarrer le cycle principal
    this.runCycle();
  }

  /**
   * Arrêter la boucle agentique
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.cycleTimer) {
      clearTimeout(this.cycleTimer);
      this.cycleTimer = null;
    }

    this.state.status = 'idle';
    this.emit('agent:stopped', { agentId: this.state.id });
    console.log(`[AgenticLoop] Phoenix Agent stopped: ${this.state.id}`);
  }

  /**
   * Cycle principal de l'agent
   */
  private async runCycle(): Promise<void> {
    if (!this.isRunning) return;

    this.state.cycleCount++;
    this.state.lastActivity = new Date();

    try {
      // Phase 1: Observer l'environnement
      await this.observe();

      // Phase 2: Réfléchir et décider
      const decision = await this.think();

      // Phase 3: Agir si nécessaire
      if (decision) {
        await this.act(decision);
      }

      // Phase 4: Apprendre des résultats
      if (this.config.learningEnabled) {
        await this.reflect();
      }

    } catch (error) {
      console.error('[AgenticLoop] Cycle error:', error);
      this.state.status = 'error';
      this.emit('agent:error', { error, cycle: this.state.cycleCount });
    }

    // Planifier le prochain cycle
    if (this.isRunning) {
      this.cycleTimer = setTimeout(() => this.runCycle(), this.config.cycleIntervalMs);
    }
  }

  /**
   * Phase 1: Observer l'environnement
   */
  private async observe(): Promise<void> {
    this.state.status = 'thinking';
    
    // Vérifier les tâches en attente
    const pendingTasks = this.state.taskQueue.filter(t => t.status === 'pending');
    
    // Vérifier les dépendances résolues
    for (const task of pendingTasks) {
      if (task.dependsOn && task.dependsOn.length > 0) {
        const allDepsCompleted = task.dependsOn.every(depId => 
          this.state.completedTasks.some(t => t.id === depId && t.status === 'completed')
        );
        if (allDepsCompleted) {
          this.emit('task:ready', task);
        }
      }
    }

    // Ajouter une observation à la mémoire
    this.addToMemory({
      type: 'observation',
      content: `Cycle ${this.state.cycleCount}: ${pendingTasks.length} tâches en attente`,
      importance: 0.3,
      tags: ['cycle', 'observation']
    });
  }

  /**
   * Phase 2: Réfléchir et décider
   */
  private async think(): Promise<AgentDecision | null> {
    // Trouver la prochaine tâche à exécuter
    const nextTask = this.getNextTask();
    
    if (!nextTask) {
      // Mode proactif: chercher quelque chose à faire
      if (this.config.proactiveMode) {
        return this.generateProactiveDecision();
      }
      return null;
    }

    // Créer une décision pour la tâche
    return {
      action: `execute_task:${nextTask.id}`,
      reasoning: `Tâche prioritaire: ${nextTask.description}`,
      confidence: 0.9,
      alternatives: [],
      risks: []
    };
  }

  /**
   * Phase 3: Agir sur la décision
   */
  private async act(decision: AgentDecision): Promise<void> {
    this.state.status = 'executing';
    
    this.addToMemory({
      type: 'decision',
      content: `Action: ${decision.action} - Raison: ${decision.reasoning}`,
      importance: 0.7,
      tags: ['decision', 'action']
    });

    // Parser l'action
    if (decision.action.startsWith('execute_task:')) {
      const taskId = decision.action.replace('execute_task:', '');
      await this.executeTask(taskId);
    } else if (decision.action.startsWith('proactive:')) {
      const proactiveAction = decision.action.replace('proactive:', '');
      await this.executeProactiveAction(proactiveAction);
    }

    this.emit('agent:acted', { decision });
  }

  /**
   * Phase 4: Réfléchir et apprendre
   */
  private async reflect(): Promise<void> {
    // Analyser les tâches récentes
    const recentTasks = this.state.completedTasks.slice(-10);
    const successRate = recentTasks.filter(t => t.status === 'completed').length / Math.max(recentTasks.length, 1);

    // Créer un apprentissage si pattern détecté
    if (recentTasks.length >= 5) {
      const patterns = this.detectPatterns(recentTasks);
      for (const pattern of patterns) {
        this.addLearning(pattern);
      }
    }

    this.emit('agent:reflected', { successRate, learnings: this.state.memory.learnings.length });
  }

  /**
   * Exécuter une tâche
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.state.taskQueue.find(t => t.id === taskId);
    if (!task) {
      console.warn(`[AgenticLoop] Task not found: ${taskId}`);
      return;
    }

    task.status = 'running';
    task.startedAt = new Date();
    this.state.currentTask = task;

    this.emit('task:started', task);

    try {
      const handler = this.taskHandlers.get(task.type);
      if (!handler) {
        throw new Error(`No handler for task type: ${task.type}`);
      }

      const result = await handler(task);
      task.output = result;
      task.status = 'completed';
      task.completedAt = new Date();

      // Déclencher les tâches suivantes
      if (task.nextTasks && task.nextTasks.length > 0) {
        for (const nextTaskId of task.nextTasks) {
          this.triggerTask(nextTaskId, task.id);
        }
      }

      this.emit('task:completed', task);
      
      this.addToMemory({
        type: 'result',
        content: `Tâche ${task.id} complétée: ${JSON.stringify(result).substring(0, 200)}`,
        importance: 0.8,
        tags: ['result', task.type]
      });

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.completedAt = new Date();

      this.emit('task:failed', { task, error });
      
      this.addToMemory({
        type: 'error',
        content: `Tâche ${task.id} échouée: ${task.error}`,
        importance: 0.9,
        tags: ['error', task.type]
      });
    }

    // Déplacer vers les tâches complétées
    this.state.taskQueue = this.state.taskQueue.filter(t => t.id !== taskId);
    this.state.completedTasks.push(task);
    this.state.currentTask = null;
    this.state.status = 'idle';
  }

  /**
   * Ajouter une tâche à la queue
   */
  addTask(task: Omit<AgentTask, 'id' | 'status' | 'createdAt'>): string {
    const newTask: AgentTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      createdAt: new Date()
    };

    this.state.taskQueue.push(newTask);
    this.emit('task:added', newTask);
    
    console.log(`[AgenticLoop] Task added: ${newTask.id} - ${newTask.description}`);
    return newTask.id;
  }

  /**
   * Créer une chaîne de tâches (A → B → C)
   */
  createTaskChain(tasks: Array<Omit<AgentTask, 'id' | 'status' | 'createdAt' | 'dependsOn' | 'nextTasks'>>): string[] {
    const taskIds: string[] = [];
    
    for (let i = 0; i < tasks.length; i++) {
      const taskId = this.addTask({
        ...tasks[i],
        dependsOn: i > 0 ? [taskIds[i - 1]] : undefined,
        nextTasks: undefined
      });
      taskIds.push(taskId);
      
      // Mettre à jour la tâche précédente avec nextTasks
      if (i > 0) {
        const prevTask = this.state.taskQueue.find(t => t.id === taskIds[i - 1]);
        if (prevTask) {
          prevTask.nextTasks = prevTask.nextTasks || [];
          prevTask.nextTasks.push(taskId);
        }
      }
    }

    this.emit('chain:created', { taskIds });
    return taskIds;
  }

  /**
   * Déclencher une tâche (suite à une dépendance résolue)
   */
  private triggerTask(taskId: string, triggeredBy: string): void {
    const task = this.state.taskQueue.find(t => t.id === taskId);
    if (task) {
      task.triggeredBy = triggeredBy;
      this.emit('task:triggered', { task, triggeredBy });
    }
  }

  /**
   * Obtenir la prochaine tâche à exécuter
   */
  private getNextTask(): AgentTask | null {
    // Filtrer les tâches prêtes (pas de dépendances non résolues)
    const readyTasks = this.state.taskQueue.filter(task => {
      if (task.status !== 'pending') return false;
      if (!task.dependsOn || task.dependsOn.length === 0) return true;
      
      return task.dependsOn.every(depId => 
        this.state.completedTasks.some(t => t.id === depId && t.status === 'completed')
      );
    });

    if (readyTasks.length === 0) return null;

    // Trier par priorité
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    readyTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return readyTasks[0];
  }

  /**
   * Générer une décision proactive
   */
  private generateProactiveDecision(): AgentDecision | null {
    // Vérifier si on doit faire quelque chose de proactif
    const idleTime = Date.now() - this.state.lastActivity.getTime();
    
    if (idleTime > 60000) { // Plus d'une minute d'inactivité
      return {
        action: 'proactive:check_system',
        reasoning: 'Vérification système après inactivité prolongée',
        confidence: 0.6,
        alternatives: ['proactive:analyze_memory', 'proactive:optimize'],
        risks: []
      };
    }

    return null;
  }

  /**
   * Exécuter une action proactive
   */
  private async executeProactiveAction(action: string): Promise<void> {
    switch (action) {
      case 'check_system':
        this.emit('proactive:system_check');
        break;
      case 'analyze_memory':
        await this.analyzeMemory();
        break;
      case 'optimize':
        await this.optimizeState();
        break;
    }
  }

  /**
   * Prendre une décision basée sur une tâche
   */
  private async makeDecision(task: AgentTask): Promise<AgentDecision> {
    const context = task.input as { question?: string; options?: string[] };
    
    return {
      action: 'decision_made',
      reasoning: `Décision prise pour: ${context.question || 'unknown'}`,
      confidence: 0.8,
      alternatives: context.options || [],
      risks: []
    };
  }

  /**
   * Apprendre d'une tâche
   */
  private async learn(task: AgentTask): Promise<Learning> {
    const learning: Learning = {
      id: `learning-${Date.now()}`,
      pattern: task.input.pattern as string || 'unknown',
      insight: task.input.insight as string || 'Apprentissage automatique',
      confidence: 0.7,
      applications: 0,
      createdAt: new Date()
    };

    this.state.memory.learnings.push(learning);
    return learning;
  }

  /**
   * Monitorer le système
   */
  private async monitor(task: AgentTask): Promise<Record<string, unknown>> {
    return {
      status: 'healthy',
      taskQueueLength: this.state.taskQueue.length,
      completedTasks: this.state.completedTasks.length,
      memorySize: this.state.memory.shortTerm.length + this.state.memory.longTerm.length,
      cycleCount: this.state.cycleCount
    };
  }

  /**
   * Ajouter un élément à la mémoire
   */
  private addToMemory(item: Omit<MemoryItem, 'id' | 'timestamp'>): void {
    const memoryItem: MemoryItem = {
      ...item,
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.state.memory.shortTerm.push(memoryItem);

    // Promouvoir vers la mémoire long terme si important
    if (item.importance > 0.7) {
      this.state.memory.longTerm.push(memoryItem);
    }

    // Limiter la taille de la mémoire court terme
    if (this.state.memory.shortTerm.length > 100) {
      this.state.memory.shortTerm = this.state.memory.shortTerm.slice(-50);
    }
  }

  /**
   * Ajouter un apprentissage
   */
  private addLearning(pattern: { pattern: string; insight: string }): void {
    const learning: Learning = {
      id: `learning-${Date.now()}`,
      pattern: pattern.pattern,
      insight: pattern.insight,
      confidence: 0.5,
      applications: 0,
      createdAt: new Date()
    };

    this.state.memory.learnings.push(learning);
    this.emit('learning:added', learning);
  }

  /**
   * Détecter des patterns dans les tâches récentes
   */
  private detectPatterns(tasks: AgentTask[]): Array<{ pattern: string; insight: string }> {
    const patterns: Array<{ pattern: string; insight: string }> = [];

    // Pattern: Tâches du même type qui échouent
    const failedByType = new Map<string, number>();
    for (const task of tasks) {
      if (task.status === 'failed') {
        failedByType.set(task.type, (failedByType.get(task.type) || 0) + 1);
      }
    }

    failedByType.forEach((count, type) => {
      if (count >= 3) {
        patterns.push({
          pattern: `frequent_failure:${type}`,
          insight: `Les tâches de type ${type} échouent fréquemment. Investiguer la cause.`
        });
      }
    });

    return patterns;
  }

  /**
   * Analyser la mémoire
   */
  private async analyzeMemory(): Promise<void> {
    const insights = this.state.memory.longTerm.filter(m => m.type === 'insight');
    console.log(`[AgenticLoop] Memory analysis: ${insights.length} insights stored`);
  }

  /**
   * Optimiser l'état
   */
  private async optimizeState(): Promise<void> {
    // Nettoyer les tâches anciennes complétées
    const oneHourAgo = new Date(Date.now() - 3600000);
    this.state.completedTasks = this.state.completedTasks.filter(
      t => t.completedAt && t.completedAt > oneHourAgo
    );
  }

  /**
   * Obtenir l'état actuel
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Enregistrer un handler de tâche personnalisé
   */
  registerTaskHandler(type: string, handler: (task: AgentTask) => Promise<Record<string, unknown>>): void {
    this.taskHandlers.set(type, handler);
  }

  /**
   * Vérifier si l'agent est en cours d'exécution
   */
  isAgentRunning(): boolean {
    return this.isRunning;
  }
}

// Singleton pour l'agent global
let globalAgent: AgenticLoop | null = null;

export function getGlobalAgent(): AgenticLoop {
  if (!globalAgent) {
    globalAgent = new AgenticLoop();
  }
  return globalAgent;
}

export function startGlobalAgent(): void {
  const agent = getGlobalAgent();
  if (!agent.isAgentRunning()) {
    agent.start();
  }
}

export function stopGlobalAgent(): void {
  if (globalAgent) {
    globalAgent.stop();
  }
}

export default AgenticLoop;
