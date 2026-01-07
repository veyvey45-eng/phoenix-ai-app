/**
 * Reasoning Engine - Moteur de Raisonnement Itératif
 * 
 * Ce module implémente la boucle de raisonnement de Manus AI:
 * 1. Analyser le contexte (comprendre l'intention)
 * 2. Penser (réfléchir à l'approche)
 * 3. Sélectionner l'outil (choisir l'action)
 * 4. Exécuter l'action
 * 5. Recevoir l'observation (résultat)
 * 6. Itérer (répéter jusqu'à complétion)
 * 7. Livrer le résultat
 */

import { invokeLLM } from '../_core/llm';

// Types pour le raisonnement
export interface ReasoningStep {
  id: string;
  type: 'analyze' | 'think' | 'select_tool' | 'execute' | 'observe' | 'validate' | 'deliver';
  input: string;
  output: string;
  reasoning: string;
  confidence: number;
  timestamp: number;
  duration: number;
}

export interface ReasoningContext {
  goal: string;
  currentState: string;
  history: ReasoningStep[];
  observations: string[];
  hypotheses: string[];
  constraints: string[];
  successCriteria: string[];
}

export interface ReasoningResult {
  success: boolean;
  finalOutput: string;
  steps: ReasoningStep[];
  totalIterations: number;
  reasoning: string;
  confidence: number;
  improvements?: string[];
}

export interface ToolSelection {
  tool: string;
  parameters: Record<string, unknown>;
  reasoning: string;
  confidence: number;
  alternatives: Array<{ tool: string; reason: string }>;
}

// Configuration du moteur
const MAX_ITERATIONS = 20;
const MIN_CONFIDENCE_THRESHOLD = 0.7;
const REFLECTION_INTERVAL = 3; // Réfléchir tous les 3 steps

/**
 * Classe principale du moteur de raisonnement
 */
export class ReasoningEngine {
  private context: ReasoningContext;
  private currentIteration: number = 0;
  private onProgress?: (step: ReasoningStep) => void;

  constructor(goal: string, onProgress?: (step: ReasoningStep) => void) {
    this.context = {
      goal,
      currentState: 'initial',
      history: [],
      observations: [],
      hypotheses: [],
      constraints: [],
      successCriteria: []
    };
    this.onProgress = onProgress;
  }

  /**
   * Exécute la boucle de raisonnement complète
   */
  async reason(userMessage: string, availableTools: string[]): Promise<ReasoningResult> {
    console.log('[ReasoningEngine] Starting reasoning loop for:', userMessage.substring(0, 100));
    
    // Phase 1: Analyser le contexte
    const analysis = await this.analyzeContext(userMessage);
    this.addStep(analysis);
    
    // Phase 2: Définir les critères de succès
    const criteria = await this.defineSuccessCriteria(userMessage, analysis);
    this.context.successCriteria = criteria;
    
    // Boucle principale de raisonnement
    while (this.currentIteration < MAX_ITERATIONS) {
      this.currentIteration++;
      console.log(`[ReasoningEngine] Iteration ${this.currentIteration}/${MAX_ITERATIONS}`);
      
      // Phase 3: Penser à l'approche
      const thinking = await this.think();
      this.addStep(thinking);
      
      // Phase 4: Sélectionner l'outil/action
      const toolSelection = await this.selectTool(availableTools);
      this.addStep({
        id: `step_${Date.now()}`,
        type: 'select_tool',
        input: JSON.stringify(availableTools),
        output: JSON.stringify(toolSelection),
        reasoning: toolSelection.reasoning,
        confidence: toolSelection.confidence,
        timestamp: Date.now(),
        duration: 0
      });
      
      // Phase 5: Exécuter l'action (simulé - sera connecté aux vrais outils)
      const execution = await this.executeAction(toolSelection);
      this.addStep(execution);
      
      // Phase 6: Observer le résultat
      const observation = await this.observe(execution.output);
      this.addStep(observation);
      this.context.observations.push(observation.output);
      
      // Réflexion périodique
      if (this.currentIteration % REFLECTION_INTERVAL === 0) {
        const reflection = await this.reflect();
        if (reflection.shouldAdjust) {
          console.log('[ReasoningEngine] Adjusting approach based on reflection');
          this.context.hypotheses.push(reflection.newHypothesis);
        }
      }
      
      // Phase 7: Valider si le but est atteint
      const validation = await this.validate();
      this.addStep(validation);
      
      if (validation.confidence >= MIN_CONFIDENCE_THRESHOLD && validation.output === 'success') {
        console.log('[ReasoningEngine] Goal achieved with confidence:', validation.confidence);
        break;
      }
      
      // Mettre à jour l'état courant
      this.context.currentState = observation.output;
    }
    
    // Phase finale: Livrer le résultat
    return this.deliverResult();
  }

  /**
   * Phase 1: Analyser le contexte et comprendre l'intention
   */
  private async analyzeContext(userMessage: string): Promise<ReasoningStep> {
    const startTime = Date.now();
    
    const prompt = `Tu es un moteur de raisonnement. Analyse cette demande et identifie:
1. L'intention principale de l'utilisateur
2. Les sous-tâches nécessaires
3. Les informations manquantes
4. Les contraintes implicites

Demande: "${userMessage}"

Réponds en JSON:
{
  "intention": "...",
  "subtasks": ["...", "..."],
  "missingInfo": ["...", "..."],
  "constraints": ["...", "..."],
  "complexity": "simple|moderate|complex",
  "estimatedSteps": number
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu es un analyseur de contexte expert.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const analysisContent = response.choices[0]?.message?.content;
      const analysis = typeof analysisContent === 'string' ? analysisContent : '{}';
      
      return {
        id: `analyze_${Date.now()}`,
        type: 'analyze',
        input: userMessage,
        output: analysis,
        reasoning: 'Analyse du contexte et de l\'intention utilisateur',
        confidence: 0.9,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        id: `analyze_${Date.now()}`,
        type: 'analyze',
        input: userMessage,
        output: JSON.stringify({ intention: userMessage, subtasks: [], complexity: 'moderate' }),
        reasoning: 'Analyse basique due à une erreur',
        confidence: 0.5,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Définir les critères de succès
   */
  private async defineSuccessCriteria(userMessage: string, analysis: ReasoningStep): Promise<string[]> {
    const prompt = `Basé sur cette demande et analyse, définis les critères de succès:

Demande: "${userMessage}"
Analyse: ${analysis.output}

Liste 3-5 critères mesurables qui déterminent si la tâche est réussie.
Réponds en JSON: { "criteria": ["...", "..."] }`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu définis des critères de succès clairs.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const criteriaContent = response.choices[0]?.message?.content;
      if (typeof criteriaContent === 'string') {
        const result = JSON.parse(criteriaContent);
        return result.criteria || [];
      }
      return ['Répondre à la demande de l\'utilisateur'];
    } catch {
      return ['Répondre à la demande de l\'utilisateur', 'Fournir une réponse complète'];
    }
  }

  /**
   * Phase 3: Penser à l'approche
   */
  private async think(): Promise<ReasoningStep> {
    const startTime = Date.now();
    
    const historyContext = this.context.history
      .slice(-5)
      .map(s => `[${s.type}] ${s.output.substring(0, 100)}`)
      .join('\n');

    const prompt = `Tu réfléchis à la meilleure approche pour atteindre l'objectif.

Objectif: ${this.context.goal}
État actuel: ${this.context.currentState}
Historique récent:
${historyContext}

Observations: ${this.context.observations.slice(-3).join(', ')}

Réfléchis à:
1. Quelle est la prochaine étape logique?
2. Quels risques dois-je anticiper?
3. Y a-t-il une meilleure approche?

Réponds en JSON:
{
  "nextStep": "...",
  "reasoning": "...",
  "risks": ["..."],
  "alternatives": ["..."],
  "confidence": 0.0-1.0
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu es un penseur stratégique qui planifie les actions.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const thinkContent = response.choices[0]?.message?.content;
      const thinking = typeof thinkContent === 'string' ? JSON.parse(thinkContent) : {};
      
      return {
        id: `think_${Date.now()}`,
        type: 'think',
        input: this.context.currentState,
        output: JSON.stringify(thinking),
        reasoning: thinking.reasoning || 'Réflexion sur l\'approche',
        confidence: thinking.confidence || 0.7,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    } catch {
      return {
        id: `think_${Date.now()}`,
        type: 'think',
        input: this.context.currentState,
        output: '{"nextStep": "continuer", "reasoning": "approche par défaut"}',
        reasoning: 'Réflexion par défaut',
        confidence: 0.5,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Phase 4: Sélectionner l'outil approprié
   */
  private async selectTool(availableTools: string[]): Promise<ToolSelection> {
    const lastThinking = this.context.history.filter(s => s.type === 'think').pop();
    
    const prompt = `Sélectionne le meilleur outil pour la prochaine action.

Objectif: ${this.context.goal}
État actuel: ${this.context.currentState}
Réflexion précédente: ${lastThinking?.output || 'aucune'}

Outils disponibles: ${availableTools.join(', ')}

Réponds en JSON:
{
  "tool": "nom_de_l_outil",
  "parameters": {},
  "reasoning": "pourquoi cet outil",
  "confidence": 0.0-1.0,
  "alternatives": [{"tool": "...", "reason": "..."}]
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu sélectionnes les outils optimaux.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        return JSON.parse(content);
      }
      return {
        tool: availableTools[0] || 'conversation',
        parameters: {},
        reasoning: 'Sélection par défaut',
        confidence: 0.5,
        alternatives: []
      };
    } catch {
      return {
        tool: availableTools[0] || 'conversation',
        parameters: {},
        reasoning: 'Sélection par défaut',
        confidence: 0.5,
        alternatives: []
      };
    }
  }

  /**
   * Phase 5: Exécuter l'action
   */
  private async executeAction(toolSelection: ToolSelection): Promise<ReasoningStep> {
    const startTime = Date.now();
    
    // Cette méthode sera connectée aux vrais outils de Phoenix
    // Pour l'instant, elle simule l'exécution
    
    return {
      id: `execute_${Date.now()}`,
      type: 'execute',
      input: JSON.stringify(toolSelection),
      output: `Action "${toolSelection.tool}" exécutée avec succès`,
      reasoning: toolSelection.reasoning,
      confidence: toolSelection.confidence,
      timestamp: Date.now(),
      duration: Date.now() - startTime
    };
  }

  /**
   * Phase 6: Observer le résultat
   */
  private async observe(executionResult: string): Promise<ReasoningStep> {
    const startTime = Date.now();
    
    const prompt = `Observe et analyse ce résultat d'exécution:

Résultat: ${executionResult}
Objectif: ${this.context.goal}

Réponds en JSON:
{
  "observation": "ce que tu observes",
  "progress": "avancement vers l'objectif (0-100%)",
  "issues": ["problèmes détectés"],
  "nextNeeded": "ce qui est encore nécessaire"
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu observes et analyses les résultats.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const obsContent = response.choices[0]?.message?.content;
      const observation = typeof obsContent === 'string' ? obsContent : '{}';
      
      return {
        id: `observe_${Date.now()}`,
        type: 'observe',
        input: executionResult,
        output: observation,
        reasoning: 'Observation du résultat',
        confidence: 0.8,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    } catch {
      return {
        id: `observe_${Date.now()}`,
        type: 'observe',
        input: executionResult,
        output: JSON.stringify({ observation: executionResult, progress: 50 }),
        reasoning: 'Observation basique',
        confidence: 0.5,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Réflexion périodique sur l'approche
   */
  private async reflect(): Promise<{ shouldAdjust: boolean; newHypothesis: string }> {
    const recentSteps = this.context.history.slice(-5);
    const recentObservations = this.context.observations.slice(-3);
    
    const prompt = `Réfléchis sur ta progression:

Étapes récentes: ${recentSteps.map(s => s.type).join(' -> ')}
Observations: ${recentObservations.join(', ')}
Objectif: ${this.context.goal}

L'approche actuelle est-elle efficace? Dois-tu ajuster?

Réponds en JSON:
{
  "shouldAdjust": true/false,
  "reason": "...",
  "newHypothesis": "nouvelle approche si ajustement nécessaire"
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu réfléchis sur ta propre performance.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        return JSON.parse(content);
      }
      return { shouldAdjust: false, newHypothesis: '' };
    } catch {
      return { shouldAdjust: false, newHypothesis: '' };
    }
  }

  /**
   * Phase 7: Valider si le but est atteint
   */
  private async validate(): Promise<ReasoningStep> {
    const startTime = Date.now();
    
    const prompt = `Valide si l'objectif est atteint:

Objectif: ${this.context.goal}
Critères de succès: ${this.context.successCriteria.join(', ')}
Observations: ${this.context.observations.slice(-3).join(', ')}

Réponds en JSON:
{
  "isComplete": true/false,
  "criteriamet": ["critères satisfaits"],
  "criteriaMissing": ["critères non satisfaits"],
  "confidence": 0.0-1.0,
  "recommendation": "continuer/terminer"
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu valides l\'atteinte des objectifs.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      const validation = typeof content === 'string' ? JSON.parse(content) : {};
      
      return {
        id: `validate_${Date.now()}`,
        type: 'validate',
        input: this.context.goal,
        output: validation.isComplete ? 'success' : 'in_progress',
        reasoning: validation.recommendation || 'Validation',
        confidence: validation.confidence || 0.5,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    } catch {
      return {
        id: `validate_${Date.now()}`,
        type: 'validate',
        input: this.context.goal,
        output: 'in_progress',
        reasoning: 'Validation par défaut',
        confidence: 0.5,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Livrer le résultat final
   */
  private deliverResult(): ReasoningResult {
    const lastValidation = this.context.history.filter(s => s.type === 'validate').pop();
    const success = lastValidation?.output === 'success';
    
    // Compiler le résultat final
    const finalOutput = this.context.observations.join('\n\n');
    
    // Générer des suggestions d'amélioration
    const improvements = this.context.hypotheses.length > 0 
      ? this.context.hypotheses 
      : ['Aucune amélioration suggérée'];

    return {
      success,
      finalOutput,
      steps: this.context.history,
      totalIterations: this.currentIteration,
      reasoning: `Raisonnement complété en ${this.currentIteration} itérations`,
      confidence: lastValidation?.confidence || 0.5,
      improvements
    };
  }

  /**
   * Ajouter une étape à l'historique
   */
  private addStep(step: ReasoningStep): void {
    this.context.history.push(step);
    if (this.onProgress) {
      this.onProgress(step);
    }
  }

  /**
   * Obtenir le contexte actuel
   */
  getContext(): ReasoningContext {
    return { ...this.context };
  }
}

/**
 * Fonction utilitaire pour créer et exécuter un raisonnement
 */
export async function executeReasoning(
  goal: string,
  userMessage: string,
  availableTools: string[],
  onProgress?: (step: ReasoningStep) => void
): Promise<ReasoningResult> {
  const engine = new ReasoningEngine(goal, onProgress);
  return engine.reason(userMessage, availableTools);
}

export default ReasoningEngine;
