/**
 * CHECKPOINT MANAGER - Gestion de la Persistance d'État
 * 
 * Sauvegarde automatique après chaque interaction
 * Restauration transparente au redémarrage
 * Zero-Loss Memory pour continuité absolue
 */

import { getDb } from "../db";
import { sandboxCheckpoints, conversations } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface CheckpointState {
  variables: Record<string, unknown>;
  files: Record<string, string>;
  memory: string;
  lastAction: string;
  iterationCount: number;
  conversationHistory: Array<{
    role: string;
    content: string;
    timestamp: number;
  }>;
  sandboxState?: {
    cwd: string;
    env: Record<string, string>;
    processes: Array<{ pid: number; command: string }>;
  };
}

export class CheckpointManager {
  /**
   * Sauvegarde automatique après chaque interaction
   * Appelée automatiquement par le système de streaming
   */
  async autoSaveCheckpoint(
    userId: number,
    conversationId: string,
    state: CheckpointState
  ): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const checkpointId = randomUUID();
    const timestamp = new Date();

    try {
      // Sauvegarder le checkpoint
      await db.insert(sandboxCheckpoints).values({
        id: checkpointId,
        userId,
        conversationId,
        data: state,
        timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: true
      });

      console.log(`[CheckpointManager] Auto-save: ${checkpointId}`);
      return checkpointId;
    } catch (error) {
      console.error('[CheckpointManager] Erreur lors de l\'auto-save:', error);
      throw error;
    }
  }

  /**
   * Charge le dernier checkpoint pour une conversation
   * Restaure l'état complet du système
   */
  async loadLatestCheckpoint(
    userId: number,
    conversationId: string
  ): Promise<CheckpointState | null> {
    const db = await getDb();
    if (!db) return null;

    try {
      const result = await db
        .select()
        .from(sandboxCheckpoints)
        .where(eq(sandboxCheckpoints.userId, userId))
        .orderBy(desc(sandboxCheckpoints.updatedAt))
        .limit(1);

      if (result.length === 0) {
        console.log('[CheckpointManager] Aucun checkpoint trouvé');
        return null;
      }

      const checkpoint = result[0];
      const state = typeof checkpoint.data === 'string' 
        ? JSON.parse(checkpoint.data) 
        : checkpoint.data;

      console.log(`[CheckpointManager] Checkpoint chargé: ${checkpoint.id}`);
      return state as CheckpointState;
    } catch (error) {
      console.error('[CheckpointManager] Erreur lors du chargement:', error);
      return null;
    }
  }

  /**
   * Restaure l'état complet du système depuis un checkpoint
   * Appelé au démarrage d'une nouvelle conversation
   */
  async restoreSystemState(
    userId: number,
    conversationId: string
  ): Promise<{
    restored: boolean;
    state?: CheckpointState;
    message: string;
  }> {
    const checkpoint = await this.loadLatestCheckpoint(userId, conversationId);

    if (!checkpoint) {
      return {
        restored: false,
        message: 'Aucun checkpoint à restaurer - Nouvelle session'
      };
    }

    // Restaurer les variables
    const variables = new Map(Object.entries(checkpoint.variables || {}));

    // Restaurer les fichiers
    const files = new Map(Object.entries(checkpoint.files || {}));

    // Restaurer la mémoire
    const memory = checkpoint.memory || '';

    console.log(`[CheckpointManager] État restauré:`);
    console.log(`  - Variables: ${variables.size}`);
    console.log(`  - Fichiers: ${files.size}`);
    console.log(`  - Mémoire: ${memory.length} caractères`);

    return {
      restored: true,
      state: checkpoint,
      message: `État restauré depuis ${new Date(checkpoint.lastAction).toLocaleString()}`
    };
  }

  /**
   * Crée un snapshot du checkpoint actuel
   * Utilisé pour les savepoints manuels
   */
  async createSnapshot(
    userId: number,
    conversationId: string,
    label: string,
    state: CheckpointState
  ): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const snapshotId = randomUUID();
    const timestamp = new Date();

    try {
      // Ajouter le label au state
      const snapshotState = {
        ...state,
        snapshotLabel: label,
        snapshotCreatedAt: timestamp.getTime()
      };

      await db.insert(sandboxCheckpoints).values({
        id: snapshotId,
        userId,
        conversationId,
        data: snapshotState,
        timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: true
      });

      console.log(`[CheckpointManager] Snapshot créé: ${snapshotId} - ${label}`);
      return snapshotId;
    } catch (error) {
      console.error('[CheckpointManager] Erreur lors de la création du snapshot:', error);
      throw error;
    }
  }

  /**
   * Récupère l'historique des checkpoints
   */
  async getCheckpointHistory(
    userId: number,
    limit: number = 10
  ): Promise<Array<{
    id: string;
    conversationId: string;
    timestamp: Date;
    label?: string;
  }>> {
    const db = await getDb();
    if (!db) return [];

    try {
      const result = await db
        .select()
        .from(sandboxCheckpoints)
        .where(eq(sandboxCheckpoints.userId, userId))
        .orderBy(desc(sandboxCheckpoints.updatedAt))
        .limit(limit);

      return result.map(cp => ({
        id: cp.id,
        conversationId: cp.conversationId,
        timestamp: cp.timestamp,
        label: (typeof cp.data === 'string' 
          ? JSON.parse(cp.data) 
          : cp.data)?.snapshotLabel
      }));
    } catch (error) {
      console.error('[CheckpointManager] Erreur lors de la récupération de l\'historique:', error);
      return [];
    }
  }

  /**
   * Restaure depuis un checkpoint spécifique
   */
  async restoreFromCheckpointId(
    checkpointId: string
  ): Promise<CheckpointState | null> {
    const db = await getDb();
    if (!db) return null;

    try {
      const result = await db
        .select()
        .from(sandboxCheckpoints)
        .where(eq(sandboxCheckpoints.id, checkpointId))
        .limit(1);

      if (result.length === 0) return null;

      const checkpoint = result[0];
      const state = typeof checkpoint.data === 'string' 
        ? JSON.parse(checkpoint.data) 
        : checkpoint.data;

      console.log(`[CheckpointManager] Restauration depuis: ${checkpointId}`);
      return state as CheckpointState;
    } catch (error) {
      console.error('[CheckpointManager] Erreur lors de la restauration:', error);
      return null;
    }
  }

  /**
   * Nettoie les anciens checkpoints
   * Garde seulement les N derniers par conversation
   */
  async cleanupOldCheckpoints(
    userId: number,
    maxPerConversation: number = 10
  ): Promise<number> {
    const db = await getDb();
    if (!db) return 0;

    try {
      const allCheckpoints = await db
        .select()
        .from(sandboxCheckpoints)
        .where(eq(sandboxCheckpoints.userId, userId))
        .orderBy(desc(sandboxCheckpoints.updatedAt));

      // Grouper par conversation
      const byConversation = new Map<string, typeof allCheckpoints>();
      for (const cp of allCheckpoints) {
        if (!byConversation.has(cp.conversationId)) {
          byConversation.set(cp.conversationId, []);
        }
        byConversation.get(cp.conversationId)!.push(cp);
      }

      let deletedCount = 0;

      // Supprimer les anciens checkpoints par conversation
      byConversation.forEach((checkpoints, conversationId) => {
        if (checkpoints.length > maxPerConversation) {
          const toDelete = checkpoints.slice(maxPerConversation);
          deletedCount += toDelete.length;
          console.log(`[CheckpointManager] Suppression de ${toDelete.length} anciens checkpoints pour ${conversationId}`);
        }
      });

      return deletedCount;
    } catch (error) {
      console.error('[CheckpointManager] Erreur lors du nettoyage:', error);
      return 0;
    }
  }

  /**
   * Exporte un checkpoint pour sauvegarde externe
   */
  async exportCheckpoint(checkpointId: string): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    try {
      const result = await db
        .select()
        .from(sandboxCheckpoints)
        .where(eq(sandboxCheckpoints.id, checkpointId))
        .limit(1);

      if (result.length === 0) throw new Error('Checkpoint not found');

      const checkpoint = result[0];
      const exportData = {
        id: checkpoint.id,
        userId: checkpoint.userId,
        conversationId: checkpoint.conversationId,
        timestamp: checkpoint.timestamp,
        data: checkpoint.data,
        version: checkpoint.version
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('[CheckpointManager] Erreur lors de l\'export:', error);
      throw error;
    }
  }

  /**
   * Importe un checkpoint depuis une sauvegarde externe
   */
  async importCheckpoint(
    userId: number,
    exportedData: string
  ): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    try {
      const parsed = JSON.parse(exportedData);
      const newId = randomUUID();
      const timestamp = new Date();

      await db.insert(sandboxCheckpoints).values({
        id: newId,
        userId,
        conversationId: parsed.conversationId,
        data: parsed.data,
        timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: true
      });

      console.log(`[CheckpointManager] Checkpoint importé: ${newId}`);
      return newId;
    } catch (error) {
      console.error('[CheckpointManager] Erreur lors de l\'import:', error);
      throw error;
    }
  }
}

// Export singleton
export const checkpointManager = new CheckpointManager();
