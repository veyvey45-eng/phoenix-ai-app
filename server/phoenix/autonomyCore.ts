/**
 * Autonomy Core - Noyau d'Autonomie de Phoenix
 * 
 * Ce module intègre tous les composants d'autonomie pour créer
 * un système unifié égal à Manus AI.
 * 
 * Composants intégrés:
 * 1. ReasoningEngine - Boucle de raisonnement itérative
 * 2. DecisionEngine - Décisions autonomes
 * 3. PlanningEngine - Planification automatique
 * 4. ActionChainer - Chaînage d'actions
 * 5. HypothesisEngine - Gestion des ambiguïtés
 * 6. MetaCognition - Réflexion sur la qualité
 * 7. WorkingMemory - Mémoire de travail
 * 8. ProactiveEngine - Initiative proactive
 */

import { ReasoningEngine, ReasoningResult } from './reasoningEngine';
import { DecisionEngine, getDecisionEngine, DecisionResult } from './decisionEngine';
import { PlanningEngine, getPlanningEngine, PlanningResult, Plan } from './planningEngine';
import { ActionChainer, getActionChainer, ChainExecutionResult } from './actionChainer';
import { HypothesisEngine, getHypothesisEngine, AmbiguityAnalysis } from './hypothesisEngine';
import { MetaCognition, getMetaCognition, QualityAssessment } from './metaCognition';
import { WorkingMemory, getWorkingMemory } from './workingMemory';
import { ProactiveEngine, getProactiveEngine, ProactiveSuggestion } from './proactiveEngine';
import { detectIntent, IntentType } from './intentDetector';

// Types pour le noyau d'autonomie
export interface AutonomousResponse {
  response: string;
  intent: IntentType;
  plan?: Plan;
  reasoning?: ReasoningResult;
  decision?: DecisionResult;
  quality?: QualityAssessment;
  suggestions?: ProactiveSuggestion[];
  metadata: {
    iterations: number;
    confidence: number;
    duration: number;
    wasImproved: boolean;
  };
}

export interface AutonomyConfig {
  enableReasoning: boolean;
  enablePlanning: boolean;
  enableMetaCognition: boolean;
  enableProactiveSuggestions: boolean;
  maxIterations: number;
  minQualityThreshold: number;
}

// Configuration par défaut
const DEFAULT_CONFIG: AutonomyConfig = {
  enableReasoning: true,
  enablePlanning: true,
  enableMetaCognition: true,
  enableProactiveSuggestions: true,
  maxIterations: 10,
  minQualityThreshold: 0.7
};

/**
 * Classe principale du noyau d'autonomie
 */
export class AutonomyCore {
  private config: AutonomyConfig;
  private decisionEngine: DecisionEngine;
  private planningEngine: PlanningEngine;
  private actionChainer: ActionChainer;
  private hypothesisEngine: HypothesisEngine;
  private metaCognition: MetaCognition;
  private workingMemory: WorkingMemory;
  private proactiveEngine: ProactiveEngine;

  constructor(config: Partial<AutonomyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialiser tous les moteurs
    this.decisionEngine = getDecisionEngine();
    this.planningEngine = getPlanningEngine();
    this.actionChainer = getActionChainer();
    this.hypothesisEngine = getHypothesisEngine();
    this.metaCognition = getMetaCognition();
    this.workingMemory = getWorkingMemory();
    this.proactiveEngine = getProactiveEngine();

    console.log('[AutonomyCore] Initialized with config:', this.config);
  }

  /**
   * Traite un message de manière autonome
   */
  async processAutonomously(
    userMessage: string,
    conversationHistory: string[],
    onProgress?: (stage: string, progress: number) => void
  ): Promise<AutonomousResponse> {
    const startTime = Date.now();
    console.log('[AutonomyCore] Processing message autonomously');

    // Notifier le début
    onProgress?.('Analyse', 0.1);

    // 1. Détecter l'intention
    const intentResult = detectIntent(userMessage);
    const intent = intentResult.type;
    console.log('[AutonomyCore] Detected intent:', intent);

    // Stocker dans la mémoire de travail
    this.workingMemory.store('current_intent', intent, { type: 'context' });
    this.workingMemory.store('user_message', userMessage, { type: 'context' });

    // 2. Analyser les ambiguïtés
    onProgress?.('Analyse des ambiguïtés', 0.2);
    const ambiguityAnalysis = await this.hypothesisEngine.analyzeAmbiguities(
      userMessage,
      conversationHistory
    );

    // 3. Prendre une décision autonome
    onProgress?.('Prise de décision', 0.3);
    const decision = await this.decisionEngine.makeDecision({
      userMessage,
      intent,
      conversationHistory,
      currentState: 'processing',
      availableActions: this.getAvailableActions(intent),
      constraints: [],
      userPreferences: {}
    });

    console.log('[AutonomyCore] Decision made:', decision.decision.action);

    // 4. Créer un plan si nécessaire
    let plan: Plan | undefined;
    if (this.config.enablePlanning && this.requiresPlanning(intent)) {
      onProgress?.('Planification', 0.4);
      const planResult = await this.planningEngine.createPlan(userMessage);
      plan = planResult.plan;
      console.log('[AutonomyCore] Plan created with', plan.phases.length, 'phases');
    }

    // 5. Exécuter le raisonnement itératif si nécessaire
    let reasoning: ReasoningResult | undefined;
    if (this.config.enableReasoning && this.requiresReasoning(intent)) {
      onProgress?.('Raisonnement', 0.5);
      const reasoningEngine = new ReasoningEngine(userMessage);
      reasoning = await reasoningEngine.reason(userMessage, this.getAvailableActions(intent));
    }

    // 6. Créer et exécuter la chaîne d'actions
    onProgress?.('Exécution', 0.6);
    const chain = await this.actionChainer.createChain(intent, userMessage);
    const chainResult = await this.actionChainer.executeChain((action, progress) => {
      onProgress?.(`Exécution: ${action.name}`, 0.6 + progress * 0.2);
    });

    // Stocker les résultats
    this.workingMemory.storeResult('chain_execution', chainResult);

    // 7. Générer la réponse
    onProgress?.('Génération de la réponse', 0.8);
    let response = this.generateResponse(intent, chainResult, ambiguityAnalysis);

    // 8. Évaluer et améliorer la qualité si nécessaire
    let quality: QualityAssessment | undefined;
    let wasImproved = false;
    if (this.config.enableMetaCognition) {
      onProgress?.('Évaluation de la qualité', 0.85);
      quality = await this.metaCognition.assessQuality(response, userMessage, conversationHistory);

      if (quality.overallScore < this.config.minQualityThreshold) {
        const improved = await this.metaCognition.improveResponse(response, quality, userMessage);
        if (improved.qualityImprovement > 0) {
          response = improved.improvedResponse;
          wasImproved = true;
        }
      }
    }

    // 9. Générer des suggestions proactives
    let suggestions: ProactiveSuggestion[] | undefined;
    if (this.config.enableProactiveSuggestions) {
      onProgress?.('Génération de suggestions', 0.9);
      suggestions = await this.proactiveEngine.generateSuggestions(
        intent,
        intent,
        userMessage,
        conversationHistory
      );
    }

    // 10. Finaliser
    onProgress?.('Finalisation', 1.0);

    const duration = Date.now() - startTime;
    console.log(`[AutonomyCore] Processing completed in ${duration}ms`);

    return {
      response,
      intent,
      plan,
      reasoning,
      decision,
      quality,
      suggestions,
      metadata: {
        iterations: reasoning?.totalIterations || 1,
        confidence: decision.decision.confidence,
        duration,
        wasImproved
      }
    };
  }

  /**
   * Génère une réponse basée sur les résultats
   */
  private generateResponse(
    intent: IntentType,
    chainResult: ChainExecutionResult,
    ambiguityAnalysis: AmbiguityAnalysis
  ): string {
    // Récupérer les résultats de la mémoire de travail
    const storedResults = this.workingMemory.query({ type: 'result' });

    // Construire la réponse basée sur l'intention
    let response = '';

    if (chainResult.success) {
      response = `J'ai traité votre demande avec succès. `;
      
      if (chainResult.completedActions > 1) {
        response += `${chainResult.completedActions} actions ont été exécutées. `;
      }
    } else {
      response = `J'ai rencontré quelques difficultés mais j'ai fait de mon mieux. `;
      if (chainResult.errors.length > 0) {
        response += `Erreurs: ${chainResult.errors.join(', ')}. `;
      }
    }

    // Ajouter les hypothèses si pertinent
    if (ambiguityAnalysis.hypotheses.length > 0) {
      const mainHypothesis = ambiguityAnalysis.hypotheses[0];
      if (mainHypothesis.confidence < 0.85) {
        response += `\n\nNote: ${mainHypothesis.statement}`;
      }
    }

    return response;
  }

  /**
   * Détermine les actions disponibles pour une intention
   */
  private getAvailableActions(intent: IntentType): string[] {
    const commonActions = ['analyze', 'respond', 'clarify', 'search'];
    
    const intentActions: Record<string, string[]> = {
      'site_creation': ['design', 'generate_html', 'generate_css', 'deploy'],
      'app_creation': ['architecture', 'generate_backend', 'generate_frontend', 'deploy'],
      'image_generation': ['enhance_prompt', 'generate_image', 'edit_image'],
      'code_execution': ['validate_code', 'execute', 'debug'],
      'web_search': ['search', 'extract', 'synthesize'],
      'weather': ['fetch_weather', 'format'],
      'crypto': ['fetch_price', 'analyze_trend'],
      'conversation': ['respond', 'clarify']
    };

    return [...commonActions, ...(intentActions[intent] || [])];
  }

  /**
   * Détermine si une intention nécessite une planification
   */
  private requiresPlanning(intent: IntentType): boolean {
    const planningIntents: IntentType[] = [
      'site_creation',
      'app_creation',
      'code_execution'
    ];
    return planningIntents.includes(intent);
  }

  /**
   * Détermine si une intention nécessite un raisonnement itératif
   */
  private requiresReasoning(intent: IntentType): boolean {
    const reasoningIntents: IntentType[] = [
      'site_creation',
      'app_creation',
      'code_execution',
      'web_search'
    ];
    return reasoningIntents.includes(intent);
  }

  /**
   * Réinitialise tous les moteurs
   */
  reset(): void {
    this.decisionEngine.reset();
    this.planningEngine.reset();
    this.actionChainer.reset();
    this.hypothesisEngine.reset();
    this.metaCognition.reset();
    this.workingMemory.reset();
    this.proactiveEngine.reset();
    console.log('[AutonomyCore] All engines reset');
  }

  /**
   * Obtient un résumé de l'état actuel
   */
  getStatus(): string {
    const memory = this.workingMemory.getSummary();
    const plan = this.planningEngine.getCurrentPlan();
    const progress = this.planningEngine.getProgress();

    return `🤖 **État de Phoenix Autonome**

${memory}

📋 **Plan actuel:** ${plan ? `${plan.goal} (${progress.percentage}%)` : 'Aucun'}

🎯 **Configuration:**
- Raisonnement: ${this.config.enableReasoning ? '✅' : '❌'}
- Planification: ${this.config.enablePlanning ? '✅' : '❌'}
- Méta-cognition: ${this.config.enableMetaCognition ? '✅' : '❌'}
- Suggestions: ${this.config.enableProactiveSuggestions ? '✅' : '❌'}`;
  }
}

// Instance singleton
let autonomyCoreInstance: AutonomyCore | null = null;

export function getAutonomyCore(config?: Partial<AutonomyConfig>): AutonomyCore {
  if (!autonomyCoreInstance) {
    autonomyCoreInstance = new AutonomyCore(config);
  }
  return autonomyCoreInstance;
}

export default AutonomyCore;
