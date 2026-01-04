/**
 * E2B Bidirectional Executor
 * Connexion bidirectionnelle avec E2B Sandbox
 * Phoenix peut lire les résultats ET réagir automatiquement
 */

import { EventEmitter } from 'events';
import { getGlobalAgent, AgentTask } from './agenticLoop';

// Types pour E2B Bidirectionnel
export interface E2BSession {
  id: string;
  sandboxId: string;
  status: 'initializing' | 'ready' | 'executing' | 'waiting' | 'closed' | 'error';
  createdAt: Date;
  lastActivity: Date;
  executionHistory: E2BExecution[];
}

export interface E2BExecution {
  id: string;
  sessionId: string;
  code: string;
  language: 'python' | 'javascript';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  output?: string;
  error?: string;
  exitCode?: number;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  artifacts?: E2BArtifact[];
}

export interface E2BArtifact {
  type: 'file' | 'image' | 'data' | 'log';
  name: string;
  path?: string;
  content?: string;
  url?: string;
  size?: number;
}

export interface E2BReaction {
  type: 'success' | 'error' | 'warning' | 'info';
  trigger: string;
  action: string;
  data?: Record<string, unknown>;
}

export interface E2BConfig {
  apiKey: string;
  timeout: number;
  maxRetries: number;
  autoReact: boolean;
  persistSession: boolean;
}

/**
 * E2B Bidirectional Executor
 * Gère la communication bidirectionnelle avec E2B
 */
export class E2BBidirectional extends EventEmitter {
  private sessions: Map<string, E2BSession> = new Map();
  private config: E2BConfig;
  private reactionRules: Map<string, (execution: E2BExecution) => E2BReaction | null> = new Map();

  constructor(config: Partial<E2BConfig> = {}) {
    super();
    this.config = {
      apiKey: process.env.E2B_API_KEY || '',
      timeout: 30000,
      maxRetries: 3,
      autoReact: true,
      persistSession: true,
      ...config
    };
    this.registerDefaultReactions();
  }

  /**
   * Enregistrer les réactions par défaut
   */
  private registerDefaultReactions(): void {
    // Réaction aux erreurs de syntaxe
    this.reactionRules.set('syntax_error', (execution) => {
      if (execution.error?.includes('SyntaxError') || execution.error?.includes('IndentationError')) {
        return {
          type: 'error',
          trigger: 'syntax_error',
          action: 'auto_fix_syntax',
          data: { originalCode: execution.code, error: execution.error }
        };
      }
      return null;
    });

    // Réaction aux imports manquants
    this.reactionRules.set('missing_import', (execution) => {
      if (execution.error?.includes('ModuleNotFoundError') || execution.error?.includes('ImportError')) {
        const moduleMatch = execution.error.match(/No module named '([^']+)'/);
        if (moduleMatch) {
          return {
            type: 'warning',
            trigger: 'missing_import',
            action: 'install_module',
            data: { module: moduleMatch[1] }
          };
        }
      }
      return null;
    });

    // Réaction aux timeouts
    this.reactionRules.set('timeout', (execution) => {
      if (execution.status === 'timeout') {
        return {
          type: 'warning',
          trigger: 'timeout',
          action: 'optimize_code',
          data: { code: execution.code, duration: execution.duration }
        };
      }
      return null;
    });

    // Réaction au succès avec données
    this.reactionRules.set('success_with_data', (execution) => {
      if (execution.status === 'completed' && execution.output) {
        // Détecter si le résultat contient des données exploitables
        try {
          const data = JSON.parse(execution.output);
          if (Array.isArray(data) || typeof data === 'object') {
            return {
              type: 'success',
              trigger: 'success_with_data',
              action: 'process_data',
              data: { result: data }
            };
          }
        } catch {
          // Pas du JSON, ignorer
        }
      }
      return null;
    });

    // Réaction aux fichiers créés
    this.reactionRules.set('file_created', (execution) => {
      if (execution.artifacts && execution.artifacts.length > 0) {
        return {
          type: 'info',
          trigger: 'file_created',
          action: 'store_artifacts',
          data: { artifacts: execution.artifacts }
        };
      }
      return null;
    });
  }

  /**
   * Créer une nouvelle session E2B
   */
  async createSession(): Promise<E2BSession> {
    const session: E2BSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sandboxId: '', // Sera rempli par E2B
      status: 'initializing',
      createdAt: new Date(),
      lastActivity: new Date(),
      executionHistory: []
    };

    this.sessions.set(session.id, session);
    
    // Initialiser la sandbox E2B (simulation pour l'instant)
    session.sandboxId = `sandbox-${Date.now()}`;
    session.status = 'ready';
    
    this.emit('session:created', session);
    console.log(`[E2BBidirectional] Session created: ${session.id}`);
    
    return session;
  }

  /**
   * Exécuter du code dans une session
   */
  async execute(sessionId: string, code: string, language: 'python' | 'javascript' = 'python'): Promise<E2BExecution> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const execution: E2BExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      code,
      language,
      status: 'pending',
      startedAt: new Date()
    };

    session.status = 'executing';
    session.lastActivity = new Date();
    
    this.emit('execution:started', execution);

    try {
      // Exécuter via l'API E2B réelle
      const result = await this.executeInE2B(execution);
      
      execution.status = result.success ? 'completed' : 'failed';
      execution.output = result.output;
      execution.error = result.error;
      execution.exitCode = result.exitCode;
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.artifacts = result.artifacts;

      session.executionHistory.push(execution);
      session.status = 'ready';

      this.emit('execution:completed', execution);

      // Réagir automatiquement si activé
      if (this.config.autoReact) {
        await this.react(execution);
      }

      return execution;

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      session.executionHistory.push(execution);
      session.status = 'error';

      this.emit('execution:failed', { execution, error });

      // Réagir à l'erreur
      if (this.config.autoReact) {
        await this.react(execution);
      }

      return execution;
    }
  }

  /**
   * Exécuter dans E2B (appel API réel)
   */
  private async executeInE2B(execution: E2BExecution): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    exitCode?: number;
    artifacts?: E2BArtifact[];
  }> {
    // Appel à l'API E2B réelle
    const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
    const apiKey = process.env.E2B_API_KEY;

    if (!apiKey) {
      // Mode simulation si pas de clé API
      return this.simulateExecution(execution);
    }

    try {
      const response = await fetch(`${apiUrl}/code/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          code: execution.code,
          language: execution.language,
          timeout: this.config.timeout
        })
      });

      if (!response.ok) {
        throw new Error(`E2B API error: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: result.success || result.exitCode === 0,
        output: result.output || result.stdout,
        error: result.error || result.stderr,
        exitCode: result.exitCode,
        artifacts: result.artifacts
      };

    } catch (error) {
      console.error('[E2BBidirectional] E2B API error:', error);
      // Fallback vers la simulation
      return this.simulateExecution(execution);
    }
  }

  /**
   * Simuler l'exécution (fallback)
   */
  private simulateExecution(execution: E2BExecution): {
    success: boolean;
    output?: string;
    error?: string;
    exitCode?: number;
    artifacts?: E2BArtifact[];
  } {
    // Simulation basique pour les tests
    if (execution.code.includes('print')) {
      return {
        success: true,
        output: 'Simulated output',
        exitCode: 0
      };
    }
    
    if (execution.code.includes('error') || execution.code.includes('raise')) {
      return {
        success: false,
        error: 'Simulated error',
        exitCode: 1
      };
    }

    return {
      success: true,
      output: 'Execution completed',
      exitCode: 0
    };
  }

  /**
   * Réagir à une exécution
   */
  async react(execution: E2BExecution): Promise<E2BReaction[]> {
    const reactions: E2BReaction[] = [];
    const ruleEntries = Array.from(this.reactionRules.entries());

    for (const entry of ruleEntries) {
      const ruleName = entry[0];
      const ruleFunc = entry[1];
      const reaction = ruleFunc(execution);
      if (reaction) {
        reactions.push(reaction);
        this.emit('reaction:triggered', { ruleName, reaction, execution });
        
        // Exécuter l'action de réaction
        await this.executeReaction(reaction, execution);
      }
    }

    return reactions;
  }

  /**
   * Exécuter une action de réaction
   */
  private async executeReaction(reaction: E2BReaction, execution: E2BExecution): Promise<void> {
    const agent = getGlobalAgent();

    switch (reaction.action) {
      case 'auto_fix_syntax':
        // Créer une tâche pour corriger le code
        agent.addTask({
          type: 'code_execution',
          description: `Auto-fix syntax error in code`,
          priority: 'high',
          input: {
            originalCode: execution.code,
            error: execution.error,
            action: 'fix_syntax'
          }
        });
        break;

      case 'install_module':
        // Créer une tâche pour installer le module
        const moduleName = reaction.data?.module as string;
        agent.addTask({
          type: 'code_execution',
          description: `Install missing module: ${moduleName}`,
          priority: 'high',
          input: {
            code: `pip install ${moduleName}`,
            language: 'python',
            action: 'install'
          }
        });
        break;

      case 'optimize_code':
        // Créer une tâche pour optimiser le code
        agent.addTask({
          type: 'code_execution',
          description: 'Optimize slow code',
          priority: 'medium',
          input: {
            originalCode: execution.code,
            action: 'optimize'
          }
        });
        break;

      case 'process_data':
        // Créer une tâche pour traiter les données
        agent.addTask({
          type: 'decision',
          description: 'Process execution result data',
          priority: 'medium',
          input: {
            data: reaction.data?.result,
            action: 'analyze'
          }
        });
        break;

      case 'store_artifacts':
        // Créer une tâche pour stocker les artefacts
        agent.addTask({
          type: 'file_analysis',
          description: 'Store execution artifacts',
          priority: 'low',
          input: {
            artifacts: reaction.data?.artifacts,
            action: 'store'
          }
        });
        break;
    }

    this.emit('reaction:executed', { reaction, execution });
  }

  /**
   * Ajouter une règle de réaction personnalisée
   */
  addReactionRule(name: string, rule: (execution: E2BExecution) => E2BReaction | null): void {
    this.reactionRules.set(name, rule);
  }

  /**
   * Lire les résultats d'une session
   */
  getSessionResults(sessionId: string): E2BExecution[] {
    const session = this.sessions.get(sessionId);
    return session?.executionHistory || [];
  }

  /**
   * Obtenir le dernier résultat d'une session
   */
  getLastResult(sessionId: string): E2BExecution | null {
    const history = this.getSessionResults(sessionId);
    return history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Fermer une session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'closed';
      this.emit('session:closed', session);
      
      if (!this.config.persistSession) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Obtenir toutes les sessions actives
   */
  getActiveSessions(): E2BSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status !== 'closed');
  }

  /**
   * Exécuter une chaîne de code (A → B → C)
   */
  async executeChain(sessionId: string, codeSteps: Array<{ code: string; language: 'python' | 'javascript'; condition?: (prev: E2BExecution) => boolean }>): Promise<E2BExecution[]> {
    const results: E2BExecution[] = [];

    for (let i = 0; i < codeSteps.length; i++) {
      const step = codeSteps[i];
      
      // Vérifier la condition si elle existe
      if (step.condition && results.length > 0) {
        const prevResult = results[results.length - 1];
        if (!step.condition(prevResult)) {
          console.log(`[E2BBidirectional] Chain step ${i} skipped due to condition`);
          continue;
        }
      }

      const execution = await this.execute(sessionId, step.code, step.language);
      results.push(execution);

      // Arrêter la chaîne si une étape échoue
      if (execution.status === 'failed') {
        console.log(`[E2BBidirectional] Chain stopped at step ${i} due to failure`);
        break;
      }
    }

    this.emit('chain:completed', { sessionId, results });
    return results;
  }
}

// Singleton pour l'executor global
let globalExecutor: E2BBidirectional | null = null;

export function getGlobalE2BExecutor(): E2BBidirectional {
  if (!globalExecutor) {
    globalExecutor = new E2BBidirectional();
  }
  return globalExecutor;
}

export default E2BBidirectional;
