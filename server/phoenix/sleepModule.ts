/**
 * Phoenix Sleep Module (Module Sommeil)
 * 
 * Implémente la consolidation nocturne des mémoires:
 * - Détection de mémoires similaires
 * - Fusion des mémoires redondantes
 * - Renforcement des patterns récurrents
 * - Génération d'insights à partir des patterns
 */

import { getMemoryStore, MemoryEntry, RetrievedMemory } from './vectraMemory';
import { cosineSimilarity, generateHashEmbedding } from './embeddings';
import { invokeLLM } from '../_core/llm';

// Types
export interface ConsolidationResult {
  merged: number;
  reinforced: number;
  insightsGenerated: number;
  patternsDetected: string[];
  duration: number;
}

export interface MemoryCluster {
  centroid: number[];
  members: RetrievedMemory[];
  theme: string;
}

export interface SleepStats {
  lastConsolidation: number | null;
  totalConsolidations: number;
  totalMerged: number;
  totalInsights: number;
}

// Configuration
const SIMILARITY_THRESHOLD = 0.85; // Seuil pour considérer deux mémoires comme similaires
const MIN_CLUSTER_SIZE = 3; // Nombre minimum de mémoires pour former un pattern
const MAX_MEMORIES_TO_PROCESS = 500; // Limite pour éviter une surcharge

/**
 * SleepModule - Gère la consolidation des mémoires
 */
export class SleepModule {
  private stats: Map<number, SleepStats> = new Map();

  /**
   * Exécute un cycle de consolidation complet pour un utilisateur
   */
  async consolidate(userId: number): Promise<ConsolidationResult> {
    const startTime = Date.now();
    const memoryStore = getMemoryStore();
    
    console.log(`[SleepModule] Début consolidation pour userId: ${userId}`);

    // Récupérer toutes les mémoires de l'utilisateur
    const allMemories = await this.getAllMemories(userId);
    
    if (allMemories.length < MIN_CLUSTER_SIZE) {
      console.log(`[SleepModule] Pas assez de mémoires (${allMemories.length}) pour consolider`);
      return {
        merged: 0,
        reinforced: 0,
        insightsGenerated: 0,
        patternsDetected: [],
        duration: Date.now() - startTime
      };
    }

    // Étape 1: Détecter les clusters de mémoires similaires
    const clusters = await this.detectClusters(allMemories);
    console.log(`[SleepModule] ${clusters.length} clusters détectés`);

    // Étape 2: Fusionner les mémoires redondantes
    const mergeResult = await this.mergeSimilarMemories(clusters, userId);
    
    // Étape 3: Renforcer les patterns récurrents
    const reinforceResult = await this.reinforcePatterns(clusters, userId);
    
    // Étape 4: Générer des insights
    const insights = await this.generateInsights(clusters, userId);

    // Mettre à jour les stats
    this.updateStats(userId, mergeResult.merged, insights.length);

    const result: ConsolidationResult = {
      merged: mergeResult.merged,
      reinforced: reinforceResult.reinforced,
      insightsGenerated: insights.length,
      patternsDetected: clusters.map(c => c.theme),
      duration: Date.now() - startTime
    };

    console.log(`[SleepModule] Consolidation terminée:`, result);
    return result;
  }

  /**
   * Récupère toutes les mémoires d'un utilisateur pour analyse
   */
  private async getAllMemories(userId: number): Promise<RetrievedMemory[]> {
    const memoryStore = getMemoryStore();
    
    // Recherche large pour récupérer un maximum de mémoires
    const memories = await memoryStore.retrieve(
      '', // Query vide pour tout récupérer
      userId,
      { limit: MAX_MEMORIES_TO_PROCESS, minScore: 0 }
    );

    return memories;
  }

  /**
   * Détecte les clusters de mémoires similaires
   */
  private async detectClusters(memories: RetrievedMemory[]): Promise<MemoryCluster[]> {
    const clusters: MemoryCluster[] = [];
    const assigned = new Set<string>();

    for (const memory of memories) {
      if (assigned.has(memory.id)) continue;

      // Trouver les mémoires similaires
      const similar: RetrievedMemory[] = [memory];
      const memoryEmbedding = generateHashEmbedding(memory.content);

      for (const other of memories) {
        if (other.id === memory.id || assigned.has(other.id)) continue;

        const otherEmbedding = generateHashEmbedding(other.content);
        const similarity = cosineSimilarity(memoryEmbedding, otherEmbedding);

        if (similarity >= SIMILARITY_THRESHOLD) {
          similar.push(other);
          assigned.add(other.id);
        }
      }

      if (similar.length >= MIN_CLUSTER_SIZE) {
        assigned.add(memory.id);
        
        // Calculer le centroïde
        const centroid = this.computeCentroid(similar);
        
        // Générer un thème pour le cluster
        const theme = await this.generateClusterTheme(similar);

        clusters.push({
          centroid,
          members: similar,
          theme
        });
      }
    }

    return clusters;
  }

  /**
   * Calcule le centroïde d'un groupe de mémoires
   */
  private computeCentroid(memories: RetrievedMemory[]): number[] {
    const embeddings = memories.map(m => generateHashEmbedding(m.content));
    const dimension = embeddings[0].length;
    const centroid = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        centroid[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      centroid[i] /= embeddings.length;
    }

    return centroid;
  }

  /**
   * Génère un thème descriptif pour un cluster
   */
  private async generateClusterTheme(memories: RetrievedMemory[]): Promise<string> {
    try {
      const sampleContents = memories.slice(0, 5).map(m => m.content).join('\n---\n');
      
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: 'Tu es un analyseur de patterns. Génère un thème court (3-5 mots) qui résume le sujet commun des textes suivants.'
          },
          {
            role: 'user',
            content: sampleContents
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      return typeof content === 'string' ? content.trim() : 'Thème non identifié';
    } catch (error) {
      // Fallback: extraire les mots les plus fréquents
      const words = memories.flatMap(m => m.content.toLowerCase().split(/\s+/));
      const freq = new Map<string, number>();
      for (const word of words) {
        if (word.length > 4) {
          freq.set(word, (freq.get(word) || 0) + 1);
        }
      }
      const topWords = Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word);
      return topWords.join(' ') || 'Cluster';
    }
  }

  /**
   * Fusionne les mémoires similaires en une seule
   */
  private async mergeSimilarMemories(
    clusters: MemoryCluster[],
    userId: number
  ): Promise<{ merged: number }> {
    const memoryStore = getMemoryStore();
    let merged = 0;

    for (const cluster of clusters) {
      if (cluster.members.length < 2) continue;

      try {
        // Créer une mémoire fusionnée
        const mergedContent = await this.createMergedContent(cluster.members);
        const highestSalience = Math.max(...cluster.members.map(m => m.salience));

        await memoryStore.store({
          userId,
          content: mergedContent,
          type: 'insight',
          timestamp: Date.now(),
          salience: Math.min(1.0, highestSalience + 0.1), // Boost de saillance
          metadata: {
            mergedFrom: cluster.members.map(m => m.id),
            theme: cluster.theme
          }
        });

        merged += cluster.members.length - 1; // -1 car on garde une version fusionnée
      } catch (error) {
        console.error('[SleepModule] Erreur fusion:', error);
      }
    }

    return { merged };
  }

  /**
   * Crée un contenu fusionné à partir de plusieurs mémoires
   */
  private async createMergedContent(memories: RetrievedMemory[]): Promise<string> {
    try {
      const contents = memories.map(m => m.content).join('\n---\n');
      
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: 'Tu es un synthétiseur. Crée un résumé concis qui capture l\'essence de tous ces textes en une seule phrase ou paragraphe court.'
          },
          {
            role: 'user',
            content: contents
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      return typeof content === 'string' ? content.trim() : memories[0].content;
    } catch (error) {
      // Fallback: garder la mémoire avec la plus haute saillance
      return memories.sort((a, b) => b.salience - a.salience)[0].content;
    }
  }

  /**
   * Renforce les patterns récurrents en augmentant leur saillance
   */
  private async reinforcePatterns(
    clusters: MemoryCluster[],
    userId: number
  ): Promise<{ reinforced: number }> {
    let reinforced = 0;

    for (const cluster of clusters) {
      // Plus le cluster est grand, plus le pattern est fort
      const reinforcementFactor = Math.min(0.2, cluster.members.length * 0.02);
      
      for (const memory of cluster.members) {
        const newSalience = Math.min(1.0, memory.salience + reinforcementFactor);
        if (newSalience > memory.salience) {
          // Note: Dans une vraie implémentation, on mettrait à jour la saillance en DB
          reinforced++;
        }
      }
    }

    return { reinforced };
  }

  /**
   * Génère des insights à partir des patterns détectés
   */
  private async generateInsights(
    clusters: MemoryCluster[],
    userId: number
  ): Promise<string[]> {
    const memoryStore = getMemoryStore();
    const insights: string[] = [];

    for (const cluster of clusters) {
      if (cluster.members.length < MIN_CLUSTER_SIZE) continue;

      try {
        const contents = cluster.members.slice(0, 5).map(m => m.content).join('\n');
        
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Tu es un analyste de patterns comportementaux. 
              Génère un insight actionnable basé sur les interactions récurrentes suivantes.
              L'insight doit être une observation utile sur les préférences ou besoins de l'utilisateur.`
            },
            {
              role: 'user',
              content: `Thème: ${cluster.theme}\n\nInteractions:\n${contents}`
            }
          ]
        });

        const content = response.choices[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) {
          const insight = content.trim();
          insights.push(insight);

          // Stocker l'insight comme mémoire de haut niveau
          await memoryStore.store({
            userId,
            content: `[INSIGHT] ${insight}`,
            type: 'insight',
            timestamp: Date.now(),
            salience: 0.9, // Les insights ont une haute saillance
            metadata: {
              theme: cluster.theme,
              basedOn: cluster.members.length
            }
          });
        }
      } catch (error) {
        console.error('[SleepModule] Erreur génération insight:', error);
      }
    }

    return insights;
  }

  /**
   * Met à jour les statistiques de consolidation
   */
  private updateStats(userId: number, merged: number, insights: number): void {
    const current = this.stats.get(userId) || {
      lastConsolidation: null,
      totalConsolidations: 0,
      totalMerged: 0,
      totalInsights: 0
    };

    this.stats.set(userId, {
      lastConsolidation: Date.now(),
      totalConsolidations: current.totalConsolidations + 1,
      totalMerged: current.totalMerged + merged,
      totalInsights: current.totalInsights + insights
    });
  }

  /**
   * Récupère les statistiques de consolidation
   */
  getStats(userId: number): SleepStats {
    return this.stats.get(userId) || {
      lastConsolidation: null,
      totalConsolidations: 0,
      totalMerged: 0,
      totalInsights: 0
    };
  }
}

// Singleton
let sleepModuleInstance: SleepModule | null = null;

export function getSleepModule(): SleepModule {
  if (!sleepModuleInstance) {
    sleepModuleInstance = new SleepModule();
  }
  return sleepModuleInstance;
}

export default SleepModule;
