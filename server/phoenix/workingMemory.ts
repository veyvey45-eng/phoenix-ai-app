/**
 * Working Memory - Mémoire de Travail Persistante
 * 
 * Ce module permet à Phoenix de garder en mémoire les résultats
 * intermédiaires et le contexte entre les actions, comme Manus AI.
 * 
 * Fonctionnalités:
 * 1. Stockage des résultats intermédiaires
 * 2. Gestion du contexte de conversation
 * 3. Résolution des références ("ça", "le même", etc.)
 * 4. Persistance entre les actions
 */

// Types pour la mémoire de travail
export interface MemoryItem {
  id: string;
  type: 'result' | 'context' | 'reference' | 'fact' | 'preference' | 'entity';
  key: string;
  value: unknown;
  metadata: {
    source: string;
    confidence: number;
    timestamp: number;
    expiresAt?: number;
    accessCount: number;
    lastAccessedAt: number;
  };
  tags: string[];
}

export interface ConversationContext {
  currentTopic: string;
  entities: Map<string, EntityReference>;
  recentActions: string[];
  userPreferences: Map<string, unknown>;
  sessionStart: number;
}

export interface EntityReference {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  properties: Record<string, unknown>;
  lastMentioned: number;
  mentionCount: number;
}

export interface MemoryQuery {
  type?: MemoryItem['type'];
  key?: string;
  tags?: string[];
  minConfidence?: number;
  maxAge?: number;
}

// Configuration
const MAX_MEMORY_ITEMS = 1000;
const DEFAULT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Classe principale de mémoire de travail
 */
export class WorkingMemory {
  private items: Map<string, MemoryItem> = new Map();
  private context: ConversationContext;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.items = new Map();
    this.context = {
      currentTopic: '',
      entities: new Map(),
      recentActions: [],
      userPreferences: new Map(),
      sessionStart: Date.now()
    };

    // Démarrer le nettoyage périodique
    this.startCleanup();
  }

  /**
   * Stocke un élément en mémoire
   */
  store(
    key: string,
    value: unknown,
    options: {
      type?: MemoryItem['type'];
      source?: string;
      confidence?: number;
      expiresIn?: number;
      tags?: string[];
    } = {}
  ): MemoryItem {
    const now = Date.now();
    
    const item: MemoryItem = {
      id: `mem_${now}_${Math.random().toString(36).substr(2, 9)}`,
      type: options.type || 'result',
      key,
      value,
      metadata: {
        source: options.source || 'unknown',
        confidence: options.confidence || 1.0,
        timestamp: now,
        expiresAt: options.expiresIn ? now + options.expiresIn : now + DEFAULT_EXPIRY_MS,
        accessCount: 0,
        lastAccessedAt: now
      },
      tags: options.tags || []
    };

    // Vérifier la limite de mémoire
    if (this.items.size >= MAX_MEMORY_ITEMS) {
      this.evictOldest();
    }

    this.items.set(key, item);
    console.log(`[WorkingMemory] Stored: ${key} (type: ${item.type})`);

    return item;
  }

  /**
   * Récupère un élément de la mémoire
   */
  retrieve(key: string): unknown | undefined {
    const item = this.items.get(key);
    
    if (!item) {
      return undefined;
    }

    // Vérifier l'expiration
    if (item.metadata.expiresAt && Date.now() > item.metadata.expiresAt) {
      this.items.delete(key);
      return undefined;
    }

    // Mettre à jour les statistiques d'accès
    item.metadata.accessCount++;
    item.metadata.lastAccessedAt = Date.now();

    return item.value;
  }

  /**
   * Recherche des éléments en mémoire
   */
  query(query: MemoryQuery): MemoryItem[] {
    const results: MemoryItem[] = [];
    const now = Date.now();

    this.items.forEach(item => {
      // Vérifier l'expiration
      if (item.metadata.expiresAt && now > item.metadata.expiresAt) {
        return;
      }

      // Filtrer par type
      if (query.type && item.type !== query.type) {
        return;
      }

      // Filtrer par clé (recherche partielle)
      if (query.key && !item.key.toLowerCase().includes(query.key.toLowerCase())) {
        return;
      }

      // Filtrer par tags
      if (query.tags && !query.tags.some(tag => item.tags.includes(tag))) {
        return;
      }

      // Filtrer par confiance
      if (query.minConfidence && item.metadata.confidence < query.minConfidence) {
        return;
      }

      // Filtrer par âge
      if (query.maxAge && (now - item.metadata.timestamp) > query.maxAge) {
        return;
      }

      results.push(item);
    });

    // Trier par pertinence (accès récent + confiance)
    results.sort((a, b) => {
      const scoreA = a.metadata.confidence * 0.5 + (1 - (now - a.metadata.lastAccessedAt) / DEFAULT_EXPIRY_MS) * 0.5;
      const scoreB = b.metadata.confidence * 0.5 + (1 - (now - b.metadata.lastAccessedAt) / DEFAULT_EXPIRY_MS) * 0.5;
      return scoreB - scoreA;
    });

    return results;
  }

  /**
   * Stocke un résultat intermédiaire
   */
  storeResult(actionId: string, result: unknown, confidence: number = 1.0): void {
    this.store(`result_${actionId}`, result, {
      type: 'result',
      source: actionId,
      confidence,
      tags: ['result', 'intermediate']
    });
  }

  /**
   * Récupère un résultat intermédiaire
   */
  getResult(actionId: string): unknown | undefined {
    return this.retrieve(`result_${actionId}`);
  }

  /**
   * Enregistre une entité mentionnée
   */
  registerEntity(
    name: string,
    type: string,
    properties: Record<string, unknown> = {}
  ): EntityReference {
    const existing = this.context.entities.get(name.toLowerCase());
    
    if (existing) {
      existing.lastMentioned = Date.now();
      existing.mentionCount++;
      Object.assign(existing.properties, properties);
      return existing;
    }

    const entity: EntityReference = {
      id: `entity_${Date.now()}`,
      name,
      type,
      aliases: [name.toLowerCase()],
      properties,
      lastMentioned: Date.now(),
      mentionCount: 1
    };

    this.context.entities.set(name.toLowerCase(), entity);
    
    // Stocker aussi en mémoire
    this.store(`entity_${name.toLowerCase()}`, entity, {
      type: 'entity',
      tags: ['entity', type]
    });

    return entity;
  }

  /**
   * Résout une référence ("ça", "le même", "celui-ci", etc.)
   */
  resolveReference(reference: string): unknown | undefined {
    const normalizedRef = reference.toLowerCase().trim();

    // Références directes
    const directRefs: Record<string, () => unknown | undefined> = {
      'ça': () => this.getLastResult(),
      'cela': () => this.getLastResult(),
      'this': () => this.getLastResult(),
      'it': () => this.getLastResult(),
      'le même': () => this.getLastResult(),
      'the same': () => this.getLastResult(),
      'celui-ci': () => this.getLastEntity(),
      'celle-ci': () => this.getLastEntity(),
      'lui': () => this.getLastEntity(),
      'elle': () => this.getLastEntity(),
      'le dernier': () => this.getLastResult(),
      'la dernière': () => this.getLastResult(),
      'the last': () => this.getLastResult(),
      'précédent': () => this.getPreviousResult(),
      'previous': () => this.getPreviousResult()
    };

    if (directRefs[normalizedRef]) {
      return directRefs[normalizedRef]();
    }

    // Recherche dans les entités
    const entity = this.context.entities.get(normalizedRef);
    if (entity) {
      return entity;
    }

    // Recherche par alias
    let foundEntity: EntityReference | undefined;
    this.context.entities.forEach((ent) => {
      if (ent.aliases.includes(normalizedRef)) {
        foundEntity = ent;
      }
    });
    if (foundEntity) {
      return foundEntity;
    }

    // Recherche dans la mémoire
    const memoryResults = this.query({ key: normalizedRef });
    if (memoryResults.length > 0) {
      return memoryResults[0].value;
    }

    return undefined;
  }

  /**
   * Obtient le dernier résultat
   */
  private getLastResult(): unknown | undefined {
    const results = this.query({ type: 'result' });
    return results.length > 0 ? results[0].value : undefined;
  }

  /**
   * Obtient le résultat précédent
   */
  private getPreviousResult(): unknown | undefined {
    const results = this.query({ type: 'result' });
    return results.length > 1 ? results[1].value : undefined;
  }

  /**
   * Obtient la dernière entité mentionnée
   */
  private getLastEntity(): EntityReference | undefined {
    let lastEntity: EntityReference | undefined;
    let lastTime = 0;

    this.context.entities.forEach((entity) => {
      if (entity.lastMentioned > lastTime) {
        lastTime = entity.lastMentioned;
        lastEntity = entity;
      }
    });

    return lastEntity;
  }

  /**
   * Met à jour le contexte de conversation
   */
  updateContext(updates: Partial<ConversationContext>): void {
    if (updates.currentTopic) {
      this.context.currentTopic = updates.currentTopic;
    }
    if (updates.recentActions) {
      this.context.recentActions = [
        ...updates.recentActions,
        ...this.context.recentActions
      ].slice(0, 10);
    }
  }

  /**
   * Obtient le contexte actuel
   */
  getContext(): ConversationContext {
    return { ...this.context };
  }

  /**
   * Stocke une préférence utilisateur
   */
  setPreference(key: string, value: unknown): void {
    this.context.userPreferences.set(key, value);
    this.store(`pref_${key}`, value, {
      type: 'preference',
      tags: ['preference', 'user']
    });
  }

  /**
   * Obtient une préférence utilisateur
   */
  getPreference(key: string): unknown | undefined {
    return this.context.userPreferences.get(key);
  }

  /**
   * Stocke un fait
   */
  storeFact(fact: string, confidence: number = 0.9): void {
    this.store(`fact_${Date.now()}`, fact, {
      type: 'fact',
      confidence,
      tags: ['fact']
    });
  }

  /**
   * Obtient tous les faits
   */
  getFacts(): string[] {
    const facts = this.query({ type: 'fact' });
    return facts.map(f => f.value as string);
  }

  /**
   * Génère un résumé de la mémoire
   */
  getSummary(): string {
    const stats = {
      totalItems: this.items.size,
      results: this.query({ type: 'result' }).length,
      entities: this.context.entities.size,
      facts: this.query({ type: 'fact' }).length,
      preferences: this.context.userPreferences.size
    };

    return `📊 **Mémoire de Travail**
- Total: ${stats.totalItems} éléments
- Résultats: ${stats.results}
- Entités: ${stats.entities}
- Faits: ${stats.facts}
- Préférences: ${stats.preferences}
- Topic actuel: ${this.context.currentTopic || 'Non défini'}
- Session: ${Math.round((Date.now() - this.context.sessionStart) / 60000)} minutes`;
  }

  /**
   * Évince les éléments les plus anciens
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.items.forEach((item, key) => {
      if (item.metadata.lastAccessedAt < oldestTime) {
        oldestTime = item.metadata.lastAccessedAt;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.items.delete(oldestKey);
      console.log(`[WorkingMemory] Evicted: ${oldestKey}`);
    }
  }

  /**
   * Démarre le nettoyage périodique
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Nettoie les éléments expirés
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    this.items.forEach((item, key) => {
      if (item.metadata.expiresAt && now > item.metadata.expiresAt) {
        this.items.delete(key);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`[WorkingMemory] Cleaned ${cleaned} expired items`);
    }
  }

  /**
   * Réinitialise la mémoire
   */
  reset(): void {
    this.items.clear();
    this.context = {
      currentTopic: '',
      entities: new Map(),
      recentActions: [],
      userPreferences: new Map(),
      sessionStart: Date.now()
    };
  }

  /**
   * Arrête le nettoyage
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Instance singleton
let workingMemoryInstance: WorkingMemory | null = null;

export function getWorkingMemory(): WorkingMemory {
  if (!workingMemoryInstance) {
    workingMemoryInstance = new WorkingMemory();
  }
  return workingMemoryInstance;
}

export default WorkingMemory;
