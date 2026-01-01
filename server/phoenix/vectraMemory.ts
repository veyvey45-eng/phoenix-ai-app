/**
 * Phoenix Vectra Memory Store
 * 
 * Système de mémoire vectorielle persistante utilisant Vectra.
 * Implémente la "transpiration" - stockage automatique des conversations
 * et retrieval contextuel intelligent.
 */

import { LocalIndex } from 'vectra';
import path from 'path';
import { generateSemanticEmbedding, generateHashEmbedding } from './embeddings';
import crypto from 'crypto';

// Types
export interface MemoryEntry {
  id: string;
  userId: number;
  content: string;
  type: 'utterance' | 'decision' | 'fact' | 'correction' | 'insight';
  timestamp: number;
  salience: number;
  contextId?: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievedMemory extends MemoryEntry {
  score: number;
}

export interface TranspirationEvent {
  userId: number;
  contextId: string;
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  hypotheses?: string[];
  issues?: string[];
}

// Configuration
const MEMORY_INDEX_PATH = path.join(process.cwd(), 'data', 'phoenix_memory');
const EMBEDDING_DIMENSION = 1536; // OpenAI ada-002 dimension

/**
 * VectraMemoryStore - Gère la mémoire long-terme de Phoenix
 */
export class VectraMemoryStore {
  private index: LocalIndex;
  private initialized: boolean = false;

  constructor() {
    this.index = new LocalIndex(MEMORY_INDEX_PATH);
  }

  /**
   * Initialise le store de mémoire
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (!(await this.index.isIndexCreated())) {
        await this.index.createIndex();
        console.log('[VectraMemory] Index créé:', MEMORY_INDEX_PATH);
      } else {
        console.log('[VectraMemory] Index existant chargé:', MEMORY_INDEX_PATH);
      }
      this.initialized = true;
    } catch (error) {
      console.error('[VectraMemory] Erreur initialisation:', error);
      throw error;
    }
  }

  /**
   * Génère un embedding pour un texte donné
   * Utilise l'extraction sémantique via LLM ou un fallback hash-based
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Utiliser les embeddings sémantiques via LLM
      return await generateSemanticEmbedding(text);
    } catch (error) {
      // Fallback: embedding basé sur hash (déterministe mais moins sémantique)
      console.warn('[VectraMemory] Semantic embedding failed, using hash fallback');
      return generateHashEmbedding(text);
    }
  }

  /**
   * Génère un embedding basé sur hash (fallback)
   * Crée un vecteur déterministe basé sur le contenu du texte
   */
  private generateHashEmbedding(text: string): number[] {
    const embedding: number[] = new Array(EMBEDDING_DIMENSION).fill(0);
    
    // Normaliser le texte
    const normalizedText = text.toLowerCase().trim();
    
    // Créer plusieurs hash pour différentes parties du texte
    const words = normalizedText.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash = crypto.createHash('sha256').update(word + i.toString()).digest();
      
      // Distribuer le hash dans le vecteur
      for (let j = 0; j < hash.length && j < EMBEDDING_DIMENSION; j++) {
        const idx = (i * 32 + j) % EMBEDDING_DIMENSION;
        embedding[idx] += (hash[j] - 128) / 128;
      }
    }

    // Ajouter des n-grams pour capturer le contexte
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const ngram = words.slice(i, i + n).join(' ');
        const hash = crypto.createHash('sha256').update(ngram).digest();
        
        for (let j = 0; j < hash.length; j++) {
          const idx = (hash[j] + j * 6) % EMBEDDING_DIMENSION;
          embedding[idx] += (hash[(j + 1) % hash.length] - 128) / 256;
        }
      }
    }

    // Normaliser le vecteur (L2 normalization)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * Stocke une mémoire dans le vector store
   */
  async store(entry: Omit<MemoryEntry, 'id'>): Promise<string> {
    await this.initialize();

    const id = crypto.randomUUID();
    const embedding = await this.generateEmbedding(entry.content);

    await this.index.insertItem({
      vector: embedding,
      metadata: {
        id,
        userId: entry.userId,
        content: entry.content,
        type: entry.type,
        timestamp: entry.timestamp,
        salience: entry.salience,
        contextId: entry.contextId || '',
        ...entry.metadata
      }
    });

    console.log(`[VectraMemory] Mémoire stockée: ${id} (type: ${entry.type})`);
    return id;
  }

  /**
   * Récupère les mémoires les plus pertinentes pour une requête
   */
  async retrieve(
    query: string,
    userId: number,
    options: {
      limit?: number;
      minScore?: number;
      types?: MemoryEntry['type'][];
    } = {}
  ): Promise<RetrievedMemory[]> {
    await this.initialize();

    const { limit = 10, minScore = 0.5, types } = options;
    const queryEmbedding = await this.generateEmbedding(query);

    try {
      const results = await this.index.queryItems(queryEmbedding, '', limit * 2);

      const memories: RetrievedMemory[] = results
        .filter(result => {
          const meta = result.item.metadata as Record<string, unknown>;
          // Filtrer par userId
          if (meta.userId !== userId) return false;
          // Filtrer par score minimum
          if (result.score < minScore) return false;
          // Filtrer par type si spécifié
          if (types && !types.includes(meta.type as MemoryEntry['type'])) return false;
          return true;
        })
        .slice(0, limit)
        .map(result => {
          const meta = result.item.metadata as Record<string, unknown>;
          return {
            id: meta.id as string,
            userId: meta.userId as number,
            content: meta.content as string,
            type: meta.type as MemoryEntry['type'],
            timestamp: meta.timestamp as number,
            salience: meta.salience as number,
            contextId: meta.contextId as string,
            score: result.score
          };
        });

      console.log(`[VectraMemory] Récupéré ${memories.length} mémoires pour: "${query.substring(0, 50)}..."`);
      return memories;
    } catch (error) {
      console.error('[VectraMemory] Erreur retrieval:', error);
      return [];
    }
  }

  /**
   * Transpiration - Stocke automatiquement une conversation
   * C'est le mécanisme qui fait que Phoenix "apprend" de chaque interaction
   */
  async transpire(event: TranspirationEvent): Promise<void> {
    await this.initialize();

    // Calculer la saillance basée sur le contenu
    const salience = this.computeSalience(event);

    // Stocker le message principal
    await this.store({
      userId: event.userId,
      content: event.content,
      type: 'utterance',
      timestamp: Date.now(),
      salience,
      contextId: event.contextId,
      metadata: {
        role: event.role,
        confidence: event.confidence
      }
    });

    // Si c'est une réponse assistant avec des hypothèses, les stocker aussi
    if (event.role === 'assistant' && event.hypotheses && event.hypotheses.length > 0) {
      await this.store({
        userId: event.userId,
        content: `Hypothèses générées: ${event.hypotheses.join(' | ')}`,
        type: 'decision',
        timestamp: Date.now(),
        salience: salience * 0.8,
        contextId: event.contextId
      });
    }

    // Si des issues ont été détectées, les stocker
    if (event.issues && event.issues.length > 0) {
      for (const issue of event.issues) {
        await this.store({
          userId: event.userId,
          content: `Issue détectée: ${issue}`,
          type: 'correction',
          timestamp: Date.now(),
          salience: 0.9, // Les corrections sont toujours importantes
          contextId: event.contextId
        });
      }
    }
  }

  /**
   * Calcule la saillance d'un événement
   * Plus la saillance est élevée, plus la mémoire est importante
   */
  private computeSalience(event: TranspirationEvent): number {
    let salience = 0.5; // Base

    // Les messages utilisateur sont généralement plus importants
    if (event.role === 'user') {
      salience += 0.1;
    }

    // Les messages longs contiennent souvent plus d'information
    if (event.content.length > 200) {
      salience += 0.1;
    }

    // Les questions sont importantes
    if (event.content.includes('?')) {
      salience += 0.1;
    }

    // Les corrections et issues augmentent la saillance
    if (event.issues && event.issues.length > 0) {
      salience += 0.2;
    }

    // Faible confiance = plus important à retenir (pour éviter de répéter l'erreur)
    if (event.confidence !== undefined && event.confidence < 0.7) {
      salience += 0.1;
    }

    return Math.min(1.0, salience);
  }

  /**
   * Consolide les mémoires (Module Sommeil simplifié)
   * Fusionne les mémoires similaires et renforce les patterns
   */
  async consolidate(userId: number): Promise<{ merged: number; reinforced: number }> {
    await this.initialize();

    // Pour le MVP, on ne fait qu'un log
    // Une vraie consolidation nécessiterait de:
    // 1. Identifier les mémoires similaires
    // 2. Les fusionner en insights
    // 3. Supprimer les doublons
    // 4. Renforcer les patterns récurrents

    console.log(`[VectraMemory] Consolidation demandée pour userId: ${userId}`);
    
    return { merged: 0, reinforced: 0 };
  }

  /**
   * Récupère les statistiques de mémoire pour un utilisateur
   */
  async getStats(userId: number): Promise<{
    totalMemories: number;
    byType: Record<string, number>;
    oldestTimestamp: number;
    newestTimestamp: number;
  }> {
    await this.initialize();

    // Pour le MVP, retourner des stats basiques
    // Une vraie implémentation scannerait l'index
    return {
      totalMemories: 0,
      byType: {},
      oldestTimestamp: 0,
      newestTimestamp: Date.now()
    };
  }
}

// Singleton instance
let memoryStoreInstance: VectraMemoryStore | null = null;

export function getMemoryStore(): VectraMemoryStore {
  if (!memoryStoreInstance) {
    memoryStoreInstance = new VectraMemoryStore();
  }
  return memoryStoreInstance;
}

export default VectraMemoryStore;
