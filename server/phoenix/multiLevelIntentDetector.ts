/**
 * Module de Détection d'Intentions Multi-niveaux
 * 
 * Ce module implémente un système de détection d'intentions en 3 couches:
 * - Couche 1: Détection rapide par patterns (cas simples)
 * - Couche 2: Analyse LLM pour cas ambigus
 * - Couche 3: Résolution de conflits avec contexte conversationnel
 * 
 * Il gère également:
 * - Intentions explicites et implicites
 * - Négations et transitions
 * - Score de confiance pour chaque niveau
 */

import { invokeLLM } from '../_core/llm';
import { SemanticAnalysis, analyzeSemantics, quickAnalyze } from './semanticAnalyzer';
import { ConversationContext, getActiveEntities, generateContextSummary } from './conversationContext';
import { detectIntent as patternDetectIntent, IntentType } from './intentDetector';

// Types pour la détection multi-niveaux
export interface IntentCandidate {
  type: IntentType;
  confidence: number;
  source: 'pattern' | 'llm' | 'context' | 'implicit';
  reasoning?: string;
}

export interface MultiLevelIntentResult {
  // Intention finale résolue
  finalIntent: IntentType;
  finalConfidence: number;
  
  // Détails par niveau
  levels: {
    pattern: IntentCandidate | null;
    llm: IntentCandidate | null;
    context: IntentCandidate | null;
  };
  
  // Intentions détectées
  explicitIntent?: IntentCandidate;
  implicitIntent?: IntentCandidate;
  
  // Transitions et négations
  hasNegation: boolean;
  hasTransition: boolean;
  negatedIntent?: IntentType;
  transitionFrom?: IntentType;
  transitionTo?: IntentType;
  
  // Méta-informations
  conflictResolved: boolean;
  resolutionMethod?: 'pattern_priority' | 'llm_priority' | 'context_priority' | 'confidence_based';
  processingTime: number;
}

// Prompt pour la détection d'intention par LLM
const INTENT_DETECTION_PROMPT = `Tu es un système de détection d'intentions expert. Analyse le message de l'utilisateur et détermine son intention.

INTENTIONS POSSIBLES:
- conversation: Discussion générale, salutations, questions simples
- image_generation: Demande de créer/générer une image, photo, illustration
- site_creation: Demande de créer un site web, une page web, un landing page
- site_modification: Demande de modifier un site web existant
- app_creation: Demande de créer une application, un chatbot, un agent IA
- code_execution: Demande d'exécuter du code, un script
- web_search: Demande de rechercher des informations sur internet
- web_navigation: Demande de naviguer vers un site web spécifique
- weather: Demande d'informations météo
- crypto: Demande d'informations sur les cryptomonnaies
- calculation: Demande de calcul mathématique
- file_analysis: Demande d'analyser un fichier

IMPORTANT:
1. Détecte les NÉGATIONS: "je ne veux plus", "arrête", "stop", "pas de"
2. Détecte les TRANSITIONS: "maintenant", "plutôt", "à la place", "en fait"
3. Distingue "image d'une application" (image_generation) de "vraie application" (app_creation)
4. Détecte les intentions IMPLICITES (sous-entendues)

Retourne UNIQUEMENT du JSON valide.`;

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    explicit_intent: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' }
      },
      required: ['type', 'confidence', 'reasoning'],
      additionalProperties: false
    },
    implicit_intent: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' }
      },
      required: ['type', 'confidence', 'reasoning'],
      additionalProperties: false,
      nullable: true
    },
    has_negation: { type: 'boolean' },
    negated_intent: { type: 'string', nullable: true },
    has_transition: { type: 'boolean' },
    transition_from: { type: 'string', nullable: true },
    transition_to: { type: 'string', nullable: true }
  },
  required: ['explicit_intent', 'has_negation', 'has_transition'],
  additionalProperties: false
};

/**
 * Couche 1: Détection rapide par patterns
 */
function detectByPatterns(message: string, hasFileContent: boolean = false): IntentCandidate | null {
  try {
    const result = patternDetectIntent(message, hasFileContent);
    
    return {
      type: result.type,
      confidence: result.confidence,
      source: 'pattern',
      reasoning: `Pattern match: ${result.details?.keywords?.join(', ') || 'N/A'}`
    };
  } catch (error) {
    console.error('[MultiLevelIntentDetector] Pattern detection error:', error);
    return null;
  }
}

/**
 * Couche 2: Analyse LLM pour cas ambigus
 */
async function detectByLLM(
  message: string,
  semanticAnalysis: SemanticAnalysis,
  contextSummary?: string
): Promise<{
  explicit: IntentCandidate | null;
  implicit: IntentCandidate | null;
  hasNegation: boolean;
  negatedIntent?: string;
  hasTransition: boolean;
  transitionFrom?: string;
  transitionTo?: string;
}> {
  try {
    const contextInfo = contextSummary ? `\n\nContexte de conversation:\n${contextSummary}` : '';
    const semanticInfo = `\n\nAnalyse sémantique:
- Sujet principal: ${semanticAnalysis.concepts.mainTopic}
- Actions: ${semanticAnalysis.concepts.actions.join(', ')}
- Négation détectée: ${semanticAnalysis.references.hasNegation}
- Transition détectée: ${semanticAnalysis.references.hasTransition}`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: INTENT_DETECTION_PROMPT },
        { role: 'user', content: `Message: "${message}"${semanticInfo}${contextInfo}` }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'intent_detection',
          strict: true,
          schema: INTENT_SCHEMA
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const result = JSON.parse(contentStr);

    const explicitCandidate: IntentCandidate | null = result.explicit_intent ? {
      type: result.explicit_intent.type as IntentType,
      confidence: result.explicit_intent.confidence,
      source: 'llm',
      reasoning: result.explicit_intent.reasoning
    } : null;

    const implicitCandidate: IntentCandidate | null = result.implicit_intent ? {
      type: result.implicit_intent.type as IntentType,
      confidence: result.implicit_intent.confidence,
      source: 'implicit',
      reasoning: result.implicit_intent.reasoning
    } : null;

    return {
      explicit: explicitCandidate,
      implicit: implicitCandidate,
      hasNegation: result.has_negation,
      negatedIntent: result.negated_intent,
      hasTransition: result.has_transition,
      transitionFrom: result.transition_from,
      transitionTo: result.transition_to
    };
  } catch (error) {
    console.error('[MultiLevelIntentDetector] LLM detection error:', error);
    return {
      explicit: null,
      implicit: null,
      hasNegation: false,
      hasTransition: false
    };
  }
}

/**
 * Couche 3: Résolution de conflits avec contexte
 */
function resolveWithContext(
  patternResult: IntentCandidate | null,
  llmResult: IntentCandidate | null,
  context: ConversationContext | null,
  semanticAnalysis: SemanticAnalysis
): { resolved: IntentCandidate; method: MultiLevelIntentResult['resolutionMethod'] } {
  const candidates: IntentCandidate[] = [];
  
  if (patternResult) candidates.push(patternResult);
  if (llmResult) candidates.push(llmResult);
  
  // Si pas de candidats, retourner conversation par défaut
  if (candidates.length === 0) {
    return {
      resolved: {
        type: 'conversation',
        confidence: 0.5,
        source: 'context',
        reasoning: 'No intent detected, defaulting to conversation'
      },
      method: 'context_priority'
    };
  }
  
  // Si un seul candidat, le retourner
  if (candidates.length === 1) {
    return {
      resolved: candidates[0],
      method: candidates[0].source === 'pattern' ? 'pattern_priority' : 'llm_priority'
    };
  }
  
  // Résolution de conflits
  const pattern = patternResult!;
  const llm = llmResult!;
  
  // Cas 1: Les deux sont d'accord
  if (pattern.type === llm.type) {
    return {
      resolved: {
        ...llm,
        confidence: Math.max(pattern.confidence, llm.confidence)
      },
      method: 'confidence_based'
    };
  }
  
  // Cas 2: Transition ou négation détectée - priorité au LLM
  if (semanticAnalysis.references.hasTransition || semanticAnalysis.references.hasNegation) {
    console.log('[MultiLevelIntentDetector] Transition/negation detected, prioritizing LLM');
    return {
      resolved: llm,
      method: 'llm_priority'
    };
  }
  
  // Cas 3: Contexte disponible - utiliser l'historique
  if (context && context.lastIntent) {
    // Si le LLM détecte une intention différente du pattern mais cohérente avec le contexte
    if (llm.type === context.lastIntent && pattern.type !== context.lastIntent) {
      return {
        resolved: llm,
        method: 'context_priority'
      };
    }
    
    // Si le pattern détecte une intention cohérente avec une transition
    if (context.lastTransition && pattern.type === context.lastTransition.to) {
      return {
        resolved: pattern,
        method: 'context_priority'
      };
    }
  }
  
  // Cas 4: Utiliser la confiance la plus élevée
  if (pattern.confidence >= llm.confidence) {
    return {
      resolved: pattern,
      method: 'confidence_based'
    };
  } else {
    return {
      resolved: llm,
      method: 'confidence_based'
    };
  }
}

/**
 * Détection d'intention multi-niveaux complète
 */
export async function detectIntentMultiLevel(
  message: string,
  context: ConversationContext | null = null,
  hasFileContent: boolean = false,
  useFullAnalysis: boolean = true
): Promise<MultiLevelIntentResult> {
  const startTime = Date.now();
  
  console.log('[MultiLevelIntentDetector] Starting multi-level detection for:', message.substring(0, 100));
  
  // Couche 1: Détection rapide par patterns
  const patternResult = detectByPatterns(message, hasFileContent);
  console.log('[MultiLevelIntentDetector] Pattern result:', patternResult?.type, patternResult?.confidence);
  
  // Analyse sémantique rapide
  const quickSemanticResult = quickAnalyze(message);
  
  // Décider si on a besoin de l'analyse LLM complète
  const needsLLMAnalysis = useFullAnalysis && (
    !patternResult ||
    patternResult.confidence < 0.8 ||
    quickSemanticResult.references?.hasNegation ||
    quickSemanticResult.references?.hasTransition ||
    quickSemanticResult.references?.hasPronounReferences
  );
  
  let llmResult: IntentCandidate | null = null;
  let implicitIntent: IntentCandidate | null = null;
  let hasNegation = quickSemanticResult.references?.hasNegation || false;
  let hasTransition = quickSemanticResult.references?.hasTransition || false;
  let negatedIntent: IntentType | undefined;
  let transitionFrom: IntentType | undefined;
  let transitionTo: IntentType | undefined;
  let semanticAnalysis: SemanticAnalysis;
  
  if (needsLLMAnalysis) {
    console.log('[MultiLevelIntentDetector] Running full LLM analysis');
    
    // Analyse sémantique complète
    const contextSummary = context ? generateContextSummary(context) : undefined;
    semanticAnalysis = await analyzeSemantics(message, contextSummary);
    
    // Détection LLM
    const llmDetection = await detectByLLM(message, semanticAnalysis, contextSummary);
    llmResult = llmDetection.explicit;
    implicitIntent = llmDetection.implicit;
    hasNegation = llmDetection.hasNegation;
    hasTransition = llmDetection.hasTransition;
    negatedIntent = llmDetection.negatedIntent as IntentType | undefined;
    transitionFrom = llmDetection.transitionFrom as IntentType | undefined;
    transitionTo = llmDetection.transitionTo as IntentType | undefined;
    
    console.log('[MultiLevelIntentDetector] LLM result:', llmResult?.type, llmResult?.confidence);
  } else {
    // Utiliser l'analyse rapide
    semanticAnalysis = {
      entities: [],
      sentiment: quickSemanticResult.sentiment || { type: 'neutral', score: 0, emotions: [] },
      tone: { formality: 'neutral', urgency: 'low', politeness: 'neutral' },
      concepts: { mainTopic: 'unknown', relatedTopics: [], actions: [], objects: [] },
      references: quickSemanticResult.references || {
        hasPronounReferences: false,
        hasPreviousReference: false,
        hasNegation: false,
        hasTransition: false
      },
      language: quickSemanticResult.language || 'fr',
      confidence: 0.6
    };
  }
  
  // Couche 3: Résolution de conflits
  const { resolved, method } = resolveWithContext(patternResult, llmResult, context, semanticAnalysis);
  
  // Construire le résultat final
  const result: MultiLevelIntentResult = {
    finalIntent: resolved.type,
    finalConfidence: resolved.confidence,
    levels: {
      pattern: patternResult,
      llm: llmResult,
      context: context ? {
        type: context.lastIntent as IntentType || 'conversation',
        confidence: 0.7,
        source: 'context',
        reasoning: `Previous intent: ${context.lastIntent}`
      } : null
    },
    explicitIntent: llmResult || patternResult || undefined,
    implicitIntent: implicitIntent || undefined,
    hasNegation,
    hasTransition,
    negatedIntent,
    transitionFrom,
    transitionTo,
    conflictResolved: patternResult?.type !== llmResult?.type && !!patternResult && !!llmResult,
    resolutionMethod: method,
    processingTime: Date.now() - startTime
  };
  
  console.log('[MultiLevelIntentDetector] Final result:', {
    intent: result.finalIntent,
    confidence: result.finalConfidence,
    method: result.resolutionMethod,
    time: result.processingTime + 'ms'
  });
  
  return result;
}

/**
 * Détection rapide (sans LLM) pour les cas simples
 */
export function detectIntentQuick(message: string, hasFileContent: boolean = false): IntentCandidate {
  // Analyse rapide pour les transitions/négations EN PREMIER
  const quickResult = quickAnalyze(message);
  
  // Si négation ou transition détectée, marquer pour analyse complète
  if (quickResult.references?.hasNegation || quickResult.references?.hasTransition) {
    const patternResult = detectByPatterns(message, hasFileContent);
    return {
      type: patternResult?.type || 'conversation',
      confidence: 0.5, // Basse confiance pour forcer l'analyse complète
      source: 'pattern',
      reasoning: 'Needs full analysis due to negation/transition'
    };
  }
  
  // Sinon, utiliser la détection par patterns
  const patternResult = detectByPatterns(message, hasFileContent);
  
  if (patternResult && patternResult.confidence >= 0.8) {
    return patternResult;
  }
  
  return patternResult || {
    type: 'conversation',
    confidence: 0.5,
    source: 'pattern',
    reasoning: 'Default fallback'
  };
}

export default {
  detectIntentMultiLevel,
  detectIntentQuick
};
