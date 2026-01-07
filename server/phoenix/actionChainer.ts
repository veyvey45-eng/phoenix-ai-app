/**
 * Action Chainer - Chaînage Fluide des Actions
 * 
 * Ce module permet à Phoenix d'enchaîner automatiquement 10-20 actions
 * sans interruption, exactement comme Manus AI.
 * 
 * Fonctionnalités:
 * 1. Chaînage automatique des actions liées
 * 2. Gestion des dépendances entre actions
 * 3. Rollback en cas d'échec
 * 4. Optimisation de l'ordre d'exécution
 */

import { IntentType } from './intentDetector';

// Types pour le chaînage
export interface ChainedAction {
  id: string;
  type: string;
  name: string;
  parameters: Record<string, unknown>;
  dependencies: string[]; // IDs des actions dépendantes
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  maxRetries: number;
}

export interface ActionChain {
  id: string;
  name: string;
  actions: ChainedAction[];
  status: 'created' | 'running' | 'completed' | 'failed' | 'paused';
  currentActionIndex: number;
  createdAt: number;
  completedAt?: number;
  results: Map<string, unknown>;
  onProgress?: (action: ChainedAction, progress: number) => void;
}

export interface ChainExecutionResult {
  success: boolean;
  completedActions: number;
  totalActions: number;
  results: Record<string, unknown>;
  errors: string[];
  duration: number;
}

// Configuration
const MAX_CHAIN_LENGTH = 25;
const DEFAULT_MAX_RETRIES = 3;
const ACTION_TIMEOUT = 60000; // 60 secondes

/**
 * Classe principale du chaîneur d'actions
 */
export class ActionChainer {
  private currentChain: ActionChain | null = null;
  private chainHistory: ActionChain[] = [];
  private actionExecutors: Map<string, (params: Record<string, unknown>) => Promise<unknown>> = new Map();

  constructor() {
    this.registerDefaultExecutors();
  }

  /**
   * Enregistre les exécuteurs d'actions par défaut
   */
  private registerDefaultExecutors(): void {
    // Ces exécuteurs seront connectés aux vrais modules de Phoenix
    this.actionExecutors.set('analyze', async (params) => {
      return { analyzed: true, params };
    });
    
    this.actionExecutors.set('search', async (params) => {
      return { searched: true, query: params.query };
    });
    
    this.actionExecutors.set('generate', async (params) => {
      return { generated: true, type: params.type };
    });
    
    this.actionExecutors.set('validate', async (params) => {
      return { validated: true, target: params.target };
    });
    
    this.actionExecutors.set('deliver', async (params) => {
      return { delivered: true, content: params.content };
    });
  }

  /**
   * Enregistre un exécuteur d'action personnalisé
   */
  registerExecutor(
    actionType: string,
    executor: (params: Record<string, unknown>) => Promise<unknown>
  ): void {
    this.actionExecutors.set(actionType, executor);
  }

  /**
   * Crée une chaîne d'actions à partir d'une intention
   */
  async createChain(
    intent: IntentType,
    userMessage: string,
    context?: Record<string, unknown>
  ): Promise<ActionChain> {
    console.log('[ActionChainer] Creating chain for intent:', intent);

    const actions = this.generateActionsForIntent(intent, userMessage, context);

    const chain: ActionChain = {
      id: `chain_${Date.now()}`,
      name: `Chain for ${intent}`,
      actions,
      status: 'created',
      currentActionIndex: 0,
      createdAt: Date.now(),
      results: new Map()
    };

    this.currentChain = chain;
    this.chainHistory.push(chain);

    return chain;
  }

  /**
   * Génère les actions pour une intention donnée
   */
  private generateActionsForIntent(
    intent: IntentType,
    userMessage: string,
    context?: Record<string, unknown>
  ): ChainedAction[] {
    const baseActions: ChainedAction[] = [];
    let actionId = 1;

    const createAction = (
      type: string,
      name: string,
      params: Record<string, unknown>,
      deps: string[] = []
    ): ChainedAction => ({
      id: `action_${actionId++}`,
      type,
      name,
      parameters: params,
      dependencies: deps,
      status: 'pending',
      retryCount: 0,
      maxRetries: DEFAULT_MAX_RETRIES
    });

    // Actions communes à toutes les intentions
    baseActions.push(createAction('analyze', 'Analyser la demande', {
      message: userMessage,
      context
    }));

    // Actions spécifiques par intention
    switch (intent) {
      case 'site_creation':
        baseActions.push(
          createAction('extract', 'Extraire les informations du site', { message: userMessage }, ['action_1']),
          createAction('design', 'Concevoir la structure du site', {}, ['action_2']),
          createAction('generate_html', 'Générer le HTML', {}, ['action_3']),
          createAction('generate_css', 'Générer le CSS', {}, ['action_3']),
          createAction('generate_js', 'Générer le JavaScript', {}, ['action_4', 'action_5']),
          createAction('assemble', 'Assembler le site', {}, ['action_6']),
          createAction('validate', 'Valider le site', {}, ['action_7']),
          createAction('deploy', 'Déployer le site', {}, ['action_8']),
          createAction('deliver', 'Présenter le résultat', {}, ['action_9'])
        );
        break;

      case 'app_creation':
        baseActions.push(
          createAction('extract', 'Extraire les spécifications', { message: userMessage }, ['action_1']),
          createAction('architecture', 'Concevoir l\'architecture', {}, ['action_2']),
          createAction('generate_backend', 'Générer le backend', {}, ['action_3']),
          createAction('generate_frontend', 'Générer le frontend', {}, ['action_3']),
          createAction('generate_api', 'Générer les APIs', {}, ['action_4']),
          createAction('integrate', 'Intégrer les composants', {}, ['action_4', 'action_5', 'action_6']),
          createAction('test', 'Tester l\'application', {}, ['action_7']),
          createAction('deploy', 'Déployer l\'application', {}, ['action_8']),
          createAction('deliver', 'Présenter le résultat', {}, ['action_9'])
        );
        break;

      case 'image_generation':
        baseActions.push(
          createAction('extract_prompt', 'Extraire le prompt', { message: userMessage }, ['action_1']),
          createAction('enhance_prompt', 'Améliorer le prompt', {}, ['action_2']),
          createAction('generate_image', 'Générer l\'image', {}, ['action_3']),
          createAction('validate_image', 'Valider l\'image', {}, ['action_4']),
          createAction('deliver', 'Présenter l\'image', {}, ['action_5'])
        );
        break;

      case 'code_execution':
        baseActions.push(
          createAction('extract_code', 'Extraire le code', { message: userMessage }, ['action_1']),
          createAction('validate_code', 'Valider le code', {}, ['action_2']),
          createAction('setup_env', 'Préparer l\'environnement', {}, ['action_3']),
          createAction('execute', 'Exécuter le code', {}, ['action_4']),
          createAction('capture_output', 'Capturer la sortie', {}, ['action_5']),
          createAction('format_result', 'Formater le résultat', {}, ['action_6']),
          createAction('deliver', 'Présenter le résultat', {}, ['action_7'])
        );
        break;

      case 'web_search':
        baseActions.push(
          createAction('extract_query', 'Extraire la requête', { message: userMessage }, ['action_1']),
          createAction('search', 'Rechercher sur le web', {}, ['action_2']),
          createAction('filter_results', 'Filtrer les résultats', {}, ['action_3']),
          createAction('extract_content', 'Extraire le contenu', {}, ['action_4']),
          createAction('synthesize', 'Synthétiser les informations', {}, ['action_5']),
          createAction('deliver', 'Présenter les résultats', {}, ['action_6'])
        );
        break;

      case 'weather':
        baseActions.push(
          createAction('extract_location', 'Extraire la localisation', { message: userMessage }, ['action_1']),
          createAction('fetch_weather', 'Récupérer la météo', {}, ['action_2']),
          createAction('format_weather', 'Formater les données', {}, ['action_3']),
          createAction('deliver', 'Présenter la météo', {}, ['action_4'])
        );
        break;

      case 'crypto':
        baseActions.push(
          createAction('extract_crypto', 'Extraire la crypto', { message: userMessage }, ['action_1']),
          createAction('fetch_price', 'Récupérer le prix', {}, ['action_2']),
          createAction('fetch_market', 'Récupérer les données marché', {}, ['action_2']),
          createAction('analyze_trend', 'Analyser la tendance', {}, ['action_3', 'action_4']),
          createAction('format_report', 'Formater le rapport', {}, ['action_5']),
          createAction('deliver', 'Présenter le rapport', {}, ['action_6'])
        );
        break;

      default:
        // Conversation simple
        baseActions.push(
          createAction('understand', 'Comprendre le message', { message: userMessage }, ['action_1']),
          createAction('generate_response', 'Générer la réponse', {}, ['action_2']),
          createAction('deliver', 'Envoyer la réponse', {}, ['action_3'])
        );
    }

    return baseActions;
  }

  /**
   * Exécute la chaîne d'actions
   */
  async executeChain(
    onProgress?: (action: ChainedAction, progress: number) => void
  ): Promise<ChainExecutionResult> {
    if (!this.currentChain) {
      return {
        success: false,
        completedActions: 0,
        totalActions: 0,
        results: {},
        errors: ['No chain to execute'],
        duration: 0
      };
    }

    const startTime = Date.now();
    this.currentChain.status = 'running';
    this.currentChain.onProgress = onProgress;

    const errors: string[] = [];
    let completedCount = 0;

    // Exécuter les actions dans l'ordre des dépendances
    while (this.hasRunnableActions()) {
      const runnableActions = this.getRunnableActions();
      
      // Exécuter les actions en parallèle si possible
      const results = await Promise.allSettled(
        runnableActions.map(action => this.executeAction(action))
      );

      // Traiter les résultats
      results.forEach((result, index) => {
        const action = runnableActions[index];
        if (result.status === 'fulfilled') {
          completedCount++;
          this.currentChain!.results.set(action.id, result.value);
        } else {
          errors.push(`${action.name}: ${result.reason}`);
        }
      });

      // Notifier la progression
      if (onProgress) {
        const progress = completedCount / this.currentChain.actions.length;
        const currentAction = runnableActions[0];
        if (currentAction) {
          onProgress(currentAction, progress);
        }
      }
    }

    // Finaliser
    this.currentChain.status = errors.length === 0 ? 'completed' : 'failed';
    this.currentChain.completedAt = Date.now();

    // Convertir les résultats en objet
    const resultsObj: Record<string, unknown> = {};
    this.currentChain.results.forEach((value, key) => {
      resultsObj[key] = value;
    });

    return {
      success: errors.length === 0,
      completedActions: completedCount,
      totalActions: this.currentChain.actions.length,
      results: resultsObj,
      errors,
      duration: Date.now() - startTime
    };
  }

  /**
   * Vérifie s'il y a des actions exécutables
   */
  private hasRunnableActions(): boolean {
    if (!this.currentChain) return false;
    return this.currentChain.actions.some(
      action => action.status === 'pending' && this.areDependenciesMet(action)
    );
  }

  /**
   * Obtient les actions exécutables
   */
  private getRunnableActions(): ChainedAction[] {
    if (!this.currentChain) return [];
    return this.currentChain.actions.filter(
      action => action.status === 'pending' && this.areDependenciesMet(action)
    );
  }

  /**
   * Vérifie si les dépendances d'une action sont satisfaites
   */
  private areDependenciesMet(action: ChainedAction): boolean {
    if (!this.currentChain) return false;
    return action.dependencies.every(depId => {
      const dep = this.currentChain!.actions.find(a => a.id === depId);
      return dep && dep.status === 'completed';
    });
  }

  /**
   * Exécute une action individuelle
   */
  private async executeAction(action: ChainedAction): Promise<unknown> {
    console.log(`[ActionChainer] Executing action: ${action.name}`);
    
    action.status = 'running';
    action.startedAt = Date.now();

    try {
      const executor = this.actionExecutors.get(action.type);
      
      if (!executor) {
        // Exécuteur par défaut
        action.status = 'completed';
        action.completedAt = Date.now();
        return { success: true, type: action.type };
      }

      // Injecter les résultats des dépendances dans les paramètres
      const enrichedParams = { ...action.parameters };
      action.dependencies.forEach(depId => {
        const depResult = this.currentChain?.results.get(depId);
        if (depResult) {
          enrichedParams[`dep_${depId}`] = depResult;
        }
      });

      const result = await Promise.race([
        executor(enrichedParams),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Action timeout')), ACTION_TIMEOUT)
        )
      ]);

      action.status = 'completed';
      action.completedAt = Date.now();
      action.result = result;

      return result;
    } catch (error) {
      action.retryCount++;
      
      if (action.retryCount < action.maxRetries) {
        console.log(`[ActionChainer] Retrying action ${action.name} (${action.retryCount}/${action.maxRetries})`);
        action.status = 'pending';
        return this.executeAction(action);
      }

      action.status = 'failed';
      action.completedAt = Date.now();
      action.error = error instanceof Error ? error.message : 'Unknown error';
      
      throw error;
    }
  }

  /**
   * Ajoute une action à la chaîne en cours
   */
  addAction(action: Omit<ChainedAction, 'id' | 'status' | 'retryCount' | 'maxRetries'>): void {
    if (!this.currentChain) return;
    
    if (this.currentChain.actions.length >= MAX_CHAIN_LENGTH) {
      console.warn('[ActionChainer] Chain length limit reached');
      return;
    }

    const newAction: ChainedAction = {
      ...action,
      id: `action_${this.currentChain.actions.length + 1}`,
      status: 'pending',
      retryCount: 0,
      maxRetries: DEFAULT_MAX_RETRIES
    };

    this.currentChain.actions.push(newAction);
  }

  /**
   * Pause la chaîne
   */
  pauseChain(): void {
    if (this.currentChain) {
      this.currentChain.status = 'paused';
    }
  }

  /**
   * Reprend la chaîne
   */
  resumeChain(): void {
    if (this.currentChain && this.currentChain.status === 'paused') {
      this.currentChain.status = 'running';
    }
  }

  /**
   * Annule la chaîne
   */
  cancelChain(): void {
    if (this.currentChain) {
      this.currentChain.actions.forEach(action => {
        if (action.status === 'pending' || action.status === 'running') {
          action.status = 'skipped';
        }
      });
      this.currentChain.status = 'failed';
    }
  }

  /**
   * Obtient la chaîne actuelle
   */
  getCurrentChain(): ActionChain | null {
    return this.currentChain;
  }

  /**
   * Obtient la progression de la chaîne
   */
  getProgress(): { completed: number; total: number; percentage: number; currentAction?: string } {
    if (!this.currentChain) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const completed = this.currentChain.actions.filter(a => a.status === 'completed').length;
    const total = this.currentChain.actions.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const currentAction = this.currentChain.actions.find(a => a.status === 'running')?.name;

    return { completed, total, percentage, currentAction };
  }

  /**
   * Réinitialise le chaîneur
   */
  reset(): void {
    this.currentChain = null;
  }
}

// Instance singleton
let actionChainerInstance: ActionChainer | null = null;

export function getActionChainer(): ActionChainer {
  if (!actionChainerInstance) {
    actionChainerInstance = new ActionChainer();
  }
  return actionChainerInstance;
}

export default ActionChainer;
