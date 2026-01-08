/**
 * ManusLikeCognition - Capacités cognitives avancées inspirées de Manus AI
 * 
 * Ce module unifie les 4 capacités cognitives clés :
 * 1. Gestion d'ambiguïté - Détection et résolution des demandes floues
 * 2. Métacognition - Auto-évaluation et réflexion sur le raisonnement
 * 3. Mémoire de travail - Contexte persistant entre les échanges
 * 4. Initiative proactive - Suggestions et anticipation des besoins
 */

import { invokeLLM } from '../_core/llm';
import { getHypothesisEngine } from './hypothesisEngine';
import { getMetaCognition } from './metaCognition';
import { getWorkingMemory } from './workingMemory';
import { getProactiveEngine } from './proactiveEngine';

// Types pour la gestion d'ambiguïté
export interface AmbiguityResolution {
  isAmbiguous: boolean;
  ambiguityLevel: 'none' | 'low' | 'medium' | 'high';
  clarificationNeeded: boolean;
  clarificationQuestions: ClarificationQuestion[];
  bestInterpretation: string;
  alternativeInterpretations: string[];
  confidence: number;
  reasoning: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  options?: string[];
  type: 'choice' | 'open' | 'confirmation';
  priority: 'required' | 'optional';
  context: string;
}

// Types pour la métacognition
export interface MetacognitiveState {
  currentConfidence: number;
  uncertaintyAreas: string[];
  knowledgeLimits: string[];
  reasoningQuality: 'poor' | 'fair' | 'good' | 'excellent';
  selfCorrections: string[];
  reflections: string[];
}

// Types pour la mémoire de travail
export interface WorkingMemoryState {
  currentTopic: string;
  recentEntities: string[];
  userPreferences: Record<string, any>;
  pendingTasks: string[];
  conversationSummary: string;
  importantFacts: string[];
}

// Types pour l'initiative proactive
export interface ProactiveState {
  suggestions: ProactiveSuggestion[];
  anticipatedNeeds: string[];
  alerts: string[];
  opportunities: string[];
}

export interface ProactiveSuggestion {
  id: string;
  type: 'action' | 'information' | 'clarification' | 'optimization';
  content: string;
  relevance: number;
  context: string;
}

// Analyse cognitive complète
export interface CognitiveAnalysis {
  ambiguity: AmbiguityResolution;
  metacognition: MetacognitiveState;
  memory: WorkingMemoryState;
  proactive: ProactiveState;
  overallReadiness: number;
  recommendedAction: 'proceed' | 'clarify' | 'defer' | 'suggest_alternative';
}

// Réponse cognitive préparée
export interface CognitiveResponse {
  shouldProceed: boolean;
  clarificationNeeded: boolean;
  clarificationMessage?: string;
  confidenceLevel: number;
  metacognitiveNotes: string[];
  proactiveSuggestions: string[];
  memoryContext: string;
}

/**
 * ManusLikeCognition - Classe principale pour les capacités cognitives
 */
export class ManusLikeCognition {
  private hypothesisEngine = getHypothesisEngine();
  private metaCognition = getMetaCognition();
  private workingMemory = getWorkingMemory();
  private proactiveEngine = getProactiveEngine();

  /**
   * Analyse l'ambiguïté d'un message utilisateur
   */
  async analyzeAmbiguity(
    message: string,
    conversationHistory: Array<{ role: string; content: string }>,
    detectedIntent: string
  ): Promise<AmbiguityResolution> {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Tu es un analyseur d'ambiguïté expert. Analyse le message utilisateur et détermine :
1. Si le message est ambigu ou incomplet
2. Le niveau d'ambiguïté (none, low, medium, high)
3. Si une clarification est nécessaire
4. Les questions de clarification à poser
5. La meilleure interprétation possible
6. Les interprétations alternatives

Contexte de l'intention détectée: ${detectedIntent}

Réponds en JSON avec ce format:
{
  "isAmbiguous": boolean,
  "ambiguityLevel": "none" | "low" | "medium" | "high",
  "clarificationNeeded": boolean,
  "clarificationQuestions": [{"id": string, "question": string, "options": string[], "type": "choice" | "open" | "confirmation", "priority": "required" | "optional", "context": string}],
  "bestInterpretation": string,
  "alternativeInterpretations": string[],
  "confidence": number (0-1),
  "reasoning": string
}`
          },
          ...conversationHistory.slice(-5).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          })),
          { role: 'user', content: message }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ambiguity_analysis',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                isAmbiguous: { type: 'boolean' },
                ambiguityLevel: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
                clarificationNeeded: { type: 'boolean' },
                clarificationQuestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      question: { type: 'string' },
                      options: { type: 'array', items: { type: 'string' } },
                      type: { type: 'string', enum: ['choice', 'open', 'confirmation'] },
                      priority: { type: 'string', enum: ['required', 'optional'] },
                      context: { type: 'string' }
                    },
                    required: ['id', 'question', 'type', 'priority', 'context'],
                    additionalProperties: false
                  }
                },
                bestInterpretation: { type: 'string' },
                alternativeInterpretations: { type: 'array', items: { type: 'string' } },
                confidence: { type: 'number' },
                reasoning: { type: 'string' }
              },
              required: ['isAmbiguous', 'ambiguityLevel', 'clarificationNeeded', 'clarificationQuestions', 'bestInterpretation', 'alternativeInterpretations', 'confidence', 'reasoning'],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0]?.message?.content;
      if (content && typeof content === 'string') {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('[ManusLikeCognition] Erreur analyse ambiguïté:', error);
    }

    // Retour par défaut si erreur
    return {
      isAmbiguous: false,
      ambiguityLevel: 'none',
      clarificationNeeded: false,
      clarificationQuestions: [],
      bestInterpretation: message,
      alternativeInterpretations: [],
      confidence: 0.7,
      reasoning: 'Analyse par défaut'
    };
  }

  /**
   * Évalue l'état métacognitif pour une requête
   */
  async evaluateMetacognition(
    message: string,
    detectedIntent: string
  ): Promise<MetacognitiveState> {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Tu es un système de métacognition. Évalue ta propre capacité à répondre à cette requête.
Analyse :
1. Ton niveau de confiance pour cette tâche
2. Les zones d'incertitude
3. Les limites de tes connaissances
4. La qualité de ton raisonnement
5. Les corrections potentielles à apporter
6. Tes réflexions sur la tâche

Type de requête: ${detectedIntent}

Réponds en JSON:
{
  "currentConfidence": number (0-1),
  "uncertaintyAreas": string[],
  "knowledgeLimits": string[],
  "reasoningQuality": "poor" | "fair" | "good" | "excellent",
  "selfCorrections": string[],
  "reflections": string[]
}`
          },
          { role: 'user', content: message }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'metacognition_evaluation',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                currentConfidence: { type: 'number' },
                uncertaintyAreas: { type: 'array', items: { type: 'string' } },
                knowledgeLimits: { type: 'array', items: { type: 'string' } },
                reasoningQuality: { type: 'string', enum: ['poor', 'fair', 'good', 'excellent'] },
                selfCorrections: { type: 'array', items: { type: 'string' } },
                reflections: { type: 'array', items: { type: 'string' } }
              },
              required: ['currentConfidence', 'uncertaintyAreas', 'knowledgeLimits', 'reasoningQuality', 'selfCorrections', 'reflections'],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0]?.message?.content;
      if (content && typeof content === 'string') {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('[ManusLikeCognition] Erreur évaluation métacognition:', error);
    }

    return {
      currentConfidence: 0.7,
      uncertaintyAreas: [],
      knowledgeLimits: [],
      reasoningQuality: 'good',
      selfCorrections: [],
      reflections: []
    };
  }

  /**
   * Met à jour la mémoire de travail
   */
  updateWorkingMemory(
    message: string,
    intent: string,
    entities: string[] = []
  ): WorkingMemoryState {
    // Stocker le message dans la mémoire
    this.workingMemory.store(`message_${Date.now()}`, {
      content: message,
      intent,
      entities,
      timestamp: Date.now()
    });

    // Mettre à jour le contexte
    const context = this.workingMemory.getContext();
    
    return {
      currentTopic: context.currentTopic || intent,
      recentEntities: entities,
      userPreferences: Object.fromEntries(context.userPreferences || new Map()),
      pendingTasks: context.recentActions || [],
      conversationSummary: '',
      importantFacts: []
    };
  }

  /**
   * Récupère l'état actuel de la mémoire de travail
   */
  getWorkingMemoryState(): WorkingMemoryState {
    const context = this.workingMemory.getContext();
    
    return {
      currentTopic: context.currentTopic || '',
      recentEntities: Array.from(context.entities?.keys() || []),
      userPreferences: Object.fromEntries(context.userPreferences || new Map()),
      pendingTasks: context.recentActions || [],
      conversationSummary: '',
      importantFacts: []
    };
  }

  /**
   * Génère des suggestions proactives
   */
  async generateProactiveSuggestions(
    message: string,
    intent: string
  ): Promise<ProactiveSuggestion[]> {
    try {
      const suggestions = await this.proactiveEngine.generateSuggestions(
        'cognitive_analysis',
        intent as any,
        message,
        []
      );
      
      return suggestions.map((s: any, i: number) => ({
        id: `suggestion_${i}`,
        type: s.type || 'action',
        content: s.description || s.title || s.content || '',
        relevance: s.confidence || 0.7,
        context: intent
      }));
    } catch (error) {
      console.error('[ManusLikeCognition] Erreur génération suggestions:', error);
      return [];
    }
  }

  /**
   * Anticipe les besoins de l'utilisateur
   */
  async anticipateNeeds(
    message: string,
    intent: string
  ): Promise<string[]> {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Tu es un système d'anticipation des besoins utilisateur.
Basé sur le message et l'intention détectée, anticipe ce que l'utilisateur pourrait vouloir ensuite.

Intention: ${intent}

Réponds en JSON:
{
  "anticipatedNeeds": string[]
}`
          },
          { role: 'user', content: message }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'needs_anticipation',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                anticipatedNeeds: { type: 'array', items: { type: 'string' } }
              },
              required: ['anticipatedNeeds'],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0]?.message?.content;
      if (content && typeof content === 'string') {
        const parsed = JSON.parse(content);
        return parsed.anticipatedNeeds || [];
      }
    } catch (error) {
      console.error('[ManusLikeCognition] Erreur anticipation besoins:', error);
    }

    return [];
  }

  /**
   * Effectue une analyse cognitive complète
   */
  async analyzeCompletely(
    message: string,
    conversationHistory: Array<{ role: string; content: string }>,
    detectedIntent: string
  ): Promise<CognitiveAnalysis> {
    // Exécuter les analyses en parallèle pour la performance
    const [ambiguity, metacognition, anticipatedNeeds] = await Promise.all([
      this.analyzeAmbiguity(message, conversationHistory, detectedIntent),
      this.evaluateMetacognition(message, detectedIntent),
      this.anticipateNeeds(message, detectedIntent)
    ]);

    // Mettre à jour la mémoire de travail
    const memory = this.updateWorkingMemory(message, detectedIntent);

    // Générer les suggestions proactives
    const suggestions = await this.generateProactiveSuggestions(message, detectedIntent);

    // Construire l'état proactif
    const proactive: ProactiveState = {
      suggestions,
      anticipatedNeeds,
      alerts: [],
      opportunities: []
    };

    // Calculer la préparation globale
    const overallReadiness = this.calculateReadiness(ambiguity, metacognition);

    // Déterminer l'action recommandée
    const recommendedAction = this.determineAction(ambiguity, metacognition, overallReadiness);

    return {
      ambiguity,
      metacognition,
      memory,
      proactive,
      overallReadiness,
      recommendedAction
    };
  }

  /**
   * Calcule le niveau de préparation global
   */
  private calculateReadiness(
    ambiguity: AmbiguityResolution,
    metacognition: MetacognitiveState
  ): number {
    const ambiguityScore = ambiguity.isAmbiguous ? 
      (ambiguity.ambiguityLevel === 'high' ? 0.3 : 
       ambiguity.ambiguityLevel === 'medium' ? 0.5 : 
       ambiguity.ambiguityLevel === 'low' ? 0.7 : 1) : 1;
    
    const confidenceScore = metacognition.currentConfidence;
    
    const qualityScore = 
      metacognition.reasoningQuality === 'excellent' ? 1 :
      metacognition.reasoningQuality === 'good' ? 0.8 :
      metacognition.reasoningQuality === 'fair' ? 0.6 : 0.4;

    return (ambiguityScore * 0.4 + confidenceScore * 0.4 + qualityScore * 0.2);
  }

  /**
   * Détermine l'action recommandée
   */
  private determineAction(
    ambiguity: AmbiguityResolution,
    metacognition: MetacognitiveState,
    readiness: number
  ): 'proceed' | 'clarify' | 'defer' | 'suggest_alternative' {
    if (ambiguity.clarificationNeeded && ambiguity.ambiguityLevel === 'high') {
      return 'clarify';
    }
    
    if (readiness < 0.4) {
      return 'defer';
    }
    
    if (metacognition.currentConfidence < 0.5 && ambiguity.alternativeInterpretations.length > 0) {
      return 'suggest_alternative';
    }
    
    return 'proceed';
  }

  /**
   * Génère un message de clarification si nécessaire
   */
  generateClarificationMessage(resolution: AmbiguityResolution): string {
    if (!resolution.clarificationNeeded || resolution.clarificationQuestions.length === 0) {
      return '';
    }

    const requiredQuestions = resolution.clarificationQuestions
      .filter(q => q.priority === 'required');

    if (requiredQuestions.length === 0) {
      return '';
    }

    let message = "J'ai besoin d'une petite précision pour mieux vous aider :\n\n";
    
    requiredQuestions.forEach((q, i) => {
      message += `${i + 1}. ${q.question}`;
      if (q.options && q.options.length > 0) {
        message += `\n   Options: ${q.options.join(', ')}`;
      }
      message += '\n';
    });

    return message;
  }

  /**
   * Génère des notes métacognitives pour la réponse
   */
  private generateMetacognitiveNotes(state: MetacognitiveState): string[] {
    const notes: string[] = [];

    if (state.currentConfidence < 0.5) {
      notes.push('⚠️ Confiance limitée - Je vous recommande de vérifier ces informations');
    }

    if (state.uncertaintyAreas.length > 0) {
      notes.push(`📊 Zones d'incertitude: ${state.uncertaintyAreas.join(', ')}`);
    }

    if (state.knowledgeLimits.length > 0) {
      notes.push(`📚 Limites: ${state.knowledgeLimits.join(', ')}`);
    }

    if (state.selfCorrections.length > 0) {
      notes.push(`🔄 Corrections: ${state.selfCorrections.join(', ')}`);
    }

    return notes;
  }

  /**
   * Prépare une réponse cognitive complète
   */
  prepareCognitiveResponse(analysis: CognitiveAnalysis): CognitiveResponse {
    const clarificationMessage = this.generateClarificationMessage(analysis.ambiguity);
    const metacognitiveNotes = this.generateMetacognitiveNotes(analysis.metacognition);
    
    const proactiveSuggestions = analysis.proactive.suggestions
      .filter(s => s.relevance > 0.5)
      .map(s => s.content);

    // Construire le contexte mémoire
    let memoryContext = '';
    if (analysis.memory.currentTopic) {
      memoryContext += `Sujet actuel: ${analysis.memory.currentTopic}. `;
    }
    if (analysis.memory.recentEntities.length > 0) {
      memoryContext += `Entités mentionnées: ${analysis.memory.recentEntities.join(', ')}. `;
    }

    return {
      shouldProceed: analysis.recommendedAction === 'proceed',
      clarificationNeeded: analysis.recommendedAction === 'clarify',
      clarificationMessage: clarificationMessage || undefined,
      confidenceLevel: analysis.metacognition.currentConfidence,
      metacognitiveNotes,
      proactiveSuggestions,
      memoryContext
    };
  }

  /**
   * Réinitialise l'état cognitif
   */
  reset(): void {
    this.hypothesisEngine.reset();
    this.metaCognition.reset();
    this.workingMemory.reset();
    this.proactiveEngine.reset();
    console.log('[ManusLikeCognition] État cognitif réinitialisé');
  }

  /**
   * Retourne le statut du système cognitif
   */
  getStatus(): string {
    const memory = this.getWorkingMemoryState();
    return `
═══════════════════════════════════════════════════════════════
                    État Cognitif Phoenix
═══════════════════════════════════════════════════════════════
📝 Sujet actuel: ${memory.currentTopic || 'Aucun'}
🏷️  Entités récentes: ${memory.recentEntities.length > 0 ? memory.recentEntities.join(', ') : 'Aucune'}
📋 Tâches en attente: ${memory.pendingTasks.length}
⚙️  Préférences: ${Object.keys(memory.userPreferences).length} enregistrées
═══════════════════════════════════════════════════════════════`;
  }
}

// Singleton
let instance: ManusLikeCognition | null = null;

export function getManusLikeCognition(): ManusLikeCognition {
  if (!instance) {
    instance = new ManusLikeCognition();
  }
  return instance;
}

export default ManusLikeCognition;
