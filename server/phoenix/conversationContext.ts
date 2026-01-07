/**
 * Module de Gestion du Contexte Conversationnel
 * 
 * Ce module maintient l'état de la conversation, incluant:
 * - L'intention précédente et le mode actuel
 * - Les entités mentionnées
 * - L'historique des actions
 * - Les références contextuelles
 */

import { Entity, SemanticAnalysis } from './semanticAnalyzer';

// Types pour le contexte conversationnel
export interface ConversationMode {
  type: 'conversation' | 'image_generation' | 'site_creation' | 'app_creation' | 'code_execution' | 'web_search' | 'weather' | 'crypto' | 'file_analysis';
  startedAt: number;
  messageCount: number;
  lastActivity: number;
}

export interface ActionHistory {
  action: string;
  intent: string;
  timestamp: number;
  success: boolean;
  result?: string;
}

export interface MentionedEntity {
  entity: Entity;
  firstMentionedAt: number;
  lastMentionedAt: number;
  mentionCount: number;
  isActive: boolean; // Si l'entité est encore pertinente dans le contexte actuel
}

export interface ConversationContext {
  // Identifiants
  conversationId: number;
  userId: string;
  
  // Mode et intention
  currentMode: ConversationMode;
  previousIntents: string[];
  lastIntent: string | null;
  
  // Entités
  entities: Map<string, MentionedEntity>;
  
  // Historique
  actionHistory: ActionHistory[];
  messageCount: number;
  
  // État de la conversation
  isWaitingForClarification: boolean;
  pendingQuestion?: string;
  
  // Transitions détectées
  lastTransition?: {
    from: string;
    to: string;
    timestamp: number;
    reason: string;
  };
  
  // Timestamps
  createdAt: number;
  lastUpdatedAt: number;
}

// Cache des contextes en mémoire (par conversationId)
const contextCache = new Map<number, ConversationContext>();

// Durée de vie du contexte en mémoire (30 minutes)
const CONTEXT_TTL = 30 * 60 * 1000;

/**
 * Crée un nouveau contexte de conversation
 */
export function createContext(conversationId: number, userId: string): ConversationContext {
  const now = Date.now();
  
  const context: ConversationContext = {
    conversationId,
    userId,
    currentMode: {
      type: 'conversation',
      startedAt: now,
      messageCount: 0,
      lastActivity: now
    },
    previousIntents: [],
    lastIntent: null,
    entities: new Map(),
    actionHistory: [],
    messageCount: 0,
    isWaitingForClarification: false,
    createdAt: now,
    lastUpdatedAt: now
  };
  
  contextCache.set(conversationId, context);
  console.log(`[ConversationContext] Created new context for conversation ${conversationId}`);
  
  return context;
}

/**
 * Récupère ou crée un contexte de conversation
 */
export function getOrCreateContext(conversationId: number, userId: string): ConversationContext {
  let context = contextCache.get(conversationId);
  
  if (!context) {
    context = createContext(conversationId, userId);
  } else {
    // Vérifier si le contexte est expiré
    if (Date.now() - context.lastUpdatedAt > CONTEXT_TTL) {
      console.log(`[ConversationContext] Context expired for conversation ${conversationId}, creating new one`);
      context = createContext(conversationId, userId);
    }
  }
  
  return context;
}

/**
 * Met à jour le contexte avec une nouvelle analyse sémantique
 */
export function updateContextWithAnalysis(
  context: ConversationContext,
  analysis: SemanticAnalysis,
  detectedIntent: string
): ConversationContext {
  const now = Date.now();
  
  // Mettre à jour les entités
  for (const entity of analysis.entities) {
    const key = `${entity.type}:${entity.value.toLowerCase()}`;
    const existing = context.entities.get(key);
    
    if (existing) {
      existing.lastMentionedAt = now;
      existing.mentionCount++;
      existing.isActive = true;
    } else {
      context.entities.set(key, {
        entity,
        firstMentionedAt: now,
        lastMentionedAt: now,
        mentionCount: 1,
        isActive: true
      });
    }
  }
  
  // Détecter les transitions
  if (context.lastIntent && context.lastIntent !== detectedIntent) {
    // Vérifier si c'est une vraie transition ou juste un changement normal
    if (analysis.references.hasTransition || analysis.references.hasNegation) {
      context.lastTransition = {
        from: context.lastIntent,
        to: detectedIntent,
        timestamp: now,
        reason: analysis.references.hasNegation ? 'negation' : 'explicit_transition'
      };
      console.log(`[ConversationContext] Transition detected: ${context.lastIntent} -> ${detectedIntent}`);
    }
  }
  
  // Mettre à jour l'intention
  if (context.lastIntent) {
    context.previousIntents.push(context.lastIntent);
    // Garder seulement les 10 dernières intentions
    if (context.previousIntents.length > 10) {
      context.previousIntents.shift();
    }
  }
  context.lastIntent = detectedIntent;
  
  // Mettre à jour le mode si nécessaire
  const intentToMode: Record<string, ConversationMode['type']> = {
    'image_generation': 'image_generation',
    'site_creation': 'site_creation',
    'app_creation': 'app_creation',
    'code_execution': 'code_execution',
    'web_search': 'web_search',
    'weather': 'weather',
    'crypto': 'crypto',
    'file_analysis': 'file_analysis',
    'conversation': 'conversation'
  };
  
  const newMode = intentToMode[detectedIntent] || 'conversation';
  if (newMode !== context.currentMode.type) {
    context.currentMode = {
      type: newMode,
      startedAt: now,
      messageCount: 1,
      lastActivity: now
    };
  } else {
    context.currentMode.messageCount++;
    context.currentMode.lastActivity = now;
  }
  
  // Mettre à jour les compteurs
  context.messageCount++;
  context.lastUpdatedAt = now;
  
  // Désactiver les entités anciennes (plus de 5 messages sans mention)
  Array.from(context.entities.entries()).forEach(([key, mentionedEntity]) => {
    if (context.messageCount - mentionedEntity.mentionCount > 5) {
      mentionedEntity.isActive = false;
    }
  });
  
  return context;
}

/**
 * Ajoute une action à l'historique
 */
export function addActionToHistory(
  context: ConversationContext,
  action: string,
  intent: string,
  success: boolean,
  result?: string
): void {
  context.actionHistory.push({
    action,
    intent,
    timestamp: Date.now(),
    success,
    result
  });
  
  // Garder seulement les 20 dernières actions
  if (context.actionHistory.length > 20) {
    context.actionHistory.shift();
  }
  
  context.lastUpdatedAt = Date.now();
}

/**
 * Récupère les entités actives du contexte
 */
export function getActiveEntities(context: ConversationContext): Entity[] {
  const activeEntities: Entity[] = [];
  
  Array.from(context.entities.values()).forEach((mentionedEntity) => {
    if (mentionedEntity.isActive) {
      activeEntities.push(mentionedEntity.entity);
    }
  });
  
  return activeEntities;
}

/**
 * Vérifie si le contexte suggère une continuation
 */
export function shouldContinuePreviousTask(context: ConversationContext, analysis: SemanticAnalysis): boolean {
  // Si le message contient des références au passé
  if (analysis.references.hasPreviousReference) {
    return true;
  }
  
  // Si le message contient des pronoms de référence et qu'il y a une action récente
  if (analysis.references.hasPronounReferences && context.actionHistory.length > 0) {
    const lastAction = context.actionHistory[context.actionHistory.length - 1];
    const timeSinceLastAction = Date.now() - lastAction.timestamp;
    // Si la dernière action date de moins de 5 minutes
    if (timeSinceLastAction < 5 * 60 * 1000) {
      return true;
    }
  }
  
  return false;
}

/**
 * Résout les références dans le message en utilisant le contexte
 */
export function resolveReferences(
  context: ConversationContext,
  message: string,
  analysis: SemanticAnalysis
): { resolvedMessage: string; resolvedEntities: Entity[] } {
  let resolvedMessage = message;
  const resolvedEntities: Entity[] = [];
  
  // Résoudre les références pronominales
  if (analysis.references.hasPronounReferences) {
    const activeEntities = getActiveEntities(context);
    
    // Remplacer "ça", "cela", "le", "la" par l'entité la plus récente
    const pronounPatterns = [
      { pattern: /\b(ça|cela|celui-ci|celle-ci)\b/gi, type: 'demonstrative' },
      { pattern: /\b(le même|la même)\b/gi, type: 'same' },
      { pattern: /\b(it|this|that)\b/gi, type: 'demonstrative_en' }
    ];
    
    for (const { pattern } of pronounPatterns) {
      if (pattern.test(message) && activeEntities.length > 0) {
        // Utiliser l'entité la plus récemment mentionnée
        const mostRecent = activeEntities[activeEntities.length - 1];
        resolvedEntities.push(mostRecent);
      }
    }
  }
  
  // Résoudre les références au passé
  if (analysis.references.hasPreviousReference && context.actionHistory.length > 0) {
    const lastAction = context.actionHistory[context.actionHistory.length - 1];
    // Ajouter l'information de la dernière action au contexte résolu
    resolvedMessage += ` [Contexte: dernière action = ${lastAction.action} (${lastAction.intent})]`;
  }
  
  return { resolvedMessage, resolvedEntities };
}

/**
 * Génère un résumé du contexte pour le LLM
 */
export function generateContextSummary(context: ConversationContext): string {
  const parts: string[] = [];
  
  // Mode actuel
  parts.push(`Mode actuel: ${context.currentMode.type}`);
  
  // Dernière intention
  if (context.lastIntent) {
    parts.push(`Dernière intention: ${context.lastIntent}`);
  }
  
  // Entités actives
  const activeEntities = getActiveEntities(context);
  if (activeEntities.length > 0) {
    const entityList = activeEntities.map(e => `${e.type}: ${e.value}`).join(', ');
    parts.push(`Entités mentionnées: ${entityList}`);
  }
  
  // Dernière action
  if (context.actionHistory.length > 0) {
    const lastAction = context.actionHistory[context.actionHistory.length - 1];
    parts.push(`Dernière action: ${lastAction.action} (${lastAction.success ? 'succès' : 'échec'})`);
  }
  
  // Transition récente
  if (context.lastTransition) {
    const timeSince = Date.now() - context.lastTransition.timestamp;
    if (timeSince < 5 * 60 * 1000) { // Moins de 5 minutes
      parts.push(`Transition récente: ${context.lastTransition.from} -> ${context.lastTransition.to} (${context.lastTransition.reason})`);
    }
  }
  
  return parts.join('\n');
}

/**
 * Nettoie les contextes expirés
 */
export function cleanupExpiredContexts(): void {
  const now = Date.now();
  let cleaned = 0;
  
  Array.from(contextCache.entries()).forEach(([conversationId, context]) => {
    if (now - context.lastUpdatedAt > CONTEXT_TTL) {
      contextCache.delete(conversationId);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    console.log(`[ConversationContext] Cleaned up ${cleaned} expired contexts`);
  }
}

// Nettoyer les contextes expirés toutes les 10 minutes
setInterval(cleanupExpiredContexts, 10 * 60 * 1000);

export default {
  createContext,
  getOrCreateContext,
  updateContextWithAnalysis,
  addActionToHistory,
  getActiveEntities,
  shouldContinuePreviousTask,
  resolveReferences,
  generateContextSummary,
  cleanupExpiredContexts
};
