/**
 * Persistent Worker - Worker background pour l'exécution des tâches d'agent
 * 
 * Ce module est le CŒUR de la solution pour la boucle d'agent persistante.
 * Il permet:
 * - Exécution sans timeout HTTP (tourne en arrière-plan)
 * - 100+ actions consécutives
 * - Sauvegarde automatique après chaque action
 * - Reprise après interruption
 */

import { taskQueue, QueuedTask, TaskConfig } from './taskQueue';
import { StateManager, createStateManager, AgentState, StepData } from './stateManager';
import { toolRegistry, ToolContext, ToolResult } from '../toolRegistry';
import { invokeLLM } from '../../_core/llm';
import { EventEmitter } from 'events';

// Types
export interface WorkerConfig {
  pollInterval: number;      // Intervalle de polling en ms
  checkpointInterval: number; // Créer un checkpoint tous les N steps
  maxConcurrentTasks: number; // Nombre max de tâches simultanées
}

export interface WorkerEvent {
  type: 'task_started' | 'task_completed' | 'task_failed' | 'step_completed' | 'thinking' | 'tool_call' | 'tool_result' | 'checkpoint' | 'error';
  taskId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

// Configuration par défaut
const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  pollInterval: 1000,        // 1 seconde
  checkpointInterval: 5,     // Checkpoint tous les 5 steps
  maxConcurrentTasks: 1      // 1 tâche à la fois pour commencer
};

/**
 * Classe PersistentWorker - Exécute les tâches en arrière-plan
 */
export class PersistentWorker {
  private static instance: PersistentWorker;
  private config: WorkerConfig;
  private running: boolean = false;
  private currentTasks: Map<string, { task: QueuedTask; stateManager: StateManager }> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private workerId: string;
  private pollTimer: NodeJS.Timeout | null = null;

  private constructor(config: Partial<WorkerConfig> = {}) {
    this.config = { ...DEFAULT_WORKER_CONFIG, ...config };
    this.workerId = `worker-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[PersistentWorker] Initialized with ID: ${this.workerId}`);
  }

  static getInstance(config?: Partial<WorkerConfig>): PersistentWorker {
    if (!PersistentWorker.instance) {
      PersistentWorker.instance = new PersistentWorker(config);
    }
    return PersistentWorker.instance;
  }

  /**
   * Démarre le worker
   */
  start(): void {
    if (this.running) {
      console.log('[PersistentWorker] Already running');
      return;
    }

    this.running = true;
    console.log('[PersistentWorker] Started');
    this.poll();
  }

  /**
   * Arrête le worker
   */
  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[PersistentWorker] Stopped');
  }

  /**
   * Polling pour récupérer les nouvelles tâches
   */
  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      // Vérifier si on peut prendre une nouvelle tâche
      if (this.currentTasks.size < this.config.maxConcurrentTasks) {
        const task = await taskQueue.dequeue();
        if (task) {
          this.executeTask(task).catch(error => {
            console.error(`[PersistentWorker] Task ${task.id} failed:`, error);
          });
        }
      }
    } catch (error) {
      console.error('[PersistentWorker] Poll error:', error);
    }

    // Planifier le prochain poll
    this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval);
  }

  /**
   * Exécute une tâche
   */
  private async executeTask(task: QueuedTask): Promise<void> {
    const stateManager = createStateManager(task.id);
    this.currentTasks.set(task.id, { task, stateManager });

    this.emit({
      type: 'task_started',
      taskId: task.id,
      data: { goal: task.goal },
      timestamp: new Date()
    });

    try {
      // Charger l'état existant (pour les reprises)
      let state = await stateManager.loadState();
      
      if (!state) {
        // Nouvel état
        state = {
          taskId: task.id,
          currentPhase: 'starting',
          currentIteration: 0,
          totalToolCalls: 0,
          workingMemory: {},
          observations: []
        };
      }

      // Contexte pour les outils
      const toolContext: ToolContext = {
        userId: task.userId.toString(),
        sessionId: task.id
      };

      // Boucle principale - SANS TIMEOUT HTTP
      let iteration = state.currentIteration;
      const maxIterations = task.config.maxIterations || 100;
      let toolCalls = state.totalToolCalls;
      const maxToolCalls = task.config.maxToolCalls || 150;

      console.log(`[PersistentWorker] Starting task ${task.id} at iteration ${iteration}`);

      while (iteration < maxIterations && toolCalls < maxToolCalls) {
        // Vérifier si la tâche a été annulée ou mise en pause
        const currentTask = await taskQueue.getTask(task.id);
        if (!currentTask || currentTask.status === 'cancelled' || currentTask.status === 'paused') {
          console.log(`[PersistentWorker] Task ${task.id} was ${currentTask?.status || 'deleted'}`);
          break;
        }

        iteration++;

        // Mettre à jour l'état
        await stateManager.updateTaskState({
          currentIteration: iteration,
          currentPhase: 'thinking'
        });

        // 1. THINK - Réflexion
        this.emit({
          type: 'thinking',
          taskId: task.id,
          data: { iteration, message: 'Phoenix réfléchit...' },
          timestamp: new Date()
        });

        const thought = await this.think(task.goal, state, toolContext);
        
        await stateManager.saveStep({
          type: 'think',
          content: thought.thinking,
          thinking: thought.thinking
        });

        // 2. Vérifier si c'est une réponse finale
        if (thought.action.type === 'answer') {
          await stateManager.saveStep({
            type: 'answer',
            content: thought.action.answer
          });

          await stateManager.updateTaskState({
            status: 'completed',
            result: thought.action.answer,
            currentPhase: 'completed'
          });

          await taskQueue.complete(task.id, thought.action.answer || 'Task completed');

          this.emit({
            type: 'task_completed',
            taskId: task.id,
            data: { result: thought.action.answer, iterations: iteration },
            timestamp: new Date()
          });

          break;
        }

        // 3. ACT - Exécuter l'outil
        if (thought.action.type === 'tool_call') {
          toolCalls++;

          await stateManager.updateTaskState({
            totalToolCalls: toolCalls,
            currentPhase: `executing: ${thought.action.tool_name}`
          });

          this.emit({
            type: 'tool_call',
            taskId: task.id,
            data: { tool: thought.action.tool_name, args: thought.action.tool_args },
            timestamp: new Date()
          });

          // Exécuter l'outil
          const toolName = thought.action.tool_name || 'unknown';
          const result = await toolRegistry.execute(
            toolName,
            thought.action.tool_args || {},
            toolContext
          );

          // Sauvegarder l'étape
          await stateManager.saveStep({
            type: 'tool_call',
            toolName: thought.action.tool_name,
            toolArgs: thought.action.tool_args,
            toolResult: result
          });

          // Sauvegarder les artifacts
          if (result.artifacts) {
            for (const artifact of result.artifacts) {
              await stateManager.addArtifact(artifact);
            }
          }

          this.emit({
            type: 'tool_result',
            taskId: task.id,
            data: { tool: thought.action.tool_name, success: result.success, output: result.output?.substring(0, 500) },
            timestamp: new Date()
          });

          // 4. OBSERVE - Analyser le résultat
          const observation = result.success
            ? `L'outil ${thought.action.tool_name} a réussi: ${result.output?.substring(0, 500)}`
            : `L'outil ${thought.action.tool_name} a échoué: ${result.error}`;

          state.observations.push(observation);
          state.lastToolResult = {
            tool: toolName,
            success: result.success,
            output: result.output?.substring(0, 500)
          };

          await stateManager.saveStep({
            type: 'observe',
            content: observation
          });

          // 5. CHECKPOINT - Sauvegarder l'état périodiquement
          if (iteration % this.config.checkpointInterval === 0) {
            await stateManager.createCheckpoint(`Auto-checkpoint at iteration ${iteration}`);
            
            this.emit({
              type: 'checkpoint',
              taskId: task.id,
              data: { iteration, toolCalls },
              timestamp: new Date()
            });
          }
        }

        // Mettre à jour l'état local
        state.currentIteration = iteration;
        state.totalToolCalls = toolCalls;
      }

      // Vérifier si on a atteint les limites
      if (iteration >= maxIterations) {
        await taskQueue.fail(task.id, `Maximum iterations (${maxIterations}) reached`);
        this.emit({
          type: 'task_failed',
          taskId: task.id,
          data: { error: `Maximum iterations (${maxIterations}) reached` },
          timestamp: new Date()
        });
      } else if (toolCalls >= maxToolCalls) {
        await taskQueue.fail(task.id, `Maximum tool calls (${maxToolCalls}) reached`);
        this.emit({
          type: 'task_failed',
          taskId: task.id,
          data: { error: `Maximum tool calls (${maxToolCalls}) reached` },
          timestamp: new Date()
        });
      }

    } catch (error: any) {
      console.error(`[PersistentWorker] Task ${task.id} error:`, error);
      
      await taskQueue.fail(task.id, error.message || 'Unknown error');
      
      this.emit({
        type: 'task_failed',
        taskId: task.id,
        data: { error: error.message },
        timestamp: new Date()
      });
    } finally {
      this.currentTasks.delete(task.id);
    }
  }

  /**
   * Réflexion de l'agent
   */
  private async think(
    goal: string,
    state: AgentState,
    toolContext: ToolContext
  ): Promise<{
    thinking: string;
    action: {
      type: 'tool_call' | 'answer';
      tool_name?: string;
      tool_args?: Record<string, unknown>;
      answer?: string;
    };
  }> {
    // Construire le contexte
    const observationsContext = state.observations.slice(-10).join('\n');
    const lastResult = state.lastToolResult
      ? `Dernier résultat: ${state.lastToolResult.tool} - ${state.lastToolResult.success ? 'Succès' : 'Échec'}: ${state.lastToolResult.output || ''}`
      : '';

    const toolsDescription = toolRegistry.generateToolsDescription();

    const systemPrompt = `Tu es Phoenix, un agent IA autonome capable d'exécuter des tâches complexes.

## Objectif
${goal}

## État actuel
- Itération: ${state.currentIteration}
- Phase: ${state.currentPhase}
- Appels d'outils: ${state.totalToolCalls}

## Observations récentes
${observationsContext || 'Aucune observation précédente'}

${lastResult}

## Outils disponibles
${toolsDescription}

## Instructions
1. Analyse l'objectif et l'état actuel
2. Décide de la prochaine action
3. Si l'objectif est atteint, utilise "answer"
4. Sinon, utilise un outil approprié

## Format de réponse (JSON)
{
  "thinking": "Ta réflexion sur la situation",
  "action": {
    "type": "tool_call" | "answer",
    "tool_name": "nom_outil (si tool_call)",
    "tool_args": { ... } (si tool_call),
    "answer": "réponse finale (si answer)"
  }
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Continue vers l'objectif: ${goal}` }
        ]
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === 'string' ? rawContent : '';
      if (!content) {
        throw new Error('Empty LLM response');
      }

      // Parser le JSON
      let parsed: any;
      try {
        // Essayer d'extraire le JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch {
        // Si le parsing échoue, traiter comme une réponse
        return {
          thinking: content,
          action: { type: 'answer', answer: content }
        };
      }

      return {
        thinking: parsed.thinking || content,
        action: parsed.action || { type: 'answer', answer: content }
      };

    } catch (error: any) {
      console.error('[PersistentWorker] Think error:', error);
      return {
        thinking: `Erreur de réflexion: ${error.message}`,
        action: { type: 'answer', answer: `Erreur: ${error.message}` }
      };
    }
  }

  /**
   * Émet un événement
   */
  private emit(event: WorkerEvent): void {
    this.eventEmitter.emit('event', event);
    this.eventEmitter.emit(event.type, event);
  }

  /**
   * S'abonne aux événements
   */
  onEvent(callback: (event: WorkerEvent) => void): void {
    this.eventEmitter.on('event', callback);
  }

  /**
   * S'abonne à un type d'événement spécifique
   */
  on(eventType: WorkerEvent['type'], callback: (event: WorkerEvent) => void): void {
    this.eventEmitter.on(eventType, callback);
  }

  /**
   * Se désabonne des événements
   */
  off(eventType: string, callback: (event: WorkerEvent) => void): void {
    this.eventEmitter.off(eventType, callback);
  }

  /**
   * Récupère l'état du worker
   */
  getStatus(): {
    running: boolean;
    workerId: string;
    activeTasks: number;
    taskIds: string[];
  } {
    return {
      running: this.running,
      workerId: this.workerId,
      activeTasks: this.currentTasks.size,
      taskIds: Array.from(this.currentTasks.keys())
    };
  }

  /**
   * Récupère l'état d'une tâche en cours
   */
  getTaskState(taskId: string): { task: QueuedTask; stateManager: StateManager } | undefined {
    return this.currentTasks.get(taskId);
  }
}

// Export singleton
export const persistentWorker = PersistentWorker.getInstance();

// Démarrer automatiquement le worker au chargement du module
// (Commenté pour permettre un démarrage manuel)
// persistentWorker.start();

export default PersistentWorker;
