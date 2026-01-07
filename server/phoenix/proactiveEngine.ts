/**
 * Proactive Engine - Moteur d'Initiative
 * 
 * Ce module permet à Phoenix de prendre des initiatives et de proposer
 * des améliorations non demandées, comme Manus AI.
 * 
 * Fonctionnalités:
 * 1. Suggestions proactives basées sur le contexte
 * 2. Détection d'opportunités d'amélioration
 * 3. Anticipation des besoins utilisateur
 * 4. Propositions d'actions complémentaires
 */

import { invokeLLM } from '../_core/llm';
import { IntentType } from './intentDetector';

// Types pour l'initiative
export interface ProactiveSuggestion {
  id: string;
  type: 'improvement' | 'follow_up' | 'warning' | 'optimization' | 'alternative' | 'related';
  title: string;
  description: string;
  action?: string;
  priority: 'low' | 'medium' | 'high';
  confidence: number;
  reasoning: string;
  timestamp: number;
  dismissed?: boolean;
}

export interface OpportunityDetection {
  opportunities: ProactiveSuggestion[];
  context: string;
  userNeed: string;
}

export interface AnticipatedNeed {
  need: string;
  probability: number;
  suggestedAction: string;
  reasoning: string;
}

// Configuration
const MIN_CONFIDENCE_FOR_SUGGESTION = 0.6;
const MAX_SUGGESTIONS_PER_RESPONSE = 3;

/**
 * Classe principale du moteur d'initiative
 */
export class ProactiveEngine {
  private suggestionHistory: ProactiveSuggestion[] = [];
  private userFeedback: Map<string, boolean> = new Map();

  constructor() {
    this.suggestionHistory = [];
  }

  /**
   * Génère des suggestions proactives basées sur le contexte
   */
  async generateSuggestions(
    currentAction: string,
    intent: IntentType,
    userMessage: string,
    conversationHistory: string[]
  ): Promise<ProactiveSuggestion[]> {
    console.log('[ProactiveEngine] Generating suggestions for:', intent);

    const prompt = `Basé sur cette interaction, génère des suggestions proactives utiles:

Action actuelle: ${currentAction}
Intention: ${intent}
Message utilisateur: "${userMessage}"
Historique: ${conversationHistory.slice(-3).join(' | ')}

Génère 1-3 suggestions qui:
1. Améliorent le résultat actuel
2. Anticipent les besoins suivants
3. Proposent des alternatives utiles
4. Avertissent de problèmes potentiels

Réponds en JSON:
{
  "suggestions": [
    {
      "type": "improvement|follow_up|warning|optimization|alternative|related",
      "title": "...",
      "description": "...",
      "action": "action suggérée si applicable",
      "priority": "low|medium|high",
      "confidence": 0.0-1.0,
      "reasoning": "..."
    }
  ]
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu génères des suggestions proactives utiles et pertinentes.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);

        const suggestions: ProactiveSuggestion[] = (result.suggestions || [])
          .filter((s: Partial<ProactiveSuggestion>) => (s.confidence || 0) >= MIN_CONFIDENCE_FOR_SUGGESTION)
          .slice(0, MAX_SUGGESTIONS_PER_RESPONSE)
          .map((s: Partial<ProactiveSuggestion>) => ({
            id: `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: s.type || 'improvement',
            title: s.title || 'Suggestion',
            description: s.description || '',
            action: s.action,
            priority: s.priority || 'medium',
            confidence: s.confidence || 0.7,
            reasoning: s.reasoning || '',
            timestamp: Date.now()
          }));

        this.suggestionHistory.push(...suggestions);
        return suggestions;
      }
    } catch (error) {
      console.error('[ProactiveEngine] Error generating suggestions:', error);
    }

    return [];
  }

  /**
   * Détecte les opportunités d'amélioration
   */
  async detectOpportunities(
    currentResult: string,
    originalRequest: string
  ): Promise<OpportunityDetection> {
    console.log('[ProactiveEngine] Detecting opportunities');

    const prompt = `Analyse ce résultat et détecte les opportunités d'amélioration:

Demande originale: "${originalRequest}"
Résultat actuel: "${currentResult.substring(0, 1500)}"

Identifie:
1. Ce qui pourrait être amélioré
2. Ce qui manque potentiellement
3. Des alternatives meilleures
4. Des risques ou problèmes

Réponds en JSON:
{
  "opportunities": [
    {
      "type": "improvement|optimization|alternative|warning",
      "title": "...",
      "description": "...",
      "priority": "low|medium|high",
      "confidence": 0.0-1.0
    }
  ],
  "userNeed": "besoin implicite détecté"
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu détectes les opportunités d\'amélioration.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);

        const opportunities: ProactiveSuggestion[] = (result.opportunities || []).map(
          (o: Partial<ProactiveSuggestion>, index: number) => ({
            id: `opp_${Date.now()}_${index}`,
            type: o.type || 'improvement',
            title: o.title || 'Opportunité',
            description: o.description || '',
            priority: o.priority || 'medium',
            confidence: o.confidence || 0.7,
            reasoning: '',
            timestamp: Date.now()
          })
        );

        return {
          opportunities,
          context: currentResult.substring(0, 200),
          userNeed: result.userNeed || ''
        };
      }
    } catch (error) {
      console.error('[ProactiveEngine] Error detecting opportunities:', error);
    }

    return {
      opportunities: [],
      context: '',
      userNeed: ''
    };
  }

  /**
   * Anticipe les besoins de l'utilisateur
   */
  async anticipateNeeds(
    currentIntent: IntentType,
    conversationHistory: string[],
    userPreferences?: Record<string, unknown>
  ): Promise<AnticipatedNeed[]> {
    console.log('[ProactiveEngine] Anticipating user needs');

    const prompt = `Anticipe les besoins suivants de l'utilisateur:

Intention actuelle: ${currentIntent}
Historique: ${conversationHistory.slice(-5).join(' | ')}
${userPreferences ? `Préférences: ${JSON.stringify(userPreferences)}` : ''}

Prédis 1-3 besoins probables que l'utilisateur aura ensuite.

Réponds en JSON:
{
  "anticipatedNeeds": [
    {
      "need": "description du besoin",
      "probability": 0.0-1.0,
      "suggestedAction": "action à proposer",
      "reasoning": "pourquoi ce besoin"
    }
  ]
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu anticipes les besoins des utilisateurs.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);
        return result.anticipatedNeeds || [];
      }
    } catch (error) {
      console.error('[ProactiveEngine] Error anticipating needs:', error);
    }

    return [];
  }

  /**
   * Génère des actions complémentaires
   */
  async suggestComplementaryActions(
    completedAction: string,
    result: unknown
  ): Promise<ProactiveSuggestion[]> {
    console.log('[ProactiveEngine] Suggesting complementary actions');

    // Actions complémentaires basées sur l'action complétée
    const complementaryMap: Record<string, ProactiveSuggestion[]> = {
      'site_creation': [
        {
          id: `comp_${Date.now()}_1`,
          type: 'follow_up',
          title: 'Ajouter du contenu',
          description: 'Voulez-vous que j\'ajoute plus de contenu au site?',
          action: 'add_content',
          priority: 'medium',
          confidence: 0.8,
          reasoning: 'Un site a souvent besoin de contenu supplémentaire',
          timestamp: Date.now()
        },
        {
          id: `comp_${Date.now()}_2`,
          type: 'optimization',
          title: 'Optimiser pour mobile',
          description: 'Je peux vérifier et améliorer la version mobile',
          action: 'optimize_mobile',
          priority: 'high',
          confidence: 0.85,
          reasoning: 'La majorité du trafic web est mobile',
          timestamp: Date.now()
        }
      ],
      'image_generation': [
        {
          id: `comp_${Date.now()}_1`,
          type: 'alternative',
          title: 'Variations',
          description: 'Voulez-vous des variations de cette image?',
          action: 'generate_variations',
          priority: 'medium',
          confidence: 0.75,
          reasoning: 'Les utilisateurs apprécient souvent avoir des options',
          timestamp: Date.now()
        }
      ],
      'code_execution': [
        {
          id: `comp_${Date.now()}_1`,
          type: 'improvement',
          title: 'Optimiser le code',
          description: 'Je peux optimiser ce code pour de meilleures performances',
          action: 'optimize_code',
          priority: 'medium',
          confidence: 0.7,
          reasoning: 'Le code peut souvent être amélioré',
          timestamp: Date.now()
        }
      ]
    };

    const suggestions = complementaryMap[completedAction] || [];
    this.suggestionHistory.push(...suggestions);
    return suggestions;
  }

  /**
   * Formate les suggestions pour l'affichage
   */
  formatSuggestionsForDisplay(suggestions: ProactiveSuggestion[]): string {
    if (suggestions.length === 0) {
      return '';
    }

    const formatted = suggestions.map(s => {
      const priorityIcon = s.priority === 'high' ? '🔴' : s.priority === 'medium' ? '🟡' : '🟢';
      const typeIcon = {
        'improvement': '💡',
        'follow_up': '➡️',
        'warning': '⚠️',
        'optimization': '⚡',
        'alternative': '🔄',
        'related': '🔗'
      }[s.type] || '💡';

      return `${priorityIcon} ${typeIcon} **${s.title}**\n   ${s.description}`;
    }).join('\n\n');

    return `\n\n---\n📌 **Suggestions:**\n\n${formatted}`;
  }

  /**
   * Enregistre le feedback utilisateur sur une suggestion
   */
  recordFeedback(suggestionId: string, accepted: boolean): void {
    this.userFeedback.set(suggestionId, accepted);
    
    const suggestion = this.suggestionHistory.find(s => s.id === suggestionId);
    if (suggestion) {
      suggestion.dismissed = !accepted;
    }

    console.log(`[ProactiveEngine] Feedback recorded for ${suggestionId}: ${accepted ? 'accepted' : 'dismissed'}`);
  }

  /**
   * Apprend des feedbacks pour améliorer les suggestions futures
   */
  learnFromFeedback(): { acceptanceRate: number; mostAccepted: string[]; mostDismissed: string[] } {
    const accepted: string[] = [];
    const dismissed: string[] = [];

    this.userFeedback.forEach((wasAccepted, suggestionId) => {
      const suggestion = this.suggestionHistory.find(s => s.id === suggestionId);
      if (suggestion) {
        if (wasAccepted) {
          accepted.push(suggestion.type);
        } else {
          dismissed.push(suggestion.type);
        }
      }
    });

    const total = accepted.length + dismissed.length;
    const acceptanceRate = total > 0 ? accepted.length / total : 0;

    return {
      acceptanceRate,
      mostAccepted: this.getMostFrequent(accepted),
      mostDismissed: this.getMostFrequent(dismissed)
    };
  }

  /**
   * Obtient les éléments les plus fréquents
   */
  private getMostFrequent(items: string[]): string[] {
    const counts = new Map<string, number>();
    items.forEach(item => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);
  }

  /**
   * Obtient l'historique des suggestions
   */
  getSuggestionHistory(): ProactiveSuggestion[] {
    return [...this.suggestionHistory];
  }

  /**
   * Réinitialise le moteur
   */
  reset(): void {
    this.suggestionHistory = [];
    this.userFeedback.clear();
  }

  /**
   * Vérifie si des suggestions doivent être faites
   */
  shouldMakeSuggestions(
    responseLength: number,
    userEngagement: number
  ): boolean {
    // Ne pas faire de suggestions si la réponse est très courte
    if (responseLength < 100) {
      return false;
    }

    // Faire des suggestions si l'utilisateur est engagé
    if (userEngagement > 0.7) {
      return true;
    }

    // Faire des suggestions occasionnellement
    return Math.random() > 0.5;
  }
}

// Instance singleton
let proactiveEngineInstance: ProactiveEngine | null = null;

export function getProactiveEngine(): ProactiveEngine {
  if (!proactiveEngineInstance) {
    proactiveEngineInstance = new ProactiveEngine();
  }
  return proactiveEngineInstance;
}

export default ProactiveEngine;
