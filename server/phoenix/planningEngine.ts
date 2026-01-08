/**
 * Planning Engine - Moteur de Planification Automatique
 * 
 * Ce module crée automatiquement des plans structurés avant chaque tâche,
 * exactement comme Manus AI le fait.
 * 
 * Fonctionnalités:
 * 1. Création automatique de plans multi-phases
 * 2. Révision dynamique du plan en cours de route
 * 3. Suivi de l'avancement
 * 4. Adaptation aux nouvelles informations
 */

import { invokeLLM } from '../_core/llm';

// Types pour la planification
export interface PlanPhase {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  estimatedDuration: number; // en secondes
  actualDuration?: number;
  dependencies: number[]; // IDs des phases dépendantes
  outputs: string[];
  startedAt?: number;
  completedAt?: number;
}

export interface Plan {
  id: string;
  goal: string;
  phases: PlanPhase[];
  currentPhaseId: number;
  status: 'created' | 'in_progress' | 'completed' | 'failed' | 'revised';
  createdAt: number;
  updatedAt: number;
  totalEstimatedDuration: number;
  revisions: PlanRevision[];
}

export interface PlanRevision {
  timestamp: number;
  reason: string;
  changes: string[];
  previousPhaseCount: number;
  newPhaseCount: number;
}

export interface PlanningResult {
  plan: Plan;
  summary: string;
  estimatedTime: string;
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Classe principale du moteur de planification
 */
export class PlanningEngine {
  private currentPlan: Plan | null = null;
  private planHistory: Plan[] = [];

  constructor() {
    this.currentPlan = null;
    this.planHistory = [];
  }

  /**
   * Crée un plan automatique pour une tâche
   */
  async createPlan(goal: string, context?: string): Promise<PlanningResult> {
    console.log('[PlanningEngine] Creating plan for:', goal.substring(0, 100));

    // Analyser la complexité de la tâche
    const complexity = await this.analyzeComplexity(goal, context);
    
    // Générer les phases du plan
    const phases = await this.generatePhases(goal, context, complexity);
    
    // Créer le plan
    const plan: Plan = {
      id: `plan_${Date.now()}`,
      goal,
      phases,
      currentPhaseId: 1,
      status: 'created',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalEstimatedDuration: phases.reduce((sum, p) => sum + p.estimatedDuration, 0),
      revisions: []
    };

    this.currentPlan = plan;
    this.planHistory.push(plan);

    // Générer le résumé
    const summary = this.generateSummary(plan);
    const estimatedTime = this.formatDuration(plan.totalEstimatedDuration);

    return {
      plan,
      summary,
      estimatedTime,
      complexity
    };
  }

  /**
   * Analyse la complexité de la tâche
   */
  private async analyzeComplexity(
    goal: string,
    context?: string
  ): Promise<'simple' | 'moderate' | 'complex'> {
    // AMÉLIORÉ: Détection automatique des tâches complexes par mots-clés
    const complexKeywords = /application|projet|site\s+web|système|architecture|multi|complet|détaillé|20\+|plusieurs|\d{2,}\s*étapes/i;
    const moderateKeywords = /crée|génère|analyse|recherche|rapport|article/i;
    
    // Vérification rapide par mots-clés
    if (complexKeywords.test(goal)) {
      console.log('[PlanningEngine] Complex task detected by keywords');
      return 'complex';
    }
    
    const prompt = `Analyse la complexité de cette tâche:

Objectif: "${goal}"
${context ? `Contexte: ${context}` : ''}

Critères AMÉLIORÉS:
- Simple: 1-3 étapes, tâche unique, < 1 minute (ex: question simple, calcul)
- Modérée: 4-10 étapes, quelques sous-tâches, 1-10 minutes (ex: recherche, article)
- Complexe: 10-25 étapes, nombreuses sous-tâches, > 10 minutes (ex: application, projet complet)

Réponds en JSON: { "complexity": "simple|moderate|complex", "reason": "...", "estimatedPhases": <nombre> }`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu analyses la complexité des tâches.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);
        return result.complexity || 'moderate';
      }
      return 'moderate';
    } catch {
      // Estimation basée sur la longueur du message
      if (goal.length < 50) return 'simple';
      if (goal.length < 200) return 'moderate';
      return 'complex';
    }
  }

  /**
   * Génère les phases du plan
   */
  private async generatePhases(
    goal: string,
    context: string | undefined,
    complexity: 'simple' | 'moderate' | 'complex'
  ): Promise<PlanPhase[]> {
    // AMÉLIORÉ: Support de 2 à 25 phases selon la complexité
    // Simple: 2-4 phases, Moderate: 5-10 phases, Complex: 10-25 phases
    const phaseCount = complexity === 'simple' ? 3 : complexity === 'moderate' ? 7 : 15;

    const prompt = `Crée un plan détaillé pour cette tâche:

Objectif: "${goal}"
${context ? `Contexte: ${context}` : ''}
Complexité: ${complexity}
Nombre de phases recommandé: ${phaseCount}

Pour chaque phase, fournis:
- Un titre concis
- Une description détaillée
- La durée estimée en secondes
- Les dépendances (IDs des phases précédentes requises)
- Les outputs attendus

Réponds en JSON:
{
  "phases": [
    {
      "id": 1,
      "title": "...",
      "description": "...",
      "estimatedDuration": 30,
      "dependencies": [],
      "outputs": ["..."]
    }
  ]
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu crées des plans de projet structurés et efficaces.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);
        return (result.phases || []).map((p: Partial<PlanPhase>, index: number) => ({
          id: p.id || index + 1,
          title: p.title || `Phase ${index + 1}`,
          description: p.description || '',
          status: 'pending' as const,
          estimatedDuration: p.estimatedDuration || 30,
          dependencies: p.dependencies || [],
          outputs: p.outputs || []
        }));
      }
      return this.createDefaultPhases(goal, phaseCount);
    } catch {
      return this.createDefaultPhases(goal, phaseCount);
    }
  }

  /**
   * Crée des phases par défaut
   */
  private createDefaultPhases(goal: string, count: number): PlanPhase[] {
    const defaultPhases: PlanPhase[] = [
      {
        id: 1,
        title: 'Analyse de la demande',
        description: 'Comprendre et analyser la demande utilisateur',
        status: 'pending',
        estimatedDuration: 10,
        dependencies: [],
        outputs: ['Analyse complète']
      },
      {
        id: 2,
        title: 'Exécution principale',
        description: 'Exécuter la tâche principale',
        status: 'pending',
        estimatedDuration: 60,
        dependencies: [1],
        outputs: ['Résultat principal']
      }
    ];

    if (count >= 4) {
      defaultPhases.push(
        {
          id: 3,
          title: 'Validation',
          description: 'Vérifier la qualité du résultat',
          status: 'pending',
          estimatedDuration: 15,
          dependencies: [2],
          outputs: ['Validation complète']
        },
        {
          id: 4,
          title: 'Livraison',
          description: 'Présenter le résultat à l\'utilisateur',
          status: 'pending',
          estimatedDuration: 10,
          dependencies: [3],
          outputs: ['Résultat livré']
        }
      );
    }

    if (count >= 7) {
      defaultPhases.splice(2, 0,
        {
          id: 3,
          title: 'Recherche d\'informations',
          description: 'Collecter les informations nécessaires',
          status: 'pending',
          estimatedDuration: 30,
          dependencies: [1],
          outputs: ['Informations collectées']
        },
        {
          id: 4,
          title: 'Planification détaillée',
          description: 'Planifier les étapes d\'exécution',
          status: 'pending',
          estimatedDuration: 15,
          dependencies: [3],
          outputs: ['Plan détaillé']
        },
        {
          id: 5,
          title: 'Implémentation',
          description: 'Implémenter la solution',
          status: 'pending',
          estimatedDuration: 90,
          dependencies: [4],
          outputs: ['Solution implémentée']
        }
      );
      // Réajuster les IDs
      defaultPhases.forEach((p, i) => { p.id = i + 1; });
    }

    return defaultPhases;
  }

  /**
   * Avance à la phase suivante
   */
  advancePhase(): PlanPhase | null {
    if (!this.currentPlan) return null;

    const currentPhase = this.currentPlan.phases.find(
      p => p.id === this.currentPlan!.currentPhaseId
    );

    if (currentPhase) {
      currentPhase.status = 'completed';
      currentPhase.completedAt = Date.now();
      if (currentPhase.startedAt) {
        currentPhase.actualDuration = (currentPhase.completedAt - currentPhase.startedAt) / 1000;
      }
    }

    // Trouver la prochaine phase
    const nextPhase = this.currentPlan.phases.find(
      p => p.status === 'pending' && this.areDependenciesMet(p)
    );

    if (nextPhase) {
      this.currentPlan.currentPhaseId = nextPhase.id;
      nextPhase.status = 'in_progress';
      nextPhase.startedAt = Date.now();
      this.currentPlan.status = 'in_progress';
      this.currentPlan.updatedAt = Date.now();
      return nextPhase;
    }

    // Toutes les phases sont complétées
    this.currentPlan.status = 'completed';
    this.currentPlan.updatedAt = Date.now();
    return null;
  }

  /**
   * Vérifie si les dépendances d'une phase sont satisfaites
   */
  private areDependenciesMet(phase: PlanPhase): boolean {
    if (!this.currentPlan) return false;
    
    return phase.dependencies.every(depId => {
      const dep = this.currentPlan!.phases.find(p => p.id === depId);
      return dep && dep.status === 'completed';
    });
  }

  /**
   * Révise le plan en cours de route
   */
  async revisePlan(reason: string, newInfo?: string): Promise<Plan | null> {
    if (!this.currentPlan) return null;

    console.log('[PlanningEngine] Revising plan:', reason);

    const previousPhaseCount = this.currentPlan.phases.length;

    const prompt = `Révise ce plan basé sur les nouvelles informations:

Plan actuel:
${this.currentPlan.phases.map(p => `- ${p.id}. ${p.title} (${p.status})`).join('\n')}

Raison de la révision: ${reason}
${newInfo ? `Nouvelles informations: ${newInfo}` : ''}

Objectif original: ${this.currentPlan.goal}

Génère un plan révisé qui:
1. Conserve les phases complétées
2. Ajuste les phases restantes
3. Ajoute de nouvelles phases si nécessaire

Réponds en JSON:
{
  "phases": [...],
  "changes": ["changement 1", "changement 2"]
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu révises des plans de projet.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);
        
        // Conserver les phases complétées
        const completedPhases = this.currentPlan.phases.filter(p => p.status === 'completed');
        const newPhases = result.phases || [];

        // Fusionner
        this.currentPlan.phases = [
          ...completedPhases,
          ...newPhases.filter((p: PlanPhase) => !completedPhases.find(cp => cp.id === p.id))
        ];

        // Enregistrer la révision
        this.currentPlan.revisions.push({
          timestamp: Date.now(),
          reason,
          changes: result.changes || ['Plan révisé'],
          previousPhaseCount,
          newPhaseCount: this.currentPlan.phases.length
        });

        this.currentPlan.status = 'revised';
        this.currentPlan.updatedAt = Date.now();

        return this.currentPlan;
      }
    } catch (error) {
      console.error('[PlanningEngine] Error revising plan:', error);
    }

    return this.currentPlan;
  }

  /**
   * Génère un résumé du plan
   */
  private generateSummary(plan: Plan): string {
    const phaseList = plan.phases
      .map(p => `${p.id}. ${p.title}`)
      .join('\n');

    return `📋 **Plan créé pour:** ${plan.goal}

**Phases (${plan.phases.length}):**
${phaseList}

**Durée estimée:** ${this.formatDuration(plan.totalEstimatedDuration)}`;
  }

  /**
   * Formate une durée en texte lisible
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds} secondes`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    return `${Math.round(seconds / 3600)} heures`;
  }

  /**
   * Obtient le plan actuel
   */
  getCurrentPlan(): Plan | null {
    return this.currentPlan;
  }

  /**
   * Obtient la phase actuelle
   */
  getCurrentPhase(): PlanPhase | null {
    if (!this.currentPlan) return null;
    return this.currentPlan.phases.find(p => p.id === this.currentPlan!.currentPhaseId) || null;
  }

  /**
   * Obtient l'avancement du plan
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    if (!this.currentPlan) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const completed = this.currentPlan.phases.filter(p => p.status === 'completed').length;
    const total = this.currentPlan.phases.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }

  /**
   * Marque une phase comme échouée
   */
  failPhase(phaseId: number, reason: string): void {
    if (!this.currentPlan) return;

    const phase = this.currentPlan.phases.find(p => p.id === phaseId);
    if (phase) {
      phase.status = 'failed';
      phase.completedAt = Date.now();
      console.log(`[PlanningEngine] Phase ${phaseId} failed:`, reason);
    }
  }

  /**
   * Réinitialise le moteur
   */
  reset(): void {
    this.currentPlan = null;
  }

  /**
   * Obtient l'historique des plans
   */
  getPlanHistory(): Plan[] {
    return [...this.planHistory];
  }
}

// Instance singleton
let planningEngineInstance: PlanningEngine | null = null;

export function getPlanningEngine(): PlanningEngine {
  if (!planningEngineInstance) {
    planningEngineInstance = new PlanningEngine();
  }
  return planningEngineInstance;
}

export default PlanningEngine;
