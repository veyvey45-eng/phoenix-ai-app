/**
 * Hypothesis Engine - Gestion des Ambiguïtés
 * 
 * Ce module permet à Phoenix de faire des hypothèses raisonnables
 * plutôt que de bloquer ou demander clarification, comme Manus AI.
 * 
 * Principes:
 * 1. Faire des hypothèses basées sur le contexte
 * 2. Choisir l'interprétation la plus probable
 * 3. Expliquer les hypothèses faites
 * 4. Permettre la correction si nécessaire
 */

import { invokeLLM } from '../_core/llm';

// Types pour les hypothèses
export interface Hypothesis {
  id: string;
  type: 'interpretation' | 'assumption' | 'inference' | 'default';
  statement: string;
  confidence: number;
  reasoning: string;
  alternatives: string[];
  source: 'context' | 'history' | 'common_sense' | 'domain_knowledge';
  createdAt: number;
  validated?: boolean;
  validatedAt?: number;
}

export interface Ambiguity {
  id: string;
  type: 'lexical' | 'syntactic' | 'semantic' | 'pragmatic' | 'referential';
  description: string;
  possibleInterpretations: string[];
  context: string;
  severity: 'low' | 'medium' | 'high';
}

export interface HypothesisResult {
  hypothesis: Hypothesis;
  shouldProceed: boolean;
  explanation: string;
  fallbackAction?: string;
}

export interface AmbiguityAnalysis {
  ambiguities: Ambiguity[];
  hypotheses: Hypothesis[];
  recommendedAction: string;
  confidence: number;
}

// Seuils de confiance
const CONFIDENCE_THRESHOLDS = {
  PROCEED_SILENTLY: 0.85,    // Procéder sans mentionner l'hypothèse
  PROCEED_WITH_NOTE: 0.65,   // Procéder en mentionnant l'hypothèse
  PROCEED_WITH_WARNING: 0.45, // Procéder avec avertissement
  ASK_CLARIFICATION: 0.25    // Demander clarification (rare)
};

/**
 * Classe principale du moteur d'hypothèses
 */
export class HypothesisEngine {
  private hypothesisHistory: Hypothesis[] = [];
  private validatedHypotheses: Map<string, boolean> = new Map();

  constructor() {
    this.hypothesisHistory = [];
  }

  /**
   * Analyse les ambiguïtés dans un message
   */
  async analyzeAmbiguities(
    message: string,
    context?: string[],
    previousHypotheses?: Hypothesis[]
  ): Promise<AmbiguityAnalysis> {
    console.log('[HypothesisEngine] Analyzing ambiguities in:', message.substring(0, 100));

    const prompt = `Analyse les ambiguïtés dans ce message:

Message: "${message}"
${context ? `Contexte: ${context.slice(-3).join(' | ')}` : ''}
${previousHypotheses ? `Hypothèses précédentes: ${previousHypotheses.map(h => h.statement).join(', ')}` : ''}

Identifie:
1. Les ambiguïtés (lexicales, syntaxiques, sémantiques, pragmatiques, référentielles)
2. Les interprétations possibles pour chaque ambiguïté
3. L'interprétation la plus probable avec justification

Réponds en JSON:
{
  "ambiguities": [
    {
      "type": "semantic|lexical|syntactic|pragmatic|referential",
      "description": "...",
      "possibleInterpretations": ["...", "..."],
      "severity": "low|medium|high"
    }
  ],
  "recommendedInterpretation": "...",
  "confidence": 0.0-1.0,
  "reasoning": "..."
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu analyses les ambiguïtés linguistiques et fais des hypothèses raisonnables.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);
        
        // Créer les objets Ambiguity
        const ambiguities: Ambiguity[] = (result.ambiguities || []).map((a: Partial<Ambiguity>, index: number) => ({
          id: `amb_${Date.now()}_${index}`,
          type: a.type || 'semantic',
          description: a.description || '',
          possibleInterpretations: a.possibleInterpretations || [],
          context: message,
          severity: a.severity || 'low'
        }));

        // Créer les hypothèses pour chaque ambiguïté
        const hypotheses: Hypothesis[] = ambiguities.map((amb, index) => ({
          id: `hyp_${Date.now()}_${index}`,
          type: 'interpretation' as const,
          statement: amb.possibleInterpretations[0] || 'Interprétation par défaut',
          confidence: result.confidence || 0.7,
          reasoning: result.reasoning || 'Basé sur le contexte',
          alternatives: amb.possibleInterpretations.slice(1),
          source: 'context' as const,
          createdAt: Date.now()
        }));

        // Sauvegarder les hypothèses
        this.hypothesisHistory.push(...hypotheses);

        return {
          ambiguities,
          hypotheses,
          recommendedAction: result.recommendedInterpretation || message,
          confidence: result.confidence || 0.7
        };
      }
    } catch (error) {
      console.error('[HypothesisEngine] Error analyzing ambiguities:', error);
    }

    // Retour par défaut si pas d'ambiguïté détectée
    return {
      ambiguities: [],
      hypotheses: [],
      recommendedAction: message,
      confidence: 0.9
    };
  }

  /**
   * Fait une hypothèse pour résoudre une ambiguïté
   */
  async makeHypothesis(
    ambiguity: Ambiguity,
    context?: string[]
  ): Promise<HypothesisResult> {
    console.log('[HypothesisEngine] Making hypothesis for:', ambiguity.description);

    // Si l'ambiguïté est de faible sévérité, choisir la première interprétation
    if (ambiguity.severity === 'low' && ambiguity.possibleInterpretations.length > 0) {
      const hypothesis: Hypothesis = {
        id: `hyp_${Date.now()}`,
        type: 'interpretation',
        statement: ambiguity.possibleInterpretations[0],
        confidence: 0.8,
        reasoning: 'Interprétation la plus commune pour ce type de demande',
        alternatives: ambiguity.possibleInterpretations.slice(1),
        source: 'common_sense',
        createdAt: Date.now()
      };

      this.hypothesisHistory.push(hypothesis);

      return {
        hypothesis,
        shouldProceed: true,
        explanation: `J'interprète cela comme: "${hypothesis.statement}"`
      };
    }

    // Pour les ambiguïtés plus complexes, utiliser le LLM
    const prompt = `Fais une hypothèse raisonnable pour cette ambiguïté:

Ambiguïté: ${ambiguity.description}
Type: ${ambiguity.type}
Interprétations possibles: ${ambiguity.possibleInterpretations.join(', ')}
${context ? `Contexte: ${context.slice(-3).join(' | ')}` : ''}

Choisis l'interprétation la plus probable et justifie ton choix.

Réponds en JSON:
{
  "chosenInterpretation": "...",
  "confidence": 0.0-1.0,
  "reasoning": "...",
  "shouldProceed": true/false
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu fais des hypothèses raisonnables basées sur le contexte.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);

        const hypothesis: Hypothesis = {
          id: `hyp_${Date.now()}`,
          type: 'interpretation',
          statement: result.chosenInterpretation,
          confidence: result.confidence || 0.7,
          reasoning: result.reasoning,
          alternatives: ambiguity.possibleInterpretations.filter(
            i => i !== result.chosenInterpretation
          ),
          source: 'context',
          createdAt: Date.now()
        };

        this.hypothesisHistory.push(hypothesis);

        return {
          hypothesis,
          shouldProceed: result.shouldProceed !== false,
          explanation: this.generateExplanation(hypothesis)
        };
      }
    } catch (error) {
      console.error('[HypothesisEngine] Error making hypothesis:', error);
    }

    // Hypothèse par défaut
    const defaultHypothesis: Hypothesis = {
      id: `hyp_${Date.now()}`,
      type: 'default',
      statement: ambiguity.possibleInterpretations[0] || 'Interprétation standard',
      confidence: 0.6,
      reasoning: 'Hypothèse par défaut',
      alternatives: ambiguity.possibleInterpretations.slice(1),
      source: 'common_sense',
      createdAt: Date.now()
    };

    this.hypothesisHistory.push(defaultHypothesis);

    return {
      hypothesis: defaultHypothesis,
      shouldProceed: true,
      explanation: `J'ai supposé: "${defaultHypothesis.statement}"`
    };
  }

  /**
   * Fait des hypothèses sur les informations manquantes
   */
  async inferMissingInfo(
    message: string,
    requiredInfo: string[],
    context?: string[]
  ): Promise<Map<string, Hypothesis>> {
    console.log('[HypothesisEngine] Inferring missing info:', requiredInfo);

    const inferences = new Map<string, Hypothesis>();

    for (const info of requiredInfo) {
      const prompt = `Infère cette information manquante:

Message original: "${message}"
Information manquante: ${info}
${context ? `Contexte: ${context.slice(-3).join(' | ')}` : ''}

Fais une hypothèse raisonnable basée sur:
1. Le contexte du message
2. Les conventions communes
3. Les valeurs par défaut sensées

Réponds en JSON:
{
  "inferredValue": "...",
  "confidence": 0.0-1.0,
  "reasoning": "...",
  "source": "context|common_sense|domain_knowledge"
}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: 'Tu infères des informations manquantes de manière raisonnable.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content;
        if (typeof content === 'string') {
          const result = JSON.parse(content);

          const hypothesis: Hypothesis = {
            id: `hyp_${Date.now()}_${info}`,
            type: 'inference',
            statement: `${info}: ${result.inferredValue}`,
            confidence: result.confidence || 0.6,
            reasoning: result.reasoning,
            alternatives: [],
            source: result.source || 'common_sense',
            createdAt: Date.now()
          };

          inferences.set(info, hypothesis);
          this.hypothesisHistory.push(hypothesis);
        }
      } catch (error) {
        console.error(`[HypothesisEngine] Error inferring ${info}:`, error);
        
        // Valeur par défaut
        const defaultHypothesis: Hypothesis = {
          id: `hyp_${Date.now()}_${info}`,
          type: 'default',
          statement: `${info}: valeur par défaut`,
          confidence: 0.4,
          reasoning: 'Valeur par défaut utilisée',
          alternatives: [],
          source: 'common_sense',
          createdAt: Date.now()
        };

        inferences.set(info, defaultHypothesis);
        this.hypothesisHistory.push(defaultHypothesis);
      }
    }

    return inferences;
  }

  /**
   * Génère une explication pour une hypothèse
   */
  private generateExplanation(hypothesis: Hypothesis): string {
    if (hypothesis.confidence >= CONFIDENCE_THRESHOLDS.PROCEED_SILENTLY) {
      return ''; // Pas besoin d'expliquer
    }

    if (hypothesis.confidence >= CONFIDENCE_THRESHOLDS.PROCEED_WITH_NOTE) {
      return `J'ai compris: "${hypothesis.statement}"`;
    }

    if (hypothesis.confidence >= CONFIDENCE_THRESHOLDS.PROCEED_WITH_WARNING) {
      return `J'ai supposé que: "${hypothesis.statement}". ${hypothesis.reasoning}. Dites-moi si ce n'est pas correct.`;
    }

    return `Je ne suis pas sûr, mais j'ai supposé: "${hypothesis.statement}". Alternatives: ${hypothesis.alternatives.join(', ')}`;
  }

  /**
   * Valide une hypothèse (après feedback utilisateur)
   */
  validateHypothesis(hypothesisId: string, isCorrect: boolean): void {
    const hypothesis = this.hypothesisHistory.find(h => h.id === hypothesisId);
    if (hypothesis) {
      hypothesis.validated = isCorrect;
      hypothesis.validatedAt = Date.now();
      this.validatedHypotheses.set(hypothesisId, isCorrect);
      
      console.log(`[HypothesisEngine] Hypothesis ${hypothesisId} validated as ${isCorrect}`);
    }
  }

  /**
   * Apprend des hypothèses validées
   */
  learnFromValidation(): void {
    // Analyser les hypothèses validées pour améliorer les futures prédictions
    const validated = this.hypothesisHistory.filter(h => h.validated !== undefined);
    const correctRate = validated.filter(h => h.validated).length / validated.length;
    
    console.log(`[HypothesisEngine] Learning from ${validated.length} validations. Correct rate: ${(correctRate * 100).toFixed(1)}%`);
  }

  /**
   * Obtient l'historique des hypothèses
   */
  getHypothesisHistory(): Hypothesis[] {
    return [...this.hypothesisHistory];
  }

  /**
   * Réinitialise le moteur
   */
  reset(): void {
    this.hypothesisHistory = [];
    this.validatedHypotheses.clear();
  }

  /**
   * Résout automatiquement les références ambiguës
   */
  async resolveReference(
    reference: string,
    context: string[],
    possibleReferents: string[]
  ): Promise<HypothesisResult> {
    console.log('[HypothesisEngine] Resolving reference:', reference);

    if (possibleReferents.length === 1) {
      const hypothesis: Hypothesis = {
        id: `hyp_ref_${Date.now()}`,
        type: 'interpretation',
        statement: `"${reference}" fait référence à "${possibleReferents[0]}"`,
        confidence: 0.95,
        reasoning: 'Seul référent possible',
        alternatives: [],
        source: 'context',
        createdAt: Date.now()
      };

      this.hypothesisHistory.push(hypothesis);

      return {
        hypothesis,
        shouldProceed: true,
        explanation: ''
      };
    }

    // Utiliser le contexte pour choisir le bon référent
    const prompt = `Résous cette référence ambiguë:

Référence: "${reference}"
Contexte récent: ${context.slice(-5).join(' | ')}
Référents possibles: ${possibleReferents.join(', ')}

Quel est le référent le plus probable?

Réponds en JSON:
{
  "referent": "...",
  "confidence": 0.0-1.0,
  "reasoning": "..."
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu résous les références ambiguës.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);

        const hypothesis: Hypothesis = {
          id: `hyp_ref_${Date.now()}`,
          type: 'interpretation',
          statement: `"${reference}" fait référence à "${result.referent}"`,
          confidence: result.confidence || 0.7,
          reasoning: result.reasoning,
          alternatives: possibleReferents.filter(r => r !== result.referent),
          source: 'context',
          createdAt: Date.now()
        };

        this.hypothesisHistory.push(hypothesis);

        return {
          hypothesis,
          shouldProceed: true,
          explanation: hypothesis.confidence < CONFIDENCE_THRESHOLDS.PROCEED_SILENTLY
            ? `J'ai compris que "${reference}" fait référence à "${result.referent}"`
            : ''
        };
      }
    } catch (error) {
      console.error('[HypothesisEngine] Error resolving reference:', error);
    }

    // Choisir le premier référent par défaut
    const defaultHypothesis: Hypothesis = {
      id: `hyp_ref_${Date.now()}`,
      type: 'default',
      statement: `"${reference}" fait référence à "${possibleReferents[0]}"`,
      confidence: 0.5,
      reasoning: 'Premier référent choisi par défaut',
      alternatives: possibleReferents.slice(1),
      source: 'common_sense',
      createdAt: Date.now()
    };

    this.hypothesisHistory.push(defaultHypothesis);

    return {
      hypothesis: defaultHypothesis,
      shouldProceed: true,
      explanation: `J'ai supposé que "${reference}" fait référence à "${possibleReferents[0]}"`
    };
  }
}

// Instance singleton
let hypothesisEngineInstance: HypothesisEngine | null = null;

export function getHypothesisEngine(): HypothesisEngine {
  if (!hypothesisEngineInstance) {
    hypothesisEngineInstance = new HypothesisEngine();
  }
  return hypothesisEngineInstance;
}

export default HypothesisEngine;
