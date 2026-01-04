/**
 * E2B Sandbox Checkpoint Manager
 * 
 * Sauvegarde et restaure l'état complet du sandbox E2B:
 * - Variables d'environnement
 * - Fichiers créés
 * - État de la session
 * - Historique des exécutions
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDb } from '../db';
import { sandboxCheckpoints } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

export interface CheckpointData {
  conversationId: string;
  userId: string;
  timestamp: number;
  sandboxState: {
    variables: Record<string, any>;
    files: Array<{
      path: string;
      content: string;
      isDirectory: boolean;
    }>;
    environment: Record<string, string>;
    workingDirectory: string;
  };
  executionHistory: Array<{
    command: string;
    output: string;
    error?: string;
    timestamp: number;
  }>;
  metadata: {
    version: string;
    e2bVersion: string;
    pythonVersion: string;
    nodeVersion: string;
  };
}

export class E2BCheckpointManager {
  private checkpointDir: string;
  private maxCheckpointsPerConversation = 10;

  constructor() {
    this.checkpointDir = path.join(process.cwd(), '.checkpoints');
    
    // Créer le répertoire de checkpoints
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
    
    console.log('[E2BCheckpoint] Initialized with checkpoint dir:', this.checkpointDir);
  }

  /**
   * Sauvegarder un checkpoint de l'état du sandbox
   */
  async saveCheckpoint(
    conversationId: string,
    userId: string,
    sandboxState: CheckpointData['sandboxState'],
    executionHistory: CheckpointData['executionHistory'],
    metadata: CheckpointData['metadata']
  ): Promise<string> {
    try {
      const timestamp = Date.now();
      const checkpointId = `checkpoint_${userId}_${conversationId}_${timestamp}`;
      
      const checkpointData: CheckpointData = {
        conversationId,
        userId,
        timestamp,
        sandboxState,
        executionHistory,
        metadata,
      };

      // Sauvegarder dans la base de données
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.insert(sandboxCheckpoints).values({
        id: checkpointId,
        conversationId,
        userId: parseInt(userId),
        timestamp: new Date(timestamp),
        data: checkpointData as any,
        version: 1,
        isActive: true,
      });

      // Sauvegarder aussi dans le système de fichiers pour la redondance
      const checkpointFile = path.join(this.checkpointDir, `${checkpointId}.json`);
      fs.writeFileSync(checkpointFile, JSON.stringify(checkpointData, null, 2));

      console.log('[E2BCheckpoint] Checkpoint saved:', checkpointId);

      // Nettoyer les anciens checkpoints
      await this.cleanupOldCheckpoints(conversationId);

      return checkpointId;
    } catch (error) {
      console.error('[E2BCheckpoint] Error saving checkpoint:', error);
      throw error;
    }
  }

  /**
   * Charger le dernier checkpoint d'une conversation
   */
  async loadLatestCheckpoint(conversationId: string): Promise<CheckpointData | null> {
    try {
      // Chercher dans la base de données
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const result = await db
        .select()
        .from(sandboxCheckpoints)
        .where(eq(sandboxCheckpoints.conversationId, conversationId))
        .orderBy(desc(sandboxCheckpoints.timestamp))
        .limit(1);

      if (result.length === 0) {
        console.log('[E2BCheckpoint] No checkpoint found for conversation:', conversationId);
        return null;
      }

      const checkpoint = result[0];
      const data = (typeof checkpoint.data === 'string' ? JSON.parse(checkpoint.data) : checkpoint.data) as CheckpointData;

      console.log('[E2BCheckpoint] Loaded checkpoint:', checkpoint.id);

      return data;
    } catch (error) {
      console.error('[E2BCheckpoint] Error loading checkpoint:', error);
      return null;
    }
  }

  /**
   * Charger un checkpoint spécifique par ID
   */
  async loadCheckpointById(checkpointId: string): Promise<CheckpointData | null> {
    try {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const result = await db
        .select()
        .from(sandboxCheckpoints)
        .where(eq(sandboxCheckpoints.id, checkpointId))
        .limit(1);

      if (result.length === 0) {
        console.log('[E2BCheckpoint] Checkpoint not found:', checkpointId);
        return null;
      }

      const checkpoint = result[0];
      const data = (typeof checkpoint.data === 'string' ? JSON.parse(checkpoint.data) : checkpoint.data) as CheckpointData;

      console.log('[E2BCheckpoint] Loaded checkpoint by ID:', checkpointId);

      return data;
    } catch (error) {
      console.error('[E2BCheckpoint] Error loading checkpoint:', error);
      return null;
    }
  }

  /**
   * Lister tous les checkpoints d'une conversation
   */
  async listCheckpoints(conversationId: string): Promise<Array<{
    id: string;
    timestamp: Date;
    version: number;
  }>> {
    try {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const results = await db
        .select({
          id: sandboxCheckpoints.id,
          timestamp: sandboxCheckpoints.timestamp,
          version: sandboxCheckpoints.version,
        })
        .from(sandboxCheckpoints)
        .where(eq(sandboxCheckpoints.conversationId, conversationId))
        .orderBy(desc(sandboxCheckpoints.timestamp));

      console.log('[E2BCheckpoint] Listed', results.length, 'checkpoints for conversation:', conversationId);

      return results;
    } catch (error) {
      console.error('[E2BCheckpoint] Error listing checkpoints:', error);
      return [];
    }
  }

  /**
   * Supprimer un checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      // Supprimer de la base de données
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.delete(sandboxCheckpoints).where(eq(sandboxCheckpoints.id, checkpointId));

      // Supprimer le fichier
      const checkpointFile = path.join(this.checkpointDir, `${checkpointId}.json`);
      if (fs.existsSync(checkpointFile)) {
        fs.unlinkSync(checkpointFile);
      }

      console.log('[E2BCheckpoint] Deleted checkpoint:', checkpointId);

      return true;
    } catch (error) {
      console.error('[E2BCheckpoint] Error deleting checkpoint:', error);
      return false;
    }
  }

  /**
   * Nettoyer les anciens checkpoints
   */
  private async cleanupOldCheckpoints(conversationId: string): Promise<void> {
    try {
      const checkpoints = await this.listCheckpoints(conversationId);

      // Garder seulement les N derniers checkpoints
      if (checkpoints.length > this.maxCheckpointsPerConversation) {
        const toDelete = checkpoints.slice(this.maxCheckpointsPerConversation);
        
        for (const checkpoint of toDelete) {
          await this.deleteCheckpoint(checkpoint.id);
        }

        console.log('[E2BCheckpoint] Cleaned up', toDelete.length, 'old checkpoints');
      }
    } catch (error) {
      console.error('[E2BCheckpoint] Error cleaning up checkpoints:', error);
    }
  }

  /**
   * Restaurer l'état du sandbox à partir d'un checkpoint
   */
  async restoreCheckpoint(checkpointData: CheckpointData): Promise<boolean> {
    try {
      console.log('[E2BCheckpoint] Restoring checkpoint...');

      // Restaurer les variables d'environnement
      Object.entries(checkpointData.sandboxState.environment).forEach(([key, value]) => {
        process.env[key] = value;
      });

      // Restaurer les fichiers
      for (const file of checkpointData.sandboxState.files) {
        const filePath = path.join(checkpointData.sandboxState.workingDirectory, file.path);
        
        // Créer les répertoires parent
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Écrire le fichier
        if (!file.isDirectory) {
          fs.writeFileSync(filePath, file.content);
        }
      }

      console.log('[E2BCheckpoint] Checkpoint restored successfully');

      return true;
    } catch (error) {
      console.error('[E2BCheckpoint] Error restoring checkpoint:', error);
      return false;
    }
  }

  /**
   * Obtenir les statistiques des checkpoints
   */
  async getStats(): Promise<Record<string, any>> {
    try {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const allCheckpoints = await db.select().from(sandboxCheckpoints);
      
      const stats = {
        totalCheckpoints: allCheckpoints.length,
        checkpointsByUser: {} as Record<string, number>,
        checkpointsByConversation: {} as Record<string, number>,
        totalSize: 0,
        averageSize: 0,
      };

      // Compter par utilisateur et conversation
      for (const checkpoint of allCheckpoints) {
        stats.checkpointsByUser[checkpoint.userId] = (stats.checkpointsByUser[checkpoint.userId] || 0) + 1;
        stats.checkpointsByConversation[checkpoint.conversationId] = (stats.checkpointsByConversation[checkpoint.conversationId] || 0) + 1;
        stats.totalSize += JSON.stringify(checkpoint.data).length;
      }

      if (allCheckpoints.length > 0) {
        stats.averageSize = Math.round(stats.totalSize / allCheckpoints.length);
      }

      return stats;
    } catch (error) {
      console.error('[E2BCheckpoint] Error getting stats:', error);
      return {};
    }
  }
}

// Singleton global
let checkpointManagerInstance: E2BCheckpointManager | null = null;

export function getCheckpointManager(): E2BCheckpointManager {
  if (!checkpointManagerInstance) {
    checkpointManagerInstance = new E2BCheckpointManager();
  }
  return checkpointManagerInstance;
}
