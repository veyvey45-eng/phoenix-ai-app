/**
 * Decision Engine - Moteur de Décision Autonome
 * 
 * Ce module permet à Phoenix de prendre des décisions autonomes
 * sans demander confirmation à l'utilisateur, comme Manus AI.
 * 
 * Principes:
 * 1. Faire des hypothèses raisonnables plutôt que bloquer
 * 2. Prendre des décisions basées sur le contexte
 * 3. Expliquer les décisions prises
 * 4. Permettre la correction si nécessaire
 */

import { invokeLLM } from '../_core/llm';
import { IntentType } from './intentDetector';

// Types pour les décisions
export interface Decision {
  id: string;
  type: 'action' | 'clarification' | 'assumption' | 'delegation';
  action: string;
  reasoning: string;
  confidence: number;
  assumptions: string[];
  alternatives: Alternative[];
  timestamp: number;
  requiresConfirmation: boolean;
}

export interface Alternative {
  action: string;
  reasoning: string;
  confidence: number;
}

export interface DecisionContext {
  userMessage: string;
  intent: IntentType;
  conversationHistory: string[];
  currentState: string;
  availableActions: string[];
  constraints: string[];
  userPreferences: Record<string, unknown>;
}

export interface DecisionResult {
  decision: Decision;
  shouldProceed: boolean;
  explanation: string;
  nextActions: string[];
}

// Seuils de confiance pour les décisions autonomes
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,      // Procéder sans hésitation
  MEDIUM: 0.65,    // Procéder avec explication
  LOW: 0.45,       // Procéder avec avertissement
  VERY_LOW: 0.25   // Demander clarification (rare)
};

// Actions qui ne nécessitent JAMAIS de confirmation
const ALWAYS_AUTONOMOUS_ACTIONS = [
  'conversation',
  'web_search',
  'weather',
  'crypto',
  'calculation',
  'code_execution',
  'file_analysis'
];

// Actions qui peuvent nécessiter une confirmation (mais rarement)
const SOMETIMES_CONFIRM_ACTIONS = [
  'site_creation',
  'app_creation',
  'image_generation',
  'site_modification'
];

/**
 * Classe principale du moteur de décision
 */
export class DecisionEngine {
  private decisionHistory: Decision[] = [];
  private userPreferences: Record<string, unknown> = {};

  constructor() {
    this.decisionHistory = [];
  }

  /**
   * Prend une décision autonome basée sur le contexte
   */
  async makeDecision(context: DecisionContext): Promise<DecisionResult> {
    console.log('[DecisionEngine] Making decision for:', context.intent);
    
    // Étape 1: Analyser le contexte et l'intention
    const analysis = await this.analyzeContext(context);
    
    // Étape 2: Générer des options de décision
    const options = await this.generateOptions(context, analysis);
    
    // Étape 3: Évaluer et sélectionner la meilleure option
    const bestOption = this.selectBestOption(options);
    
    // Étape 4: Déterminer si une confirmation est nécessaire
    const requiresConfirmation = this.shouldRequireConfirmation(bestOption, context);
    
    // Étape 5: Créer la décision finale
    const decision: Decision = {
      id: `decision_${Date.now()}`,
      type: this.determineDecisionType(bestOption, context),
      action: bestOption.action,
      reasoning: bestOption.reasoning,
      confidence: bestOption.confidence,
      assumptions: analysis.assumptions,
      alternatives: options.filter(o => o !== bestOption),
      timestamp: Date.now(),
      requiresConfirmation
    };

    // Sauvegarder dans l'historique
    this.decisionHistory.push(decision);

    // Générer l'explication
    const explanation = this.generateExplanation(decision, context);

    return {
      decision,
      shouldProceed: !requiresConfirmation || bestOption.confidence >= CONFIDENCE_THRESHOLDS.HIGH,
      explanation,
      nextActions: this.determineNextActions(decision, context)
    };
  }

  /**
   * Analyse le contexte pour comprendre la situation
   */
  private async analyzeContext(context: DecisionContext): Promise<{
    clarity: number;
    assumptions: string[];
    ambiguities: string[];
    implicitNeeds: string[];
  }> {
    const prompt = `Analyse ce contexte de décision:

Message utilisateur: "${context.userMessage}"
Intention détectée: ${context.intent}
Historique: ${context.conversationHistory.slice(-3).join(' | ')}

Identifie:
1. La clarté de la demande (0-1)
2. Les hypothèses raisonnables à faire
3. Les ambiguïtés présentes
4. Les besoins implicites non exprimés

Réponds en JSON:
{
  "clarity": 0.0-1.0,
  "assumptions": ["hypothèse 1", "hypothèse 2"],
  "ambiguities": ["ambiguïté 1"],
  "implicitNeeds": ["besoin implicite 1"]
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu analyses les contextes de décision.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        return JSON.parse(content);
      }
      return { clarity: 0.7, assumptions: [], ambiguities: [], implicitNeeds: [] };
    } catch {
      return {
        clarity: 0.7,
        assumptions: ['L\'utilisateur veut une réponse rapide'],
        ambiguities: [],
        implicitNeeds: []
      };
    }
  }

  /**
   * Génère des options de décision
   */
  private async generateOptions(
    context: DecisionContext,
    analysis: { clarity: number; assumptions: string[]; ambiguities: string[]; implicitNeeds: string[] }
  ): Promise<Alternative[]> {
    const prompt = `Génère 3 options de décision pour cette situation:

Message: "${context.userMessage}"
Intention: ${context.intent}
Clarté: ${analysis.clarity}
Ambiguïtés: ${analysis.ambiguities.join(', ')}

Actions disponibles: ${context.availableActions.join(', ')}

Pour chaque option, donne:
- L'action à prendre
- Le raisonnement
- La confiance (0-1)

Réponds en JSON:
{
  "options": [
    {"action": "...", "reasoning": "...", "confidence": 0.0-1.0},
    {"action": "...", "reasoning": "...", "confidence": 0.0-1.0},
    {"action": "...", "reasoning": "...", "confidence": 0.0-1.0}
  ]
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu génères des options de décision optimales.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);
        return result.options || [];
      }
      return [];
    } catch {
      // Option par défaut basée sur l'intention
      return [{
        action: context.intent,
        reasoning: 'Action basée sur l\'intention détectée',
        confidence: 0.7
      }];
    }
  }

  /**
   * Sélectionne la meilleure option
   */
  private selectBestOption(options: Alternative[]): Alternative {
    if (options.length === 0) {
      return {
        action: 'conversation',
        reasoning: 'Aucune option disponible, conversation par défaut',
        confidence: 0.5
      };
    }

    // Trier par confiance décroissante
    const sorted = [...options].sort((a, b) => b.confidence - a.confidence);
    return sorted[0];
  }

  /**
   * Détermine si une confirmation est nécessaire
   * IMPORTANT: Phoenix doit être AUTONOME - les confirmations sont RARES
   */
  private shouldRequireConfirmation(option: Alternative, context: DecisionContext): boolean {
    // Actions toujours autonomes
    if (ALWAYS_AUTONOMOUS_ACTIONS.includes(context.intent)) {
      return false;
    }

    // Haute confiance = pas de confirmation
    if (option.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      return false;
    }

    // Confiance moyenne = pas de confirmation mais explication
    if (option.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      return false;
    }

    // Confiance basse = pas de confirmation mais avertissement
    if (option.confidence >= CONFIDENCE_THRESHOLDS.LOW) {
      return false;
    }

    // Très basse confiance = confirmation uniquement si action destructive
    const destructiveActions = ['delete', 'remove', 'supprimer', 'effacer'];
    const isDestructive = destructiveActions.some(d => 
      context.userMessage.toLowerCase().includes(d)
    );

    return isDestructive && option.confidence < CONFIDENCE_THRESHOLDS.VERY_LOW;
  }

  /**
   * Détermine le type de décision
   */
  private determineDecisionType(
    option: Alternative,
    context: DecisionContext
  ): Decision['type'] {
    if (option.confidence < CONFIDENCE_THRESHOLDS.VERY_LOW) {
      return 'clarification';
    }
    if (option.confidence < CONFIDENCE_THRESHOLDS.LOW) {
      return 'assumption';
    }
    return 'action';
  }

  /**
   * Génère une explication de la décision
   */
  private generateExplanation(decision: Decision, context: DecisionContext): string {
    const confidenceLevel = decision.confidence >= CONFIDENCE_THRESHOLDS.HIGH ? 'haute'
      : decision.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM ? 'moyenne'
      : 'modérée';

    let explanation = `Je procède avec ${decision.action} (confiance ${confidenceLevel}).`;

    if (decision.assumptions.length > 0) {
      explanation += ` J'ai supposé que: ${decision.assumptions.join(', ')}.`;
    }

    if (decision.alternatives.length > 0) {
      const alt = decision.alternatives[0];
      explanation += ` Alternative possible: ${alt.action}.`;
    }

    return explanation;
  }

  /**
   * Détermine les prochaines actions
   */
  private determineNextActions(decision: Decision, context: DecisionContext): string[] {
    const actions: string[] = [decision.action];

    // Ajouter des actions de suivi si nécessaire
    if (decision.type === 'assumption') {
      actions.push('verify_assumption');
    }

    if (context.intent === 'site_creation' || context.intent === 'app_creation') {
      actions.push('generate_preview');
      actions.push('offer_modifications');
    }

    return actions;
  }

  /**
   * Prend une décision rapide sans LLM (pour les cas simples)
   */
  makeQuickDecision(intent: IntentType, confidence: number): DecisionResult {
    const decision: Decision = {
      id: `quick_${Date.now()}`,
      type: 'action',
      action: intent,
      reasoning: 'Décision rapide basée sur l\'intention claire',
      confidence,
      assumptions: [],
      alternatives: [],
      timestamp: Date.now(),
      requiresConfirmation: false
    };

    return {
      decision,
      shouldProceed: true,
      explanation: `Je procède avec ${intent}.`,
      nextActions: [intent]
    };
  }

  /**
   * Apprend des préférences utilisateur
   */
  learnPreference(key: string, value: unknown): void {
    this.userPreferences[key] = value;
    console.log('[DecisionEngine] Learned preference:', key, value);
  }

  /**
   * Obtient l'historique des décisions
   */
  getDecisionHistory(): Decision[] {
    return [...this.decisionHistory];
  }

  /**
   * Réinitialise le moteur
   */
  reset(): void {
    this.decisionHistory = [];
  }
}

// Instance singleton
let decisionEngineInstance: DecisionEngine | null = null;

export function getDecisionEngine(): DecisionEngine {
  if (!decisionEngineInstance) {
    decisionEngineInstance = new DecisionEngine();
  }
  return decisionEngineInstance;
}

export default DecisionEngine;
