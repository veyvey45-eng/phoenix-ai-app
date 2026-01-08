/**
 * Persistent Agent System - Système d'agent autonome persistant
 * 
 * Ce module exporte tous les composants nécessaires pour la boucle d'agent persistante:
 * - TaskQueue: File d'attente des tâches
 * - StateManager: Gestion de l'état persistant
 * - PersistentWorker: Worker background pour l'exécution
 * - AgentWebSocket: Communication bidirectionnelle
 */

export { taskQueue, TaskQueue, TaskConfig, CreateTaskInput, QueuedTask } from './taskQueue';
export { StateManager, createStateManager, AgentState, StepData, EventData } from './stateManager';
export { persistentWorker, PersistentWorker, WorkerConfig, WorkerEvent } from './worker';
export { agentWebSocket, AgentWebSocketServer } from './websocket';

// Types combinés
export interface PersistentAgentConfig {
  task: import('./taskQueue').TaskConfig;
  worker: Partial<import('./worker').WorkerConfig>;
}

/**
 * Initialise le système d'agent persistant
 */
export async function initPersistentAgent(httpServer?: import('http').Server): Promise<void> {
  console.log('[PersistentAgent] Initializing...');
  
  // Démarrer le worker
  const { persistentWorker } = await import('./worker');
  persistentWorker.start();
  
  // Attacher le WebSocket si un serveur HTTP est fourni
  if (httpServer) {
    const { agentWebSocket } = await import('./websocket');
    agentWebSocket.attach(httpServer, '/ws/agent');
  }
  
  console.log('[PersistentAgent] Initialized successfully');
}

/**
 * Arrête le système d'agent persistant
 */
export async function stopPersistentAgent(): Promise<void> {
  console.log('[PersistentAgent] Stopping...');
  
  const { persistentWorker } = await import('./worker');
  persistentWorker.stop();
  
  const { agentWebSocket } = await import('./websocket');
  agentWebSocket.close();
  
  console.log('[PersistentAgent] Stopped');
}

/**
 * Crée et démarre une nouvelle tâche d'agent
 */
export async function startAgentTask(
  userId: number,
  goal: string,
  config?: import('./taskQueue').TaskConfig
): Promise<string> {
  const { taskQueue } = await import('./taskQueue');
  return taskQueue.createTask({ userId, goal, config });
}

/**
 * Récupère l'état d'une tâche
 */
export async function getAgentTaskStatus(taskId: string) {
  const { taskQueue } = await import('./taskQueue');
  return taskQueue.getTask(taskId);
}

/**
 * Récupère les étapes d'une tâche
 */
export async function getAgentTaskSteps(taskId: string) {
  const { createStateManager } = await import('./stateManager');
  const stateManager = createStateManager(taskId);
  return stateManager.getSteps();
}

/**
 * Pause une tâche
 */
export async function pauseAgentTask(taskId: string): Promise<void> {
  const { taskQueue } = await import('./taskQueue');
  await taskQueue.pause(taskId);
}

/**
 * Reprend une tâche
 */
export async function resumeAgentTask(taskId: string): Promise<void> {
  const { taskQueue } = await import('./taskQueue');
  await taskQueue.resume(taskId);
}

/**
 * Annule une tâche
 */
export async function cancelAgentTask(taskId: string): Promise<void> {
  const { taskQueue } = await import('./taskQueue');
  await taskQueue.cancel(taskId);
}

/**
 * Récupère les statistiques du système
 */
export async function getPersistentAgentStats() {
  const { taskQueue } = await import('./taskQueue');
  const { persistentWorker } = await import('./worker');
  const { agentWebSocket } = await import('./websocket');
  
  return {
    queue: {
      length: await taskQueue.getQueueLength(),
      tasks: await taskQueue.getQueuedTasks()
    },
    worker: persistentWorker.getStatus(),
    websocket: agentWebSocket.getStats()
  };
}
