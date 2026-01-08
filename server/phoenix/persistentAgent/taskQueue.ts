/**
 * Task Queue - File d'attente persistante pour les tâches d'agent
 * 
 * Ce module gère la file d'attente des tâches à exécuter par le worker.
 * Les tâches sont persistées en base de données pour permettre la reprise.
 */

import { getDb } from '../../db';
import { agentTasks, agentQueue } from '../../../drizzle/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Types
export interface TaskConfig {
  maxIterations?: number;
  maxToolCalls?: number;
  requireConfirmation?: boolean;
  verbose?: boolean;
  timeout?: number;
}

export interface CreateTaskInput {
  userId: number;
  goal: string;
  config?: TaskConfig;
  priority?: number;
}

export interface QueuedTask {
  id: string;
  userId: number;
  goal: string;
  config: TaskConfig;
  status: string;
  priority: number;
  position: number;
  queuedAt: Date;
}

// Configuration par défaut - BEAUCOUP PLUS ÉLEVÉE que avant
const DEFAULT_CONFIG = {
  maxIterations: 100,    // 100 itérations max (vs 30 avant)
  maxToolCalls: 150,     // 150 appels d'outils max (vs 40 avant)
  requireConfirmation: false,
  verbose: true,
  timeout: 30 * 60 * 1000 // 30 minutes (vs 5 minutes avant)
} as const;

/**
 * Classe TaskQueue - Gère la file d'attente des tâches
 */
export class TaskQueue {
  private static instance: TaskQueue;

  private constructor() {
    console.log('[TaskQueue] Initialized');
  }

  static getInstance(): TaskQueue {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue();
    }
    return TaskQueue.instance;
  }

  /**
   * Crée une nouvelle tâche et l'ajoute à la queue
   */
  async createTask(input: CreateTaskInput): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const taskId = `task-${Date.now()}-${randomUUID().substring(0, 8)}`;
    const config = {
      maxIterations: input.config?.maxIterations ?? DEFAULT_CONFIG.maxIterations,
      maxToolCalls: input.config?.maxToolCalls ?? DEFAULT_CONFIG.maxToolCalls,
      requireConfirmation: input.config?.requireConfirmation ?? DEFAULT_CONFIG.requireConfirmation,
      verbose: input.config?.verbose ?? DEFAULT_CONFIG.verbose,
      timeout: input.config?.timeout ?? DEFAULT_CONFIG.timeout
    };

    // 1. Créer la tâche
    await db.insert(agentTasks).values([
      {
        id: taskId,
        userId: input.userId,
        goal: input.goal,
        config: config,
        status: 'pending',
        currentPhase: 'queued',
        currentIteration: 0,
        totalToolCalls: 0,
        workingMemory: {},
        artifacts: [],
      }
    ]);

    // 2. Obtenir la prochaine position dans la queue
    const positionResult = await db.select({ maxPos: sql<number>`MAX(position)` })
      .from(agentQueue);
    const lastPosition = positionResult[0]?.maxPos || 0;

    // 3. Ajouter à la queue
    await db.insert(agentQueue).values({
      taskId: taskId,
      priority: input.priority || 0,
      position: lastPosition + 1,
      status: 'queued',
    });

    console.log(`[TaskQueue] Task ${taskId} created and queued at position ${lastPosition + 1}`);
    return taskId;
  }

  /**
   * Récupère la prochaine tâche à exécuter
   */
  async dequeue(): Promise<QueuedTask | null> {
    const db = await getDb();
    if (!db) return null;
    
    // Récupérer la tâche avec la plus haute priorité et la plus ancienne position
    const queueItems = await db.select()
      .from(agentQueue)
      .where(eq(agentQueue.status, 'queued'))
      .orderBy(desc(agentQueue.priority), asc(agentQueue.position))
      .limit(1);

    if (queueItems.length === 0) {
      return null;
    }

    const queueItem = queueItems[0];

    // Récupérer la tâche associée
    const tasks = await db.select()
      .from(agentTasks)
      .where(eq(agentTasks.id, queueItem.taskId))
      .limit(1);

    if (tasks.length === 0) {
      // Nettoyer l'entrée orpheline
      await db.delete(agentQueue).where(eq(agentQueue.taskId, queueItem.taskId));
      return null;
    }

    const task = tasks[0];

    // Marquer comme en cours de traitement
    await db.update(agentQueue)
      .set({ 
        status: 'processing',
        startedAt: new Date()
      })
      .where(eq(agentQueue.taskId, queueItem.taskId));

    await db.update(agentTasks)
      .set({ 
        status: 'running',
        startedAt: new Date(),
        currentPhase: 'starting'
      })
      .where(eq(agentTasks.id, task.id));

    console.log(`[TaskQueue] Dequeued task ${task.id}`);

    return {
      id: task.id,
      userId: task.userId,
      goal: task.goal,
      config: task.config as TaskConfig || DEFAULT_CONFIG,
      status: 'running',
      priority: queueItem.priority || 0,
      position: queueItem.position,
      queuedAt: queueItem.queuedAt
    };
  }

  /**
   * Marque une tâche comme terminée
   */
  async complete(taskId: string, result: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    await db.update(agentTasks)
      .set({ 
        status: 'completed',
        result: result,
        completedAt: new Date()
      })
      .where(eq(agentTasks.id, taskId));

    await db.update(agentQueue)
      .set({ 
        status: 'completed',
        completedAt: new Date()
      })
      .where(eq(agentQueue.taskId, taskId));

    console.log(`[TaskQueue] Task ${taskId} completed`);
  }

  /**
   * Marque une tâche comme échouée
   */
  async fail(taskId: string, error: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    await db.update(agentTasks)
      .set({ 
        status: 'failed',
        error: error,
        completedAt: new Date()
      })
      .where(eq(agentTasks.id, taskId));

    await db.update(agentQueue)
      .set({ 
        status: 'failed',
        completedAt: new Date()
      })
      .where(eq(agentQueue.taskId, taskId));

    console.log(`[TaskQueue] Task ${taskId} failed: ${error}`);
  }

  /**
   * Met une tâche en pause
   */
  async pause(taskId: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    await db.update(agentTasks)
      .set({ 
        status: 'paused',
        currentPhase: 'paused'
      })
      .where(eq(agentTasks.id, taskId));

    console.log(`[TaskQueue] Task ${taskId} paused`);
  }

  /**
   * Reprend une tâche en pause
   */
  async resume(taskId: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Récupérer la tâche
    const tasks = await db.select()
      .from(agentTasks)
      .where(and(
        eq(agentTasks.id, taskId),
        eq(agentTasks.status, 'paused')
      ))
      .limit(1);

    if (tasks.length === 0) {
      throw new Error(`Task ${taskId} not found or not paused`);
    }

    // Obtenir la prochaine position
    const positionResult = await db.select({ maxPos: sql<number>`MAX(position)` })
      .from(agentQueue);
    const lastPosition = positionResult[0]?.maxPos || 0;

    // Supprimer l'ancienne entrée de queue si elle existe
    await db.delete(agentQueue).where(eq(agentQueue.taskId, taskId));

    // Ajouter avec priorité élevée
    await db.insert(agentQueue).values({
      taskId: taskId,
      priority: 100, // Haute priorité pour les reprises
      position: lastPosition + 1,
      status: 'queued',
    });

    await db.update(agentTasks)
      .set({ 
        status: 'pending',
        currentPhase: 'resuming'
      })
      .where(eq(agentTasks.id, taskId));

    console.log(`[TaskQueue] Task ${taskId} resumed`);
  }

  /**
   * Annule une tâche
   */
  async cancel(taskId: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    await db.update(agentTasks)
      .set({ 
        status: 'cancelled',
        completedAt: new Date()
      })
      .where(eq(agentTasks.id, taskId));

    await db.delete(agentQueue).where(eq(agentQueue.taskId, taskId));

    console.log(`[TaskQueue] Task ${taskId} cancelled`);
  }

  /**
   * Récupère l'état d'une tâche
   */
  async getTask(taskId: string): Promise<typeof agentTasks.$inferSelect | null> {
    const db = await getDb();
    if (!db) return null;
    
    const tasks = await db.select()
      .from(agentTasks)
      .where(eq(agentTasks.id, taskId))
      .limit(1);

    return tasks[0] || null;
  }

  /**
   * Récupère les tâches d'un utilisateur
   */
  async getUserTasks(userId: number, limit: number = 50): Promise<typeof agentTasks.$inferSelect[]> {
    const db = await getDb();
    if (!db) return [];
    
    return db.select()
      .from(agentTasks)
      .where(eq(agentTasks.userId, userId))
      .orderBy(desc(agentTasks.createdAt))
      .limit(limit);
  }

  /**
   * Récupère les tâches en attente dans la queue
   */
  async getQueuedTasks(): Promise<QueuedTask[]> {
    const db = await getDb();
    if (!db) return [];
    
    const queueItems = await db.select()
      .from(agentQueue)
      .where(eq(agentQueue.status, 'queued'))
      .orderBy(desc(agentQueue.priority), asc(agentQueue.position));

    const tasks: QueuedTask[] = [];
    for (const item of queueItems) {
      const task = await this.getTask(item.taskId);
      if (task) {
        tasks.push({
          id: task.id,
          userId: task.userId,
          goal: task.goal,
          config: task.config as TaskConfig || DEFAULT_CONFIG,
          status: item.status || 'queued',
          priority: item.priority || 0,
          position: item.position,
          queuedAt: item.queuedAt
        });
      }
    }

    return tasks;
  }

  /**
   * Compte les tâches dans la queue
   */
  async getQueueLength(): Promise<number> {
    const db = await getDb();
    if (!db) return 0;
    
    const result = await db.select({ count: sql<number>`COUNT(*)` })
      .from(agentQueue)
      .where(eq(agentQueue.status, 'queued'));

    return result[0]?.count || 0;
  }

  /**
   * Nettoie les tâches anciennes
   */
  async cleanup(daysOld: number = 7): Promise<number> {
    const db = await getDb();
    if (!db) return 0;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Supprimer les entrées de queue terminées
    await db.delete(agentQueue)
      .where(and(
        sql`${agentQueue.status} IN ('completed', 'failed')`,
        sql`${agentQueue.completedAt} < ${cutoffDate}`
      ));

    console.log(`[TaskQueue] Cleaned up old queue entries`);
    return 0;
  }
}

// Export singleton
export const taskQueue = TaskQueue.getInstance();
export default taskQueue;
