/**
 * PERSISTENT AGENT LOOP - Boucle d'Agent Persistante
 * 
 * Ce module améliore la boucle d'agent pour:
 * 1. Persister l'état complet en base de données
 * 2. Récupérer automatiquement après un crash/redémarrage
 * 3. Maintenir un heartbeat pour détecter les agents morts
 * 4. Reprendre les tâches interrompues
 * 5. Gérer les sessions de longue durée
 */

import { getDb } from "../db";
import { agentState, autonomousTasks, taskLogs } from "../../drizzle/schema";
import { eq, and, lt, desc, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { invokeLLM } from "../_core/llm";
import { EventEmitter } from "events";

// Constantes de configuration
const HEARTBEAT_INTERVAL = 10000; // 10 secondes
const STALE_THRESHOLD = 60000; // 1 minute sans heartbeat = agent mort
const MAX_RECOVERY_ATTEMPTS = 3;
const CHECKPOINT_INTERVAL = 5000; // Sauvegarde toutes les 5 secondes

export interface AgentLoopState {
  id: string;
  userId: number;
  sessionId: string;
  status: 'idle' | 'running' | 'paused' | 'recovering' | 'crashed';
  currentTaskId?: string;
  currentPhaseId?: number;
  currentStepIndex: number;
  totalSteps: number;
  context: Record<string, unknown>;
  memory: AgentMemory;
  lastHeartbeat: Date;
  lastCheckpoint: Date;
  recoveryAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMemory {
  shortTerm: string[]; // Dernières 10 interactions
  workingMemory: Record<string, unknown>; // Variables de travail
  conversationSummary: string; // Résumé de la conversation
  learnedPatterns: string[]; // Patterns appris
}

export interface AgentPhase {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  steps: AgentStep[];
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface AgentStep {
  id: string;
  phaseId: number;
  title: string;
  action: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Classe principale pour la boucle d'agent persistante
 */
export class PersistentAgentLoop extends EventEmitter {
  private state: AgentLoopState;
  private heartbeatTimer?: NodeJS.Timeout;
  private checkpointTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(userId: number, sessionId?: string) {
    super();
    this.state = this.createInitialState(userId, sessionId);
  }

  /**
   * Crée l'état initial de l'agent
   */
  private createInitialState(userId: number, sessionId?: string): AgentLoopState {
    const now = new Date();
    return {
      id: randomUUID(),
      userId,
      sessionId: sessionId || randomUUID(),
      status: 'idle',
      currentStepIndex: 0,
      totalSteps: 0,
      context: {},
      memory: {
        shortTerm: [],
        workingMemory: {},
        conversationSummary: '',
        learnedPatterns: []
      },
      lastHeartbeat: now,
      lastCheckpoint: now,
      recoveryAttempts: 0,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Démarre la boucle d'agent avec récupération automatique
   */
  async start(): Promise<boolean> {
    try {
      console.log(`[PersistentAgentLoop] Démarrage pour l'utilisateur ${this.state.userId}`);

      // Vérifier s'il existe un état à récupérer
      const recovered = await this.tryRecoverFromCrash();
      if (recovered) {
        console.log('[PersistentAgentLoop] État récupéré avec succès');
      }

      // Démarrer le heartbeat
      this.startHeartbeat();

      // Démarrer les checkpoints automatiques
      this.startAutoCheckpoint();

      // Sauvegarder l'état initial
      await this.saveState();

      this.state.status = 'running';
      this.emit('started', { sessionId: this.state.sessionId });

      return true;
    } catch (error) {
      console.error('[PersistentAgentLoop] Erreur au démarrage:', error);
      return false;
    }
  }

  /**
   * Arrête proprement la boucle d'agent
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true;
    console.log('[PersistentAgentLoop] Arrêt en cours...');

    // Arrêter les timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
    }

    // Sauvegarder l'état final
    this.state.status = 'paused';
    await this.saveState();

    this.emit('stopped', { sessionId: this.state.sessionId });
    console.log('[PersistentAgentLoop] Arrêté proprement');
  }

  /**
   * Tente de récupérer après un crash
   */
  private async tryRecoverFromCrash(): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    try {
      // Chercher un état existant pour cet utilisateur
      const existingStates = await db
        .select()
        .from(agentState)
        .where(
          and(
            eq(agentState.userId, this.state.userId),
            or(
              eq(agentState.status, 'running'),
              eq(agentState.status, 'recovering')
            )
          )
        )
        .orderBy(desc(agentState.updatedAt))
        .limit(1);

      if (existingStates.length === 0) {
        return false;
      }

      const existingState = existingStates[0];

      // Vérifier si l'état est vraiment mort (pas de heartbeat récent)
      const lastHeartbeat = new Date(existingState.lastHeartbeat || 0);
      const timeSinceHeartbeat = Date.now() - lastHeartbeat.getTime();

      if (timeSinceHeartbeat < STALE_THRESHOLD) {
        // L'agent est encore vivant, ne pas récupérer
        console.log('[PersistentAgentLoop] Agent existant encore actif');
        return false;
      }

      // Récupérer l'état
      console.log('[PersistentAgentLoop] Récupération de l\'état après crash...');

      const recoveryAttempts = (existingState.recoveryAttempts || 0) + 1;

      if (recoveryAttempts > MAX_RECOVERY_ATTEMPTS) {
        console.error('[PersistentAgentLoop] Trop de tentatives de récupération, abandon');
        await db
          .update(agentState)
          .set({ status: 'crashed', updatedAt: new Date() })
          .where(eq(agentState.id, existingState.id));
        return false;
      }

      // Restaurer l'état
      this.state = {
        id: existingState.id,
        userId: existingState.userId,
        sessionId: existingState.sessionId || randomUUID(),
        status: 'recovering',
        currentTaskId: existingState.currentTaskId || undefined,
        currentPhaseId: existingState.currentPhaseId || undefined,
        currentStepIndex: existingState.currentStepIndex || 0,
        totalSteps: existingState.totalSteps || 0,
        context: (existingState.context as Record<string, unknown>) || {},
        memory: (existingState.memory as AgentMemory) || this.createInitialState(this.state.userId).memory,
        lastHeartbeat: new Date(),
        lastCheckpoint: new Date(),
        recoveryAttempts,
        createdAt: existingState.createdAt,
        updatedAt: new Date()
      };

      // Mettre à jour en base
      await db
        .update(agentState)
        .set({
          status: 'recovering',
          recoveryAttempts,
          lastHeartbeat: new Date(),
          updatedAt: new Date()
        })
        .where(eq(agentState.id, existingState.id));

      // Reprendre la tâche en cours si elle existe
      if (this.state.currentTaskId) {
        await this.resumeTask(this.state.currentTaskId);
      }

      this.state.status = 'running';
      this.emit('recovered', { 
        sessionId: this.state.sessionId,
        recoveryAttempts 
      });

      return true;
    } catch (error) {
      console.error('[PersistentAgentLoop] Erreur lors de la récupération:', error);
      return false;
    }
  }

  /**
   * Reprend une tâche interrompue
   */
  private async resumeTask(taskId: string): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      const tasks = await db
        .select()
        .from(autonomousTasks)
        .where(eq(autonomousTasks.id, taskId));

      if (tasks.length === 0) {
        console.log(`[PersistentAgentLoop] Tâche ${taskId} non trouvée`);
        return;
      }

      const task = tasks[0];

      // Vérifier si la tâche était en cours
      if (task.status === 'in_progress') {
        console.log(`[PersistentAgentLoop] Reprise de la tâche: ${task.title}`);

        // Marquer la tâche comme en cours de récupération
        await db
          .update(autonomousTasks)
          .set({
            status: 'in_progress',
            updatedAt: new Date()
          })
          .where(eq(autonomousTasks.id, taskId));

        // Logger la reprise
        await db.insert(taskLogs).values({
          id: randomUUID(),
          taskId,
          userId: this.state.userId,
          actionType: 'task_resumed',
          input: { reason: 'crash_recovery' },
          createdAt: new Date()
        });

        this.emit('taskResumed', { taskId, title: task.title });
      }
    } catch (error) {
      console.error('[PersistentAgentLoop] Erreur lors de la reprise de tâche:', error);
    }
  }

  /**
   * Démarre le heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        const db = await getDb();
        if (!db) return;

        this.state.lastHeartbeat = new Date();

        await db
          .update(agentState)
          .set({
            lastHeartbeat: this.state.lastHeartbeat,
            status: this.state.status
          })
          .where(eq(agentState.id, this.state.id));

        this.emit('heartbeat', { timestamp: this.state.lastHeartbeat });
      } catch (error) {
        console.error('[PersistentAgentLoop] Erreur heartbeat:', error);
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Démarre les checkpoints automatiques
   */
  private startAutoCheckpoint(): void {
    this.checkpointTimer = setInterval(async () => {
      if (this.isShuttingDown) return;
      await this.saveCheckpoint();
    }, CHECKPOINT_INTERVAL);
  }

  /**
   * Sauvegarde un checkpoint de l'état
   */
  async saveCheckpoint(): Promise<void> {
    try {
      await this.saveState();
      this.state.lastCheckpoint = new Date();
      this.emit('checkpoint', { timestamp: this.state.lastCheckpoint });
    } catch (error) {
      console.error('[PersistentAgentLoop] Erreur checkpoint:', error);
    }
  }

  /**
   * Sauvegarde l'état complet en base de données
   */
  async saveState(): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      const stateData = {
        id: this.state.id,
        userId: this.state.userId,
        sessionId: this.state.sessionId,
        status: this.state.status,
        currentTaskId: this.state.currentTaskId,
        currentPhaseId: this.state.currentPhaseId,
        currentStepIndex: this.state.currentStepIndex,
        totalSteps: this.state.totalSteps,
        context: this.state.context,
        memory: this.state.memory,
        lastHeartbeat: this.state.lastHeartbeat,
        recoveryAttempts: this.state.recoveryAttempts,
        updatedAt: new Date()
      };

      // Upsert: insert ou update
      const existing = await db
        .select()
        .from(agentState)
        .where(eq(agentState.id, this.state.id));

      if (existing.length > 0) {
        await db
          .update(agentState)
          .set(stateData)
          .where(eq(agentState.id, this.state.id));
      } else {
        await db.insert(agentState).values({
          ...stateData,
          createdAt: this.state.createdAt
        });
      }
    } catch (error) {
      console.error('[PersistentAgentLoop] Erreur sauvegarde état:', error);
    }
  }

  /**
   * Met à jour la mémoire de l'agent
   */
  updateMemory(update: Partial<AgentMemory>): void {
    this.state.memory = {
      ...this.state.memory,
      ...update
    };

    // Limiter la mémoire à court terme
    if (this.state.memory.shortTerm.length > 10) {
      this.state.memory.shortTerm = this.state.memory.shortTerm.slice(-10);
    }

    this.state.updatedAt = new Date();
  }

  /**
   * Ajoute une interaction à la mémoire à court terme
   */
  addToShortTermMemory(interaction: string): void {
    this.state.memory.shortTerm.push(interaction);
    if (this.state.memory.shortTerm.length > 10) {
      this.state.memory.shortTerm.shift();
    }
  }

  /**
   * Met à jour le contexte de travail
   */
  updateContext(key: string, value: unknown): void {
    this.state.context[key] = value;
    this.state.updatedAt = new Date();
  }

  /**
   * Définit la tâche courante
   */
  setCurrentTask(taskId: string, totalSteps: number): void {
    this.state.currentTaskId = taskId;
    this.state.totalSteps = totalSteps;
    this.state.currentStepIndex = 0;
    this.state.updatedAt = new Date();
  }

  /**
   * Avance à l'étape suivante
   */
  advanceStep(): void {
    this.state.currentStepIndex++;
    this.state.updatedAt = new Date();
    this.emit('stepAdvanced', {
      currentStep: this.state.currentStepIndex,
      totalSteps: this.state.totalSteps
    });
  }

  /**
   * Définit la phase courante
   */
  setCurrentPhase(phaseId: number): void {
    this.state.currentPhaseId = phaseId;
    this.state.updatedAt = new Date();
    this.emit('phaseChanged', { phaseId });
  }

  /**
   * Retourne l'état actuel
   */
  getState(): AgentLoopState {
    return { ...this.state };
  }

  /**
   * Retourne les statistiques de l'agent
   */
  getStats(): {
    sessionId: string;
    status: string;
    uptime: number;
    currentStep: number;
    totalSteps: number;
    recoveryAttempts: number;
    memorySize: number;
  } {
    return {
      sessionId: this.state.sessionId,
      status: this.state.status,
      uptime: Date.now() - this.state.createdAt.getTime(),
      currentStep: this.state.currentStepIndex,
      totalSteps: this.state.totalSteps,
      recoveryAttempts: this.state.recoveryAttempts,
      memorySize: this.state.memory.shortTerm.length
    };
  }
}

// Gestionnaire global des boucles d'agent
const agentLoops = new Map<number, PersistentAgentLoop>();

/**
 * Obtient ou crée une boucle d'agent pour un utilisateur
 */
export function getPersistentAgentLoop(userId: number): PersistentAgentLoop {
  if (!agentLoops.has(userId)) {
    const loop = new PersistentAgentLoop(userId);
    agentLoops.set(userId, loop);
  }
  return agentLoops.get(userId)!;
}

/**
 * Initialise toutes les boucles d'agent au démarrage du serveur
 */
export async function initializePersistentAgentLoops(): Promise<void> {
  console.log('[PersistentAgentLoop] Initialisation des boucles d\'agent...');

  const db = await getDb();
  if (!db) {
    console.error('[PersistentAgentLoop] Base de données non disponible');
    return;
  }

  try {
    // Récupérer tous les états d'agent qui étaient en cours
    const activeStates = await db
      .select()
      .from(agentState)
      .where(
        or(
          eq(agentState.status, 'running'),
          eq(agentState.status, 'recovering')
        )
      );

    console.log(`[PersistentAgentLoop] ${activeStates.length} agents à récupérer`);

    for (const state of activeStates) {
      const loop = new PersistentAgentLoop(state.userId);
      agentLoops.set(state.userId, loop);
      await loop.start();
    }

    console.log('[PersistentAgentLoop] ✅ Initialisation terminée');
  } catch (error) {
    console.error('[PersistentAgentLoop] Erreur lors de l\'initialisation:', error);
  }
}

/**
 * Arrête proprement toutes les boucles d'agent
 */
export async function shutdownPersistentAgentLoops(): Promise<void> {
  console.log('[PersistentAgentLoop] Arrêt de toutes les boucles...');

  for (const [userId, loop] of agentLoops) {
    await loop.stop();
  }

  agentLoops.clear();
  console.log('[PersistentAgentLoop] ✅ Toutes les boucles arrêtées');
}

export default PersistentAgentLoop;
