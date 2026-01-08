/**
 * State Manager - Gestionnaire d'état persistant pour l'agent
 * 
 * Ce module gère la persistance de l'état de l'agent, permettant:
 * - Sauvegarde après chaque action (checkpoint)
 * - Reprise exacte après interruption
 * - Rollback en cas d'erreur
 */

import { getDb } from '../../db';
import { agentTasks, agentSteps, agentCheckpoints, agentEvents } from '../../../drizzle/schema';
import { eq, desc, asc, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Types
export interface AgentState {
  taskId: string;
  currentPhase: string;
  currentIteration: number;
  totalToolCalls: number;
  workingMemory: Record<string, unknown>;
  observations: string[];
  lastToolResult?: {
    tool: string;
    success: boolean;
    output?: string;
  };
}

export interface StepData {
  type: 'think' | 'plan' | 'tool_call' | 'observe' | 'answer' | 'error' | 'checkpoint';
  content?: string;
  thinking?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: {
    success: boolean;
    output?: string;
    error?: string;
    artifacts?: Array<{
      type: string;
      content: string;
      name?: string;
      mimeType?: string;
    }>;
    metadata?: Record<string, unknown>;
  };
}

export interface EventData {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Classe StateManager - Gère l'état persistant de l'agent
 */
export class StateManager {
  private taskId: string;
  private stepCounter: number = 0;
  private eventSequence: number = 0;

  constructor(taskId: string) {
    this.taskId = taskId;
    console.log(`[StateManager] Initialized for task ${taskId}`);
  }

  /**
   * Charge l'état actuel depuis la base de données
   */
  async loadState(): Promise<AgentState | null> {
    const db = await getDb();
    if (!db) return null;

    const tasks = await db.select()
      .from(agentTasks)
      .where(eq(agentTasks.id, this.taskId))
      .limit(1);

    if (tasks.length === 0) return null;

    const task = tasks[0];

    // Compter les étapes existantes
    const stepCount = await db.select({ count: sql<number>`COUNT(*)` })
      .from(agentSteps)
      .where(eq(agentSteps.taskId, this.taskId));
    this.stepCounter = stepCount[0]?.count || 0;

    // Compter les événements existants
    const eventCount = await db.select({ count: sql<number>`COUNT(*)` })
      .from(agentEvents)
      .where(eq(agentEvents.taskId, this.taskId));
    this.eventSequence = eventCount[0]?.count || 0;

    // Récupérer les observations des étapes précédentes
    const observeSteps = await db.select()
      .from(agentSteps)
      .where(and(
        eq(agentSteps.taskId, this.taskId),
        eq(agentSteps.type, 'observe')
      ))
      .orderBy(asc(agentSteps.stepNumber));

    const observations = observeSteps
      .map(s => s.content)
      .filter((c): c is string => c !== null);

    // Récupérer le dernier résultat d'outil
    const lastToolStep = await db.select()
      .from(agentSteps)
      .where(and(
        eq(agentSteps.taskId, this.taskId),
        eq(agentSteps.type, 'tool_call')
      ))
      .orderBy(desc(agentSteps.stepNumber))
      .limit(1);

    let lastToolResult: AgentState['lastToolResult'] | undefined;
    if (lastToolStep.length > 0 && lastToolStep[0].toolResult) {
      const result = lastToolStep[0].toolResult as { success: boolean; output?: string };
      lastToolResult = {
        tool: lastToolStep[0].toolName || 'unknown',
        success: result.success,
        output: result.output
      };
    }

    return {
      taskId: task.id,
      currentPhase: task.currentPhase || 'unknown',
      currentIteration: task.currentIteration || 0,
      totalToolCalls: task.totalToolCalls || 0,
      workingMemory: task.workingMemory as Record<string, unknown> || {},
      observations,
      lastToolResult
    };
  }

  /**
   * Sauvegarde une étape
   */
  async saveStep(data: StepData): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    this.stepCounter++;
    const stepId = `step-${this.taskId}-${this.stepCounter}-${randomUUID().substring(0, 8)}`;

    await db.insert(agentSteps).values([{
      id: stepId,
      taskId: this.taskId,
      stepNumber: this.stepCounter,
      type: data.type,
      content: data.content,
      thinking: data.thinking,
      toolName: data.toolName,
      toolArgs: data.toolArgs,
      toolResult: data.toolResult,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date()
    }]);

    console.log(`[StateManager] Saved step ${stepId} (type: ${data.type})`);
    return stepId;
  }

  /**
   * Met à jour l'état de la tâche
   */
  async updateTaskState(updates: Partial<{
    status: string;
    currentPhase: string;
    currentIteration: number;
    totalToolCalls: number;
    workingMemory: Record<string, unknown>;
    result: string;
    error: string;
  }>): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    await db.update(agentTasks)
      .set({
        ...updates,
        updatedAt: new Date()
      } as any)
      .where(eq(agentTasks.id, this.taskId));

    console.log(`[StateManager] Updated task state: ${JSON.stringify(Object.keys(updates))}`);
  }

  /**
   * Crée un checkpoint (point de sauvegarde)
   */
  async createCheckpoint(reason?: string): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const state = await this.loadState();
    if (!state) throw new Error('Cannot create checkpoint: state not found');

    const checkpointId = `checkpoint-${this.taskId}-${this.stepCounter}-${randomUUID().substring(0, 8)}`;

    await db.insert(agentCheckpoints).values([{
      id: checkpointId,
      taskId: this.taskId,
      stepNumber: this.stepCounter,
      state: {
        currentPhase: state.currentPhase,
        currentIteration: state.currentIteration,
        totalToolCalls: state.totalToolCalls,
        workingMemory: state.workingMemory,
        observations: state.observations,
        lastToolResult: state.lastToolResult
      },
      reason: reason || 'automatic',
      isAutomatic: !reason
    }]);

    // Mettre à jour le timestamp du dernier checkpoint
    await db.update(agentTasks)
      .set({ lastCheckpointAt: new Date() })
      .where(eq(agentTasks.id, this.taskId));

    console.log(`[StateManager] Created checkpoint ${checkpointId}`);
    return checkpointId;
  }

  /**
   * Restaure depuis un checkpoint
   */
  async restoreFromCheckpoint(checkpointId?: string): Promise<AgentState | null> {
    const db = await getDb();
    if (!db) return null;

    // Si pas de checkpointId, prendre le dernier
    let checkpoint;
    if (checkpointId) {
      const checkpoints = await db.select()
        .from(agentCheckpoints)
        .where(eq(agentCheckpoints.id, checkpointId))
        .limit(1);
      checkpoint = checkpoints[0];
    } else {
      const checkpoints = await db.select()
        .from(agentCheckpoints)
        .where(eq(agentCheckpoints.taskId, this.taskId))
        .orderBy(desc(agentCheckpoints.createdAt))
        .limit(1);
      checkpoint = checkpoints[0];
    }

    if (!checkpoint) {
      console.log(`[StateManager] No checkpoint found`);
      return null;
    }

    const state = checkpoint.state as AgentState;

    // Restaurer l'état de la tâche
    await db.update(agentTasks)
      .set({
        currentPhase: state.currentPhase,
        currentIteration: state.currentIteration,
        totalToolCalls: state.totalToolCalls,
        workingMemory: state.workingMemory,
        status: 'running'
      })
      .where(eq(agentTasks.id, this.taskId));

    // Supprimer les étapes après le checkpoint
    await db.delete(agentSteps)
      .where(and(
        eq(agentSteps.taskId, this.taskId),
        sql`${agentSteps.stepNumber} > ${checkpoint.stepNumber}`
      ));

    this.stepCounter = checkpoint.stepNumber;

    console.log(`[StateManager] Restored from checkpoint ${checkpoint.id} at step ${checkpoint.stepNumber}`);
    return state;
  }

  /**
   * Enregistre un événement pour le streaming
   */
  async emitEvent(data: EventData): Promise<void> {
    const db = await getDb();
    if (!db) return;

    this.eventSequence++;

    await db.insert(agentEvents).values([{
      taskId: this.taskId,
      eventType: data.type,
      data: data.data,
      sequence: this.eventSequence
    }]);
  }

  /**
   * Récupère les événements depuis une séquence donnée
   */
  async getEventsSince(sequence: number): Promise<Array<{ type: string; data: Record<string, unknown>; sequence: number }>> {
    const db = await getDb();
    if (!db) return [];

    const events = await db.select()
      .from(agentEvents)
      .where(and(
        eq(agentEvents.taskId, this.taskId),
        sql`${agentEvents.sequence} > ${sequence}`
      ))
      .orderBy(asc(agentEvents.sequence));

    return events.map(e => ({
      type: e.eventType,
      data: e.data as Record<string, unknown>,
      sequence: e.sequence
    }));
  }

  /**
   * Récupère toutes les étapes de la tâche
   */
  async getSteps(): Promise<Array<typeof agentSteps.$inferSelect>> {
    const db = await getDb();
    if (!db) return [];

    return db.select()
      .from(agentSteps)
      .where(eq(agentSteps.taskId, this.taskId))
      .orderBy(asc(agentSteps.stepNumber));
  }

  /**
   * Récupère tous les checkpoints de la tâche
   */
  async getCheckpoints(): Promise<Array<typeof agentCheckpoints.$inferSelect>> {
    const db = await getDb();
    if (!db) return [];

    return db.select()
      .from(agentCheckpoints)
      .where(eq(agentCheckpoints.taskId, this.taskId))
      .orderBy(desc(agentCheckpoints.createdAt));
  }

  /**
   * Ajoute un artifact à la tâche
   */
  async addArtifact(artifact: {
    type: string;
    name?: string;
    content: string;
    url?: string;
    mimeType?: string;
  }): Promise<void> {
    const db = await getDb();
    if (!db) return;

    // Récupérer les artifacts existants
    const tasks = await db.select()
      .from(agentTasks)
      .where(eq(agentTasks.id, this.taskId))
      .limit(1);

    if (tasks.length === 0) return;

    const existingArtifacts = (tasks[0].artifacts as Array<any>) || [];
    const newArtifacts = [
      ...existingArtifacts,
      {
        ...artifact,
        createdAt: new Date().toISOString()
      }
    ];

    await db.update(agentTasks)
      .set({ artifacts: newArtifacts })
      .where(eq(agentTasks.id, this.taskId));

    console.log(`[StateManager] Added artifact: ${artifact.type} - ${artifact.name || 'unnamed'}`);
  }

  /**
   * Met à jour la mémoire de travail
   */
  async updateWorkingMemory(key: string, value: unknown): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const tasks = await db.select()
      .from(agentTasks)
      .where(eq(agentTasks.id, this.taskId))
      .limit(1);

    if (tasks.length === 0) return;

    const existingMemory = (tasks[0].workingMemory as Record<string, unknown>) || {};
    const newMemory = {
      ...existingMemory,
      [key]: value
    };

    await db.update(agentTasks)
      .set({ workingMemory: newMemory })
      .where(eq(agentTasks.id, this.taskId));
  }
}

// Factory function
export function createStateManager(taskId: string): StateManager {
  return new StateManager(taskId);
}

export default StateManager;
